
// var BinaryServer = require('binaryjs').BinaryServer;
var WebSocketServer = require('ws').Server
var PNG = require('node-png').PNG
var fs = require('fs')
var exec = require('child_process').exec

function lpad(n, width) {
	n += '';
	return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

function FrameDumpServer() {
	this._nextFrameIndex = 0
}

FrameDumpServer.prototype.output = function(outputPath) {
	this._outputPath = outputPath
	return this
}

FrameDumpServer.prototype.listen = function(httpServer, connectApp, endpoint) {
	var self = this

	connectApp.get(endpoint + '/reset', this._reset.bind(this))

	this._ws = new WebSocketServer({
		server: httpServer,
		path: endpoint
	});

	this._ws.on('connection', function(client) {
		console.log('connection', client._socket.bufferSize)
		client.on('message', function(m) {
			console.log('message', m.length)
		})
		client.on('data', function() {
			console.log('data')
		})
		client.send('foo')
	})

	return this
}

FrameDumpServer.prototype._reset = function(_req, res) {
	console.log('reset')

	exec('rm -f ' + this._outputPath + '/*.png', function() {
		exec('mkdir -p ' + this._outputPath, function() {
			res.send(200)
		})
	})
}

FrameDumpServer.prototype._handleFrame = function(buf) {
console.error('_handleFrame', buf.length, type)
	var self = this

	var width = 512//meta.width
	var height = 512//meta.height

	var thisFrame = this._nextFrameIndex++

	var png = new PNG({
		width: width,
		height: height,
		filterType: -1
	});

	buf.copy(png.data)

	var offset = 0

// console.log('_handleFrameStream', thisFrame, meta)

	// stream.on('data', function(d) {
	// 	d.copy(png.data, offset)
	// 	offset += d.length
	// })

	// stream.on('end', function() {
	// 	console.log('end', thisFrame)

		var framePngName = self._outputPath + '/' + lpad(thisFrame, 8) + '.png';

		png.pack()
			.pipe(fs.createWriteStream(framePngName))
			.on('close', function() {
				console.log('close')
			})
	// })

}

exports.FrameDumpServer = FrameDumpServer;

