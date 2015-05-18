var should = require("should");
var ItemsStore = require("../ItemsStore");

describe("ItemsStore Read", function() {
	it("should be able handle setItemData", function() {
		var store = new ItemsStore({});
		store.setItemData("1", "data1");
		store.getItem("1").should.be.eql("data1");
		(typeof store.getItem("2")).should.be.eql("undefined");
		store.getItemInfo("1").should.containDeep({
			available: true,
			outdated: false,
			updated: false,
			listening: false
		});
		store.getItemInfo("2").should.containDeep({
			available: false,
			outdated: false,
			updated: false,
			listening: false
		});
	});
	it("should run readSingleItem and applyNewData on read", function(done) {
		var store = new ItemsStore({
			readSingleItem: function(item, callback) {
				callback(null, "data" + item.id);
			},
			applyNewData: function(oldData, newData) {
				return oldData + "->" + newData;
			}
		});
		store.waitForItem("1", function() {
			store.getItem("1").should.be.eql("undefined->data1");
			done();
		})
	});
	it("should run readSingleItem and applyNewData on repeated read (outdated)", function(done) {
		var counter = 1;
		var store = new ItemsStore({
			readSingleItem: function(item, callback) {
				callback(null, (counter++) + "data" + item.id);
			},
			applyNewData: function(oldData, newData) {
				return oldData + "->" + newData;
			}
		});
		store.waitForItem("1", function() {
			store.getItem("1").should.be.eql("undefined->1data1");
			store.outdate("1");
			store.waitForItem("1", function() {
				store.getItem("1").should.be.eql("undefined->1data1->2data1");
				done();
			});
		});
	});
	it("should not run readSingleItem and applyNewData on repeated read (not outdated)", function(done) {
		var counter = 1;
		var store = new ItemsStore({
			readSingleItem: function(item, callback) {
				callback(null, (counter++) + "data" + item.id);
			},
			applyNewData: function(oldData, newData) {
				return oldData + "->" + newData;
			}
		});
		store.waitForItem("1", function() {
			store.getItem("1").should.be.eql("undefined->1data1");
			store.waitForItem("1", function() {
				store.getItem("1").should.be.eql("undefined->1data1");
				done();
			});
		});
	});
	it("should get items with getData", function() {
		var counter = 1;
		var store = new ItemsStore({});
		store.setItemData("abc", "databc");
		store.setItemData("def", "defata");
		store.isItemAvailable("abc").should.be.eql(true);
		store.isItemAvailable("def").should.be.eql(true);
		store.isItemAvailable("ghi").should.be.eql(false);
		store.getData().should.be.eql({
			$abc: "databc",
			$def: "defata"
		});
	});
});
