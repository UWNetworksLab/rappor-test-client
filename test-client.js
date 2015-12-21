var process = require("process");
var freedom = require("freedom-for-node");
var randgen = require('randgen');
var argv = require('yargs')
    .usage('Usage: $0 [-m mean] [-v variance] [-n num_samples]')
    .default('mean', 9)
    .default('variance', 4)
    .default('samples', 10)
    .alias('m', 'mean')
    .alias('v', 'variance')
    .alias('n', 'samples')
    .argv;

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
                    console.log(val);
                    process.exit(0);
                });
        });
    });


