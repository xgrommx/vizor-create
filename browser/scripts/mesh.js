var VertexBuffer = require('./vertex-buffer').VertexBuffer;
var IndexBuffer = require('./index-buffer').IndexBuffer;
var ComposeShader = require('./compose-shader').ComposeShader;

function Mesh(gl, prim_type, t_cache, data, base_path, asset_tracker)
{
	this.gl = gl;
	this.prim_type = prim_type;
	this.vertex_buffers = {};
	this.index_buffer = null;
	this.t_cache = t_cache;
	this.material = new Material();
	this.vertex_count = 0;
	
	for(var v_type in VertexBuffer.vertex_type)
		this.vertex_buffers[v_type] = null;
		
	if(data)
	{
		var load_stream = function(url, lo, rng, stream, parent)
		{
			var img = new Image();
		
			lo = parseFloat(lo);
			rng = parseFloat(rng);
			
			asset_tracker.signal_started();
		
			img.onload = function()
			{
				var canvas = document.createElement('canvas');
				var ctx = canvas.getContext('2d');
				
				canvas.width = img.width;
				canvas.height = img.height;
				
				ctx.imageSmoothingEnabled = false;
				ctx.webkitImageSmoothingEnabled = false;
				ctx.globalCompositeOperation = 'copy';
				
				ctx.drawImage(img, 0, 0);
			
				var pd = ctx.getImageData(0, 0, img.width, img.height);
				var count = pd.width * pd.height;
				var dv = new DataView(pd.data.buffer);
				var ab = new ArrayBuffer(count);
				var abdv = new DataView(ab);
				var data = [];
				
				// Extract the datastream from the canvas RGBA data.
				for(var i = 0, o = 0; o < count; i += 4, o++)
					abdv.setUint8(o, dv.getUint8(i));
				
				// Decode
				for(i = 0; i < count; i+=4)
					data.push(abdv.getFloat32(i, false));
				
				stream.bind_data(data);
			
				if(parent)
					parent.vertex_count = count / (4 * 3);
				
				msg('Finished loading stream from ' + img.src + ' with ' + (count / 4) + ' elements.');
				asset_tracker.signal_completed();
			};
		
			img.onerror = function()
			{
				asset_tracker.signal_failed();
			};
		
			img.onabort = function()
			{
				asset_tracker.signal_failed();
			};

			img.src = base_path + url + '.png';
		};
		
		if(data.vertices)
			load_stream(data.vertices, data.v_lo, data.v_rng, this.vertex_buffers.VERTEX = new VertexBuffer(gl, VertexBuffer.vertex_type.VERTEX), this);

		if(data.normals)
			load_stream(data.normals, data.n_lo, data.n_rng, this.vertex_buffers.NORMAL = new VertexBuffer(gl, VertexBuffer.vertex_type.NORMAL));
		else // Compute normals
		{
			var vts = data.vertices,
                                  p1 = null,
                                  p2 = null,
                                  p3 = null;
			
			this.face_norms = [];
			
			if(data.indices)
			{
				var idx = data.indices;
				
				for(var i = 0, len = idx.length; i < len; i += 3)
				{
					p1 = idx[i]*3;
					p2 = idx[i+1]*3;
					p3 = idx[i+2]*3;
					
					var v1 = [vts[p1] - vts[p3], vts[p1+1] - vts[p3+1], vts[p1+2] - vts[p3+2]];
					var v2 = [vts[p1] - vts[p2], vts[p1+1] - vts[p2+1], vts[p1+2] - vts[p2+2]];
					
					var n = [v1[1] * v2[2] - v1[2] * v2[1],
                                                 v1[2] * v2[0] - v1[0] * v2[2],
                                                 v1[0] * v2[1] - v1[1] * v2[0]];
					
					var l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
					
					if(l > 0.000001)
					{
						n[0] /= l;
						n[1] /= l;
						n[2] /= l;
					}
					
					this.face_norms.push(n[0]);
					this.face_norms.push(n[1]);
					this.face_norms.push(n[2]);
				}
				
				// TODO: Use index buffer to calculate proper vertex normals.
			}
			else
			{
				var ndata = [];
				
				for(var i = 0, len = vts.length/3; i < len; i += 3)
				{
					p1 = i*3;
					p2 = (i+1)*3;
					p3 = (i+2)*3;
					
					var v1 = [vts[p1] - vts[p3], vts[p1+1] - vts[p3+1], vts[p1+2] - vts[p3+2]];
					var v2 = [vts[p1] - vts[p2], vts[p1+1] - vts[p2+1], vts[p1+2] - vts[p2+2]];
					
					var n = [v1[1] * v2[2] - v1[2] * v2[1],
					         v1[2] * v2[0] - v1[0] * v2[2],
					         v1[0] * v2[1] - v1[1] * v2[0]];
					         
					var l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
					
					if(l > 0.000001)
					{
						n[0] /= l;
						n[1] /= l;
						n[2] /= l;
					}
					
					this.face_norms.push(n[0]);
					this.face_norms.push(n[1]);
					this.face_norms.push(n[2]);
					
					for(var c = 0; c < 3; c++)
					{
						ndata.push(n[0]);
						ndata.push(n[1]);
						ndata.push(n[2]);
					}
				}
				
				(this.vertex_buffers['NORMAL'] = new VertexBuffer(gl, VertexBuffer.vertex_type.NORMAL)).bind_data(ndata);
			}
		}
		
		if(data.uv0)
		{
  			load_stream(data.uv0, data.uv0_lo, data.uv0_rng, this.vertex_buffers['UV0'] = new VertexBuffer(gl, VertexBuffer.vertex_type.UV0))
		}
		
		if(data.indices)
		{
			var idx = this.index_buffer = new IndexBuffer(gl);
			
			idx.bind_data(data.indices);
		}
	}
}

Mesh.prototype.generate_shader = function()
{
	this.shader = ComposeShader(E2.app.player.core.renderer.shader_cache, this, this.material, null, null, null, null);
}

Mesh.prototype.render = function(camera, transform, shader, material)
{
	var verts = this.vertex_buffers['VERTEX'];
	var shader = shader || this.shader;
	var gl = this.gl;
	
	if(!verts || !shader || !shader.linked)
		return;
	
	var unbound = gl.bound_mesh !== this || gl.bound_shader !== shader;
	
	if(unbound)
	{
		shader.enable();
	
		for(var v_type in VertexBuffer.vertex_type)
		{
			var vb = this.vertex_buffers[v_type];
		
			if(vb)
				vb.bind_to_shader(shader);
		}

		shader.bind_camera(camera);
		shader.apply_uniforms(this, material);
		gl.bound_mesh = this;
		gl.bound_shader = shader;
	}
	
	if(!this.instances)
	{
		shader.bind_transform(transform);
		
		if(!this.index_buffer)
		{
			gl.drawArrays(this.prim_type, 0, verts.count);
		}
		else
		{
			if(unbound)
				this.index_buffer.enable();
			
			gl.drawElements(this.prim_type, this.index_buffer.count, gl.UNSIGNED_SHORT, 0);
		}
	}
	else
	{
		var inst = this.instances;
		var inst_t = this.instance_transforms;
		var ft = mat4.create();
		var ift = inst_t ? mat4.create() : null;
		
		if(!this.index_buffer)
		{
			for(var i = 0, len = inst.length; i < len; i++)
			{
				if(!transform.invert)
					mat4.multiply(inst[i], transform, ft);
				else
					mat4.multiply(transform, inst[i], ft);
				
				if(ift)
					mat4.multiply(ft, inst_t[i], ift);
					
				shader.bind_transform(ift ? ift : ft);
				gl.drawArrays(this.prim_type, 0, verts.count);
			}
		}
		else
		{
			this.index_buffer.enable();

			for(var i = 0, len = inst.length; i < len; i++)
			{
				if(!transform.invert)
					mat4.multiply(inst[i], transform, ft);
				else
					mat4.multiply(transform, inst[i], ft);
			
				if(ift)
					mat4.multiply(ft, inst_t[i], ift);

				shader.bind_transform(ift ? ift : ft);
				gl.drawElements(this.prim_type, this.index_buffer.count, gl.UNSIGNED_SHORT, 0);
			}
		}
	}
};

exports.Mesh = Mesh;
