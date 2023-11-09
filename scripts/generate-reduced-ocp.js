const yaml = require('js-yaml')
const fs = require('fs');
const { exec,execSync } = require("child_process");


var dotenv = require('dotenv')
var dotenvExpand = require('dotenv-expand')

var myEnv = dotenv.config()
dotenvExpand.expand(myEnv)

const topic_map = process.env.TOPIC_MAP_DIR + '/' + process.env.TOPIC_MAP_FILE;
const distroAdocDir = process.env.REDUCER_OUTPUT_DIR + '/' +  process.env.DISTRO + '/' + process.env.PRODUCT_VERSION;

try {
    let fileContents = fs.readFileSync(topic_map, 'utf8');
    //let fileContents = fs.readFileSync('/home/gmcgoldr/yamltest/_topic_map_short.yml', 'utf8');
    let data = yaml.loadAll(fileContents);

    for (var topic of data)
    {
        processTopic(topic, '');
    }

    //console.log(data);
} catch (e) {
    console.log(e);
}

function processTopic(topic, dir)
{

    if (topic.Dir)
    {
        var topicDir = dir + "/" + topic.Dir;
        var outputDir = distroAdocDir + topicDir;

        if (!fs.existsSync(outputDir)){
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log("Category: " + topic.Name)
        for (var subtopic of topic.Topics)
            processTopic(subtopic, topicDir)
    }
    else
    {

        processAdoc(dir, topic.File);
    }



}

function processAdoc(dir, file)
{
    var outDir =  distroAdocDir + dir;
    var outFile = outDir + "/" + file + ".adoc";

    var adocFile = process.env.INPUT_DIR + dir + "/" + file + ".adoc"

    var cmd = "asciidoctor-reducer -r asciidoctor/reducer/include_mapper -o "
    cmd += outFile + " " + adocFile; 

    console.log(cmd);

    console.log("generating " + outFile) 

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