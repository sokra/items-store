/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function ItemsStoreLease() {
	this.leases = undefined;
}

module.exports = ItemsStoreLease;

ItemsStoreLease.prototype.capture = function(fn, onUpdate) {
	var newLeases = [];
	var leases = this.leases;
	function listenTo(Store, id) {
		var lease = Store.listenToItem(id, onUpdate);
		var idx = newLeases.indexOf(lease);
		if(idx < 0) {
			if(leases) {
				idx = leases.indexOf(lease);
				if(idx >= 0)
					leases.splice(idx, 1);
			}
			newLeases.push(lease);
		}
	}
	var error = null;
	try {
		var ret = fn(listenTo);
	} catch(e) {
		error = e;
	}
	if(leases) {
		leases.forEach(function(lease) {
			lease.close();
		});
	}
	this.leases = newLeases;
	if(error) throw error;
	return ret;
};

ItemsStoreLease.prototype.close = function() {
	if(this.leases) {
		this.leases.forEach(function(lease) {
			lease.close();
		});
	}
	this.leases = undefined;
};
