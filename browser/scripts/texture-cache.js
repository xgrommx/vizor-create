var Texture = require('./texture').Texture;

function TextureCache(gl, core)
{
	this.gl = gl;
	this.core = core;
	this.textures = {};
}

TextureCache.prototype.get = function(url)
{
	var ce = this.textures[url];

	if(ce !== undefined)
	{
		msg('Returning cahed version of texture \'' + url + '\'.');
		ce.count++;
		return ce.texture;
	}
	
	var t = new Texture(this.gl);
	
	msg('Fetching texture \'' + url + '\'.');
	
	t.load(url, this.core);
	this.textures[url] = { count:0, texture:t };
	
	return t;
};

TextureCache.prototype.clear = function()
{
	this.textures = {};
};

TextureCache.prototype.count = function()
{
	var c = 0;
	var ts = this.textures;
	
	for(var t in ts)
	{
		if(ts.hasOwnProperty(t))
			++c;
	}
		
	return c;
};

exports.TextureCache = TextureCache;
