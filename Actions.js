/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var EventEmitter = require("events").EventEmitter;

var Actions = module.exports = exports;

Actions.create = function create(array) {
	var obj = {};
	if(Array.isArray(array)) {
		array.forEach(function(name) {
			obj[name] = create();
		});
	} else {
		var ee = new EventEmitter();
		var action = function() {
			var args = Array.prototype.slice.call(arguments);
			ee.emit("trigger", args);
		};
		action.listen = function(callback, bindContext) {
			ee.addListener("trigger", function(args) {
				callback.apply(bindContext, args);
			});
		};
	}
	return obj;
};
