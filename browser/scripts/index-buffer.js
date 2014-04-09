function IndexBuffer(gl)
{
	this.gl = gl;
	this.buffer = gl.createBuffer();
	this.count = 0;
}

IndexBuffer.prototype.enable = function()
{
	var gl = this.gl;
	
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer);
};

IndexBuffer.prototype.bind_data = function(i_data)
{
	var gl = this.gl;
	
	this.count = i_data.length;
	this.enable();
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(i_data), gl.STATIC_DRAW);
};

exports.IndexBuffer = IndexBuffer;
