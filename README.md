# items-store

A flux-like architecture with a syncing items store.

## Idea

### ItemsStore

A store that manages read and write access to items (accessed by a string id).

It

* offers synchronous access to items
* caches items after reading
* fires update events for items
* merges multiple writes to items
* writes do optimistic updates

### ItemsStoreFetcher

A helper which repeatedly calls a function until all references items are available. The ItemsStoreFetcher can fetch from multiple stores.

### ItemsStoreLease

A helper class which leases multiple items from multiple stores. It captures dependencies from calling a function.

## StateFromStoresMixin

A react component mixin that provides component state from stores.

The component provides a **static** `getState` method that calculate state from states (and params when using react-router). The mixin handles listening to changes and charging stores.

The usable API inside the `getState` method is very simple.


## API

### `ItemsStore`

#### `new ItemsStore(desc, [initialData])`

The constructor.

`desc` A description of the store. The creator provides options and read/write methods that the store will use.

`initialData` An object containing initial item data. You may pass the result of `getData` here. This should be used for initializing the stores after server-side rendering.

#### `desc`

The store description. The behavior of the store changes depending on the contained keys. Can contain these keys:

**reading and writing**

`readSingleItem: function(item, callback)` Reads a single item. `item` is an object `{ id: string, oldData: any|undefined }`. `callback` is a `function(err, newData: any|undefined)`.

`readMultipleItems: function(items, callback)` Reads multiple items. Similar to `readSingleItem` but `items` is an array and the `callback` is a `function(err, newDatas: object)` where `newDatas` is an object containing items id as key (prefixed with any single char) and value is the new data. i. e. `{"_12345": { name: "item 12345" }}`.

`writeSingleItem: function(item, callback)` Writes a single item. `item` is an object `{ id: string, update: any, oldData: any|undefined, newData: any|undefined }`. `callback` is a `function(err)`.

`writeMultipleItems: function(items, callback)` Writes multiple items. Similar to `writeSingleItem` but `items` is an array.

`writeAndReadSingleItem: function(item, callback)` A combination of `writeSingleItem` followed by a `readSingleItem`.

`writeAndReadMultipleItems: function(items, callback)` A combination of `writeMultipleItems` followed by a `readMultipleItems`.

`maxWriteItems` Maximum of items allowed to be written by `writeMultipleItems` or `writeAndReadMultipleItems`.

`maxReadItems` Maximum of items allowed to be read by `readMultipleItems`.

You need to provide at least one read method. If you want to do updates you need to provide at least one write or writeAndRead method.

Reading or writing multiple items is preferred if more than one items should be read or written.

writeAndRead methods are preferred of write methods.

**updates**

`applyUpdate: function(data, update)` Apply an update to existing data. The new data is returned. Doesn't modify `data`.

`applyUpdate` defaults to an method that merges (flat) the keys from `update` into `data`.

`mergeUpdates: function(a, b)` Merges two update. A new update is returned that represents applying update `a` and `b`.

`mergeUpdates` default to an flat merge.

`rebaseUpdate: function(update, oldData, newData)` Called when new data is received while an item was already changed locally. Returns a new update that behaves to `newData` like `update` to `oldData`.

`rebaseUpdate` default to an identity function that just returns `update`.

**timing**

`queueRequest: function(fn)` Called when the store want to do something. It's called with a async function `fn(callback)` that should be called sometime in the future. You should wait at least one tick before calling `fn` if you want multiple reads/writes to be merged. You can use a queue to queue from multiple stores.

#### `getItem(id)`

Returns the current data of the item `id`. Returns `undefined` if no data is available. May return outdated cached data.

#### `getItemInfo(id)`

Returns status information about the item `id`. Returns an object with these keys:

`available` Any data is available.

`outdated` The item is outdated and a read is queued.

`update` The item was changed and a write is queued.

`listening` Somebody is interested in this item.

#### `isItemAvailable(id)`

Returns `true` if any data is available.

#### `listenToItem(id, handler)`

Listen to changes of the item `id`. `handler` is called with the new data. A lease is returned which has a single method `close` which stops listening.

When calling `listenToItem` twice with the same `id` and `handler` no new lease is created. Instead the old lease is returned.

Calling this method may trigger a read to the item.

#### `waitForItem(id, callback)`

Waits until the item `id` is available and call the `callback` once it's available.

Calling this method may trigger a read to the item.

#### `getData()`

Returns an object containing the data for every available item.

#### `updateItem(id, update)`

Applies the `update` to item `id`. The format of `update` depends on the provided `applyUpdate` implementation.

Calling this method trigger a write to the item.

#### `update()`

Defines all available items as outdated and triggers reads.

#### `setItemData(id, newData)`

Sets the current item data `newData` for the item `id`. Should only be called when receiving data from a higher instance i. e. from the server or database.

You can use it in provided read and write methods when getting more information that the requested one. You should use this method when receiving data from an open stream.


### `ItemsStoreFetcher`

#### static `fetch(fn, callback)`

Calls `fn` (`function(getItem, getItemInfo)`) multiple times until all referenced items are available. Than calls `callback` (`function(err, result)`) with the return value.

If `fn` throws an error `callback` is called immediately with the error.

The provided function `getItem(Store, id)` reads an item from a store. The provided function `getItemInfo(Store, id)` reads item information from a store.


### `ItemsStoreLease`

#### `new ItemsStoreLease()`

Create a new instance.

#### `capture(fn, onUpdate)`

Calls `fn` (`function(getItem, getItemInfo)`) and starts listening to item updates (if not already listening). `onUpdate` is called when an item was updated. Calling this method also stops listening to items that are no longer referenced by the `fn`.

The provided function `getItem(Store, id)` reads an item from a store. The provided function `getItemInfo(Store, id)` reads item information from a store.

#### `close()`

Stops listening to item updates.


### `StateFromStoresMixin`

Mixin for react component.

**component**

It's expected from the component to provide a static `getState` function. It can optionally provide a `getAdditionalInitialState` instance method.

The context of the component must contain a key `stores` which is an object containing all stores (i. e. `{Messages: [ItemsStore], Users: [ItemsStore]}`).

#### static `getState(stores, params)`

This function should create the component state from `stores` and `params` and return it.

`stores` is an object containing functions for each store. i. e. 
```
{
  Messages: { [Function getItem] info: [Function getItemInfo] },
  Users: { [Function getItem] info: [Function getItemInfo] }
}
```

`params` is the params object from `react-router` (if used)

Example for a `getState` method:

``` javascript
statics: {
	getState: function(stores, params) {
		var thread = stores.Threads(params.threadId);
		return {
			thread: thread,
			messages: thread && thread.messages.map(function(messageId) {
				var message = stores.Messages(messageId);
				return message && Object.assign({}, message, {
					user: stores.users(message.userId)
				});
			})
		}
	}
}
```

#### `getAdditionalInitialState()`

Returns initial state that is merged with the initial state provided from the static `getState` method.

**hooks**

#### `getInitialState`

Returns the initial state generated by the static `getState` method.

#### `componentWillReceiveProps`

When the context is changed by react-router, i. e. when the params changed, state is updated.

**methods**

#### static `chargeStore(stores, params, callback)`

Prepares stores with an `ItemsStoreFetcher`.

`stores` The object of `ItemsStores`, like the `stores` key in the context.

`params` params object from `react-router`.

### `Actions`

Helpers to create actions:

``` javascript
{ [Function trigger]
  listen: [Function listen]
}
```

An action can be triggered by calling it. Any number of arguments can be provided.

An action has a `listen` (`function(callback, bindContext)`) method to listen to the action.

``` javascript
var singleAction = Actions.create();
singleAction(); // trigger
singleAction(1, 2, "hello"); // trigger with actions
singleAction.listen(function(a, b, c) {
	console.log(a, b, c);
}, this);

var actions = Actions.create([
	"someAction",
	"otherAction"
]);
actions.someAction();
actions.otherAction("other");
```

#### `create([names])`

Creates a single action (without `names` parameter) or multiple actions (with `names` (`string[]`) parameter).


## Example

https://github.com/webpack/react-starter


## TODO

* `readAndStreamSingleItem`, `readAndStreamMultipleItems`
* Timeout for cached data
* Maximum size of cached data


## License

Copyright (c) 2014 Tobias Koppers [![Gittip donate button](http://img.shields.io/gittip/sokra.png)](https://www.gittip.com/sokra/)

MIT (http://www.opensource.org/licenses/mit-license.php)

