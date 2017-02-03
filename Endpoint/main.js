'use strict';
// setup azure-event-hubs|express|websocket|nconf
var fs    = require('fs'),
	nconf = require('nconf');
// nconf init
nconf.argv()
   .env()
   .file({ file: __dirname+'/config.json' });
 
// Device to Cloud
var EventHubClient = require('azure-event-hubs').Client;
// Cloud to Device
var Client = require('azure-iothub').Client;
var Message = require('azure-iot-common').Message;
var last_message = null; // global

// app.js
var WebSocketServer = require('websocket').server;
var express         = require('express');
var app             = express();
var server          = app.listen(8080);
var wsServer        = new WebSocketServer({ httpServer : server });

// https://github.com/Azure/azure-event-hubs-node/issues/16#issuecomment-277009617
process.on('uncaughtException', err => {
	console.log('Caught exception: ', err);
});

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
 
// Cloud to Device client
var targetDevice = 'myFirstDevice';
var serviceClient = Client.fromConnectionString( nconf.get("azure_iot_connection") );
 serviceClient.open(function (err) {
   if (err) {
     console.error('Could not connect: ' + err.message);
   } else {
     console.log('Service client connected');
     serviceClient.getFeedbackReceiver(receiveFeedback);
     var message = new Message('Cloud to device message.');
     message.ack = 'full';
     message.messageId = "My Message ID";
     console.log('Sending message: ' + message.getData());
     serviceClient.send(targetDevice, message, printResultFor('send'));
   }
 });
 function receiveFeedback(err, receiver){
   receiver.on('message', function (msg) {
     console.log('Feedback message:');
     console.log(msg.getData().toString('utf-8'));
   });
 }
 function printResultFor(op) {
   return function printResult(err, res) {
     if (err) console.log(op + ' error: ' + err.toString());
     if (res) console.log(op + ' status: ' + res.constructor.name);
   };
 }
// Device to Cloud client
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

//
app.get('/hello', function(req, res){
     var message = new Message(JSON.stringify({"type":"hello", "value":req.query.value}));
     message.ack = 'full';
     message.messageId = "My Message ID";
     console.log('Sending message: ' + message.getData());
     serviceClient.send(targetDevice, message, printResultFor('send'));
	 res.send('{"status":"sent"}');
});
