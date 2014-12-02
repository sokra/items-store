/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var React = require("react");
var ItemsStoreLease = require("./ItemsStoreLease");
var ItemsStoreFetcher = require("./ItemsStoreFetcher");

function makeStores(stores, addDepenency) {
	if(!addDepenency) {
		return stores;
	}
	return Object.keys(stores).reduce(function(obj, key) {
		obj[key] = {
			getItem: function(id) {
				addDepenency(stores[key], id);
				return stores[key].getItem(id);
			},
			getItemInfo: function(id) {
				addDepenency(stores[key], id);
				return stores[key].getItemInfo(id);
			},
			isItemAvailable: function(id) {
				addDepenency(stores[key], id);
				return stores[key].isItemAvailable(id);
			},
		};
		return obj;
	}, {});
}

module.exports = {
	statics: {
		chargeStores: function(stores, params, callback) {
			ItemsStoreFetcher.fetch(function(addDepenency) {
				this.getState(makeStores(stores, addDepenency), params);
			}.bind(this), callback);
		}
	},
	componentWillUnmount: function() {
		if(this.itemsStoreLease) this.itemsStoreLease.close();
	},
	getInitialState: function() {
		var This = this.constructor;
		if(!this.itemsStoreLease) this.itemsStoreLease = new ItemsStoreLease();
		return Object.assign(this.itemsStoreLease.capture(function(addDepenency) {
			return This.getState(makeStores(this.context.stores, addDepenency), this.getParams && this.getParams());
		}.bind(this), this.StateFromStoresMixin_onUpdate),
			this.getAdditionalInitialState && this.getAdditionalInitialState());
	},
	StateFromStoresMixin_onUpdate: function() {
		var This = this.constructor;
		this.setState(this.itemsStoreLease.capture(function(addDepenency) {
			return This.getState(makeStores(this.context.stores, addDepenency), this.getParams && this.getParams());
		}.bind(this), this.StateFromStoresMixin_onUpdate));
	},
	componentWillReceiveProps: function(newProps, newContext) {
		if(!newContext) return;
		var This = this.constructor;
		this.setState(this.itemsStoreLease.capture(function(addDepenency) {
			return This.getState(makeStores(newContext.stores, addDepenency), newContext.getCurrentParams && newContext.getCurrentParams());
		}.bind(this), this.StateFromStoresMixin_onUpdate));
	},
	contextTypes: {
		stores: React.PropTypes.object.isRequired
	}
};