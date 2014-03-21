"use strict";

var WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({port: 5000});

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        console.log('received: %s', message[1]);
        console.log('array', message instanceof Float32Array)
        console.log('array', new Float32Array(message[1]))
    });
    ws.send('something');
});
