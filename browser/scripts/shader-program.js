var Shader = require('./shader').Shader;

function ShaderProgram(gl, program)
{
	this.gl = gl;
	this.program = program || gl.createProgram();
	this.n_mat = null;
}

ShaderProgram.prototype.attach = function(shader)
{
	this.gl.attachShader(this.program, shader.shader);
};

ShaderProgram.prototype.link = function()
{
	var gl = this.gl;
	var prog = this.program;
	
	gl.linkProgram(prog);
	this.linked = true;
	this.link_info = '';
	
	if(!gl.getProgramParameter(prog, gl.LINK_STATUS))
	{
		msg('ERROR: Shader linking failed:\n' + gl.getProgramInfoLog(prog));
		this.link_info += gl.getProgramInfoLog(prog);
		this.linked = false;
	}
	
	gl.validateProgram(prog);
	
	if(!gl.getProgramParameter(prog, gl.VALIDATE_STATUS))
	{
		msg('ERROR: Shader validation failed:\n' + gl.getProgramInfoLog(prog));
		this.link_info += gl.getProgramInfoLog(prog);
		this.linked = false;
	}
};

ShaderProgram.prototype.enable = function()
{
	this.gl.useProgram(this.program);
};

ShaderProgram.prototype.bind_camera = function(camera)
{
	var gl = this.gl;
	
	gl.uniformMatrix4fv(this.v_mat, false, camera.view);
	gl.uniformMatrix4fv(this.p_mat, false, camera.projection);
};

ShaderProgram.prototype.bind_transform = function(m_mat)
{
	var gl = this.gl;
	
	gl.uniformMatrix4fv(this.m_mat, false, m_mat);
	
	if(this.n_mat)
	{
		var n_mat = mat3.create();
		
		mat4.toInverseMat3(m_mat, n_mat);
		mat3.transpose(n_mat);
		gl.uniformMatrix3fv(this.n_mat, false, n_mat);
	}
};

exports.ShaderProgram = ShaderProgram;
