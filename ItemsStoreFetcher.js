/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
module.exports = ItemsStoreFetcher = exports;

ItemsStoreFetcher.fetch = function(fn, callback) {
	var ident = this.ident;
	var unavailableItems;
	function onItemAvailable() {
		if(--unavailableItems === 0)
			runFn();
	}
	function getItem(Store, id) {
		if(Store.isItemAvailable(id)) {
			return Store.getItem(id);
		} else {
			unavailableItems++;
			Store.waitForItem(id, onItemAvailable);
		}
	}
	function getItemInfo(Store, id) {
		if(!Store.isItemAvailable(id)) {
			unavailableItems++;
			Store.waitForItem(id, onItemAvailable);
		}
		return Store.getItemInfo(id);
	}
	function runFn() {
		unavailableItems = 1;
		try {
			var ret = fn(getItem, getItemInfo);
		} catch(e) {
			unavailableItems = NaN;
			callback(e);
		}
		if(--unavailableItems === 0) {
			callback(null, ret);
		}
	}
	runFn();
};
