/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Tobias Koppers @sokra
 */
var React = require("react");
var ItemsStoreLease = require("./ItemsStoreLease");
var ItemsStoreFetcher = require("./ItemsStoreFetcher");
var ReactUpdates = require("react/lib/ReactUpdates");

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
			isItemUpToDate: function(id) {
				addDepenency(stores[key], id);
				return stores[key].isItemUpToDate(id);
			}
		};
		return obj;
	}, {});
}

module.exports = {
	statics: {
		chargeStores: function(stores, params, callback) {
			ItemsStoreFetcher.fetch(function(addDepenency) {
				this.getStoreState(makeStores(stores, addDepenency), params);
			}.bind(this), callback);
		}
	},
	componentWillUnmount: function() {
		if(this.itemsStoreLease) this.itemsStoreLease.close();
	},
	getInitialState: function() {
		var This = this.constructor;
		if(!this.itemsStoreLease) this.itemsStoreLease = new ItemsStoreLease();
		return this.itemsStoreLease.capture(function(addDepenency) {
			return this.mergeStates(
				This.getStoreState(makeStores(this.context.stores, addDepenency), this.getParams && this.getParams())
			);
		}.bind(this), this.StateFromStoresMixin_onUpdate);
	},
	StateFromStoresMixin_onUpdate: function() {
		if(this.StateFromStoresMixin_updateScheduled)
			return;
		this.StateFromStoresMixin_updateScheduled = true;
		ReactUpdates.asap(this.StateFromStoresMixin_doUpdate);
	},
	StateFromStoresMixin_doUpdate: function() {
		this.StateFromStoresMixin_updateScheduled = false;
		if(!this.isMounted()) return;
		var This = this.constructor;
		this.setState(this.itemsStoreLease.capture(function(addDepenency) {
			return this.mergeStates(
				This.getStoreState(makeStores(this.context.stores, addDepenency), this.getParams && this.getParams())
			);
		}.bind(this), this.StateFromStoresMixin_onUpdate));
	},

	/*
	*  I want UI state to exist outside of stores.
	*  TODO: _.merge is insufficient if state is intermingled. stale store data accumulate.
	*  TODO: if an item is deleted on the server, then new storeState is created
	*  TODO: that item will still exist in this.state
	*
	*  TODO: I think
	* */
	mergeStates: function(storeState) {
		var This = this.constructor;
		var uiState = !this.isMounted() ? This.getUiState() : this.state;

		//		return _.merge(uiState, storeState);

		// TODO: this works if uiState and storeState don't have any collisions
		return Object.assign({}, uiState, storeState);
	},

	componentWillReceiveProps: function(newProps, newContext) {
		if(!newContext) return;
		var This = this.constructor;
		this.setState(this.itemsStoreLease.capture(function(addDepenency) {
			return this.mergeStates(
				This.getStoreState(makeStores(newContext.stores, addDepenency), newContext.getCurrentParams && newContext.getCurrentParams())
			);
		}.bind(this), this.StateFromStoresMixin_onUpdate));
	},
	contextTypes: {
		stores: React.PropTypes.object.isRequired
	}
};