E2.p = E2.plugins["record_framebuffer"] = function(core, node)
{
	var self = this;

	this.desc = 'Grab the current framebuffer and transmit frame size and RGB data to a specified recording server.';
	
	this.input_slots = [ 
		{ name: 'record', dt: core.datatypes.BOOL, desc: 'Switch recording on or off.', def: false },
		{ name: 'url', dt: core.datatypes.TEXT, desc: 'URL of the recording server.' },
		{ name: 'texture', dt: core.datatypes.TEXTURE, desc: 'The texture output of a graph.' }
	];
	
	this.output_slots = [];
	this.gl = core.renderer.context;

	this._client = new WebSocket('ws://localhost:8000/_fd');
	this._client.binaryType = "arraybuffer";
	this._client.onmessage = function() {
		console.log('onmessage')
	}
	this._client.onclose = function()
	{
		self._client = null;
	};
};

E2.p.prototype.reset = function()
{
	this.url = null;
	this.texture = null;
}

E2.p.prototype.connection_changed = function(on, conn, slot)
{
	if(!on)
	{
		if(slot.index === 1)
			this.url = null;
		else if(slot.index === 2)
			this.texture = null;
	}
};

E2.p.prototype.update_input = function(slot, data)
{
	if(slot.index === 0)
		this.record = data;
	else if(slot.index === 1)
		this.url = data;
	else if(slot.index === 2)
		this.texture = data;
};

E2.p.prototype.update_state = function()
{
	if(!this.record || !this.url || !this.texture || !this.texture.framebuffer)
		return;
	
	var gl = this.gl;
	var w = this.texture.width;
	var h = this.texture.height;
	var size = w * h * 4;
	var img_data = new Uint8Array(size);
	
	gl.bindFramebuffer(gl.FRAMEBUFFER, this.texture.framebuffer);
	gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, img_data);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

console.log('send frame', this._client.bufferedAmount, this._client.readyState)
	this._client.send(img_data.buffer);
};
