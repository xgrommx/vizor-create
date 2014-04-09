function VertexBuffer(gl, v_type)
{
	this.gl = gl;
	this.type = v_type;
	this.buffer = gl.createBuffer();
	this.count = 0;
}

VertexBuffer.vertex_type = 
{
	VERTEX: 0,
	NORMAL: 1,
	COLOR: 2,
	UV0: 3,
	UV1: 4,
	UV2: 5,
	UV3: 6,
	COUNT: 7 // Always last
};

VertexBuffer.type_stride = [
	3,
	3,
	4,
	2,
	2,
	2,
	2
];

VertexBuffer.prototype.enable = function()
{
	var gl = this.gl;
	
	gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
};

VertexBuffer.prototype.bind_data = function(v_data, draw_mode)
{
	var gl = this.gl;

	this.count = (v_data.toString() === '[object ArrayBuffer]' ? v_data.byteLength / 4 : v_data.length) / VertexBuffer.type_stride[this.type];
	this.enable();
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v_data), typeof draw_mode !== 'undefined' ? draw_mode : gl.STATIC_DRAW);
};

VertexBuffer.prototype.bind_to_shader = function(shader)
{
	shader.bind_array(this.type, this.buffer, VertexBuffer.type_stride[this.type]);
};

exports.VertexBuffer = VertexBuffer;
