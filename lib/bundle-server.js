var fs = require('fs');
var browserify = require('browserify');

function bundleSender(res, next) {
	return function(err, src) {
		if (err)
			return next(err);

		res.set('Content-Type', 'application/javascript')
		res.set('Content-Length', Buffer.byteLength(src, 'utf8'))

		res.end(src);
	}
}

function BundleServer(pluginsPath) {
	this._pluginsPath = pluginsPath
}

BundleServer.prototype.listen = function(expressApp) {
	var self = this;

	expressApp.use('/scripts/engi.js', function(req, res, next) {
		var bundler = browserify();
		bundler.add('./browser/scripts/core.js')
		bundler.bundle({ debug: true }, bundleSender(res, next))
	});

	expressApp.use('/plugins/all.plugins.js', function(req, res, next) {
		var bundler = browserify({
			basedir: './browser'
		});

		fs.readdir(self._pluginsPath, function(err, plugins) {
			if (err)
				return next(err);

			plugins.forEach(function(plugin) {
				if (/^.*\.js$/.test(plugin)) {
					bundler.add(fs.createReadStream(self._pluginsPath + plugin))
				}
			})

			bundler
			.bundle({ debug: true }, bundleSender(res, next))
		})
	})
}

exports.BundleServer = BundleServer;
