var should = require("should");
var ItemsStore = require("../ItemsStore");
var ItemsStoreFetcher = require("../ItemsStoreFetcher");

describe("ItemsStoreFetcher", function() {
	it("should wait until item is available", function(done) {
		var store = new ItemsStore({
			readSingleItem: function() {}
		});
		var afterSet = false;
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
		}, function(err) {
			if(err) throw err;
			afterSet.should.be.eql(true);
			done()
		});
		store.setItemData("1", "d1");
		afterSet = true;
		store.setItemData("2", "d2");
		afterSet = false;
	});
	it("should wait until items are available", function(done) {
		var store = new ItemsStore({
			readSingleItem: function() {}
		});
		var afterSet = false;
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
			addDependency(store, "3");
			addDependency(store, "4");
		}, function(err) {
			if(err) throw err;
			afterSet.should.be.eql(true);
			done()
		});
		store.setItemData("1", "d1");
		store.setItemData("2", "d2");
		store.setItemData("3", "d3");
		afterSet = true;
		store.setItemError("4", "e4");
		afterSet = false;
	});
	it("should wait until more and more items are available", function(done) {
		var store = new ItemsStore({
			readSingleItem: function() {}
		});
		var afterSet = false;
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
			if(!store.getItem("2")) return;
			addDependency(store, "3");
			if(!store.getItem("3")) return;
			addDependency(store, "4");
		}, function(err) {
			if(err) throw err;
			afterSet.should.be.eql(true);
			done()
		});
		store.setItemData("1", "d1");
		store.setItemData("2", "d2");
		store.setItemData("3", "d3");
		afterSet = true;
		store.setItemError("4", "e4");
		afterSet = false;
	});
	it("should wait until more and more items are available", function(done) {
		var counter = 0;
		var store = new ItemsStore({
			readSingleItem: function(item, callback) {
				counter++;
				callback(null, "d" + item.id);
			}
		});
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
			if(!store.getItem("2")) return;
			addDependency(store, "3");
			if(!store.getItem("3")) return;
			addDependency(store, "4");
			if(!store.getItem("4")) return;
		}, function(err) {
			if(err) throw err;
			counter.should.be.eql(3);
			done()
		});
	});
	it("should not wait when items are already available", function() {
		var store = new ItemsStore({
			readSingleItem: function() {
				throw new Error("should not be called");
			}
		});
		store.setItemData("1", "d1");
		store.setItemData("2", "d2");
		store.setItemData("3", "d3");
		store.setItemError("4", "e4");
		var called = 0;
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
			addDependency(store, "3");
			addDependency(store, "4");
		}, function(err) {
			if(err) throw err;
			called++
		});
		called.should.be.eql(1);
	});
	it("should not wait when items are already available (difficult values)", function() {
		var store = new ItemsStore({
			readSingleItem: function() {
				throw new Error("should not be called");
			}
		});
		store.setItemData("1", null);
		store.setItemData("2", false);
		store.setItemData("3", 0);
		store.setItemError("4", null);
		var called = 0;
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
			addDependency(store, "3");
			addDependency(store, "4");
		}, function(err) {
			if(err) throw err;
			called++
		});
		called.should.be.eql(1);
	});
	it("should wait when only some items are already available", function() {
		var store = new ItemsStore({
			readSingleItem: function() {
				throw new Error("should not be called");
			}
		});
		store.setItemData("1", "d1");
		store.setItemData("2", "d2");
		var called = 0;
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
			addDependency(store, "3");
			addDependency(store, "4");
		}, function(err) {
			if(err) throw err;
			called++
		});
		called.should.be.eql(0);
		store.setItemData("3", "d3");
		store.setItemError("4", "e4");
		called.should.be.eql(1);
	});
	it("should wait when items are outdated", function() {
		var store = new ItemsStore({
			readSingleItem: function() {
				throw new Error("should not be called");
			}
		});
		store.setItemData("1", "d1");
		store.setItemData("2", "d2");
		store.setItemData("3", "d3");
		store.setItemError("4", "e4");
		store.outdate();
		store.isItemUpToDate("1").should.be.eql(false);
		var called = 0;
		ItemsStoreFetcher.fetch(function(addDependency) {
			addDependency(store, "2");
			addDependency(store, "3");
			addDependency(store, "4");
		}, function(err) {
			if(err) throw err;
			called++
		});
		called.should.be.eql(0);
		store.setItemData("1", "nd1");
		store.setItemData("2", "nd2");
		store.setItemData("3", "d3");
		store.setItemError("4", "e4");
		called.should.be.eql(1);
	});
});
