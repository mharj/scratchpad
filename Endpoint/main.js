'use strict';
// setup azure-event-hubs|express|websocket|nconf
var fs    = require('fs'),
	nconf = require('nconf');
// nconf init
nconf.argv()
   .env()
   .file({ file: __dirname+'/config.json' });
 
var EventHubClient = require('azure-event-hubs').Client;
var last_message = null; // global

// app.js
var WebSocketServer = require('websocket').server;
var express         = require('express');
var app             = express();
var server          = app.listen(8080);
var wsServer        = new WebSocketServer({ httpServer : server });

app.use(express.static(__dirname + '/static')); // for static files

function originIsAllowed(origin) { // TODO: put logic here to detect whether the specified origin is allowed. 
	return true;
}

// websocket
wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    var connection = request.accept('iot-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');
	// send initial data
	if ( last_message !== null ) {
		connection.sendUTF(JSON.stringify(last_message));
	}
/*  connection.on('message', function(message) { ... });*/
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});
 

// Azure IoT
var client = EventHubClient.fromConnectionString( nconf.get("azure_iot_connection") );
client.open()
	.then(client.getPartitionIds.bind(client))
	.then(function (partitionIds) {
		return partitionIds.map(function (partitionId) {
			return client.createReceiver('$Default', partitionId, { 'startAfterTime' : Date.now()}).then(function(receiver) {
				console.log('Created partition receiver: ' + partitionId);
				receiver.on('errorReceived', printError);
				receiver.on('message', printMessage);
			});
		});
	})
	.catch(printError);
	 
var printError = function (err) {
	console.log(err.message);
};

var printMessage = function (message) {
	last_message = message.body;
	wsServer.broadcastUTF(JSON.stringify(message.body));
};
