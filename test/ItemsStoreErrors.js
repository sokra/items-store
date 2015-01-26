var should = require("should");
var ItemsStore = require("../ItemsStore");

describe("ItemsStore Errors", function() {
	it("should be able handle setItemError", function() {
		var store = new ItemsStore({
			applyNewError: function(oldData, error) {
				if(oldData === undefined) return error;
				return [oldData, error];
			}
		});
		store.setItemError("1", "err1");
		store.setItemData("2", 2);
		store.setItemError("2", "err2");
		store.getItem("1").should.be.eql("err1");
		store.getItem("2").should.be.eql([2, "err2"]);
		store.getItemInfo("1").should.be.eql({
			available: true,
			outdated: false,
			updated: false,
			listening: false,
			error: "err1"
		});
		store.getItemInfo("2").should.be.eql({
			available: true,
			outdated: false,
			updated: false,
			listening: false,
			error: "err2"
		});
	});
	it("should get error on item read", function(done) {
		var store = new ItemsStore({
			readSingleItem: function(item, callback) {
				callback("err" + item.id);
			},
			applyNewError: function(oldData, error) {
				return "error: " + error;
			}
		});
		store.waitForItem("1", function() {
			store.getItem("1").should.be.eql("error: err1");
			done();
		})
	})
	it("should get error on item create", function(done) {
		var store = new ItemsStore({
			createSingleItem: function(item, callback) {
				callback("err" + item.data);
			},
			applyNewError: function(oldData, error) {
				return "error: " + error;
			}
		});
		store.createItem("1", function(err) {
			err.should.be.eql("err1");
			done();
		});
	});
	it("should get error on item delete", function(done) {
		var store = new ItemsStore({
			deleteSingleItem: function(item, callback) {
				callback("err" + item.id);
			},
			applyNewError: function(oldData, error) {
				return "error: " + error;
			}
		});
		store.deleteItem("1", function(err) {
			err.should.be.eql("err1");
			done();
		});
	});
	it("should get error on item write", function(done) {
		var store = new ItemsStore({
			writeSingleItem: function(item, callback) {
				callback("err" + item.id + " " + item.update);
			},
			readSingleItem: function(item, callback) {
				throw new Error("Should not be called");
			},
			applyNewError: function(oldData, error) {
				return "error: " + error;
			}
		});
		store.updateItem("1", "new1");
		store.waitForItem("1", function() {
			store.getItem("1").should.be.eql("error: err1 new1");
			done();
		})
	});
});
