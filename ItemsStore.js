/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function ItemsStore(desc, initialData) {
	if(!desc || typeof desc !== "object")
		throw new Error("Invalid argument: desc must be an object");
	desc.applyUpdate = desc.applyUpdate || applyUpdate;
	desc.mergeUpdates = desc.mergeUpdates || mergeUpdates;
	desc.rebaseUpdate = desc.rebaseUpdate || rebaseUpdate;
	desc.applyNewData = desc.applyNewData || applyNewData;
	desc.applyNewError = desc.applyNewError || applyNewError;
	desc.queueRequest = desc.queueRequest || process.nextTick.bind(process);
	this.desc = desc;
	this.items = initialData ? Object.keys(initialData).reduce(function(obj, key) {
		obj[key] = {
			data: initialData[key],
			tick: 0
		};
		return obj;
	}, {}) : {};
	this.createableItems = [];
	this.deletableItems = [];
	this.requesting = false;
	this.invalidItems = [];
	this.updateTick = 0;
	this.supportCreate = desc.createSingleItem || desc.createMultipleItems ||
		desc.createAndReadSingleItem || desc.createAndReadMultipleItems;
	this.supportDelete = desc.deleteSingleItem || desc.deleteMultipleItems;
	this.supportWrite = desc.writeSingleItem || desc.writeMultipleItems ||
		desc.writeAndReadSingleItem || desc.writeAndReadMultipleItems;
	this.supportRead = desc.readSingleItem || desc.readMultipleItems;
}

module.exports = ItemsStore;

/*

item = { outdated: true }
no item data available and data should be requested

item = { data: {} }
item data available

item = { data: {}, outdated: true }
item data available, but data should be renewed by request

item = { data: {}, update: {}, newData: {} }
item data available, but it should be updated with the "update" and "newData"

item = { update: {} }
no item data available and it should be updated with the "update"

*/

ItemsStore.prototype._createItem = function() {
	return {
		data: undefined,
		update: undefined,
		newData: undefined,
		error: undefined,
		outdated: undefined,
		tick: undefined,
		handlers: undefined,
		infoHandlers: undefined
	};
}

ItemsStore.prototype.getData = function() {
	var data = {};
	var hasData = false;
	Object.keys(this.items).forEach(function(key) {
		if(this.items[key].data) {
			data[key] = this.items[key].data;
			hasData = true;
		}
	}, this);
	if(hasData)
		return data;
};

ItemsStore.prototype.outdate = function(id) {
	if(typeof id === "string") {
		var item = this.items["_" + id];
		if(!item) return;
		item.tick = null;
	} else {
		this.updateTick++;
	}
};

ItemsStore.prototype.update = function(allOrId) {
	if(typeof allOrId === "string") {
		var id = allOrId;
		var item = this.items["_" + id];
		if(!item) return;
		if(!item.outdated) {
			item.outdated = true;
			this.invalidateItem(id);
			if(item.infoHandlers) {
				var handlers = item.infoHandlers.slice();
				handlers.forEach(function(fn) {
					fn(item.newData !== undefined ? item.newData : item.data);
				});
			}
		}
	} else {
		this.updateTick++;
		Object.keys(this.items).forEach(function(key) {
			var id = key.substr(1);
			var item = this.items[key];
			if(!item) return;
			if(!item.outdated && (allOrId || (item.handlers && item.handlers.length > 0))) {
				item.outdated = true;
				this.invalidateItem(id);
			}
		}, this);
	}
};

ItemsStore.prototype.listenToItem = function(id, handler) {
	if(typeof handler !== "function") throw new Error("handler argument must be a function");
	var lease = {
		close: function lease() {
			var item = this.items["_" + id];
			if(!item) return;
			var idx = item.handlers.indexOf(handler);
			if(idx < 0) return;
			item.handlers.splice(idx, 1);
			item.leases.splice(idx, 1);
			// TODO stream: if item.handlers.length === 0
		}.bind(this)
	};
	var item = this.items["_" + id];
	if(!item) {
		item = this._createItem();
		item.handlers = [handler];
		item.leases = [lease];
		item.outdated = true;
		this.items["_" + id] = item;
		this.invalidateItem(id);
	} else {
		if(item.handlers) {
			var idx = item.handlers.indexOf(handler);
			if(idx >= 0) {
				return item.leases[idx];
			}
			item.handlers.push(handler);
			item.leases.push(lease);
		} else {
			item.handlers = [handler];
			item.leases = [lease];
		}
		if(item.tick !== this.updateTick && !item.outdated) {
			item.outdated = true;
			this.invalidateItem(id);
		}
	}
	// TODO stream: start streaming
	return lease;
}

ItemsStore.prototype.waitForItem = function(id, callback) {
	var self = this;
	var onUpdate = function() {
		if(!self.isItemUpToDate(id)) return;
		var idx = item.infoHandlers.indexOf(onUpdate);
		if(idx < 0) return;
		item.infoHandlers.splice(idx, 1);
		callback();
	};

	var item = this.items["_" + id];
	if(!item) {
		item = this._createItem();
		item.infoHandlers = [onUpdate];
		item.outdated = true;
		this.items["_" + id] = item;
		this.invalidateItem(id);
	} else {
		if(this.isItemUpToDate(id)) {
			callback();
			return;
		}
		if(item.infoHandlers) {
			item.infoHandlers.push(onUpdate);
		} else {
			item.infoHandlers = [onUpdate];
		}
		if(!item.outdated && item.tick !== this.updateTick) {
			item.outdated = true;
			this.invalidateItem(id);
		}
	}
};

ItemsStore.prototype.getItem = function(id) {
	var item = this.items["_" + id];
	if(!item) return undefined;
	return item.newData !== undefined ? item.newData : item.data;
};

ItemsStore.prototype.isItemAvailable = function(id) {
	var item = this.items["_" + id];
	return !!(item && item.data !== undefined);
};

ItemsStore.prototype.isItemUpToDate = function(id) {
	var item = this.items["_" + id];
	return !!(item && item.data !== undefined && !item.outdated && item.tick === this.updateTick);
};

ItemsStore.prototype.getItemInfo = function(id) {
	var item = this.items["_" + id];
	if(!item) return {
		available: false,
		outdated: false,
		updated: false,
		listening: false,
		error: undefined
	};
	return {
		available: item.data !== undefined,
		outdated: !(!item.outdated && item.tick === this.updateTick),
		updated: item.update !== undefined,
		listening: !!item.handlers && item.handlers.length > 0,
		error: item.error
	};
};

ItemsStore.prototype.updateItem = function(id, update) {
	if(!this.supportWrite)
		throw new Error("Store doesn't support updating of items");
	var item = this.items["_" + id];
	if(!item) {
		item = this._createItem();
		item.update = update;
		this.items["_" + id] = item;
	} else {
		if(item.data !== undefined) {
			item.newData = this.desc.applyUpdate(item.newData !== undefined ? item.newData : item.data, update);
		}
		if(item.update !== undefined) {
			item.update = this.desc.mergeUpdates(item.update, update);
		} else {
			item.update = update;
		}
	}
	this.invalidateItem(id);
	if(item.data !== undefined && item.handlers) {
		var handlers = item.handlers.slice();
		handlers.forEach(function(fn) {
			fn(item.newData);
		});
	}
};

ItemsStore.prototype.createItem = function(data, handler) {
	if(!this.supportCreate)
		throw new Error("Store doesn't support creating of items");
	this.createableItems.push({
		data: data,
		handler: handler
	});
	if(!this.requesting) {
		this.requesting = true;
		this._queueRequest();
	}
};

ItemsStore.prototype.deleteItem = function(id, handler) {
	if(!this.supportDelete)
		throw new Error("Store doesn't support deleting of items");
	this.deletableItems.push({
		id: id,
		handler: handler
	});
	if(!this.requesting) {
		this.requesting = true;
		this._queueRequest();
	}
};

ItemsStore.prototype.invalidateItem = function(id) {
	if(this.invalidItems.indexOf(id) >= 0)
		return;
	if(!this.supportRead)
		throw new Error("Store doesn't support reading of items");
	this.invalidItems.push(id);
	if(!this.requesting) {
		this.requesting = true;
		this._queueRequest();
	}
};

ItemsStore.prototype._queueRequest = function() {
	this.desc.queueRequest(this._request.bind(this));
};

ItemsStore.prototype._requestWriteAndReadMultipleItems = function(items, callback) {
	this.desc.writeAndReadMultipleItems(items, function(err, newDatas) {
		if(err) {
			items.forEach(function(item) {
				this.setItemError(item.id, err);
			}, this);
		}
		if(newDatas) {
			Object.keys(newDatas).forEach(function(id) {
				this.setItemData(id.substr(1), newDatas[id]);
			}, this);
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestWriteMultipleItems = function(items, callback) {
	this.desc.writeMultipleItems(items, function(err) {
		if(err) {
			items.forEach(function(item) {
				this.setItemError(item.id, err);
			}, this);
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestWriteAndReadSingleItem = function(item, callback) {
	this.desc.writeAndReadSingleItem(item, function(err, newData) {
		if(err) {
			this.setItemError(item.id, err);
		}
		if(newData !== undefined) {
			this.setItemData(item.id, newData);
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestWriteSingleItem = function(item, callback) {
	this.desc.writeSingleItem(item, function(err) {
		if(err) {
			this.setItemError(item.id, err);
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestReadMultipleItems = function(items, callback) {
	this.desc.readMultipleItems(items, function(err, newDatas) {
		if(err) {
			items.forEach(function(item) {
				this.setItemError(item.id, err);
			}, this);
		}
		if(newDatas) {
			Object.keys(newDatas).forEach(function(id) {
				this.setItemData(id.substr(1), newDatas[id]);
			}, this);
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestReadSingleItem = function(item, callback) {
	this.desc.readSingleItem(item, function(err, newData) {
		if(err) {
			this.setItemError(item.id, err);
		}
		if(newData !== undefined) {
			this.setItemData(item.id, newData);
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestCreateSingleItem = function(item, callback) {
	this.desc.createSingleItem(item, function(err, id) {
		if(item.handler) item.handler(err, id);
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestCreateMultipleItems = function(items, callback) {
	this.desc.createMultipleItems(items, function(err, ids) {
		for(var i = 0; i < items.length; i++) {
			if(items[i].handler) {
				items[i].handler(err, ids && ids[i]);
			}
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestCreateAndReadSingleItem = function(item, callback) {
	this.desc.createAndReadSingleItem(item, function(err, id, newData) {
		if(!err && newData !== undefined) {
			this.setItemData(id, newData);
		}
		if(item.handler) item.handler(err, id, newData);
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestCreateAndReadMultipleItems = function(items, callback) {
	this.desc.createAndReadMultipleItems(items, function(err, ids, newDatas) {
		if(newDatas) {
			Object.keys(newDatas).forEach(function(id) {
				this.setItemData(id.substr(1), newDatas[id]);
			}, this);
		}
		for(var i = 0; i < items.length; i++) {
			if(items[i].handler) {
				items[i].handler(err, ids && ids[i], ids && newDatas && newDatas[ids[i]]);
			}
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestDeleteSingleItem = function(item, callback) {
	this.desc.deleteSingleItem(item, function(err) {
		if(item.handler) item.handler(err);
		if(!err) {
			delete this.items["_" + item.id];
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._requestDeleteMultipleItems = function(items, callback) {
	this.desc.deleteMultipleItems(items, function(err) {
		for(var i = 0; i < items.length; i++) {
			if(items[i].handler) {
				items[i].handler(err);
			}
			if(!err) {
				delete this.items["_" + items[i].id];
			}
		}
		this._queueRequest();
		callback();
	}.bind(this));
};

ItemsStore.prototype._request = function(callback) {
	callback = callback || function () {};
	if(this.desc.createAndReadMultipleItems) {
		var items = this._popCreateableItem(true);
		if(items.length === 1 && this.desc.createAndReadSingleItem) {
			this._requestCreateAndReadSingleItem(items[0], callback);
			return;
		} else if(items.length > 0) {
			this._requestCreateAndReadMultipleItems(items, callback);
			return;
		}
	}
	if(this.desc.createMultipleItems) {
		var items = this._popCreateableItem(true);
		if(items.length === 1 && this.desc.createSingleItem) {
			if(!this.desc.createAndReadSingleItem) {
				this._requestCreateSingleItem(items[0], callback);
				return;
			}
		} else if(items.length > 0) {
			this._requestCreateMultipleItems(items, callback);
			return;
		}
	}
	if(this.desc.createAndReadSingleItem) {
		var item = this._popCreateableItem(false);
		if(item) {
			this._requestCreateAndReadSingleItem(item, callback);
			return;
		}
	}
	if(this.desc.createSingleItem) {
		var item = this._popCreateableItem(false);
		if(item) {
			this._requestCreateSingleItem(item, callback);
			return;
		}
	}
	if(this.desc.writeAndReadMultipleItems) {
		var items = this._popWriteableItem(true, true);
		if(items.length === 1 && this.desc.writeAndReadSingleItem) {
			this._requestWriteAndReadSingleItem(items[0], callback);
			return;
		} else if(items.length > 0) {
			this._requestWriteAndReadMultipleItems(items, callback);
			return;
		}
	}
	if(this.desc.writeMultipleItems) {
		var items = this._popWriteableItem(true, false);
		if(items.length === 1 && this.desc.writeSingleItem) {
			if(!this.desc.writeAndReadSingleItem) {
				this._requestWriteSingleItem(items[0], callback);
				return;
			}
		} else if(items.length > 0) {
			this._requestWriteMultipleItems(items, callback);
			return;
		}
	}
	if(this.desc.writeAndReadSingleItem) {
		var item = this._popWriteableItem(false, true);
		if(item) {
			this._requestWriteAndReadSingleItem(item, callback);
			return;
		}
	}
	if(this.desc.writeSingleItem) {
		var item = this._popWriteableItem(false);
		if(item) {
			this._requestWriteSingleItem(item, callback);
			return;
		}
	}
	if(this.desc.deleteMultipleItems) {
		var items = this._popDeleteableItem(true);
		if(items.length === 1 && this.desc.deleteSingleItem) {
			this._requestDeleteSingleItem(items[0], callback);
			return;
		} else if(items.length > 0) {
			this._requestDeleteMultipleItems(items, callback);
			return;
		}
	}
	if(this.desc.deleteSingleItem) {
		var item = this._popDeleteableItem(false);
		if(item) {
			this._requestDeleteSingleItem(item, callback);
			return;
		}
	}
	if(this.desc.readMultipleItems) {
		var items = this._popReadableItem(true);
		if(items.length === 1 && this.desc.readSingleItem) {
			this._requestReadSingleItem(items[0], callback);
			return;
		} else if(items.length > 0) {
			this._requestReadMultipleItems(items, callback);
			return;
		}
	}
	if(this.desc.readSingleItem) {
		var item = this._popReadableItem(false);
		if(item) {
			this._requestReadSingleItem(item, callback);
			return;
		}
	}
	this.requesting = false;
	callback();
};

ItemsStore.prototype.setItemError = function(id, newError) {
	var item = this.items["_" + id];
	if(!item) {
		item = this._createItem();
		item.data = this.desc.applyNewError(undefined, newError);
		item.error = newError;
		item.tick = this.updateTick;
		this.items["_" + id] = item;
		return;
	}
	newData = this.desc.applyNewError(item.data, newError);
	item.error = newError;
	this._setItemNewData(id, item, newData)
};

ItemsStore.prototype.setItemData = function(id, newData) {
	var item = this.items["_" + id];
	if(!item) {
		item = this._createItem();
		item.data = this.desc.applyNewData(undefined, newData);
		item.tick = this.updateTick;
		this.items["_" + id] = item;
		return;
	}
	newData = this.desc.applyNewData(item.data, newData);
	item.error = null;
	this._setItemNewData(id, item, newData)
};

ItemsStore.prototype._setItemNewData = function(id, item, newData) {
	if(item.newData !== undefined) {
		item.update = this.desc.rebaseUpdate(item.update, item.data, newData);
		item.newData = this.desc.applyUpdate(newData, item.update);
	}
	var oldData = item.data;
	item.data = newData;
	item.outdated = false;
	item.tick = this.updateTick;
	if(item.update === undefined) {
		var idx = this.invalidItems.indexOf(id);
		if(idx >= 0)
			this.invalidItems.splice(idx, 1);
	}
	var infoHandlers = item.infoHandlers && item.infoHandlers.slice();
	var handlers = item.handlers && item.handlers.slice();
	if(infoHandlers) {
		infoHandlers.forEach(function(fn) {
			fn();
		});
	}
	if(handlers && oldData !== newData) {
		handlers.forEach(function(fn) {
			fn(item.newData !== undefined ? item.newData : newData);
		});
	}
};

ItemsStore.prototype._popCreateableItem = function(multiple) {
	if(multiple) {
		if(this.maxCreateItems && this.maxCreateItems < this.createableItems.length) {
			return this.createableItems.splice(0, this.maxCreateItems);
		} else {
			var items = this.createableItems;
			this.createableItems = [];
			return items;
		}
	} else {
		return this.createableItems.shift();
	}
};

ItemsStore.prototype._popDeleteableItem = function(multiple) {
	if(multiple) {
		if(this.maxDeleteItems && this.maxDeleteItems < this.deletableItems.length) {
			return this.deletableItems.splice(0, this.maxDeleteItems);
		} else {
			var items = this.deletableItems;
			this.deletableItems = [];
			return items;
		}
	} else {
		return this.deletableItems.shift();
	}
};

ItemsStore.prototype._popWriteableItem = function(multiple, willRead) {
	var results = [];
	for(var i = 0; i < this.invalidItems.length; i++) {
		var id = this.invalidItems[i];
		var item = this.items["_" + id];
		if(item.update) {
			var result = {
				id: id,
				update: item.update,
				oldData: item.data,
				newData: item.newData
			};
			item.outdated = true;
			item.data = item.newData;
			delete item.update;
			delete item.newData;
			if(willRead) {
				this.invalidItems.splice(i, 1);
				i--;
			}
			if(!multiple)
				return result;
			results.push(result);
			if(this.desc.maxWriteItems && results.length >= this.desc.maxWriteItems)
				break;
		}
	}
	if(multiple)
		return results;
};

ItemsStore.prototype._popReadableItem = function(multiple) {
	var results = [];
	for(var i = 0; i < this.invalidItems.length; i++) {
		var id = this.invalidItems[i];
		var item = this.items["_" + id];
		if(item.outdated) {
			var result = {
				id: id,
				oldData: item.data
			};
			this.invalidItems.splice(i, 1);
			i--;
			if(!multiple)
				return result;
			results.push(result);
			if(this.desc.maxReadItems && results.length >= this.desc.maxReadItems)
				break;
		}
	}
	if(multiple)
		return results;
};


function applyUpdate(data, update) {
	return Object.assign({}, data, update);
}

function mergeUpdates(a, b) {
	return Object.assign({}, a, b);
}

function rebaseUpdate(update, oldData, newData) {
	return update;
}

function applyNewData(oldData, newData) {
	return newData;
}

function applyNewError(oldData, newError) {
	return null;
}
