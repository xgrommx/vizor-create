var fs = require('fs');
var browserify = require('browserify');
var through = require('through');

function BundleServer(pluginsPath) {
	this._pluginsPath = pluginsPath
}

BundleServer.prototype.listen = function(expressApp) {
	var self = this;

	expressApp.use('/plugins/all.plugins.js', function(req, res, next) {
		var bundler = browserify({
			basedir: process.cwd()
		});

		fs.readdir(self._pluginsPath, function(err, plugins) {
			if (err)
				return next(err);

			plugins.forEach(function(plugin) {
				if (/^.*\.js$/.test(plugin)) {
					bundler.add(self._pluginsPath + plugin)
				}
			})

			bundler
			.bundle({ debug: true }, function(err, src) {
				if (err)
					return next(err);

				res.set('Content-Type', 'application/javascript')
				res.set('Content-Length', Buffer.byteLength(src, 'utf8'))

				res.end(src);
			})
		})
	})
}

exports.BundleServer = BundleServer;
