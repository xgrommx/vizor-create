var Color = require('./color').Color;
var Renderer = require('./renderer').Renderer;
var VertexBuffer = require('./vertex-buffer').VertexBuffer;

function Material(gl, t_cache, data, base_path)
{
	this.t_cache = t_cache;
	this.depth_test = true;
	this.depth_write = true;
	this.depth_func = Material.depth_func.LEQUAL;
	this.alpha_clip = false;
	this.shinyness = 1.0;
	this.double_sided = false;
	this.blend_mode = Renderer.blend_mode.NORMAL;
	this.ambient_color = new Color(0, 0, 0, 1);
	this.diffuse_color = new Color(1, 1, 1, 1);
	this.textures = [];
	this.lights = [null, null, null, null, null, null, null, null];
	
	if(data)
	{
		var self = this;

		var parse_color = function(name)
		{
			var c = data[name];
			
			if(c)
				self[name] = new Color(c[0], c[1], c[2], c[3]);
		};
		
		var parse_tex = function(name, tgt, old)
		{
			var t = data[name];
			
			if(t)
			{
				var url = t.url;
				var len = url.length;
				
				self.textures[tgt] = t_cache.get(base_path + url);
				
				if(url.substring(len - 3).toLowerCase() == 'png')
					self.alpha_clip = true;
			}
		};
		
		parse_color('diffuse_color');
		parse_color('ambient_color');
		parse_tex('diffuse_color_map', Material.texture_type.DIFFUSE_COLOR);
		parse_tex('specular_intensity_map', Material.texture_type.SPECULAR_COLOR);
		parse_tex('specular_color_map', Material.texture_type.SPECULAR_COLOR);
		parse_tex('emission_intensity_map', Material.texture_type.EMISSION_COLOR);
		parse_tex('emission_color_map', Material.texture_type.EMISSION_COLOR);
		parse_tex('normal_map', Material.texture_type.NORMAL);
		
		this.depth_test = data.depth_test ? data.depth_test : true;
		this.depth_write = data.depth_write ? data.depth_write : true;
		this.alpha_clip = data.alpha_clip ? data.alpha_clip : false;
		this.shinyness = data.shininess ? data.shininess : 0.0; // TODO: Fix this in the exporter, re-export all relevant assets.
		this.double_sided = data.double_sided ? true : false;
	}
}

Material.texture_type =
{
	DIFFUSE_COLOR: 0,
	SPECULAR_COLOR: 1,
	EMISSION_COLOR: 2,
	NORMAL: 3,
	COUNT: 4 // Always last!
};

Material.depth_func =
{
	NEVER: 0,
	LESS: 1,
	EQUAL: 2,
	LEQUAL: 3,
	GREATER: 4,
	NOTEQUAL: 5,
	GEQUAL: 6,
	ALWAYS: 7,
	COUNT: 8 // Always last!
};

Material.prototype.enable = function()
{
	var r = E2.app.player.core.renderer;
	var gl = r.context;
	
	if(this.depth_test)
	{
		var depth_flags = [
			gl.NEVER, 
			gl.LESS,
			gl.EQUAL,
			gl.LEQUAL,
			gl.GREATER,
			gl.NOTEQUAL,
			gl.GEQUAL,
			gl.ALWAYS
		];
		
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(depth_flags[this.depth_func]);
	}
	else
		gl.disable(gl.DEPTH_TEST);
	
	gl.depthMask(this.depth_write);
	r.set_blend_mode(this.blend_mode);
};

Material.get_caps_hash = function(mesh, o_mat)
{
	var h = '', tt = Material.texture_type;
	var mat = o_mat ? o_mat : mesh.material;
	
	for(var i = 0, len = VertexBuffer.vertex_type.COUNT; i <len; i++)
		h += mesh && mesh.vertex_buffers[i] ? '1' : '0';
	 
	h += mat.diffuse_color ? '1' : '0';
	h += mat.emission_color ? '1' : '0';
	h += mat.specular_color ? '1' : '0';
	h += mat.ambient_color ? '1' : '0';
	h += mat.alpha_clip ? '1' : '0';
	
	if(o_mat)
	{
		if(mesh)
		{
			var mm = mesh.material;
		
			h += (o_mat.textures[tt.DIFFUSE_COLOR] || mm.textures[tt.DIFFUSE_COLOR]) ? '1' : '0';
			h += (o_mat.textures[tt.EMISSION_COLOR] || mm.textures[tt.EMISSION_COLOR]) ? '1' : '0';
			h += (o_mat.textures[tt.SPECULAR_COLOR] || mm.textures[tt.SPECULAR_COLOR]) ? '1' : '0';
			h += (o_mat.textures[tt.NORMAL] || mm.textures[tt.NORMAL]) ? '1' : '0';
		}
		else
		{
			h += o_mat.textures[tt.DIFFUSE_COLOR] ? '1' : '0';
			h += o_mat.textures[tt.EMISSION_COLOR] ? '1' : '0';
			h += o_mat.textures[tt.SPECULAR_COLOR] ? '1' : '0';
			h += o_mat.textures[tt.NORMAL] ? '1' : '0';
		}
	}
	else
	{
		h += mat.textures[tt.DIFFUSE_COLOR] ? '1' : '0';
		h += mat.textures[tt.EMISSION_COLOR] ? '1' : '0';
		h += mat.textures[tt.SPECULAR_COLOR] ? '1' : '0';
		h += mat.textures[tt.NORMAL] ? '1' : '0';
	}

	for(i = 0; i < 8; i++)
		h += mat.lights[i] ? (mat.lights[i].type === Light.type.POINT ? 'p' : 'd') : '0';
	
	return h;
};

exports.Material = Material;
