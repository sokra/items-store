/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var React = require("react");
var ItemsStoreLease = require("./ItemsStoreLease");
var ItemsStoreFetcher = require("./ItemsStoreFetcher");
var ReactUpdates = require("react/lib/ReactUpdates");

function makeStores(stores, addDependency) {
	if(!addDependency) {
		return stores;
	}
	return Object.keys(stores).reduce(function(obj, key) {
		obj[key] = {
			getItem: function(id) {
				addDependency(stores[key], id);
				return stores[key].getItem(id);
			},
			getItemInfo: function(id) {
				addDependency(stores[key], id);
				return stores[key].getItemInfo(id);
			},
			isItemAvailable: function(id) {
				addDependency(stores[key], id);
				return stores[key].isItemAvailable(id);
			},
			isItemUpToDate: function(id) {
				addDependency(stores[key], id);
				return stores[key].isItemUpToDate(id);
			},
		};
		return obj;
	}, {});
}

module.exports = function createContainer(Component) {
	if(!Component.getProps)
		throw new Error("Passed Component " + Component.displayName + " has no static getProps function");
	return React.createClass({
		displayName: Component.displayName + "Container",
		statics: {
			chargeStores: function(stores, params, callback) {
				ItemsStoreFetcher.fetch(function(addDependency) {
					Component.getProps(makeStores(stores, addDependency), params);
				}.bind(this), callback);
			}
		},
		getInitialState: function() {
			if(!this.lease) this.lease = new ItemsStoreLease();
			var stores = this.context.stores;
			var router = this.context.router;
			var params = router && router.getCurrentParams && router.getCurrentParams();
			return this.lease.capture(function(addDependency) {
				return Component.getProps(makeStores(stores, addDependency), params);
			}, this._onUpdate);
		},
		_onUpdate: function() {
			// _onUpdate is called when any leased value has changed
			// we schedule an update (this merges multiple changes to a single state change)
			if(this._updateScheduled)
				return;
			this._updateScheduled = true;
			ReactUpdates.asap(this._doUpdate);
		},
		_doUpdate: function() {
			// 
			this._updateScheduled = false;
			if(!this.isMounted()) return;
			var stores = this.context.stores;
			var router = this.context.router;
			var params = router && router.getCurrentParams && router.getCurrentParams();
			this.setState(this.lease.capture(function(addDependency) {
				return Component.getProps(makeStores(stores, addDependency), params);
			}, this._onUpdate));
		},
		componentWillReceiveProps: function(newProps, newContext) {
			// on context change update, because params may have changed
			if(!newContext || !newContext.router) return;
			var stores = newContext.stores;
			var router = newContext.router;
			var params = router && router.getCurrentParams && router.getCurrentParams();
			this.setState(this.lease.capture(function(addDependency) {
				return Component.getProps(makeStores(stores, addDependency), params);
			}, this._onUpdate));
		},
		componentWillUnmount: function() {
			if(this.lease) this.lease.close();
		},
		render: function() {
			return React.createElement(Component, this.state);
		},
		contextTypes: {
			stores: React.PropTypes.object.isRequired,
			router: React.PropTypes.func
		}
	})
};
