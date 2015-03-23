var options = processArguments(process.argv.slice(2));

if(options.sourceFile) {
    var fs = require('fs');
    var cool = require('cool-ascii-faces');
    var appPath = __dirname;

//Web Modules
    var express = require('express');
    var bodyParser = require('body-parser');
    var url = require('url');
    var app = express();

//Activating Settings
    var getCalls = 0;
    var postCalls = 0;

    var settings = JSON.parse(fs.readFileSync(options.sourceFile));

    var response_head = {'Content-Type': 'application/json'};
    if (settings.CORS.allow_remote)
        response_head['Access-Control-Allow-Origin'] = settings.CORS.routes;

    if (process.env.VERBOSE) {
        console.log(settings);
        console.log(response_head);
    }

//Own Modules
    var Database = require(appPath + '/lib/db');
    var Services = require(appPath + '/lib/serviceManager');
    var db = new Database(settings.db);
    var serviceManager = new Services(settings, db);

//Setting up Web Server
    app.set('port', (settings.port || options.port || process.env.PORT || 9001));
    app.use(express.static(appPath + '/public'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
        extended: true
    }));

    app.get('/', function (request, response) {
        getCalls++;
        var result = '';
        var rData = url.parse(request.url, true);
        var times = process.env.TIMES || 5;

        if (process.env.VERBOSE) {
            console.log("//---------------------GET Request" + getCalls + "---------------------//");
            console.log(JSON.stringify(rData, undefined, 4));
        }
        for (i = 0; i < times; i++)
            result += (i + 1) + ".- " + cool() + "<br/>";

        response.send(result);
    });

    app.post('*', function (request, response) {
        postCalls++;
        var data = request.body;
        var rData = url.parse(request.url, true);

        if (process.env.VERBOSE) {
            console.log("//---------------------POST Request#" + postCalls + "---------------------//");
            console.log(JSON.stringify(rData, undefined, 4));
        }

        serviceManager.handleService(rData.pathname, data, function (err, result) {
            if (err) {
                if (err == 404) {
                    //Servicio no encontrado
                    response.writeHead(404);
                    response.end();
                }
                else {
                    //Error en el servicio
                    response.writeHead(err);
                    response.end(result);
                }
            } else {
                response.writeHead(200, response_head);
                response.end(result);
            }
        });
    });

    app.listen(app.get('port'), function () {
        console.log("Express app is running at localhost:" + app.get('port'))
    });
} else{
    if(options.help)
        printHelp();
    else
        console.log("The app need a file to serve, use -h to help");
}
//---------------------------------------------------------------------------------------
//Utilities functions
function processArguments(arguments) {
    var options = {};

    if (arguments.length) {
        for(var i = 0; i < arguments.length; i++){
            arg = arguments[i];

            switch (arg) {
                case "-v":
                    options.VERBOSE = process.env.VERBOSE = true;
                    break;
                case "-s":
                    options.sourceFile = arguments[i + 1];
                    break;
                case "-p":
                    options.port = parseInt(arguments[i + 1]);
                    break;
                case "-h":
                    options.help = true;
            }
        }

        //Default values

    }

    if (process.env.VERBOSE) {
        console.log("-----------------Program Options-----------------");
        console.log(JSON.stringify(options, undefined, 4));
    }

    return options;
}

function printHelp(){
    console.log("//---------------------------//");
    console.log("easyqJS - Help - WELCOME");
    console.log("");
    console.log("Use: node app.js [options] -s your_services.json");
    console.log("");
    console.log("\tOptions: ");
    console.log("\t-h\t\tPrint this help");
    console.log("\t-v\t\tActivate VERBOSE mode in the app");
    console.log("\t-p\t\tSet a port for runtime server - DEFAULT:9001");
    console.log("");
    console.log("Example: node app.js -p 8080 -s services.json");
    console.log("//---------------------------//");
}