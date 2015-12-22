var process = require("process");
var freedom = require("freedom-for-node");
var randgen = require('randgen');
var request = require('request');
var argv = require('yargs')
    .usage('Usage: $0 [-m mean] [-v variance] [-n num_samples] [-s] [-u host] [-p path] [-V variable]')
    .default('mean', 9)
    .default('variance', 4)
    .default('samples', 10)
    .default('submit', false)
    .default('host', 'https://www.uproxy.org')
    .default('path', 'submit-rappor-stats')
    .default('variable', 'test-v1')
    .alias('m', 'mean')
    .alias('v', 'variance')
    .alias('n', 'samples')
    .alias('h', 'host')
    .alias('p', 'path')
    .alias('V', 'variable')
    .alias('s', 'submit')
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

freedom.freedom("node_modules/freedomjs-anonymized-metrics/anonmetrics.json", {}).then(
    function (rappor_proto) {
        var metrics_def = {"name":"TestMetrics",
                           "definition": {}};
        for (var i = 0; i < argv.samples; i++) {
            // TODO: use my modified max-based log metics, and define a max here.
            metrics_def.definition["test-" + (1 + i)] = {
                "type": "logarithmic",
                "base": 2,
                "num_bloombits": 256,
                "num_hashes": 2,
                "num_cohorts": 64,
                "prob_p": 0.5,
                "prob_q": 0.75,
                "prob_f": 0.5,
                "flag_oneprr": true
            };
        }
        var metric = new rappor_proto(metrics_def);

        var all_reports = [];
        var samples = [];
        for (var i = 0; i < argv.samples; i++) {
            var sample = Math.ceil(randgen.rnorm(argv.mean, argv.variance));
            samples.push(sample);
            all_reports.push(metric.report("test-" + (1 + i), sample));
        };
        Promise.all(all_reports).then(function() {
            metric.retrieve().then(
                function(val) {
                    console.log("Samples: " + samples);
                    for (var k in val) {
                        console.log("  " + val[k]);
                    }
                    if (argv.submit) {
                        post_values(val);
                    } else {
                        process.exit(0);
                    }
                });
        });
    });


