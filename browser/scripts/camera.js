function Camera(gl)
{
	this.projection = mat4.create();
	this.view = mat4.create();
	
	mat4.identity(this.projection);
	mat4.identity(this.view);
}

exports.Camera = Camera;
