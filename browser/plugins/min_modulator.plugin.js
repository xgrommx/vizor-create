E2.p = E2.plugins["min_modulator"] = function(core, node)
{
	this.desc = 'Emit the lesser of the two input values.';
	
	this.input_slots = [ 
		{ name: 'value', dt: core.datatypes.FLOAT, desc: 'The first input value', def: 0.0 },
		{ name: 'value', dt: core.datatypes.FLOAT, desc: 'The second input value', def: 0.0 } 
	];
	
	this.output_slots = [
		{ name: 'min', dt: core.datatypes.FLOAT, desc: 'The smaller of the two supplied values.', def: 0.0 }
	];
};

E2.p.prototype.reset = function()
{
	this.val_a = 0.0;
	this.val_b = 0.0;
	this.output_val = 0.0;
};

E2.p.prototype.update_input = function(slot, data)
{
	if(slot.index === 0)
		this.val_a = data;
	else
		this.val_b = data;
};	

E2.p.prototype.update_state = function()
{
	this.output_val = Math.min(this.val_a, this.val_b);
};

E2.p.prototype.update_output = function(slot)
{
	return this.output_val;
};
