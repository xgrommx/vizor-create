function TextureSampler(tex)
{
	var canvas = document.createElement('canvas');
	var image = tex.image;
	
	canvas.width = image.width;
	canvas.height = image.height;

	var context = canvas.getContext('2d');

	context.drawImage(image, 0, 0);

	this.imgdata = context.getImageData(0, 0, image.width, image.height);
	this.texture = tex;
}

TextureSampler.prototype.get_pixel = function(x, y)
{
	var img = this.texture.image;
	
	x = x < 0 ? 0 : x > 1.0 ? 1.0 : x;
	y = y < 0 ? 0 : y > 1.0 ? 1.0 : y;

	x *= img.width - 1;
	y *= img.height - 1;
	
	var o = (Math.round(x) + (img.width * Math.round(y))) * 4;
	var d = this.imgdata.data;
	
	return [d[o], d[o+1], d[o+2], d[o+3]];
};

exports.TextureSampler = TextureSampler;
