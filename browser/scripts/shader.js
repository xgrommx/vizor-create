function Shader(gl, type, src)
{
	this.shader = gl.createShader(type);
	this.compiled = false;
	this.linked = false;
	this.compile_info = ''
	this.link_info = ''
	
	try
	{
		gl.shaderSource(this.shader, src);
	}
	catch(e)
	{
		msg('ERROR: Shader source invalid: ' + e);
		return;
	}
	
	gl.compileShader(this.shader);
	
	if(!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS))
	{
		var info = gl.getShaderInfoLog(this.shader);
		var info_lines = info.split('\n');
		var src_lines = src.split('\n');
		
		this.compile_info = info;
		msg('ERROR: Shader compilation failed:\n');	
		
		for(var l = 0, len = info_lines.length; l != len; l++)
		{
			var line_str = info_lines[l];
			var tokens = line_str.split(':');
			
			msg(line_str + '\n\t>>> ' + src_lines[parseInt(tokens[2])-1]);
		}
		
	}
	else
		this.compiled = true;
}

exports.Shader = Shader;
