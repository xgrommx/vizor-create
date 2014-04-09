function Color(r, g, b, a)
{
	this.rgba = [r, g, b, a || 1.0];
}

Color.prototype.clone = function(src)
{
	var s = src.rgba, d = this.rgba;
	
	d[0] = s[0];
	d[1] = s[1];
	d[2] = s[2];
	d[3] = s[3];
};

exports.Color = Color;
