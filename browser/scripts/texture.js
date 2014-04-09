var TextureSampler = require('./texture-sampler').TextureSampler;
var msg = require('./util').msg;

function Texture(gl, handle)
{
	this.gl = gl;
	this.min_filter = this.mag_filter = gl.LINEAR;
	this.texture = handle || gl.createTexture();
	this.width = 0;
	this.height = 0;
	this.image = null;
}

Texture.prototype.create = function(width, height)
{
	this.upload(new Image(width, height), 'Internal Create');
};

Texture.prototype.drop = function()
{
	this.gl.deleteTexture(this.texture);
	this.texture = null;
};

Texture.prototype.load = function(src, core)
{
	var img = new Image();
	
	img.onload = function(self, src, c) { return function()
	{
		msg('Finished loading texture \'' + src + '\'.');
		self.upload(img, src);
		c.asset_tracker.signal_completed();
	}}(this, src, core);
	
	img.onerror = function(src, c) { return function()
	{
		msg('ERROR: Failed to load texture \'' + src + '\'', 'Renderer');
		c.asset_tracker.signal_failed();
	}}(src, core);
	
	core.asset_tracker.signal_started();
	img.src = src;	
};

Texture.prototype.enable = function(stage)
{
	var gl = this.gl;
	
	if(gl.bound_tex_stage !== stage || gl.bound_tex !== this.texture) // Don't rebind
	{
		gl.activeTexture(stage || gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.min_filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.mag_filter);
		gl.bound_tex_stage = stage;
		gl.bound_tex = this.texture;
	}
};

Texture.prototype.disable = function()
{
	var gl = this.gl;
	
	gl.bindTexture(gl.TEXTURE_2D, null);
};

Texture.prototype.isPow2 = function(n)
{
	var v =  Math.log(n) / Math.log(2);	
	var v_int = Math.floor(v);
	
	return (v - v_int === 0.0);
};

// Accepts both Image and Canvas instances.
Texture.prototype.upload = function(img, src)
{
	this.width = img.width || img.videoWidth;
	this.height = img.height || img.videoHeight;
	this.image = img;
	
	if(!this.isPow2(this.width))
		msg('WARNING: The width (' + this.width + ') of the texture \'' + src + '\' is not a power of two.');

	if(!this.isPow2(this.height))
		msg('WARNING: The height (' + this.height + ') of the texture \'' + src + '\' is not a power of two.');
	
	var gl = this.gl;
	
	this.enable();
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	this.disable();
};

Texture.prototype.set_filtering = function(down, up)
{
	this.min_filter = down;
	this.mag_filter = up;
};

Texture.prototype.get_sampler = function()
{
	return new TextureSampler(this);
};

exports.Texture = Texture;
