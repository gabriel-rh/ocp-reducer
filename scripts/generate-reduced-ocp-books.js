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

        if (dir.length == 0)
            topicDir = topic.Dir
        else
            topicDir = dir + "/" + topic.Dir;
        
        if (currLevel == 1) {

            topLevelDir = topic.Dir;

            masterFilespec = process.env.INPUT_DIR + '/' +  topic.Dir + '/' + 'master.adoc';

            console.log("masterFilespec: " + masterFilespec)


            try {
                deleteExistingFile(masterFilespec);
                createDirectoriesIfNeeded(masterFilespec);
                fs.appendFileSync(masterFilespec, '= ' + topic.Name +'\n\n')

                // TODO add attributes here
            } catch (err) {
                console.error('Error creating the directory:', err);
            }

        }
        else {
            fs.appendFileSync(masterFilespec, '='.repeat(currLevel) + ' ' + topic.Name +'\n')
        }

        //console.log("Category: " + topic.Name)

        for (var subtopic of topic.Topics) {
            processTopic(subtopic, topicDir)
        }

        if (currLevel == 1) {
            var outDir =  distroAdocDir + '/' + topicDir;
            var outFile = outDir + "/master-reduced.adoc";
        

            console.log('masterFilespec: ' + masterFilespec)
            console.log('outFile: ' + outFile)
        
            var cmd = "asciidoctor-reducer --attribute=" +  process.env.DISTRO + " -r asciidoctor/reducer/include_mapper -o "
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

    const index = dir.indexOf(topLevelDir) + topLevelDir.length+1;
    let includeDir = dir.substring(index);

    includeDir = includeDir === "" ||includeDir.endsWith("/") ? includeDir : includeDir + "/";

    let offset = currLevel - 1
    fs.appendFileSync(masterFilespec, 'include::' + includeDir + file + '.adoc[leveloffset=+' + offset + ']\n\n')

}