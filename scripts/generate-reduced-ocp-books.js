const yaml = require('js-yaml')
const fs = require('fs');
const { exec, execSync } = require("child_process");
const path = require('path');

var dotenv = require('dotenv')
var dotenvExpand = require('dotenv-expand')

var myEnv = dotenv.config()
dotenvExpand.expand(myEnv)

const topic_map = process.env.TOPIC_MAP_DIR + '/' + process.env.TOPIC_MAP_FILE;
const distroAdocDir = process.env.REDUCER_OUTPUT_DIR + '/' + process.env.DISTRO + '/' + process.env.PRODUCT_VERSION + '/reduced-build';



let currLevel = 0;

let masterFilespec = '';
let topLevelDir = '';
let bookNodes = [];
let BASE_PORTAL_URL = "https://access.redhat.com/documentation/en-us/"

const generateUrlFromName = (name, delimiter = "_") => {
    // Remove characters that aren't allowed in URLs
    if (!name)
    {
        console.log("null name***********************")
        return null;
    }
    let url = name.replace(/^\.+|[^0-9a-zA-Z _\-.]+/g, "").replace(/\u00A0/g, ' ');
    // Replace spaces with the delimiter
    url = url.replace(/\s+/g, delimiter);
    // Replace multiple delimiters with a single delimiter
    url = url.replace(new RegExp(delimiter + "+", "g"), delimiter);
    return url.toLowerCase();
}

const buildPortalUrl = (bookName) => {
    const product = process.env.PRODUCT_TITLE
    const version = process.env.PRODUCT_VERSION

    return (
        generateUrlFromName(product) +
        "/" +
        generateUrlFromName(version) +
        "/html-single/" +
        generateUrlFromName(bookName) +
        "/"
    );
}

const findBookNameByDir = (targetDir) => {
    for (let book of bookNodes) {
        if (book.Dir === targetDir) {
            return book.Name;
        }
    }
    return null; // Return null if the book name is not found
}

// Function to delete the existing file if present
const deleteExistingFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.error('Error deleting the existing file:', err);
        }
    }
};

// Function to create a file and its parent directories recursively
const createDirectoriesIfNeeded = (filePath) => {
    // Extract the directory path from the file path
    const directoryPath = path.dirname(filePath);

    // Recursively create the parent directories
    fs.mkdir(directoryPath, { recursive: true }, (err) => {
        if (err) {
            console.error('Error creating directories:', err);
        }
    });
};



try {
    let fileContents = fs.readFileSync(topic_map, 'utf8');
    //let fileContents = fs.readFileSync('/home/gmcgoldr/yamltest/_topic_map_short.yml', 'utf8');
    let data = yaml.loadAll(fileContents);



    data.forEach(topic => {
        if (!topic.Distros || topic.Distros.includes(process.env.DISTRO)) {
            let bookNode = {
                Name: topic.Name,
                Dir: topic.Dir,
                Distros: topic.Distros
            };
            bookNodes.push(bookNode);
        }
    });

    console.log(bookNodes);

    for (var topic of data) {
        processTopic(topic, '');
    }

    //console.log(data);
} catch (e) {
    console.log(e);
}

function processTopic(topic, dir) {

    let topicDir = '';

    currLevel++;

    if (topic.Dir) {
        if (!topic.Distros || topic.Distros.includes(process.env.DISTRO)) {
            if (dir.length == 0)
                topicDir = topic.Dir
            else
                topicDir = dir + "/" + topic.Dir;

            if (currLevel == 1) {

                topLevelDir = topic.Dir;

                masterFilespec = process.env.INPUT_DIR + '/' + topic.Dir + '/' + 'master.adoc';

                console.log("masterFilespec: " + masterFilespec)


                try {
                    deleteExistingFile(masterFilespec);
                    createDirectoriesIfNeeded(masterFilespec);
                    fs.appendFileSync(masterFilespec, '= ' + topic.Name + '\n\n')

                    // TODO add attributes here
                } catch (err) {
                    console.error('Error creating the directory:', err);
                }

            }
            else {
                fs.appendFileSync(masterFilespec, '='.repeat(currLevel) + ' ' + topic.Name + '\n')
            }

            //console.log("Category: " + topic.Name)

            for (var subtopic of topic.Topics) {
                processTopic(subtopic, topicDir)
            }

            if (currLevel == 1) {
                var outDir = distroAdocDir + '/' + topicDir;
                var outFile = outDir + "/master-reduced.adoc";


                console.log('masterFilespec: ' + masterFilespec)
                console.log('outFile: ' + outFile)

                var cmd = "asciidoctor-reducer --attribute=" + process.env.DISTRO + " --attribute=product-title='" + process.env.PRODUCT_TITLE + "' --attribute=product-version=" + process.env.PRODUCT_VERSION + " -r asciidoctor/reducer/include_mapper -o "
                cmd += outFile + " " + masterFilespec;



                execSync(cmd, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`error: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        return;
                    }
                    //console.log(`stdout: ${stdout}`);
                });

                // Read the content of the generated XML file
                let adocContent = fs.readFileSync(outFile, 'utf-8');


                const LINKS_RE = new RegExp(
                    "(?:xref|link):([\\./\\w_-]*/?[\\w_.-]*\\.(?:html|adoc))?(#[\\w_-]*)?(\\[.*?\\])",
                    "gm"
                );


                let currentBookName = findBookNameByDir(topicDir)

                //console.log('currentBookName: ' + currentBookName)

                let links = adocContent.matchAll(LINKS_RE);

                for (const link of links) {
                    let link_text = link[0];
                    let link_file = link[1];
                    let link_anchor = link[2];
                    let link_title = link[3];

                    //console.log('link_text: ' + link_text + ' link_file: ' + link_file)
                    //console.log('link_anchor: ' +  link_anchor + ' link_title: ' + link_title)

                    // sanity check - is this a link to an external site?
                    // apparently the link macro CAN be used for internal links too, so just testing for http
                    // NOTE: a docs.openshift.com link would not process here correctly, anyway, so let it pass through
                    if (link_text.includes("http:") || link_text.includes("https:")) {
                        continue;
                    }

                    let fixed_link = ""; // setting the scope of fixed_link outside the if statements

                    if (link_file !== undefined) {
                        let fixed_link_file = link_file.replace(".html", ".adoc");
                        //let fixed_link_file_abs = path.join(process.env.INPUT_DIR + '/' + topic.Dir, fixed_link_file);

                        //console.log('fixed_link_file_abs: ' + fixed_link_file_abs)


                        //let full_relative_path = path.relative(process.env.INPUT_DIR, fixed_link_file_abs);

                        let full_relative_path = fixed_link_file.replace(/^(\.\.\/)+/, "");
                        console.log('full_relative_path: ' + full_relative_path)

                        if (full_relative_path.startsWith("..")) {
                            console.log(`ERROR : link pointing outside source directory? ${link_file}`);
                            continue;
                        }
                        let split_relative_path = full_relative_path.split("/");
                        let book_dir_name = split_relative_path[0];

                        //console.log('book_dir_name: ' + book_dir_name)

                        let book_name = findBookNameByDir(book_dir_name)

                        //console.log('book_name: ' + book_name)

                        if (book_name === currentBookName) {
                            if (link_anchor === undefined) {
                                fixed_link = "xref:" + /*file_to_id_map[fixed_link_file_abs] + */ link_title;
                            } else {
                                fixed_link = "xref:" + link_anchor.replace("#", "") + link_title;
                            }

                        } else {
                            let fixed_link_file = BASE_PORTAL_URL + buildPortalUrl(book_name);

                            //console.log('fixed_link_file: ' + fixed_link_file)
                            if (link_anchor === undefined) {
                                // ${file_to_id_map[fixed_link_file_abs]}
                                fixed_link = `link:${fixed_link_file}#${link_title}`;
                            } else {
                                fixed_link = `link:${fixed_link_file}${link_anchor}${link_title}`;
                            }
                        }


                        //console.log('fixed_link: ' + fixed_link)


                    }
                    else {
                        fixedLink = "xref:" + link_anchor.replace("#", "") + link_title;
                    }

                    adocContent = adocContent.replace(link_text, fixed_link)



                }

                // Write the modified content back to the file
                fs.writeFileSync(outFile, adocContent, 'utf-8');



                var docinfoFile = outDir + "/docinfo.xml";

                const docinfoContent = `<title>${topic.Name}</title>
<productname>{product-title}</productname>
<productnumber>{product-version}</productnumber>
<subtitle>Enter a short description here.</subtitle>
<abstract>
    <para>A short overview and summary of the book's subject and purpose, traditionally no more than one paragraph long.</para>
</abstract>
<authorgroup>
    <orgname>Red Hat OpenShift Documentation Team</orgname>
</authorgroup>
<xi:include href="Common_Content/Legal_Notice.xml" xmlns:xi="http://www.w3.org/2001/XInclude" />
`;

                fs.writeFileSync(docinfoFile, docinfoContent, 'utf-8');

                var outXMLFile = outDir + "/master-reduced.xml";
                var cmd2 = "asciidoctor" + " -r asciidoctor/reducer/include_mapper" + " --attribute=idseparator=-" + " --attribute=docinfo='shared,private' --attribute=doctype=book " + " --attribute=product-title='" + process.env.PRODUCT_TITLE + "' --attribute=product-version=" + process.env.PRODUCT_VERSION + " --attribute=data-uri! -o " + outXMLFile + ' -b docbook ' + outFile;

                console.log('outXMLFile: ' + outXMLFile)

                execSync(cmd2, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`error: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        return;
                    }


                });


                console.log("got here")
                // Read the content of the generated XML file
                let xmlContent = fs.readFileSync(outXMLFile, 'utf-8');

                //console.log(xmlContent)
                // Replace xl:href= with xlink:href=
                xmlContent = xmlContent.replace(/link\s+xl:href/g, 'link xlink:href');

                xmlContent = xmlContent.replace(/xmlns:xl=/g, 'xmlns:xlink=')
                xmlContent = xmlContent.replace(' xml:lang="en"', '') 
                //console.log("*****************" + xmlContent)

                // Replace the initial <?xml version="1.0" encoding="UTF-8"?>
                xmlContent = xmlContent.replace(
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE book [
<!ENTITY % sgml.features "IGNORE">
<!ENTITY % xml.features "INCLUDE">
<!ENTITY % DOCBOOK_ENTS PUBLIC "-//OASIS//ENTITIES DocBook Character Entities V4.5//EN" "http://www.oasis-open.org/docbook/xml/4.5/dbcentx.mod">
%DOCBOOK_ENTS;
]>`
                );



                // Write the modified content back to the file
                fs.writeFileSync(outXMLFile, xmlContent, 'utf-8');

            }

        }
    }
    else {
        if (!topic.Distros || topic.Distros.includes(process.env.DISTRO)) {
            processAdoc(dir, topic.File);
        }
    }

    currLevel--;

}

function processAdoc(dir, file) {

    const index = dir.indexOf(topLevelDir) + topLevelDir.length + 1;
    let includeDir = dir.substring(index);

    includeDir = includeDir === "" || includeDir.endsWith("/") ? includeDir : includeDir + "/";

    let offset = currLevel - 1
    fs.appendFileSync(masterFilespec, 'include::' + includeDir + file + '.adoc[leveloffset=+' + offset + ']\n\n')

}