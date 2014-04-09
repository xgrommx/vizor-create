
var Color = require('./color').Color;
var Light = require('./light').Light;
var Material = require('./material').Material;
var TextureSampler = require('./texture-sampler').TextureSampler;
var Texture = require('./texture').Texture;
var TextureCache = require('./texture-cache').TextureCache;
var VertexBuffer = require('./vertex-buffer').VertexBuffer;

function ShaderCache(gl)
{
	this.shaders = {};
}

ShaderCache.prototype.get = function(key)
{
	if(key in this.shaders)
		return this.shaders[key];
	
	return null;
}

ShaderCache.prototype.count = function()
{
	var c = 0;
	
	for(p in this.shaders)
		++c;
		
	return c;
};

ShaderCache.prototype.set_shader = function(key, shader)
{
	this.shaders[key] = shader;
};

ShaderCache.prototype.clear = function()
{
	this.shaders = {};
};

function Renderer(canvas_id, core)
{
	this.canvas_id = canvas_id;
	this.canvas = $(canvas_id);
	this.framebuffer_stack = [];
	this.def_ambient = new Float32Array([0.0, 0.0, 0.0, 1.0]);
	this.def_diffuse = new Float32Array([1.0, 1.0, 1.0, 1.0]);
	this.def_specular = new Float32Array([1.0, 1.0, 1.0, 1.0]);
		
	this.org_width = this.canvas.width();
	this.org_height = this.canvas.height();
	
	try
	{
		var ctx_opts = { alpha: false, preserveDrawingBuffer: false, antialias: true };
		
		this.context = this.canvas[0].getContext('webgl', ctx_opts);
		
		if(!this.context)
			this.context = this.canvas[0].getContext('experimental-webgl', ctx_opts);
	}
	catch(e)
	{
		this.context = null;
	}
	
	if(!this.context)
		window.location = 'no_webgl.html';
	
	this.texture_cache = new TextureCache(this.context, core);
	this.shader_cache = new ShaderCache(this.context);
	this.fullscreen = false;
	this.default_tex = new Texture(this.context);
	this.default_tex.load('../images/no_texture.png', core);

	document.addEventListener('fullscreenchange', this.on_fullscreen_change(this));
	document.addEventListener('webkitfullscreenchange', this.on_fullscreen_change(this));
	document.addEventListener('mozfullscreenchange', this.on_fullscreen_change(this));
	
	// Constants, to cut down on wasted objects in slot definitions.
	this.camera_screenspace = new Camera(this.context);
	this.light_default = new Light();
	this.material_default = new Material();
	this.color_white = new Color(1.0, 1.0, 1.0);
	this.color_black = new Color(0.0, 0.0, 0.0);
	this.vector_origin = [0.0, 0.0, 0.0];
	this.vector_unity = [1.0, 1.0, 1.0];
	this.matrix_identity = mat4.create();
	
	mat4.identity(this.matrix_identity);
}

Renderer.blend_mode = 
{
	NONE: 0,
	ADDITIVE: 1,
	SUBTRACTIVE: 2,
	MULTIPLY: 3,
	NORMAL: 4
};

Renderer.prototype.begin_frame = function()
{
	var gl = this.context;

	if(gl)
	{
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clearDepth(1.0);
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);
		gl.bound_tex = null;
		gl.bound_tex_stage = null;
		gl.bound_mesh = null;
		gl.bound_shader = null;
		
		// this.update_viewport();
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}	
};

Renderer.prototype.end_frame = function()
{
	var gl = this.context;
	
	if(gl)
		gl.flush();
};

Renderer.prototype.push_framebuffer = function(fb, w, h)
{
	var gl = this.context;
	
	gl.viewport(0, 0, w, h);
	gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
	this.framebuffer_stack.push([fb, w, h]);
};

Renderer.prototype.pop_framebuffer = function()
{
	var fbs = this.framebuffer_stack;
	var gl = this.context;
	
	fbs.pop();
	
	if(fbs.length > 0)
	{
		var fb = fbs[fbs.length-1];
		
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb[0]);
		gl.viewport(0, 0, fb[1], fb[2]);
	}
	else
	{
		var c = this.canvas[0];
		
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, c.width, c.height);
	}
};

Renderer.prototype.on_fullscreen_change = function(self) { return function()
{
	var c = E2.dom.webgl_canvas;
	
	if(self.fullscreen && !document.fullscreenElement && !document.webkitFullScreenElement && !document.mozFullscreenElement)
	{
		c.attr('class', 'webgl-canvas-normal');
		c.attr('width', '' + self.org_width + 'px');
		c.attr('height', '' + self.org_height + 'px');
		self.update_viewport();
		self.fullscreen = false;
	}
	else
	{
		self.fullscreen = true;
		document.fullscreenElement = document.webkitFullScreenElement = document.mozFullscreenElement = null;
	}
}};

Renderer.prototype.set_fullscreen = function(state)
{
	var c = E2.dom.webgl_canvas;
	var cd = c[0];

	if(state)
	{
		if(!this.fullscreen)
		{
			if(cd.requestFullscreen || cd.webkitRequestFullScreen || cd.mozRequestFullScreen)
			{
				if(cd.requestFullscreen)
					cd.requestFullscreen();
				if(cd.webkitRequestFullScreen)
					cd.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
				else if(cd.mozRequestFullScreen)
					cd.mozRequestFullScreen();
				
				c.attr('class', 'webgl-canvas-fs');
				c.attr('width', '1280px');
				c.attr('height', '720px');
				this.update_viewport();
			}
		}
	}
	else
	{
		if(this.fullscreen)
		{
			var cfs = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen;
			
			if(cfs)
			{
				c.attr('class', 'webgl-canvas-normal');
				c.attr('width', '' + this.org_width + 'px');
				c.attr('height', '' + this.org_height + 'px');
				this.update_viewport();
				cfs();
			}
		}
	}
};

Renderer.prototype.update_viewport = function()
{
	var c = this.canvas[0];
	
	this.context.viewport(0, 0, c.width, c.height);
};

Renderer.prototype.set_depth_enable = function(on)
{
	var gl = this.context;

	if(on)
	{
		gl.enable(gl.DEPTH_TEST);
		gl.depthMask(true);
		gl.depthFunc(gl.LEQUAL);
		return;
	}

	gl.disable(gl.DEPTH_TEST);
	gl.depthMask(false);
};

Renderer.prototype.set_blend_mode = function(mode)
{
	var gl = this.context;
	var bm = Renderer.blend_mode;
	
	switch(mode)
	{
		case bm.NONE:
			gl.disable(gl.BLEND);
			break;
			
		case bm.ADDITIVE:
			gl.enable(gl.BLEND);
			gl.blendEquation(gl.FUNC_ADD);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
			break;

		case bm.SUBTRACTIVE:
			gl.enable(gl.BLEND);
			gl.blendEquation(gl.FUNC_ADD);
			gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
			break;

		case bm.MULTIPLY:
			gl.enable(gl.BLEND);
			gl.blendEquation(gl.FUNC_ADD);
			gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
			break;

		default:
			gl.enable(gl.BLEND);
			gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			break;
	}
};

exports.Renderer = Renderer;
