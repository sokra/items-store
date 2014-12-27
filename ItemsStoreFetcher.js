/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var ItemsStoreFetcher = module.exports = exports;

ItemsStoreFetcher.fetch = function(fn, callback) {
	var ident = this.ident;
	var unavailableItems;
	function onItemAvailable() {
		if(--unavailableItems === 0)
			runFn();
	}
	function listenTo(Store, id) {
		if(!Store.isItemUpToDate(id)) {
			unavailableItems++;
			Store.waitForItem(id, onItemAvailable);
		}
	}
	function runFn() {
		unavailableItems = 1;
		try {
			var ret = fn(listenTo);
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
