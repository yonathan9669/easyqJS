var mysql = require('mysql');
var events = require("events");

var DB = function(settings){
	this.settings = settings;
};

DB.prototype = new events.EventEmitter();

DB.prototype.connect = function(){
    var db = this;
    if(db.connection && process.env.VERBOSE)
        console.log(db.connection.state);
    var connection = (db.isConnect())? db.connection : mysql.createConnection(db.settings);

    if(connection.state !== "authenticated") {
        connection.connect(function (err) {
            if (err) {
                //console.error('error connecting: ' + err.stack);
                db.emit('error', err);
            } else {
                //console.log('connected as id ' + connection.threadId);
                db.emit('connected', connection);
            }
        });
    } else
        db.emit('connected', connection);

    this.connection = connection;
};

DB.prototype.closeConnection = function(){
	var db = this;

    if(db.isConnect()) {
        db.connection.end(function (err) {
            if (err) {
                //console.error('close error : ' + err.stack);
                db.emit('error', err);
            } else {
                //console.log('connection successfully closed');
                db.emit('closed');
            }
        });
    } else {
        var err =   (db.isDisconnect()) ?  "Connection already finished" :
                    (db.connection) ? "Connection is not established, cannot disconnect" : "Is not Connected";
        db.emit('error', err);
    }
};

//Any Kind of QUERY
DB.prototype.query = function (query, values, callback, stream) {
    var db = this;

    var result = db.connection.query(query, values);

    result.on('error', function (err) {
        // Handle error, an 'end' event will be emitted after this as well
        db.emit('error', err, callback);
    }).on('fields', function (fields) {
        // the field packets for the rows to follow
    }).on('result', function (row) {
        // Pausing the connnection is useful if your processing involves I/O
        if (stream) {
            db.connection.pause();
            if(process.env.VERBOSE)
                console.log("Processing row...");
        }

        db.emit('query_row', row, stream, function () {
            if (stream) {
                db.connection.resume();
                if(process.env.VERBOSE)
                    console.log("Row Processed!..");
            }
        });

    }).on('end', function () {
        // all rows have been received
        db.emit('query_end', result.sql, callback);
    });
};


DB.prototype.getState = function(){
    return this.connection.state;
};

DB.prototype.getThreadId = function(){
    return this.connection.threadId;
};

DB.prototype.isConnect = function(){
    return this.connection && this.getState() === 'authenticated';
};

DB.prototype.isDisconnect = function() {
    return this.connection && this.getState() === 'disconnected';
};

module.exports = DB;