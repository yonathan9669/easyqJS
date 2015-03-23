/**
 * Created by yonathanmorales on 23/3/15.
 */
var events = require("events");
var semaphore = require('Semaphore')(1);
var index = 0;

var Handle = function(db, cache_timeout) {
    var self = this;
    this.db = db;
    this.queries = [];
    this.cache = [];
    this.timeout = cache_timeout || 30000;
    this.executing = {};

    //Events Listeners
    this.db.on('connected', function (connection) {
        if(process.env.VERBOSE) {
            console.log("--------------DBMessage ID:" + db.getThreadId() + "--------------");
            console.log("The connection is " + db.getState());
            console.log("Connected = " + db.isConnect());
        }
    }).on('query_row', function (row, stream, callback) {
        if (process.env.VERBOSE) {
            //console.log("index: " + index + JSON.stringify(row, undefined, 4));
        }

        self.executing.data[index++] = row;

        if (stream)
            return callback();
    }).on('query_end', function (query, callback) {
        if(process.env.VERBOSE) {
            console.log('Query= "' + query + '" Completed...');
        }

        callback(null, JSON.stringify(self.executing));
        self._setCache();
        semaphore.leave();
    }).on('closed', function () {
        if(process.env.VERBOSE) {
            console.log("--------------DBMessage ID:" + db.getThreadId() + "--------------");
            console.log("The connection is " + db.getState());
            console.log("Disconnected = " + db.isDisconnect());
        }
    }).on('error', function (err, callback) {
        if(process.env.VERBOSE) {
            console.log("An error has occurred");
            console.error(err);
        }
        callback(500);
        semaphore.leave();
    });
};

Handle.prototype = new events.EventEmitter();

Handle.prototype.add = function(name, query){
    this.cache[name] = {
        valid: 0,
        params: [],
        data: []
    };

    this.queries[name] = query;
};

Handle.prototype.execute = function(name, data, callback) {
    var self = this;
    var query = self.queries[name];

    if(process.env.VERBOSE) {
        console.log(semaphore);
        console.log(self.queries);
    }

    if (query) {
        semaphore.take(function () {
            self.executing.name = name;
            self.executing.status = "Invalid Call";
            self.executing.params = [];
            self.executing.data = [];

            if (data = self._verifyParam(query.params, data)) {
                self.executing.params = data;
                if (Date.now() <= self.cache[name].valid && self._verifyParam(self.cache[name].params, data, true)) {
                    self.executing.status = "Cache";
                    self.executing.data = self.cache[name].data;

                    callback(null, JSON.stringify(self.executing));
                    semaphore.leave();
                } else {
                    self.executing.status = "OK";
                    self.db.connect();
                    index = 0;
                    self.db.query(query.sql, data, callback);
                }
            } else {
                self.executing.params = query.params;
                callback(412, JSON.stringify(self.executing));
                semaphore.leave();
            }
        });
    }

    return query;
};

Handle.prototype._verifyParam = function(params, data, cache) {
    if(process.env.VERBOSE) {
        console.log("Cache = " + cache);
        console.log(JSON.stringify(params, undefined, 4));
        console.log(JSON.stringify(data, undefined, 4));
    }

    if(cache) {
        for (var j = 0; j < data.length; j++)
            if (params[j] !== data[j])
                return false;
        return true;
    }

    var len = Object.keys(data).length;
    if (len !== params.length)
        return false;

    var queue = [];
    for(var i = 0; i < len; i++) {
        var param = params[i];
        queue[i] = data[param.name];
        if (!queue[i])
            return false;
    }

    if(process.env.VERBOSE) {
        console.log(JSON.stringify(queue, undefined, 4));
    }

    return queue;
};

Handle.prototype._setCache = function(){
    if(process.env.VERBOSE) {
        console.log("Setting up cache for next " + this.timeout/1000 + " SECONDS");
    }

    this.cache[this.executing.name].valid = Date.now() + this.timeout;
    this.cache[this.executing.name].data = this.executing.data;
    this.cache[this.executing.name].params = this.executing.params;

    if(process.env.VERBOSE) {
        console.log("Data cached for service " + this.executing.name);
    }
};

module.exports = Handle;