function Application() {
	var self = this;
	var canvas_parent = $("#canvas_parent");
	var canvas = $("#canvas");

	this.state = {
		STOPPED: 0,
		PLAYING: 1,
		PAUSED: 2
	};
	
	this.presetManager = new PresetManager('/presets');
	this.player = null;
	this.canvas = canvas;
	this.c2d = canvas[0].getContext('2d');
	this.src_node = null;
	this.dst_node = null;
	this.src_slot = null;
	this.src_slot_div = null;
	this.dst_slot = null;
	this.dst_slot_div = null;
	this.edit_conn = null;
	this.shift_pressed = false;
	this.ctrl_pressed = false;
	this.alt_pressed = false;
	this.hover_slot = null;
	this.hover_slot_div = null;
	this.hover_connections = [];
	this.hover_node = null;
	this.hover_nodes = [];
	this.scrollOffset = [0, 0];
	this.selection_start = null;
	this.selection_end = null;
	this.selection_last = null;
	this.selection_nodes = [];
	this.selection_conns = [];
	this.selection_dom = null;
	this.clipboard = null;
	this.in_drag = false;
	this.resize_timer = null;
	this.is_osx = /mac os x/.test(navigator.userAgent.toLowerCase());
	this.condensed_view = false;
	this.collapse_log = true;
	this.selection_border_style = '1px solid #09f';
	this.normal_border_style = 'none';
	this.is_panning = false;
	this.is_fullscreen = false;

	// Make the UI visible now that we know that we can execute JS
	$('.nodisplay').removeClass('nodisplay');

	$('#left-nav-collapse-btn').click(function(e)
	{
		self.toggleLeftPane();
	});

	this.getNIDFromSlot = function(id)
	{
		return parseInt(id.slice(1, id.indexOf('s')));
	};
	
	this.getSIDFromSlot = function(id)
	{
		return parseInt(id.slice(id.indexOf('s') + 2, id.length));
	};
	
	this.offsetToCanvasCoord = function(ofs)
	{
		var o = [ofs.left, ofs.top];
		var co = canvas_parent.offset();
		var so = self.scrollOffset;
		
		o[0] -= co.left;
		o[1] -= co.top;
		o[0] += so[0];
		o[1] += so[1];
		
		return o;
	};
	
	this.getSlotPosition = function(node, slot_div, type, result)
	{
		var area = node.open ? slot_div : node.ui.dom;
		var o = self.offsetToCanvasCoord(area.offset());
	
		result[0] = Math.round(type == E2.slot_type.input ? o[0] : o[0] + area.width() + (node.open ? 0 : 5));
		result[1] = Math.round(o[1] + (area.height() / 2));
	};
	
	this.onPluginsLoaded = function()
	{
	}

	this.onPluginRegistered = function(key, id)
	{
	}

	this.onPluginInstantiated = function(id, pos)
	{	
		var cp = canvas_parent;
		var co = cp.offset();
		var createPlugin = function(name)
		{
			var node = self.player.core.active_graph.create_instance(id, (pos[0] - co.left) + self.scrollOffset[0], (pos[1] - co.top) + self.scrollOffset[1]);
		
			node.reset();

			if(name !== null) // Graph?
			{
				node.title = name;
				node.plugin.graph = new Graph(
					self.player.core,
					node.parent_graph,
					node.parent_graph.tree_node.add_child(name)
				);
				
				node.plugin.graph.plugin = node.plugin;
				node.plugin.graph.reg_listener(node.plugin.graph_event(node.plugin));
				self.player.core.graphs.push(node.plugin.graph);
			}
			
			node.create_ui();
			
			if(node.plugin.state_changed)
			{
				node.plugin.state_changed(null);			
				node.plugin.state_changed(node.ui.plugin_ui);			
			}
		};
		
		if (id === 'graph') {
			bootbox.prompt('Name new graph.', function(name) {
				createPlugin(name);
			});
		}
		else if(id === 'loop')
			createPlugin('Loop');
		else
			createPlugin(null);
	};
	
	this.activateHoverSlot = function()
	{
		var hs = self.hover_slot;
		
		if(!hs)
			return;
		
		self.hover_slot_div[0].style.backgroundColor = E2.erase_color;
		
		// Mark any attached connection
		var conns = self.player.core.active_graph.connections;
		var dirty = false;
		
		conns.some(function(c)
		{
			if(c.dst_slot === hs || c.src_slot === hs)
			{
				c.ui.deleting = true;
				self.hover_connections.push(c);
				dirty = true;
				
				if(hs.type == E2.slot_type.input)
					return true; // Early out if this is an input slot, but continue searching if it's an output slot. There might be multiple connections.
			}
		});

		if(dirty)
			self.updateCanvas(false);
	};
	
	this.releaseHoverSlot = function()
	{
		if(self.hover_slot != null)
		{
			self.hover_slot_div[0].style.backgroundColor = 'inherit';
			self.hover_slot_div[0].style.color = '#000';
			self.hover_slot_div = null;
			self.hover_slot = null;
		}
		
		self.releaseHoverConnections();
	};
	
	this.onSlotClicked = function(node, slot, slot_div, type) { return function(e)
	{
		e.stopPropagation();
		
		if(!self.shift_pressed)
		{
			var graph = self.player.core.active_graph;

			if (type === E2.slot_type.output)
			{
				// drag new connection from output
				self.src_node = node;
				self.src_slot = slot;
				self.src_slot_div = slot_div;

				self.edit_conn = new Connection(null, null, null, null);
				self.edit_conn.create_ui();

				self.getSlotPosition(node, slot_div, E2.slot_type.output, self.edit_conn.ui.src_pos);
			
				var offset = 0;
				
				var ocs = graph.find_connections_from(node, slot);
				ocs.sort(function(a, b) {
					return a.offset < b.offset ? - 1 : a.offset > b.offset ? 1 : 0;
				});
				
				ocs.forEach(function(oc, i)
				{
					oc.offset = i;

					if(oc.offset != i)
					{
						offset = i;
						return;
					}
					
					offset = i + 1;
				});
				
				self.edit_conn.offset = offset;
				slot_div[0].style.color = E2.COLOR_COMPATIBLE_SLOT;
			} else { // drag connection from input
				self.dst_node = node;
				self.dst_slot = slot;
				self.dst_slot_div = slot_div;

				var conn = graph.find_connection_to(node, slot);
				if (!conn)
				{
					// new connection
					self.edit_conn = new Connection(null, null, null, null, 1);
					self.edit_conn.create_ui();
					self.edit_conn.offset = 0;
					self.getSlotPosition(node, slot_div, E2.slot_type.input, self.edit_conn.ui.src_pos);
				}
				else
				{
					// existing connection
					self.src_node = conn.src_node;
					self.src_slot = conn.src_slot;
					self.src_slot_div = conn.ui.src_slot_div;
					self.edit_conn = conn;
				}

				self.onSlotEntered(node, slot, slot_div)(e);
			}
		}
		else
			self.removeHoverConnections();
				
		return false;
	}};

	this.onSlotEntered = function(node, slot, slot_div) { return function(e)
	{
		if (self.edit_conn)
		{
			var ss_dt;

			if (self.edit_conn.direction === 1)
			{
				ss_dt = self.dst_slot.dt;
			} else {
				ss_dt = self.src_slot.dt;
			}

			var any_dt = self.player.core.datatypes.ANY;

			// Only allow connection if datatypes match and slot is unconnected. 
			// Don't allow self-connections. There no complete check for cyclic 
			// redundacies, though we should probably institute one.
			// Additionally, don't allow connections between two ANY slots.
			var isValid = (ss_dt === any_dt || slot.dt === any_dt || ss_dt === slot.dt) && 
				!(ss_dt === any_dt && slot.dt === any_dt) &&
				(!slot.is_connected || // not connected, or
					// source to destination, and dest is slot and source isn't slot
					((self.edit_conn.direction === 0 && self.dst_slot === slot && self.src_node !== node) ||
					// dest to source, and source is slot and dest isn't slot
				   (self.edit_conn.direction === 1 && self.src_slot === slot && self.dst_node !== node)));

			if (self.edit_conn.direction === 1)
			{
				if (slot.type !== E2.slot_type.output)
					isValid = false;

				if (!isValid)
				{
					self.src_node = null;
					self.src_slot = null;
					self.src_slot_div = null;
				}
				else
				{
					self.src_slot = slot;
					self.src_node = node;
					self.src_slot_div = slot_div;
				}
			}
			else
			{
				if (slot.type !== E2.slot_type.input)
					isValid = false;

				if (!isValid)
				{
					self.dst_node = null;
					self.dst_slot = null;
					self.dst_slot_div = null;
				}
				else
				{
					self.dst_node = node;
					self.dst_slot = slot;
					self.dst_slot_div = slot_div;
				}
			}

			if (isValid)
				slot_div[0].style.color = E2.COLOR_COMPATIBLE_SLOT;
			else
				slot_div[0].style.color = E2.erase_color;
		}

		self.hover_slot = slot;
		self.hover_slot_div = slot_div;

		if(self.shift_pressed)
			self.activateHoverSlot();
	}};

	this.onSlotExited = function(node, slot, slot_div) { return function(e)
	{
		if (self.edit_conn)
		{
			if (self.edit_conn.direction === 1)
			{
				self.src_node = null;
			
				if(self.src_slot === slot)
				{
					slot_div[0].style.color = '#000';
					self.src_slot = null;
				}
			}
			else
			{
				self.dst_node = null;
			
				if (self.edit_conn.dst_slot && self.edit_conn.dst_slot.is_connected)
				{
					self.hover_connections = [self.edit_conn];
					self.removeHoverConnections();
					self.edit_conn.dst_slot = null;
				}

				if(self.dst_slot === slot)
				{
					slot_div[0].style.color = '#000';
					self.dst_slot = null;
				}
			}
		}
			
		self.releaseHoverSlot();
	}};
	
	this.updateCanvas = function(clear)
	{
		var c = self.c2d;
		var canvas = self.canvas[0];
		 
		if(clear)
			c.clearRect(0, 0, canvas.width, canvas.height);
				
		var conns = self.player.core.active_graph.connections;
		var cb = [[], [], [], []];
		var styles = ['#888', '#fd9720', '#09f', E2.erase_color];
		
		for(var i = 0, len = conns.length; i < len; i++)
		{
			var cui = conns[i].ui;

			// Draw inactive connections first, then connections with data flow,
			// next selected connections and finally selected connections to 
			// ensure they get rendered on top.
			cb[cui.deleting ? 3 : cui.selected ? 2 : cui.flow ? 1 : 0].push(cui.parent_conn);
		}
		
		if(self.edit_conn)
			cb[0].push(self.edit_conn);
		
		var so = self.scrollOffset;
		
		c.lineWidth = 2;
		c.lineCap = 'square';
		c.lineJoin = 'miter';
		
		for(var bin = 0; bin < 4; bin++)
		{
			var b = cb[bin];

			if(b.length > 0)
			{
				c.strokeStyle = styles[bin];
				c.beginPath();
			
				for(var i = 0, len = b.length; i < len; i++)
				{
                    // Noodles!
                    var cn = b[i].ui;
                    var x1 = (cn.src_pos[0] - so[0]) + 0.5;
                    var y1 = (cn.src_pos[1] - so[1]) + 0.5;
                    var x4 = (cn.dst_pos[0] - so[0]) + 0.5;
                    var y4 = (cn.dst_pos[1] - so[1]) + 0.5;
                    var diffx = Math.max(16, x4 - x1);
                    var x2 = x1 + diffx * 0.5;
                    var x3 = x4 - diffx * 0.5;
        
                    c.moveTo(x1, y1);
                    c.bezierCurveTo(x2, y1, x3, y4, x4, y4);
				}
				
				c.stroke();
			}
		}
		
		// Draw selection fence (if any)
		if(self.selection_start)
		{
			var ss = self.selection_start;
			var se = self.selection_end;
			var so = self.scrollOffset;
			var s = [ss[0] - so[0], ss[1] - so[1]];
			var e = [se[0] - so[0], se[1] - so[1]];
			
			c.lineWidth = 2;
			c.strokeStyle = '#09f';
			c.strokeRect(s[0], s[1], e[0] - s[0], e[1] - s[1]);
		}
	};
	
	this.mouseEventPosToCanvasCoord = function(e, result)
	{
		var cp = canvas_parent[0];
		
		result[0] = (e.pageX - cp.offsetLeft) + self.scrollOffset[0];
		result[1] = (e.pageY - cp.offsetTop) + self.scrollOffset[1];
	};
	
	this.onMouseReleased = function(e)
	{
		var changed = false;

		// Creating a connection?
		if (self.edit_conn)
		{
			var ss = self.src_slot;
			var ds = self.dst_slot;

			if (!ss || !ds)
			{
				self.edit_conn = self.src_node = self.dst_node = null;
				self.updateCanvas(true);
				self.releaseHoverSlot();
				return;
			}

			var c;
			if (self.edit_conn.dst_slot === self.dst_slot && self.edit_conn.src_slot == self.src_slot)
			{
				// already fully connected
				c = self.edit_conn;
			}
			else
			{
				c = new Connection(self.src_node, self.dst_node, ss, ds);
				self.src_node.outputs.push(c);
	
				self.dst_node.add_input(c);

				c.create_ui();
				c.ui.src_pos = self.edit_conn.ui.src_pos.slice(0);
				c.ui.src_slot_div = self.src_slot_div;
				c.ui.dst_slot_div = self.dst_slot_div;
				c.offset = self.edit_conn.offset;
				self.player.core.active_graph.connections.push(c);
			}

			self.getSlotPosition(self.src_node, self.src_slot_div, E2.slot_type.output, c.ui.src_pos);
			self.getSlotPosition(self.dst_node, self.dst_slot_div, E2.slot_type.input, c.ui.dst_pos);

			c.signal_change(true);

			self.dst_slot_div[0].style.color = '#000';
			self.dst_slot.is_connected = true;
			self.dst_slot_div = self.dst_slot = null;
			changed = true;
		}

		if(self.src_slot)
		{
			self.src_slot_div[0].style.color = '#000';
			self.src_slot = self.src_slot_div = null;
			changed = true;
		}
		
		self.dst_node = self.src_node = self.edit_conn = null;
		
		if(changed)
			self.updateCanvas(true);
		else
			E2.dom.structure.tree.on_mouse_up();
	};
	
	this.activateHoverNode = function()
	{
		if(self.hover_node !== null)
		{
			self.hover_node.ui.header_row[0].className += ' pl_delete';
		
			var hcs = self.hover_connections;
			var conns = self.player.core.active_graph.connections;
			
			function iterate_conns(hcs, uid)
			{
				conns.forEach(function(c)
				{
					if(c.src_node.uid == uid || c.dst_node.uid == uid)
					{
						c.ui.deleting = true;
						hcs.push(c);
					}
				});
			};
			
			self.hover_nodes.push(self.hover_node);

			if(self.isNodeInSelection(self.hover_node))
			{
				var nodes = self.selection_nodes;
				
				nodes.forEach(function(node)
				{
					if(node === self.hover_node)
						return;

					node.ui.header_row[0].className += ' pl_delete';
					self.hover_nodes.push(node);
					
					iterate_conns(hcs, node.uid);
				});
			}

			iterate_conns(hcs, self.hover_node.uid);
			
			if(hcs.length > 0)
				self.updateCanvas(false);
		}
	};
	
	this.releaseHoverNode = function(release_conns)
	{
		if(self.hover_node !== null)
		{
			var hn = self.hover_nodes;
			
			self.hover_node = null;
			
			for(var i = 0, len = self.hover_nodes.length; i < len; i++)
				hn[i].ui.header_row[0].className = hn[i].ui.header_row[0].className.replace(' pl_delete', '')
			
			self.hover_nodes = [];
			
			if(release_conns)
				self.releaseHoverConnections();
		}
	};

	this.clearEditState = function()
	{
		self.src_node = null;
		self.dst_node = null;
		self.src_slot = null;
		self.src_slot_div = null;
		self.dst_slot = null;
		self.dst_slot_div = null;
		self.edit_conn = null;
		self.shift_pressed = false;
		self.ctrl_pressed = false;
		self.hover_slot = null;
		self.hover_slot_div = null;
		self.hover_connections = [];
		self.hover_node = null;
	};
	
	this.releaseHoverConnections = function()
	{
		var hcs = self.hover_connections;
		
		if(hcs.length > 0)
		{
			for(var i = 0, len = hcs.length; i < len; i++)
				hcs[i].ui.deleting = false;
			
			self.hover_connections = [];
			self.updateCanvas(false);
		}
		
	};
	
	this.removeHoverConnections = function()
	{
		var hcs = self.hover_connections;
	
		if(hcs.length > 0)
		{
			var graph = self.player.core.active_graph;
			var conns = graph.connections;
			
			// Remove the pending connections from the graph list,
			// so that plugins that rely on notification of graph
			// events can scan this list with meaningful results.
			for(var i = 0, len = hcs.length; i < len; i++)
			{
				var c = hcs[i];
				var idx = conns.indexOf(c);
				
				if(idx > -1)
					conns.splice(idx, 1);

				graph.destroy_connection(c);
			}
			
			for(var i = 0, len = hcs.length; i < len; i++)
				hcs[i].signal_change(false);
			
			self.hover_connections = [];
			self.updateCanvas(true);
		}
	};
		
	this.onNodeHeaderEntered = function(node) { return function(e)
	{
		self.hover_node = node;

		if(self.shift_pressed)
			self.activateHoverNode();
	}};
	
	this.onNodeHeaderExited = function(e)
	{
		self.releaseHoverNode(true);
		self.hover_node = null;
	};
	
	this.deleteHoverNodes = function()
	{
		var hns = self.hover_nodes.slice(0);
		var ag = self.player.core.active_graph;
		
		self.releaseHoverNode(false);
		self.clearSelection();

		self.removeHoverConnections();

		for(var i = 0, len = hns.length; i < len; i++)
		{
			var n = hns[i];
			
			ag.unregister_node(n);
			n.destroy();
		}
		
		self.updateCanvas(true);
	};
	
	this.onNodeHeaderClicked = function(e)
	{
		e.stopPropagation();
		
		if(self.shift_pressed && self.hover_node !== null)
		{
			self.deleteHoverNodes();
		}

		return false;
	};
	
	this.onNodeHeaderDblClicked = function(node) { return function(e)
	{
		bootbox.prompt({
			animate: false,
			title: 'Rename node',
			value: node.title, 
			callback: function(name) {
				if (!name)
					return;

				node.title = name;
			
				if(node.ui !== null) {
					node.ui.dom.find('.t').text(node.title);
					
					if(node.update_connections())
						E2.app.updateCanvas(true)
				}
				
				if(node.plugin.e2_is_graph)
					node.plugin.graph.tree_node.set_title(node.title)
			
				if(node.plugin.renamed)
					node.plugin.renamed()
					
				node.parent_graph.emit_event({ type: 'node-renamed', node: node });
			}
		})
	}}
	
	this.isNodeInSelection = function(node)
	{
		var sn = self.selection_nodes;
		 
		if(sn.length)
		{
			for(var i = 0, len = sn.length; i < len; i++)
			{
				if(sn[i] === node)
					return true;
			}
		}
		
		return false;
	};
	
	this.onNodeDragged = function(node) { return function(e)
	{
		self.in_drag = true;

		var nd = node.ui.dom[0];
		var dx = nd.offsetLeft - node.x;
		var dy = nd.offsetTop - node.y;
		var conns = [];
		var gconns = function(n, coll)
		{
			for(var i = 0, len = n.inputs.length; i < len; i++)
			{
				var c = n.inputs[i];
			
				if(!(c in coll))
					coll.push(c);
			}

			for(var i = 0, len = n.outputs.length; i < len; i++)
			{
				var c = n.outputs[i];
			
				if(!(c in coll))
					coll.push(c);
			}
		};
		
		node.x += dx;
		node.y += dy;
		
		var dirty = node.update_connections();
		
		if(self.isNodeInSelection(node))
		{
			var sn = self.selection_nodes;
			var conns = [];
			
			for(var i = 0, len = sn.length; i < len; i++)
			{
				var n = sn[i];
				
				if(n === node) // Already at the desired location
					continue;
				
				var s = n.ui.dom[0].style;
				
				n.x += dx;
				n.y += dy;
				s.left = '' + (n.x) + 'px';
				s.top = '' + (n.y) + 'px';
				gconns(n, conns);
			}
		}
		
		if(dirty || conns.length)
		{
			var gsp = E2.app.getSlotPosition;
			
			for(var i = 0, len = conns.length; i < len; i++)
			{
				var cn = conns[i];
				var c = cn.ui;
				
				gsp(cn.src_node, c.src_slot_div, E2.slot_type.output, c.src_pos);
				gsp(cn.dst_node, c.dst_slot_div, E2.slot_type.input, c.dst_pos);
			}
			
			self.updateCanvas(true);
		}
	}};
	
	this.onNodeDragStopped = function(node) { return function(e)
	{
		self.onNodeDragged(node)(e);
		self.in_drag = false;
	}};
	
	this.clearSelection = function()
	{
		var sn = self.selection_nodes;
		var sc = self.selection_conns;
		
		for(var i = 0, len = sn.length; i < len; i++)
		{
			var nui = sn[i].ui;
			
			if(nui)
			{
				nui.selected = false;
				nui.dom[0].style.border = self.normal_border_style;
			}
		}
			
		for(var i = 0, len = sc.length; i < len; i++)
		{
			var cui = sc[i].ui;
			
			if(cui) 
				cui.selected = false;
		}

		self.selection_nodes = [];
		self.selection_conns = [];
		
		this.onHideTooltip();
	};
	
	this.onCanvasMouseDown = function(e)
	{
		if(e.target.id !== 'canvas')
			return;
		
		if(e.which === 1) 
		{
			self.selection_start = [0, 0];
			self.mouseEventPosToCanvasCoord(e, self.selection_start);
			self.selection_end = self.selection_start.slice(0);
			self.selection_last = [e.pageX, e.pageY];
			self.clearSelection();
			self.selection_dom = E2.dom.canvas_parent.find(':input').addClass('noselect'); //.attr('disabled', 'disabled');
		}
		else if(e.which === 2)
		{
			self.is_panning = true;
			self.canvas[0].style.cursor = 'move';
			e.preventDefault();
			return;
		}
		else
		{
			self.releaseSelection();
			self.clearSelection();
			E2.app.updateCanvas();
		}
		
		self.in_drag = true;
		self.updateCanvas(false);
	};
	
	this.releaseSelection = function()
	{
		self.selection_start = null;
		self.selection_end = null;
		self.selection_last = null;
		
		if(self.selection_dom)
			self.selection_dom.removeClass('noselect'); // .removeAttr('disabled');
		
		self.selection_dom = null;
	};
	
	this.onCanvasMouseUp = function(e)
	{
		if(e.which === 2)
		{
			self.is_panning = false;
			self.canvas[0].style.cursor = '';
			e.preventDefault();
			return;		
		}
		
		if(!self.selection_start)
			return;
		
		self.releaseSelection();
		
		var nodes = self.selection_nodes;
		
		if(nodes.length)
		{
			var sconns = self.selection_conns;
			
			var insert_all = function(clist)
			{
				for(var i = 0, len = clist.length; i < len; i++)
				{
					var c = clist[i];
					var found = false;
										
					for(var ci = 0, cl = sconns.length; ci < cl; ci++)
					{
						if(c === sconns[ci])
						{
							found = true;
							break;
						}
					}
			
					if(!found)
					{
						c.ui.selected = true;
						sconns.push(c);
					}
				}
			};
			
			// Select all pertinent connections
			for(var i = 0, len = nodes.length; i < len; i++)
			{
				var n = nodes[i];
			    				
				insert_all(n.inputs);
				insert_all(n.outputs);
			}
		}
		
		self.in_drag = false;
		self.updateCanvas(true);
		
		// Clear focus to prevent problems with the user dragging over text areas (bringing them in focus) during selection.
		if(document.activeElement)
    			document.activeElement.blur();
	};

	this.onMouseMoved = function(e)
	{
		self._mousePosition = [e.pageX, e.pageY];

		if(self.is_panning)
		{
			var cp = E2.dom.canvas_parent;
			
			if(e.movementX)
			{
				cp.scrollLeft(self.scrollOffset[0]-e.movementX);
				self.scrollOffset[0] = cp.scrollLeft();
			}
			
			if(e.movementY)
			{
				cp.scrollTop(self.scrollOffset[1]-e.movementY);
				self.scrollOffset[1] = cp.scrollTop();
			}
			
			e.preventDefault();
			return;
		}
		else if(self.edit_conn)
		{
			var cp = E2.dom.canvas_parent;
			var pos = cp.position();
			var w = cp.width();
			var h = cp.height();
			var x2 = pos.left + w;
			var y2 = pos.top + h;
			
			if(e.pageX < pos.left)
				cp.scrollLeft(self.scrollOffset[0] - 20);
			else if(e.pageX > x2)
				cp.scrollLeft(self.scrollOffset[0] + 20);
					
			if(e.pageY < pos.top)
				cp.scrollTop(self.scrollOffset[1] - 20);
			else if(e.pageY > y2)
				cp.scrollTop(self.scrollOffset[1] + 20);

			self.mouseEventPosToCanvasCoord(e, self.edit_conn.ui.dst_pos);
			self.updateCanvas(true);

			return;
		}
		else if(!self.selection_start)
		{
			E2.dom.structure.tree.on_mouse_move(e);
			return;
		}
		
		if(!self.selection_end)
			return;
		
		self.mouseEventPosToCanvasCoord(e, self.selection_end);
		
		var nodes = self.player.core.active_graph.nodes;
		var cp = E2.dom.canvas_parent;
		
		var ss = self.selection_start.slice(0);
		var se = self.selection_end.slice(0);
		
		for(var i = 0; i < 2; i++)
		{
			if(se[i] < ss[i])
			{
				var t = ss[i];
			
				ss[i] = se[i];
				se[i] = t;
			}
		}
		
		var sn = self.selection_nodes;
		var ns = [];
		
		for(var i = 0, len = sn.length; i < len; i++)
			sn[i].ui.selected = false;

		for(var i = 0, len = nodes.length; i < len; i++)
		{
			var n = nodes[i],
			    nui = n.ui.dom[0],
			    p_x = nui.offsetLeft,
			    p_y = nui.offsetTop,
			    p_x2 = p_x + nui.clientWidth,
			    p_y2 = p_y + nui.clientHeight;
			    
			if(se[0] < p_x || se[1] < p_y || ss[0] > p_x2 || ss[1] > p_y2)
				continue; // No intersection.
				
			if(!n.ui.selected)
			{
				self.markNodeAsSelected(n, false);
				ns.push(n);
			}
		}
		
		for(var i = 0, len = sn.length; i < len; i++)
		{
			var n = sn[i];
			
			if(!n.ui.selected)
				n.ui.dom[0].style.border = self.normal_border_style;
		}
		
		self.selection_nodes = ns;
		
		var co = cp.offset();
		var w = cp.width();
		var h = cp.height();
		var dx = e.pageX - self.selection_last[0];
		var dy = e.pageY - self.selection_last[1];

		if((dx < 0 && e.pageX < co.left + (w * 0.15)) || (dx > 0 && e.pageX > co.left + (w * 0.85)))
			cp.scrollLeft(self.scrollOffset[0] + dx);
		
		if((dy < 0 && e.pageY < co.top + (h * 0.15)) || (dy > 0 && e.pageY > co.top + (h * 0.85)))
			cp.scrollTop(self.scrollOffset[1] + dy);
		
		self.selection_last[0] = e.pageX;
		self.selection_last[1] = e.pageY;
		
		self.updateCanvas(true);
	};

	this.selectionToObject = function(nodes, conns, sx, sy) {
		var d = {};
		var x1 = 9999999.0, y1 = 9999999.0, x2 = 0, y2 = 0;

		sx = sx || 50
		sy = sy || 50

		d.nodes = [];
		d.conns = [];
		
		for(var i = 0, len = nodes.length; i < len; i++)
		{
			var n = nodes[i];
			var dom = n.ui ? n.ui.dom : null;
			var p = dom ? dom.position() : { left: n.x, top: n.y };
			var b = [p.left, p.top, p.left + (dom ? dom.width() : 0), p.top + (dom ? dom.height() : 0)]; 
			
			if(dom)
				n = n.serialise();
			
			if(b[0] < x1) x1 = b[0];
			if(b[1] < y1) y1 = b[1];
			if(b[2] > x2) x2 = b[2];
			if(b[3] > y2) y2 = b[3];
			
			d.nodes.push(n);
		}
		
		d.x1 = x1 + sx;
		d.y1 = y1 + sy;
		d.x2 = x2 + sx;
		d.y2 = y2 + sy;
		
		for(var i = 0, len = conns.length; i < len; i++)
		{
			var c = conns[i];
			
			d.conns.push(c.ui ? c.serialise() : c);
		}
			
		return d;
	}

	this.fillCopyBuffer = function(nodes, conns, sx, sy) {
		self.clipboard = JSON.stringify(self.selectionToObject(nodes, conns, sx, sy))
		msg('Copy.')
	};

	this.onDelete = function(e)
	{
		if(!self.selection_nodes.length)
			return;

		self.hover_node = self.selection_nodes[0];
		self.activateHoverNode();
		self.deleteHoverNodes();
	};
	
	this.onCopy = function(e)
	{
		if(self.selection_nodes.length < 1)
		{
			msg('Copy: Nothing selected.');
			e.stopPropagation();
			return false;
		}
		
		self.fillCopyBuffer(self.selection_nodes, self.selection_conns, self.scrollOffset[0], self.scrollOffset[1]);
		e.stopPropagation();
		return false;
	};
	
	this.onCut = function(e)
	{
		msg('Cut.');
		
		if(self.selection_nodes.length > 0)
		{
			self.onCopy(e);
			self.onDelete(e);
		}
	};

	this.onPaste = function(e)
	{
		if(self.clipboard === null)
			return;
		
		msg('Paste.');
		self.clearSelection();

		var d = JSON.parse(self.clipboard);
		var cp = E2.dom.canvas_parent;
		var ag = self.player.core.active_graph;
		var n_lut = {};
		var sx = self.scrollOffset[0];
		var sy = self.scrollOffset[1];

		bw2 = Math.max(self._mousePosition[0] - cp.position().left + sx, 30);
		bh2 = Math.max(self._mousePosition[1] - cp.position().top + sy, 30);
		
		for(var i = 0, len = d.nodes.length; i < len; i++)
		{
			var node = d.nodes[i];
			
			var n = new Node(null, null, null, null);
			var new_uid = ag.get_node_uid();

			node.x = Math.floor((node.x - d.x1) + bw2);
			node.y = Math.floor((node.y - d.y1) + bh2);

			if(!n.deserialise(ag.uid, node))
				continue;
			
			n_lut[n.uid] = new_uid;
			n.uid = new_uid;
			
			ag.register_node(n);
			ag.emit_event({ type: 'node-created', node: n });

			n.patch_up(self.player.core.graphs);
			self.selection_nodes.push(n);
		}

		for(var i = 0, len = d.conns.length; i < len; i++)
		{
			var cn = d.conns[i];
			
			var suid = n_lut[cn.src_nuid];
			var duid = n_lut[cn.dst_nuid];
			
			if(suid === undefined || duid === undefined)
			{
				// We have to clear the the is_connected flag from the destination
				// slot. Otherwise the user will be unable to connect to it. 
				if(duid !== undefined)
				{
					for(var ni = 0, len2 = self.selection_nodes.length; ni < len2; ni++)
					{
						var n = self.selection_nodes[ni];
						
						if(n.uid === duid)
						{
							var slots = cn.dst_dyn ? n.dyn_inputs : n.plugin.input_slots;
							var slot = slots[cn.dst_slot];
							
							slot.is_connected = false;
							slot.connected = false;
							n.inputs_changed = true;
		
							// TODO: Does any of the graph internal state need clearing at this point?
							// Do we need to find a way to correctly call connection_changed() here?
							
							break; // Early out
						}
					}
				}
				
				continue;
			}
			
			var c = new Connection(null, null, null, null);

			c.deserialise(cn);
			
			c.src_node = suid;
			c.dst_node = duid;
			
			if(c.patch_up(ag.nodes))
			{
				ag.connections.push(c);

				c.create_ui();
				c.ui.selected = true;
				self.selection_conns.push(c);
			}
		}
		
		var r_init_struct = function(pg, n)
		{
			n.parent_graph = pg;
			
			if(!n.plugin.e2_is_graph)
				return;

			n.plugin.graph.tree_node = n.parent_graph.tree_node.add_child(n.title);
			n.plugin.graph.tree_node.graph = n.plugin.graph;
			n.plugin.graph.uid = E2.app.player.core.get_graph_uid();
			n.plugin.graph.parent_graph = pg;
		
			var nodes = n.plugin.graph.nodes;
			
			for(var i = 0, len = nodes.length; i < len; i++)
				r_init_struct(n.plugin.graph, nodes[i]);
		};
		
		for(var i = 0, len = self.selection_nodes.length; i < len; i++)
		{
			var n = self.selection_nodes[i];

			n.initialise();

			if(n.plugin.reset)
				n.plugin.reset();			

			n.create_ui();

			self.markNodeAsSelected(n, false);

			if(n.plugin.state_changed)
				n.plugin.state_changed(n.ui.plugin_ui);			
			
			r_init_struct(ag, n);
		}
		
		for(var i = 0, len = self.selection_conns.length; i < len; i++)
		{
			var cui = self.selection_conns[i].ui;
			
			cui.resolve_slot_divs();
			E2.app.getSlotPosition(cui.parent_conn.src_node, cui.src_slot_div, E2.slot_type.output, cui.src_pos);
			E2.app.getSlotPosition(cui.parent_conn.dst_node, cui.dst_slot_div, E2.slot_type.input, cui.dst_pos);
		}
		
		if(d.conns.length)
			self.updateCanvas(false);
	};

	this.markNodeAsSelected = function(node, addToSelection)
	{
		node.ui.dom[0].style.border = self.selection_border_style;
		node.ui.selected = true;
		if (addToSelection !== false)
			self.selection_nodes.push(node);
	}

	this.selectAll = function()
	{
		self.clearSelection();
		
		var ag = self.player.core.active_graph;

		ag.nodes.map(self.markNodeAsSelected);
		
		ag.connections.map(function(c)
		{
			c.ui.selected = true;
			self.selection_conns.push(c);
		});

		self.updateCanvas(true);
	};
	
	this.onWindowResize = function() {
		if (E2.app.player.core.renderer.fullscreen)
			return;

		var glc = E2.dom.webgl_canvas[0];
		var canvases = $('#canvases');
		var width = canvases[0].clientWidth;
		var height = canvases[0].clientHeight

		if (glc.width !== width || glc.height !== height)
		{
			glc.width = width;
			glc.height = height;

			E2.dom.webgl_canvas.css('width', width);
			E2.dom.webgl_canvas.css('height', height);
			E2.dom.canvas_parent.css('width', width);
			E2.dom.canvas_parent.css('height', height);
			E2.dom.canvas[0].width = width;
			E2.dom.canvas[0].height = height;
			E2.dom.canvas.css('width', width);
			E2.dom.canvas.css('height', height);
			E2.app.player.core.renderer.update_viewport();
		}

		if(self.player)
			self.updateCanvas(true);
	};

	this.toggleLeftPane = function()
	{
		$('#left-nav-collapse-btn').toggleClass('fa-angle-left fa-angle-right');

		self.condensed_view = !self.condensed_view;

		E2.dom.left_nav.toggle(!self.condensed_view);
		E2.dom.mid_pane.toggle(!self.condensed_view);
		$('.resize-handle').toggle(!self.condensed_view);
		
		if(self.condensed_view)
			E2.dom.dbg.toggle(false);
		else if(!self.collapse_log)
			E2.dom.dbg.toggle(true);
		
		self.onWindowResize();
	};

	this.onKeyDown = function(e)
	{
		function is_text_input_in_focus() {
			var rx = /INPUT|SELECT|TEXTAREA/i;
			return (rx.test(e.target.tagName) || e.target.disabled || e.target.readOnly);
		}

		if(is_text_input_in_focus())
			return;

		if(e.keyCode === 8 || e.keyCode === 46) // use backspace and delete for deleting nodes
		{
			self.onDelete(e);
			e.preventDefault();
		}
		else if(e.keyCode === 9) // tab to show/hide noodles
		{
			E2.dom.canvas_parent.toggle();
			e.preventDefault();
		}
		else if(e.keyCode === 18) // alt
		{
			self.alt_pressed = true;
		}
		else if(e.keyCode === 17) // CMD on OSX, CTRL on everything else
		{
			self.ctrl_pressed = true;
		}
		else if(e.keyCode === 16) // .isShift doesn't work on Chrome. This does.
		{
			self.shift_pressed = true;
			self.activateHoverSlot();
			self.activateHoverNode();
		}
		else if(e.keyCode === 70) // f
		{
			self.is_fullscreen = !self.is_fullscreen;
			self.player.core.renderer.set_fullscreen(self.is_fullscreen);
			e.preventDefault();
		}
		else if(e.keyCode === 32) // space
		{
			if(self.player.current_state === self.player.state.PLAYING)
			{
				if(self.ctrl_pressed || e.metaKey)
					self.onPauseClicked();
				else
					self.onStopClicked();
			}
			else
			{
				self.onPlayClicked();
			}
			
			e.preventDefault();
			return false;
		}
		else if(self.ctrl_pressed || e.metaKey)
		{
			if(e.keyCode === 65) // CTRL+a
			{
				self.selectAll();
				e.preventDefault(); // FF uses this combo for opening the bookmarks sidebar.
				e.stopPropagation();
				return false;
			}
			if(e.keyCode === 66) // CTRL+b
			{
				self.toggleLeftPane();
				e.preventDefault(); // FF uses this combo for opening the bookmarks sidebar.
				return;
			}
			else if(e.keyCode === 76) // CTRL+l
			{
				self.collapse_log = !self.collapse_log;
				E2.dom.dbg.toggle(!self.collapse_log);
				
				if(!self.collapse_log)
					msg(null); // Update scroll position.
					
				self.onWindowResize();
				e.preventDefault();
				return;
			}

			if(e.keyCode === 67) // CTRL+c
				self.onCopy(e);
			else if(e.keyCode === 88) // CTRL+x
				self.onCut(e);
			else if(e.keyCode === 86) // CTRL+v
				self.onPaste(e);
		}
	};

	this.onKeyUp = function(e)
	{
		if(e.keyCode === 17) // CMD on OSX, CTRL on everything else
		{
			self.ctrl_pressed = false;
		}
		else if (e.keyCode === 18)
		{
			self.alt_pressed = false;
		}
		else if(e.keyCode === 16)
		{
			self.shift_pressed = false;
			self.releaseHoverSlot();
			self.releaseHoverNode(false);
		}
	};

	this.changeControlState = function()
	{
		var s = self.player.state;
		var cs = self.player.current_state;

		if (cs !== s.PLAYING) {
			E2.dom.play_i.removeClass('fa-pause')
			E2.dom.play_i.addClass('fa-play')
			E2.dom.stop.addClass('disabled')
		} else {
			E2.dom.play_i.removeClass('fa-play')
			E2.dom.play_i.addClass('fa-pause')
			E2.dom.stop.removeClass('disabled')
		}
	}
	
	this.onPlayClicked = function()
	{
		if (self.player.current_state === self.player.state.PLAYING)
			self.player.pause();
		else
			self.player.play();

		self.changeControlState();
	};
	
	this.onPauseClicked = function()
	{
		self.player.pause();
		self.changeControlState();
	};

	this.onStopClicked = function()
	{
		self.player.schedule_stop(self.changeControlState);
	};

	this.onOpenClicked = function() {
		FileSelectControl
			.createGraphSelector(null, 'Open', function(path) {
				history.pushState({
					graph: {
						path: path
					}
				}, '', path + '/edit')

				E2.app.midPane.closeAll()
				E2.app.loadGraph('/data/graph'+path+'.json')
			})
	}

	this.loadGraph = function(graphPath)
	{
		E2.app.onStopClicked();
		E2.app.player.on_update();
		E2.dom.filename_input.val(graphPath);
		E2.app.player.load_from_url(graphPath);
	};

	this.onSaveAsPresetClicked = function() {
		self.openPresetSaveDialog()
	}

	this.onSaveSelectionAsPresetClicked = function() {
		var graph = self.selectionToObject(self.selection_nodes, self.selection_conns)
		self.openPresetSaveDialog(JSON.stringify({ root: graph }))
	}

	this.openPresetSaveDialog = function(serializedGraph) {
		var username = E2.models.user.get('username')
		if (!username) {
			return E2.controllers.account.openLoginModal()
		}

		var presetsPath = '/'+username+'/presets/'

		E2.dom.load_spinner.show()

		$.get(presetsPath, function(files) {
			var fcs = new FileSelectControl()
			.frame('save-frame')
			.template('preset')
			.buttons({
				'Cancel': function() {},
				'Save': function(name) {
					if (!name)
						return bootbox.alert('Please enter a name for the preset')

					serializedGraph = serializedGraph || self.player.core.serialise()

					$.ajax({
						type: 'POST',
						url: presetsPath,
						data: {
							name: name,
							graph: serializedGraph
						},
						dataType: 'json',
						success: function(saved) {
							E2.dom.load_spinner.hide()
							self.presetManager.refresh()
						},
						error: function(x, t, err) {
							E2.dom.load_spinner.hide();

							if (x.status === 401)
								return E2.controllers.account.openLoginModal();

							if (x.responseText)
								bootbox.alert('Save failed: ' + x.responseText);
							else
								bootbox.alert('Save failed: ' + err);
						}
					});
				}
			})
			.files(files)
			.modal();
			
			return fcs;
		})
	};

	this.onSaveClicked = function(cb)
	{
		self.openSaveDialog();
	}

	this.openSaveDialog = function(cb)
	{
		if (!E2.models.user.get('username'))
		{
			return E2.controllers.account.openLoginModal();
		}

		E2.dom.load_spinner.show();

		$.get(URL_GRAPHS, function(files)
		{
			var wh = window.location.hash;
			var fcs = new FileSelectControl()
			.frame('save-frame')
			.template('graph')
			.buttons({
				'Cancel': function() {},
				'Save': function(path, tags)
				{
					if (!path)
						return bootbox.alert('Please enter a filename');

					var ser = self.player.core.serialise();

					$.ajax({
						type: 'POST',
						url: URL_GRAPHS,
						data: {
							path: path,
							tags: tags,
							graph: ser
						},
						dataType: 'json',
						success: function(saved)
						{
							E2.dom.load_spinner.hide();
							history.pushState({}, '', saved.path+'/edit');
							if (cb)
								cb();
						},
						error: function(x, t, err)
						{
							E2.dom.load_spinner.hide();

							if (x.status === 401)
								return E2.controllers.account.openLoginModal();

							if (x.responseText)
								bootbox.alert('Save failed: ' + x.responseText);
							else
								bootbox.alert('Save failed: ' + err);
						}
					});
				}
			})
			.files(files)
			.selected(window.location.pathname.split('/')[2])
			.modal();
			
			return fcs;
		})
	};

	this.onPublishClicked = function()
	{
		self.openSaveDialog(function()
		{
			window.location.href = '//vizor.io/'+window.location.pathname.split('/').slice(1,3).join('/');
		});
	}
	
	this.onLoadClipboardClicked = function()
	{
		var url = URL_GRAPHS + E2.dom.filename_input.val();

		$.get(url, function(d) {
			self.fillCopyBuffer(d.root.nodes, d.root.conns, 0, 0);
		});
	};

	this.onShowTooltip = function(e)
	{
		if(self.in_drag)
			return false;
		
		var $elem = $(e.currentTarget);
		var tokens = $elem.attr('alt').split('_');
		var core = self.player.core;
		var node = core.active_graph.nuid_lut[parseInt(tokens[0], 10)];
		var txt = '';
		
		if(tokens.length < 2) // Node?
		{
			var p_name = core.plugin_mgr.keybyid[node.plugin.id];
			
			txt += '<b>' + p_name + '</b><br/><br/>' + node.plugin.desc;
		}
		else // Slot
		{
			var plugin = node.plugin;
			var slot = null;

			if(tokens[1][0] === 'd')
				slot = node.find_dynamic_slot(tokens[1][1] === 'i' ? E2.slot_type.input : E2.slot_type.output, parseInt(tokens[2], 10));
			else
				slot = (tokens[1][1] === 'i' ? plugin.input_slots : plugin.output_slots)[parseInt(tokens[2], 10)];
			
			txt = '<b>Type:</b> ' + slot.dt.name;
	
			if(slot.lo !== undefined || slot.hi !== undefined)
				txt += '<br /><b>Range:</b> ' + (slot.lo !== undefined ? 'min. ' + slot.lo : '') + (slot.hi !== undefined ? (slot.lo !== undefined ? ', ' : '') + 'max. ' + slot.hi : '')
	
			if(slot.def !== undefined)
			{
				txt += '<br /><b>Default:</b> ';
				
				if(slot.def === null)
					txt += 'Nothing';
				else if(slot.def === self.player.core.renderer.matrix_identity)
					txt += 'Identity';
				else if(slot.def === self.player.core.renderer.material_default)
					txt += 'Default material';
				else if(slot.def === self.player.core.renderer.light_default)
					txt += 'Default light';
				else if(slot.def === self.player.core.renderer.camera_screenspace)
					txt += 'Screenspace camera';
				else
				{
					var cn = slot.def.constructor.name;
					
					if(cn === 'Texture')
					{
						txt += 'Texture';
						
						if(slot.def.image && slot.def.image.src)
							txt += ' (' + slot.def.image.src + ')';
					}
					else
						txt += JSON.stringify(slot.def);
				}
			}
			
			txt += '<br /><br />';
	
			if(slot.desc)
				txt += slot.desc.replace(/\n/g, '<br/>');
		}
		
		clearTimeout(self._tooltipTimer);

		self._tooltipTimer = setTimeout(function() {
			if (self.in_drag)
				return;

			$elem.tooltip(
			{
				title: txt,
				container: 'body',
				animation: false,
				trigger: 'manual',
				html: true
			})
			.tooltip('show');

			self._tooltipElem = $elem;

		}, 500);
		
	};
	
	this.onHideTooltip = function()
	{
		clearTimeout(self._tooltipTimer);
		if (self._tooltipElem)
		{
			self._tooltipElem.tooltip('hide');
			self._tooltipElem = null;
		}

		if(self.in_drag)
			return false;
	};
	
   	document.addEventListener('mouseup', this.onMouseReleased);
	document.addEventListener('mousemove', this.onMouseMoved);
	window.addEventListener('keydown', this.onKeyDown);
	window.addEventListener('keyup', this.onKeyUp);
	
	canvas_parent[0].addEventListener('scroll', function()
	{
		self.scrollOffset = [ canvas_parent.scrollLeft(), canvas_parent.scrollTop() ];
		var s = canvas[0].style;
		
		s.left = '' + self.scrollOffset[0] + 'px';
		s.top = '' + self.scrollOffset[1] + 'px';
		self.updateCanvas(true);
	});
	
	canvas_parent[0].addEventListener('mousedown', this.onCanvasMouseDown);
	document.addEventListener('mouseup', this.onCanvasMouseUp);
	
	// Clear hover state on window blur. Typically when the user switches
	// to another tab.
	window.addEventListener('blur', function()
	{
		self.shift_pressed = false;
		self.ctrl_pressed = false;
		self.releaseHoverSlot();
		self.releaseHoverNode(false);
	});
	
	window.addEventListener('resize', function(self) { return function()
	{
		// To avoid UI lag, we don't respond to window resize events directly.
		// Instead, we set up a timer that gets superceeded for each (spurious)
		// resize event within a 100 ms window.
		clearTimeout(self.resize_timer);
		self.resize_timer = setTimeout(self.onWindowResize, 200);
	}}(this));

	var add_button_events = function(btn)
	{
		// We have to forward key events that would otherwise get trapped when
		// the user hovers over the playback control buttons.
		btn[0].addEventListener('keydown', this.onKeyDown);
		btn[0].addEventListener('keyup', this.onKeyUp);
	};
	
	add_button_events(E2.dom.play);
	add_button_events(E2.dom.stop);
	add_button_events(E2.dom.save);
	add_button_events(E2.dom.open);

	// close bootboxes on click 
	$(document).on('click', '.bootbox.modal.in', function(e) {
		var $et = $(e.target)
		if (!$et.parents('.modal-dialog').length)
			bootbox.hideAll()
	})

	$('button#fullscreen').click(function() {
		self.player.core.renderer.set_fullscreen(true);
	});
	
	$('button#help').click(function() {
		window.open('/help/introduction.html', 'Vizor Create Help');
	});

	$('.resize-handle').on('mousedown', function(e) {
		var $handle = $(e.target)
		var $pane = $($handle.data('target'))
		var ow = $pane.width()
		var ox = e.pageX
		var $doc = $(document)
		var changed = false

		e.preventDefault()

		function mouseMoveHandler(e) {
			changed = true
			var nw = ow + (e.pageX - ox)
			e.preventDefault()
			$pane.css('flex', '0 0 '+nw+'px')
			$pane.css('width', nw+'px')
			$pane.css('max-width', nw+'px')
			E2.app.onWindowResize()
		}

		$doc.on('mousemove', mouseMoveHandler)
		$doc.one('mouseup', function(e) {
			if (!changed) {
				$pane.toggleClass('pane-hidden')
				E2.app.onWindowResize()
			}
			e.preventDefault()
			$doc.off('mousemove', mouseMoveHandler)
		})
	})

	self.midPane = new E2.MidPane();

	this.onHideTooltip();
}





$('.mid-pane').hide();
setTimeout(function() {
	$('.mid-pane').show();
},500)

