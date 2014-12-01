/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var React = require("react");
var ItemsStoreLease = require("./ItemsStoreLease");
var ItemsStoreFetcher = require("./ItemsStoreFetcher");

function makeStores(stores, getItem, getItemInfo) {
	if(!getItem) {
		getItem = function(Store, id) {
			return Store.getItem(id);
		};
	}
	if(!getItemInfo) {
		getItemInfo = function(Store, id) {
			return Store.getItemInfo(id);
		};
	}
	return Object.keys(stores).reduce(function(obj, key) {
		obj[key] = getItem.bind(null, stores[key]);
		obj[key].info = getItemInfo.bind(null, stores[key]);
		return obj;
	}, {});
}

module.exports = {
	statics: {
		chargeStores: function(stores, params, callback) {
			ItemsStoreFetcher.fetch(function(getItem, getItemInfo) {
				this.getState(makeStores(stores, getItem, getItemInfo), params);
			}.bind(this), callback);
		}
	},
	componentWillUnmount: function() {
		if(this.itemsStoreLease) this.itemsStoreLease.close();
	},
	getInitialState: function() {
		var This = this.constructor;
		if(!this.itemsStoreLease) this.itemsStoreLease = new ItemsStoreLease();
		return Object.assign(this.itemsStoreLease.capture(function(getItem, getItemInfo) {
			return This.getState(makeStores(this.context.stores, getItem, getItemInfo), this.getParams && this.getParams());
		}.bind(this), this.StateFromStoresMixin_onUpdate),
			this.getAdditionalInitialState && this.getAdditionalInitialState());
	},
	StateFromStoresMixin_onUpdate: function() {
		var This = this.constructor;
		this.setState(this.itemsStoreLease.capture(function(getItem, getItemInfo) {
			return This.getState(makeStores(this.context.stores, getItem, getItemInfo), this.getParams && this.getParams());
		}.bind(this), this.StateFromStoresMixin_onUpdate));
	},
	componentWillReceiveProps: function(newProps, newContext) {
		if(!newContext) return;
		var This = this.constructor;
		this.setState(this.itemsStoreLease.capture(function(getItem, getItemInfo) {
			return This.getState(makeStores(newContext.stores, getItem, getItemInfo), newContext.getCurrentParams && newContext.getCurrentParams());
		}.bind(this), this.StateFromStoresMixin_onUpdate));
	},
	contextTypes: {
		stores: React.PropTypes.object.isRequired
	}
};