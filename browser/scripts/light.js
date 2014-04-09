var Color = require('./color').Color;

function Light()
{
	this.type = Light.type.POINT;
	this.diffuse_color = new Color(1, 1, 1, 1);
	this.specular_color = new Color(1, 1, 1, 1);
	this.position = [0, 1, 0];
	this.direction = [0, -1, 0];
	this.intensity = 1.0;
}

Light.type = 
{
	POINT: 0,
	DIRECTIONAL: 1,
	COUNT: 2 // Always last!
};

exports.Light = Light;
