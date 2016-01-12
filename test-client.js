var process = require("process");
var freedom = require("freedom-for-node");
var randgen = require('randgen');
var request = require('request');
var fs = require('fs');

var argv = require('yargs')
    .usage('Usage: $0 [-h] [-m mean] [-v variance] [-n num_samples] [-s] [-p paramfile] [-f savefile] [-H host] [-P path] [-V variable]')
    .default('mean', 9)
    .default('variance', 4)
    .default('samples', 10)
    .default('submit', false)
    .default('host', 'https://www.uproxy.org')
    .default('path', 'submit-rappor-stats')
    .default('variable', 'test-v1')
    .default('paramfile', 'params.csv')
    .alias('h', 'help')
    .help('help')
    .alias('m', 'mean')
    .alias('v', 'variance')
    .alias('n', 'samples')
    .alias('H', 'host')
    .alias('P', 'path')
    .alias('V', 'variable')
    .alias('s', 'submit')
    .alias('f', 'savefile')
    .alias('p', 'paramfile')
    .argv;

function post_values(val) {
    var path = argv.host + "/" + argv.path;
    console.log("Posting " + Object.keys(val).length + " items to " + path);
    function post_value_n(idx) {
        var params = {};
        params[argv.variable] = val[Object.keys(val)[idx]];
        var param_str = JSON.stringify(params);
        var options = {
            method: 'post',
            body: params,
            json: true,
            url: path
        }
        console.log("Posting " + JSON.stringify(params));
        request(options, function (err, res, body) {
            if (err) {
                inspect(err, 'error posting json')
                return
            }
            var headers = res.headers
            var statusCode = res.statusCode
            if (statusCode != 200) {
                console.log("Failed: " + JSON.stringify(res));
            } else if ((1+idx) < Object.keys(val).length) {
                post_value_n(idx + 1);
            } else {
                process.exit(0);
            }
        })
    }
    post_value_n(0);
}

function save_values(vals, samples, outputFileName) {
    var stats = [];
    var date = new Date();
    var hourFields = [ date.getFullYear(), 1+date.getMonth(), date.getDate(),
                      1+date.getHours(), date.getMinutes(), date.getSeconds() ]
    var basis = parseInt('cab73c58', 16);
    var keys = Object.keys(vals);
    for (var i = 0; i < keys.length; i++) {
        stat = { 'submission_id' : '8cbd24dc-45b6-41b3-b9d5-1a7d' + (basis + i).toString(16),
                 'metric' : 'test-v1',
                 'hour': hourFields,
                 'value': vals[keys[i]] }
        stats.push(stat);
    }
    values = { 'count': stats.length, 'rapporStats': stats };
    fs.writeFileSync(outputFileName, JSON.stringify(values));
    fs.writeFileSync(outputFileName.split(".")[0] + ".real", JSON.stringify(samples));
}

var READ_SIZE = 16384;
var param_bloombits, param_hashes, param_cohorts, param_prob_p, param_prob_q, param_prob_f;

console.log("Opening", argv.paramfile);
fs.read(fs.openSync(argv.paramfile, 'r'), new Buffer(READ_SIZE), 0, READ_SIZE, null,
        function (e,bytesRead, paramBuf) {
            var paramText = paramBuf.toString('utf8', 0, bytesRead);
            // values are k,h,m,p,q,f
            var varNames = paramText.split('\n')[0].split(',');
            var params = paramText.split('\n')[1].split(',');
            param_bloombits = parseInt(params[varNames.indexOf('k')]);
            param_hashes = parseInt(params[varNames.indexOf('h')]);
            param_cohorts = parseInt(params[varNames.indexOf('m')]);
            param_prob_p = parseFloat(params[varNames.indexOf('p')]);
            param_prob_q = parseFloat(params[varNames.indexOf('q')]);
            param_prob_f = parseFloat(params[varNames.indexOf('f')]);
            console.log(argv.paramfile,":\n", paramText);
            // Now that we have the parameters, use them.
            generateData();
});

function generateData() {
    freedom.freedom("node_modules/freedomjs-anonymized-metrics/anonmetrics.json", {}).then(
        function (rappor_proto) {
            console.log("starting data generation");
            var metrics_def = {"name":"TestMetrics",
                               "definition": {}};
            metrics_def.definition["test-v1"] = {
                "type": "logarithmic",
                "base": 2,
                "num_bloombits": param_bloombits,
                "num_hashes": param_hashes,
                "num_cohorts": param_cohorts,
                "prob_p": param_prob_p,
                "prob_q": param_prob_q,
                "prob_f": param_prob_f,
                "flag_oneprr": true
            };
            var metrics = [];
            for (var i = 0; i < argv.samples; i++) {
                metrics.push(new rappor_proto(metrics_def));
            }

            var all_reports = [];
            var samples = [];
            for (var i = 0; i < argv.samples; i++) {
                var sample;
                do {
                    sample = Math.ceil(randgen.rnorm(argv.mean, argv.variance));
                } while (sample < 0);
                samples.push(sample);
                all_reports.push(metrics[i].report("test-v1", sample));
            };
            Promise.all(all_reports).then(function() {
                Promise.all(metrics.map(function(met) { return met.retrieve(); })).then(
                    function(val_kvs) {
                        console.log("Samples: " + samples);
                        var val = val_kvs.map(function(m) { return m["test-v1"];});
                        for (var k in val) {
                            console.log("  " + val[k]);
                        }
                        if (argv.savefile) {
                            save_values(val, samples, argv.savefile);
                        }
                        if (argv.submit) {
                            post_values(val);
                        } else {
                            process.exit(0);
                        }
                    });
            });
        });
};

