var process = require("process");
var freedom = require("freedom-for-node");

freedom.freedom("module.json", {}).then(
    function (proto) {
        var root = new proto();
        root.on('event', function(data) {
        var rappor = freedom["rappor"];
            var metrics = new rappor.metrics({"name":"test-v1",
                                              "definition": {
                                                  // TODO: use my modified max-based log metics, and define a max here.
                                                  "test-v1": {
                                                      "type": "logarithmic",
                                                      "base": 2
                                                  }}});


            metrics.report("test-v1", 4).then(
                function () {
                    metrics.retrieve().then(function(val) {
                        console.log(val);
                    });
                });
        });
});


