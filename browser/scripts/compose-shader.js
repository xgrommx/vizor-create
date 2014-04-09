var Material = require('./material').Material;
var VertexBuffer = require('./vertex-buffer').VertexBuffer;
var Light = require('./light').Light;
var Shader = require('./shader').Shader;

function ComposeShader(cache, mesh, material, uniforms_vs, uniforms_ps, vs_custom, ps_custom)
{
	var gl = E2.app.player.core.renderer.context;
	var streams = [];
	var v_types = VertexBuffer.vertex_type;
	var has_lights = false;
	var lights = material ? material.lights : mesh.material.lights;
	var tt = Material.texture_type;
	
	for(var v_type in v_types)
	{
		var index = v_types[v_type];
		
		streams[index] = mesh.vertex_buffers[v_type] !== null;
	}		
	
	var cached = [null, ''], shader = null;
	
	if(cache)
	{
		var caps = Material.get_caps_hash(mesh, material);
		
		cached = [cache.get(caps), caps];
	}

	if(!cached[0])
	{
		var prog = gl.createProgram();
		var d_tex = (material ? material.textures[tt.DIFFUSE_COLOR] : undefined) || mesh.material.textures[tt.DIFFUSE_COLOR];
		var s_tex = (material ? material.textures[tt.SPECULAR_COLOR] : undefined) || mesh.material.textures[tt.SPECULAR_COLOR];
		var n_tex = (material ? material.textures[tt.NORMAL] : undefined) || mesh.material.textures[tt.NORMAL];
		var e_tex = (material ? material.textures[tt.EMISSION_COLOR] : undefined) || mesh.material.textures[tt.EMISSION_COLOR];
		var mat = material ? material : mesh.material;
		var vs_src = [];
		var ps_src = [];
		var vs_c_src = [];
		var ps_c_src = [];

		shader = new ShaderProgram(gl, prog);
		shader.apply_uniforms_custom = null;
		shader.streams = streams;
		shader.material = material;
		
		var vs_dp = function(s)
		{
			vs_src.push(s);
			vs_c_src.push(s);
		};
	
		var ps_dp = function(s)
		{
			ps_src.push(s);
			ps_c_src.push(s);
		};

		vs_src.push('precision lowp float;');
		vs_src.push('attribute vec3 v_pos;');
		vs_src.push('uniform vec4 d_col;');
		vs_src.push('uniform mat4 m_mat;');
		vs_src.push('uniform mat4 v_mat;');
		vs_src.push('uniform mat4 p_mat;');
		vs_src.push('varying vec4 f_col;');
		
		if(uniforms_vs)
			vs_src.push(uniforms_vs);
	
		ps_src.push('precision lowp float;');
		ps_src.push('uniform vec4 a_col;');
		ps_src.push('varying vec4 f_col;');
		
		if(uniforms_ps)
			ps_src.push(uniforms_ps);
	
		if(streams[v_types.COLOR])
			vs_src.push('attribute vec4 v_col;');

		if(streams[v_types.NORMAL])
		{
			vs_src.push('uniform mat3 n_mat;');
			vs_src.push('attribute vec3 v_norm;');
			vs_src.push('varying vec3 f_norm;');
		
			ps_src.push('varying vec3 f_norm;');
		
			for(var i = 0; i < 8; i++)
			{
				var l = lights[i];
			
				if(l)
				{
					var lid = 'l' + i;
				
					vs_src.push('uniform vec3 ' + lid + '_pos;');
					ps_src.push('uniform vec3 ' + lid + '_pos;');
					ps_src.push('uniform vec4 ' + lid + '_d_col;');
					ps_src.push('uniform vec4 ' + lid + '_s_col;');
					ps_src.push('uniform float ' + lid + '_power;');
					vs_src.push('varying vec3 ' + lid + '_v2l;');
					ps_src.push('varying vec3 ' + lid + '_v2l;');
					
					if(l.type === Light.type.DIRECTIONAL)
					{
						vs_src.push('uniform vec3 ' + lid + '_dir;');
						ps_src.push('uniform vec3 ' + lid + '_dir;');
					}
					
					has_lights = true;
				}
			}
		
			if(has_lights)
			{
				vs_src.push('varying vec3 eye_pos;');
				ps_src.push('uniform mat4 v_mat;');
				ps_src.push('varying vec3 eye_pos;');
				ps_src.push('uniform vec4 s_col;');
				ps_src.push('uniform float shinyness;');
			}
		}
	
		if(streams[v_types.UV0])
		{
			vs_src.push('attribute vec2 v_uv0;');
			vs_src.push('varying vec2 f_uv0;');

			ps_src.push('varying vec2 f_uv0;');
			
			if(d_tex)
				ps_src.push('uniform sampler2D d_tex;');
			
			if(s_tex)
				ps_src.push('uniform sampler2D s_tex;');

			if(n_tex)
				ps_src.push('uniform sampler2D n_tex;');

			if(e_tex)
				ps_src.push('uniform sampler2D e_tex;');
		}

		if(!vs_custom)
		{
			vs_dp('void main(void) {');
			vs_dp('    vec4 tp = m_mat * vec4(v_pos, 1.0);\n');

			vs_dp('    tp = v_mat * tp;');
			vs_dp('    gl_Position = p_mat * tp;');

			if(has_lights)
			{
				for(var i = 0; i < 8; i++)
				{
					var l = lights[i];
			
					if(l)
					{
						var lid = 'l' + i;
						
						if(l.type === Light.type.DIRECTIONAL)
							vs_dp('    ' + lid + '_v2l = ' + lid + '_dir;');
						else
							vs_dp('    ' + lid + '_v2l = ' + lid + '_pos - tp.xyz;');
					}
				}
				
				vs_dp('    eye_pos = -normalize(tp.xyz);');
			}
			
			if(streams[v_types.COLOR])
				vs_dp('    f_col = d_col * v_col;');
			else
				vs_dp('    f_col = d_col;');
			
			if(streams[v_types.NORMAL])
				vs_dp('    f_norm = n_mat * v_norm;');
			
			if(streams[v_types.UV0])
				vs_dp('    f_uv0 = v_uv0;');		

			vs_dp('}');
		}
		else
		{
			vs_dp(vs_custom);
		}
	
		if(!ps_custom)
		{
			ps_dp('void main(void) {');
			ps_dp('    vec4 fc = vec4(0.0, 0.0, 0.0, f_col.a);');

			if(streams[v_types.NORMAL] && has_lights)
			{
				if(streams[v_types.NORMAL] && streams[v_types.UV0] && n_tex)
					ps_dp('    vec3 n_dir = normalize(f_norm * -(texture2D(n_tex, f_uv0.st).rgb - 0.5 * 2.0));');
				else
					ps_dp('    vec3 n_dir = normalize(f_norm);');

				ps_dp('    float shine = max(1.0, shinyness);');
				
				for(var i = 0; i < 8; i++)
				{
					var l = lights[i];
			
					if(l)
					{
						var lid = 'l' + i;
						var liddir = lid + '_v2l_n';
				
						ps_dp('    vec3 ' + liddir + ' = normalize(' + lid + '_v2l);');
						ps_dp('    float ' + lid + '_dd = max(0.0, dot(n_dir, ' + liddir + '));');
						ps_dp('    float ' + lid + '_spec_fac = pow(max(0.0, dot(reflect(-' + liddir + ', n_dir), eye_pos)), shinyness + 1.0);\n');
						ps_dp('\n    fc.rgb += ' + lid + '_d_col.rgb * f_col.rgb * ' + lid + '_dd * ' + lid + '_power;\n');
						
						var s = '    fc.rgb += shine * ' + lid + '_power * ';
				
						s += lid + '_s_col.rgb * s_col.rgb * ' + lid + '_spec_fac';
						
						if(streams[v_types.UV0] && s_tex)
							s += ' * texture2D(s_tex, f_uv0.st).rgb';

						ps_dp(s + ';\n');
					}
				}
			}
			
			if(!has_lights)
				ps_dp('    fc.rgb = f_col.rgb;');
			
			if(streams[v_types.UV0])
			{
				if(d_tex)
					ps_dp('    fc *= texture2D(d_tex, f_uv0.st);');
				
				if(e_tex)
					ps_dp('    fc.rgb += texture2D(e_tex, f_uv0.st).rgb;');
			}

			ps_dp('    fc.rgb += a_col.rgb;\n');
			
			if(mat.alpha_clip)
				ps_dp('    if(fc.a < 0.5)\n        discard;\n');
			
			ps_dp('    gl_FragColor = fc;');
			ps_dp('}');
		}
		else
		{
			ps_dp(ps_custom);
		}

		shader.vs_src = vs_src.join('\n');
		shader.ps_src = ps_src.join('\n');
		shader.vs_c_src = vs_c_src.join('\n');
		shader.ps_c_src = ps_c_src.join('\n');
		
		var vs = new Shader(gl, gl.VERTEX_SHADER, shader.vs_src);
		var ps = new Shader(gl, gl.FRAGMENT_SHADER, shader.ps_src);
		var compiled = vs.compiled && ps.compiled;

		var resolve_attr = function(id)
		{
			var idx = gl.getAttribLocation(prog, id);
			
			return idx < 0 ? undefined : idx;
		};
		
		if(compiled)
		{
			shader.attach(vs);
			shader.attach(ps);
			shader.link();
			
			if(streams[v_types.VERTEX])
				shader.v_pos = resolve_attr('v_pos');
		
			if(streams[v_types.NORMAL])
				shader.v_norm = resolve_attr('v_norm');
		
			shader.m_mat = gl.getUniformLocation(prog, 'm_mat');
			shader.v_mat = gl.getUniformLocation(prog, 'v_mat');
			shader.p_mat = gl.getUniformLocation(prog, 'p_mat');
			shader.a_col = gl.getUniformLocation(prog, 'a_col');
			shader.d_col = gl.getUniformLocation(prog, 'd_col');

			if(has_lights)
			{
				shader.s_col = gl.getUniformLocation(prog, 's_col');
				shader.shinyness = gl.getUniformLocation(prog, 'shinyness');
				shader.n_mat = gl.getUniformLocation(prog, 'n_mat');
	
				for(var i = 0; i < 8; i++)
				{
					var l = lights[i];
			
					if(l)
					{
						var lid = 'l' + i;

						shader[lid + '_pos'] = gl.getUniformLocation(prog, lid + '_pos');
						shader[lid + '_d_col'] = gl.getUniformLocation(prog, lid + '_d_col');
						shader[lid + '_s_col'] = gl.getUniformLocation(prog, lid + '_s_col');
						shader[lid + '_power'] = gl.getUniformLocation(prog, lid + '_power');
				
						if(l.type === Light.type.DIRECTIONAL)
							shader[lid + '_dir'] = gl.getUniformLocation(prog, lid + '_dir');
					}
				}
			}

			if(streams[v_types.COLOR])
				shader.v_col = resolve_attr('v_col');
		
			if(streams[v_types.UV0])
			{
				shader.v_uv0 = resolve_attr('v_uv0');
			
				if(d_tex)
					shader.d_tex = gl.getUniformLocation(prog, 'd_tex');
		
				if(s_tex)
					shader.s_tex = gl.getUniformLocation(prog, 's_tex');

				if(n_tex)
					shader.n_tex = gl.getUniformLocation(prog, 'n_tex');

				if(e_tex)
					shader.e_tex = gl.getUniformLocation(prog, 'e_tex');
			}
		}
	
		shader.bind_array = function(type, data, item_size)
		{
			var types = VertexBuffer.vertex_type;
			var attr = undefined;
		
			if(type === types.VERTEX)
				attr = this.v_pos;
			else if(type === types.UV0)
				attr = this.v_uv0;
			else if(type === types.NORMAL)
				attr = this.v_norm;
			else if(type === types.COLOR)
				attr = this.v_col;
		
			if(attr === undefined)
				return;
		
			gl.bindBuffer(gl.ARRAY_BUFFER, data);
			gl.enableVertexAttribArray(attr);
			gl.vertexAttribPointer(attr, item_size, gl.FLOAT, false, 0, 0);
		};
	
		shader.apply_uniforms = !compiled ? function(mesh, mat) {} : function(mesh, mat)
		{
			var r = E2.app.player.core.renderer;
			var m = mat ? mat : mesh.material;

			gl.enableVertexAttribArray(this.v_pos);
			gl.uniform4fv(this.a_col, (m.ambient_color) ? new Float32Array(m.ambient_color.rgba) : r.def_ambient);
			gl.uniform4fv(this.d_col, (m.diffuse_color) ? new Float32Array(m.diffuse_color.rgba) : r.def_diffuse);
		
			if(this.s_col !== undefined)
				gl.uniform4fv(this.s_col, (m.specular_color) ? new Float32Array(m.specular_color.rgba) : r.def_specular);
		
			if(this.shinyness !== undefined)
				gl.uniform1f(this.shinyness, m.shinyness);
		
			for(var i = 0; i < 8; i++)
			{
				var l = lights[i];
			
				if(l)
				{
					var lid = 'l' + i;

					gl.uniform3fv(this[lid + '_pos'], l.position);
					gl.uniform4fv(this[lid + '_d_col'], l.diffuse_color.rgba);
					gl.uniform4fv(this[lid + '_s_col'], l.specular_color.rgba);
					gl.uniform1f(this[lid + '_power'], l.intensity);
				
					if(l.type === Light.type.DIRECTIONAL)
						gl.uniform3fv(this[lid + '_dir'], l.direction);
				}
			}

			if(this.v_norm !== undefined)
				gl.enableVertexAttribArray(this.v_norm);
		
			if(this.v_uv0 !== undefined)
			{
				var dt = null, st = null, nt = null, et = null;
				var mm = mesh.material;
			
				if(mat)
				{
					dt = mat.textures[tt.DIFFUSE_COLOR] || mm.textures[tt.DIFFUSE_COLOR];
					st = mat.textures[tt.SPECULAR_COLOR] || mm.textures[tt.SPECULAR_COLOR];
					nt = mat.textures[tt.NORMAL] || mm.textures[tt.NORMAL];
					et = mat.textures[tt.EMISSION_COLOR] || mm.textures[tt.EMISSION_COLOR];
				}
				else
				{
					dt = mm.textures[tt.DIFFUSE_COLOR];
					st = mm.textures[tt.SPECULAR_COLOR];
					nt = mm.textures[tt.NORMAL];
					et = mm.textures[tt.EMISSION_COLOR];
				}
			
				gl.enableVertexAttribArray(this.v_uv0);

				if(dt && this.d_tex !== undefined)
				{
					gl.uniform1i(this.d_tex, 0);
					dt.enable(gl.TEXTURE0);
				}

				if(st && this.s_tex !== undefined)
				{
					gl.uniform1i(this.s_tex, 1);
					st.enable(gl.TEXTURE1);
				}

				if(nt && this.n_tex !== undefined)
				{
					gl.uniform1i(this.n_tex, 2);
					nt.enable(gl.TEXTURE2);
				}

				if(et && this.e_tex !== undefined)
				{
					gl.uniform1i(this.e_tex, 3);
					et.enable(gl.TEXTURE3);
				}
			}
		
			if(this.apply_uniforms_custom)
				this.apply_uniforms_custom();
		
			if(m.double_sided)
				gl.disable(gl.CULL_FACE);
			else
				gl.enable(gl.CULL_FACE);
	
			m.enable();
		};
		
		if(cache)
			cache.set_shader(cached[1], shader);
	}
	else
		shader = cached[0];
	
	return shader;
}

exports.ComposeShader = ComposeShader;

