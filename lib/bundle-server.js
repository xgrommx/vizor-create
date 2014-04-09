var fs = require('fs');
var when = require('when');
var node = require('when/node');
var browserify = require('browserify');
var through = require('through');

function browserify(res) {
	var b = browserify({ debug: true });
	b.add(entrypoint);
	b.bundle()
		b.on('error', function(e) {
			return res.end(500);
		});

	res.setHeader('Content-Type', 'text/javascript');
	res.setHeader('Content-Length', new Buffer(str).length);
	res.setHeader('Cache-Control', 'private, no-cache, max-age=1');
	res.end(str);
}

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

			bundler.bundle({ debug: true }).pipe(res)

			throughStream.resume()
			throughStream.end()
		})
		.otherwise(function(err) {
			next(err)
		})
	})
}

exports.BundleServer = BundleServer;
