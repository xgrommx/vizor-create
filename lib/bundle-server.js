var fs = require('fs');
var when = require('when');
var node = require('when/node');
var browserify = require('browserify');
var through = require('through');

function BundleServer(pluginsPath) {
	this._pluginsPath = pluginsPath
}

BundleServer.prototype.listen = function(expressApp) {
	var self = this;

	expressApp.use('/_/all.plugins.js', function(req, res, next) {
		var throughStream = through()
		throughStream.setMaxListeners(0)
		throughStream.pause()

		node.call(fs.readdir, self._pluginsPath)
		.then(function(plugins) {
			return when.map(plugins.filter(function(plg) {
					return /^.*\.js$/.test(plg)
				}),
				function(plugin) {
					var dfd = when.defer()
					fs.createReadStream(self._pluginsPath + plugin)
						.on('end', function() {
							dfd.resolve()
						})
						.pipe(throughStream, { end: false })

					return dfd.promise;
			})
		})
		.then(function() {
			var bundler = browserify({
				entries: [ throughStream ],
				basedir: './plugins'
			});

			bundler
			.bundle({ debug: true })
			.on('error', function(e) {
				return res.end(500);
			})
			.pipe(res)

			throughStream.resume()
			throughStream.end()
		})
		.otherwise(function(err) {
			next(err)
		})
	})
}

exports.BundleServer = BundleServer;
