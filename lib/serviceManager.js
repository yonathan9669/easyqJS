//Own Modules
var Handle = require('./handle');

var Services = function (settings, db) {
    this.url = settings.url;
    this.queryHandle = new Handle(db);

    var self = this;

    settings.services.forEach(function (service) {
        if (process.env.VERBOSE) {
            console.log("//----------------------------------------//");
            console.log("Name = " + service.name);
            console.log("Description = " + service.description);
            console.log("Service = http://" + self.url + "/" + service.name);
        }

        self.queryHandle.add(service.name, {
            sql: service.sql,
            params: service.params
        });

        if (process.env.VERBOSE) {
            console.log("\t\t||----------------------------------------||");
            console.log("\t\tRequired Values: ");
            service.params.forEach(function (value) {
                console.log("\t\t - Name: " + value.name +
                "\t\t| Type: " + value.type +
                "\t\t| Description: " + value.description);
            });
        }
    });
};

Services.prototype.handleService = function (path, data, callback) {
    if (!this.queryHandle.execute(this._getService(path), data, callback))
        callback(404);
};

Services.prototype._getService = function (path) {
    path = path.split('/');
    return path[path.length - 1];
};

module.exports = Services;