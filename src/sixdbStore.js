import { db, dbName, tkOpen, setDb, voidFn } from './main';
import { logger, logEnum } from './logger';
import { done, tasks, checkTasks } from './taskQueue';
import { makeErrorObject, lastErrorObj } from './errorSys';
import {
  requestErrorAction,
  requestSuccessAction,
  tryGetAll,
  cursorAggregate,
  cursorLoop,
  cursorGetRecords,
  cursorDelRecords,
  cursorCount,
  cursorUpdate,
  countLog,
  aggregateLog,
  initCursorLoop,
  setSharedObj,
  queryLog,
  tryOpenCursor,
  tryGetByKey,
  isKey
} from './helpers';
import { _qrySys } from './qrySys.js';
import { Index } from './sixdbIndex';

//// Private variables //////////////////////////////
let _store;
const qrySys = _qrySys;

function setStore(origin, storeName, rwMode) {
  _store = null;
  try {
    _store = db.transaction(storeName, rwMode).objectStore(storeName);
  } catch (e) {
    makeErrorObject(origin, e);
    logger(lastErrorObj, true);
  }
  done();
}

// Puts setStore() in task queue
function initStore(origin, storeName, rwMode) {
  let args = [ origin, storeName, rwMode ];
  let task = {
    args: args,
    fn: setStore
  };

  tasks.push(task);
}

//// Private functions //////////////////////////////

// Creates a new index in the store
function newIndex(
  storeName,
  indexName,
  keyPath,
  { unique, successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let version;
  let origin = 'Store.newIndex()';
  logger(origin + logEnum.begin);

  //// Gets the new version
  //
  version = db.version;
  db.close();
  let newVersion = version + 1;

  //// The change of the database schema only can be performed in the onupgradedneeded event
  //// so a new version number is needed to trigger that event.
  //
  let request = window.indexedDB.open(dbName, newVersion);

  request.onupgradeneeded = function(event) {
    let _db = event.target.result;
    setDb(_db);
    let _store = null;

    var upgradeTransaction = event.target.transaction;

    //// Gets store
    try {
      _store = upgradeTransaction.objectStore(storeName);
    } catch (e) {
      requestErrorAction(origin, e, errorCallback);
      return;
    }

    if (!_store.indexNames.contains(indexName)) {
      _store.createIndex(indexName, keyPath, { unique: unique });
    } else {
      _db.close();
      logger(`The index "${indexName}" already exists in store "${storeName}"`);
      done();
    }
  };

  request.onsuccess = function(event) {
    requestSuccessAction(
      event,
      origin,
      successCallback,
      `Index "${indexName}" created in store "${storeName}"`
    );
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}

// Adds one(A) or more(B) records to the store
function addRecord(obj, { successCallback = voidFn, errorCallback = voidFn }) {
  let origin = 'Store.add()';
  logger(origin + logEnum.begin);
  let args = { obj, origin, successCallback, errorCallback };

  if (Array.isArray(obj)) {
    addRecordA(args);
  } else {
    addRecordB(args);
  }
}
function addRecordA({ obj, origin, successCallback, errorCallback }) {
  let objSize = obj.length;
  let counter = 0;

  while (counter < objSize) {
    let request = _store.add(obj[counter]);
    counter++;
    request.onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };
  }
  requestSuccessAction(
    event,
    origin,
    successCallback,
    `New record/s added to store "${_store.name}"`
  );
}
function addRecordB({ obj, origin, successCallback, errorCallback }) {
  let request = _store.add(obj);
  request.onsuccess = function(event) {
    requestSuccessAction(
      event,
      origin,
      successCallback,
      `New record/s added to store "${_store.name}"`
    );
  };

  request.onerror = function(event) {
    requestErrorAction(origin, event.target.error, errorCallback);
  };
}
// Gets all records from a store
function getAll(successCallback, errorCallback) {
  let request = null;
  let origin = 'Store.getAll()';
  logger(origin + logEnum.begin);

  /// Callbacks of request
  let onsuccess = function(event) {
    requestSuccessAction(
      event.target.result,
      origin,
      successCallback,
      `All records returned from store "${_store.name}"`
    );
  };
  let onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };

  /// Request definition
  request = tryGetAll(origin, _store, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }
  request.onsuccess = onsuccess;
  request.onerror = onerror;
}
// Gets records filtered by a query
function get(query, successCallback, errorCallback) {
  let origin = 'Store.get()';
  logger(origin + logEnum.begin);
  if (isKey(query)) {
    getBykey(query, successCallback, errorCallback);
    return;
  }
  let resultFiltered = [];
  let conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);

  let extMode = conditionsBlocksArray
    ? conditionsBlocksArray[0].externalLogOperator
    : null;

  let exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;
  let obj = {
    counter: 0,
    source: _store.name,
    extMode: extMode,
    event: resultFiltered,
    resultFiltered: resultFiltered,
    origin: origin,
    query: query,
    conditionsBlocksArray: conditionsBlocksArray,
    exitsInFirstTrue: exitsInFirstTrue,
    logFunction: queryLog,
    cursorFunction: cursorGetRecords,
    successCallback: successCallback
  };

  setSharedObj(obj);

  let request = tryOpenCursor(origin, _store, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }

  request.onsuccess = function(event) {
    let cursor = event.target.result;
    cursorLoop(cursor);
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
// Gets records with key as query
function getBykey(query, successCallback, errorCallback) {
  let origin = 'Store.getByKey()';
  logger(origin + logEnum.begin);
  let request;

  let onsuccess = function(event) {
    successCallback(event.target.result, origin, query);
    db.close();
    logger(`Records with key "${query}" returned from store "${_store.name}"`);
    done();
  };
  let onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };

  request = tryGetByKey(origin, _store, query, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }
  request.onsuccess = onsuccess;
  request.onerror = onerror;
}
// Deletes one or more records using a query
function del(query, successCallback, errorCallback) {
  let origin = 'Store.del()';
  logger(origin + logEnum.begin);

  if (isKey(query)) {
    delByKey(query, successCallback, errorCallback);
    return;
  }

  let request = null;

  let conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
  let extMode = conditionsBlocksArray
    ? conditionsBlocksArray[0].externalLogOperator
    : null;
  let exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;

  let obj = {
    counter: 0,
    extMode: extMode,
    source: _store.name,
    event: event,
    origin: origin,
    query: query,
    conditionsBlocksArray: conditionsBlocksArray,
    exitsInFirstTrue: exitsInFirstTrue,
    logFunction: queryLog,
    cursorFunction: cursorDelRecords,
    successCallback: successCallback
  };

  setSharedObj(obj);

  request = tryOpenCursor(origin, _store, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }

  request.onsuccess = function(event) {
    let cursor = event.target.result;
    cursorLoop(cursor);
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
// Deletes records using primary key as query. Is more fast.
function delByKey(query, successCallback, errorCallback) {
  let origin = 'Store.delByKey()';
  logger(origin + logEnum.begin);

  let request = _store.delete(query);

  request.onsuccess = function(event) {
    successCallback(event, origin, query);
    db.close();
    logger(`Records with primary key "${query}" deleted from store "${_store.name}"`);
    done();
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
// Counts records filtered by a query
function count(query, successCallback, errorCallback) {
  let origin = 'Store.count()';
  logger(origin + logEnum.begin);

  if (!query) {
    countAll(successCallback, errorCallback);
    return;
  }

  let conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
  let extMode = conditionsBlocksArray
    ? conditionsBlocksArray[0].externalLogOperator
    : null;
  let exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;
  /// Object used by cursorLoop()
  let obj = {
    counter: 0,
    get event() {
      return this.counter;
    },
    source: _store.name,
    extMode: extMode,
    origin: origin,
    query: query,
    conditionsBlocksArray: conditionsBlocksArray,
    exitsInFirstTrue: exitsInFirstTrue,
    logFunction: countLog,
    cursorFunction: cursorCount,
    successCallback: successCallback
  };

  setSharedObj(obj);

  initCursorLoop(_store, errorCallback);
}
// Counts all records in the store
function countAll(successCallback, errorCallback) {
  let origin = 'Store.countAll()';
  logger(origin + logEnum.begin);
  let request = _store.count();

  request.onsuccess = function(event) {
    let message = `${event.target.result} records in store "${_store.name}"`;
    requestSuccessAction(event.target.result, origin, successCallback, message);
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
// Deletes an index
function delIndex(storeName, indexName, successCallback, errorCallback) {
  let version;
  let origin = 'Store.delIndex()';
  logger(origin + logEnum.begin);

  //// Gets the new version
  //
  version = db.version;
  db.close();
  let newVersion = version + 1;

  //// The change of the database schema only can be performed in the onupgradedneeded event
  //// so a new version number is needed to trigger that event.
  //
  let request = window.indexedDB.open(dbName, newVersion);

  request.onupgradeneeded = function(event) {
    let _db = event.target.result;
    setDb(_db);
    let _store = null;

    let upgradeTransaction = event.target.transaction;

    //// Gets store
    try {
      _store = upgradeTransaction.objectStore(storeName);
    } catch (e) {
      requestErrorAction(origin, e, errorCallback);
      return;
    }

    _store.deleteIndex(indexName);
  };

  request.onsuccess = function(event) {
    requestSuccessAction(
      event,
      origin,
      successCallback,
      `Index "${indexName}" deleted from object store "${storeName}"`
    );
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
// Apply a function (aggregatefn) to the values of a property.
function getaggregateFunction(
  property,
  aggregatefn,
  successCallback = voidFn,
  origin,
  { query, errorCallback = voidFn }
) {
  logger(origin + logEnum.begin);

  var commonArgs = {
    origin: origin,
    property: property,
    aggregatefn: aggregatefn,
    successCallback: successCallback,
    errorCallback: errorCallback
  };

  if (!query) getaggregateFunctionA(commonArgs);
  else getAggregateFunctionB(query, commonArgs);
}
function getaggregateFunctionA({
  origin,
  property,
  aggregatefn,
  successCallback,
  errorCallback
}) {
  let actualValue = null;
  let counter = 0;

  let request = tryOpenCursor(origin, _store, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }

  request.onsuccess = function(event) {
    let cursor = event.target.result;

    if (cursor) {
      if (cursor.value[property]) {
        counter++;
        actualValue = aggregatefn(actualValue, cursor.value[property], counter);
      }
      cursor.continue();
    } else {
      successCallback(actualValue, origin);
      db.close();
      logger(`Result of ${origin} on property "${property}": ${actualValue}`);
      done();
    }
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
function getAggregateFunctionB(
  query,
  { origin, property, aggregatefn, successCallback, errorCallback }
) {
  if (isKey(query)) {
    query = _store.keyPath + '=' + query;
  }
  let conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
  let extMode = conditionsBlocksArray
    ? conditionsBlocksArray[0].externalLogOperator
    : null;
  let exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;
  let obj = {
    counter: 0,
    actualValue: null,
    get event() {
      return this.actualValue;
    },
    property: property,
    aggregatefn: aggregatefn,
    extMode: extMode,
    origin: origin,
    query: query,
    conditionsBlocksArray: conditionsBlocksArray,
    exitsInFirstTrue: exitsInFirstTrue,
    logFunction: aggregateLog,
    cursorFunction: cursorAggregate,
    successCallback: successCallback
  };

  setSharedObj(obj);

  /// request definition
  let request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
  if (!request) {
    checkTasks();
    return;
  }
  request.onsuccess = function(event) {
    let cursor = event.target.result;
    cursorLoop(cursor);
  };
  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
// Adds getaggregateFunction() to the task queue
function makeAggregateTask({
  property,
  successCallback,
  aggregatefn,
  origin,
  query,
  errorCallback
}) {
  let options = {
    query: query,
    errorCallback: errorCallback
  };

  let args = [ property, aggregatefn, successCallback, origin, options ];

  tasks.push({ args: args, fn: getaggregateFunction });
}
// Updates one or more records
function update(query, objectValues, { successCallback, errorCallback }) {
  let origin = 'Store.update()';
  logger(origin + logEnum.begin);

  //// Gets isIndexKeyValue
  //// If true then is query is a single value (an index key)
  let isIndexKeyValue = isKey(query);

  if (isIndexKeyValue) {
    // If query is a single number value then is mofied to be valid to the query system
    query = _store.keyPath + '=' + query;
  }
  let conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);

  var extMode = conditionsBlocksArray
    ? conditionsBlocksArray[0].externalLogOperator
    : null;
  var exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;

  let obj = {
    counter: 0,
    keys: Object.keys(objectValues),
    newObjectValuesSize: Object.keys(objectValues).length,
    extMode: extMode,
    objectValues: objectValues,
    event: event,
    origin: origin,
    query: query,
    conditionsBlocksArray: conditionsBlocksArray,
    exitsInFirstTrue: exitsInFirstTrue,
    logFunction: queryLog,
    cursorFunction: cursorUpdate,
    successCallback: successCallback
  };

  setSharedObj(obj);

  initCursorLoop(_store, errorCallback);
}

/**
 * Constructs a Sixdb Store instance. This constructor is used via Sixdb.openStore() method.
 * @class
 * @param  {string} storeName Name of the object store
 * @return {object}
 */
export let Store = function(storeName) {
  //// Public properties ////////////////////////////
  this.name = storeName;

  //// Public Methods declaration ///////////////////
  this.newIndex;
  this.openIndex;
  this.delIndex;
  this.add;
  this.getAll;
  this.get;
  this.del;
  this.count;
  this.aggregateFn;
  this.update;
};

/**
 * Creates a new index in the object store.
 * @method Store#newIndex
 * @instance
 * @param  {string} indexName Name of the new index.
 * @param  {string} keyPath Name of the property used as key.
 * @param  {object} [options]
 * @param  {boolean} [options.unique] If true, the index will not allow duplicate values for a single key.
 * @param  {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.
 */
Store.prototype.newIndex = function(
  indexName,
  keyPath,
  { unique, successCallback, errorCallback } = {}
) {
  let args = [
    this.name,
    indexName,
    keyPath,
    {
      unique: unique,
      successCallback: successCallback,
      errorCallback: errorCallback
    }
  ];
  let task = {
    args: args,
    fn: newIndex
  };
  tasks.push(tkOpen);
  tasks.push(task);
};

Store.prototype.openIndex = function(indexName) {
  return new Index(this.name, indexName);
};

/**
 * Adds one or more records to the object store.
 * @method Store#add
 * @instance
 * @param  {object | object[]} obj A single object or an array of objects wich represents the records.
 * @param  {object} [options]
 * @param  {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.
 * @example
 * var mydb = new Sixdb('myDatabase');
 * 
 * // Instantiates the store "southFactory"
 * var store = mydb.openStore('southFactory');
 *
 * // Object to insert in the object store
 * //
 * var person = {
 *     name: 'Peter',
 *     age: 32
 * }
 *
 * // Callback function to process a possible error
 * //
 * var myErrorCallback = function(e){
 *     console.log(e);
 * }
 *
 *
 * //
 * // Inserts a new record in the object store.
 * //
 * store.add( person, { errorCallback: myErrorCallback });
 *
 *
 * // Execs all pending tasks.
 * //
 * mydb.execTasks();
 */
Store.prototype.add = function(obj, { successCallback, errorCallback } = {}) {
  let args = [ obj, { successCallback, errorCallback } ];
  let task = { args: args, fn: addRecord };

  tasks.push(tkOpen);
  initStore('store.add(...)', this.name, 'readwrite');
  tasks.push(task);
};

/**
 * Gets all records from the object store.
 * @method Store#getAll
 * @instance
 * @param  {function} successCallback Function called on success. Receives event and origin as parameters.
 * @param  {function} [errorCallback] Function to handle errors. Receives an error object as argument.
 * @example
 * const mydb = new Sixdb('myDatabase');
 * 
 * // Instantiates the store "southFactory"
 * //
 * let store = mydb.openStore('southFactory');
 * 
 * // An example of object stored in the object store
 * //
 * let person = {
 *     name: 'Peter',
 *     age: 32,
 *     salary: 1100
 * };
 *
 *
 * //
 * // Callback function to process the result
 * //
 * const myCallback = function(result){
 *
 *     if(Array.isArray(result)){
 *         for(let i = 0, j = result.length; i < j; i++)
 *         console.log(`Name: ${result[i].name} Age: ${result[i].age} Salary: ${result[i].salary}\n`);
 *     } else {
 *         console.log(`Name: ${result.name} Age: ${result.age} Salary:{result.salary}`);
 *     }
 * };
 *
 *
 * //
 * // Gets all records from the store "southFactory"
 * //
 * store.getAll(myCallback);
 *  
 *
 *
 * // Execs all pending tasks
 * mydb.execTasks();
*/
Store.prototype.getAll = function(successCallback, errorCallback = voidFn) {
  let args = [ successCallback, errorCallback ];
  let task = {
    args: args,
    fn: getAll
  };
  tasks.push(tkOpen);
  initStore('store.getAll()', this.name, 'readonly');
  tasks.push(task);
};

/**
 * Gets one or more records from store using a query.
 * @method Store#get
 * @instance
 * @param  {query} query The query to select the records.
 * @param  {function} successCallback Function called on success. Receives event and origin as parameters.
 * @param  {function} [errorCallback] Function to handle errors. Receives an error object as argument.
 * @example
 * // An example of object stored in the object store
 * //
 * let person = {
 *     name: 'Peter',
 *     age: 32,
 *     salary: 1100
 * };
 * 
 * const mydb = new Sixdb('myDatabase');
 * 
 * // Instantiates the store "southFactory"
 * //
 * let store = mydb.openStore('southFactory');
 * 
 * // Gets all records with salary > 1200 and age < 40
 * //
 * store.get('salary > 1200 & age < 40', mySuccesCallback);
 * 
 * mydb.execTasks();
 * 
 */
Store.prototype.get = function(query, successCallback, errorCallback = voidFn) {
  let args = [ query, successCallback, errorCallback ];
  let task = {
    args: args,
    fn: get
  };
  tasks.push(tkOpen);
  initStore('store.get()', this.name, 'readonly');
  tasks.push(task);
};

/**
 * Deletes one or more records from the store using a query.
 * @method Store#del
 * @instance
 * @param  {query} query 
 * @param  {object} [options]
 * @param  {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.
 */
Store.prototype.del = function(
  query,
  { successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let args = [ query, successCallback, errorCallback ];
  let task = {
    args: args,
    fn: del
  };

  tasks.push(tkOpen);
  initStore('store.del()', this.name, 'readwrite');
  tasks.push(task);
};

/**
 * Counts the records in the store.
 * @method Store#count
 * @instance
 * @param  {function} successCallback Function called on success. Receives result (number), origin and query as parameters.
 * @param  {object} [options] 
 * @param  {query} [options.query] The query used to select the records to count.Array
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.
 */
Store.prototype.count = function(
  successCallback,
  { query, errorCallback = voidFn } = {}
) {
  var args = [ query, successCallback, errorCallback ];
  var task = {
    args: args,
    fn: count
  };

  tasks.push(tkOpen);
  initStore('store.count()', this.name, 'readonly');
  tasks.push(task);
};

/**
 * Deletes an Index from the store.
 * @method Store#delIndex
 * @instance
 * @param  {string} indexName Name of the index.
 * @param  {object} [options] 
 * @param  {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.
 */
Store.prototype.delIndex = function(
  indexName,
  { successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let args = [ this.name, indexName, successCallback, errorCallback ];
  let task = {
    args: args,
    fn: delIndex
  };

  tasks.push(tkOpen);
  tasks.push(task);
};

/**
 * Iterates the store by applying a function to each record in a specified property.
 * @method Store#aggregateFn
 * @instance
 * @param  {string} property Represents the column to apply the aggregate function.
 * @param  {aggregateFunction} aggregatefn Function applied over the records. 
 * @param  {function} successCallback Function called on success. Receives result, origin and query as parameters.
 * @param  {object} [options]
 * @param  {query} [options.query] The query used to select records.errorCallback.
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.
 * @example
 * // An example of object stored in the object store
 * //
 * let person = {
 *     name: 'Peter',
 *     age: 32,
 *     salary: 1100
 * };
 * 
 * const mydb = new Sixdb('myDatabase');
 * 
 * // Instantiates the store "southFactory"
 * //
 * let store = mydb.openStore('southFactory');
 * 
 * // Sends to mySuccesCallback the average age of employees with salary highter than 1500
 * //
 * store.aggregateFn('age', mydb.aggregateFuncs.avg, mySuccesCallback, {query: 'salary > 1500'});
 * 
 * mydb.execTasks();
 */
Store.prototype.aggregateFn = function(
  property,
  aggregatefn,
  successCallback,
  { query, errorCallback } = {}
) {
  var origin = 'Store.aggregateFn()';
  var args = {
    property: property,
    successCallback: successCallback,
    aggregatefn: aggregatefn,
    origin: origin,
    query: query,
    errorCallback: errorCallback
  };

  tasks.push(tkOpen);
  initStore('initStore', this.name, 'readonly');
  makeAggregateTask(args);
};

/**
 * Updates one or more records in the store.
 * @method Store#update
 * @instance
 * @param  {query} query The query used to select the records to update.
 * @param  {object} objectValues Object wich contains the properties with the new values.<br>
 * Example: {property1: newValue1, property4: newValue4}<br>
 * The value can be a function that receives the old value and returns a new value:<br>
 * Example: {property2: function(oldValue){return oldValue + 100;}}
 * @param  {object} [options]
 * @param  {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.errorCallback
 * @example
 * // An example of object stored in the object store
 * //
 * let person = {
 *     name: 'Peter',
 *     age: 32,
 *     salary: 1100
 * };
 * 
 * const mydb = new Sixdb('myDatabase');
 * 
 * // Instantiates the store "southFactory"
 * //
 * let store = mydb.openStore('southFactory');
 * 
 * // Updates salary of record with primary key 4 (only in the case that object store has autoincrement primary key)
 * //
 * store.update(4, {salary: 1200});
 * 
 * // Updates salary and age of Peter
 * //
 * store.update('name = Peter', {age: 33, salary: 1150});
 * 
 * // Increases salary of employees with age > 40 by 100 using a function
 * //
 * store.update(
 *     'age > 40', 
 *     {
 *         salary: function(oldSalary){ return oldSalary + 100;} 
 *     }
 * );
 * 
 * mydb.execTasks();
 */
Store.prototype.update = function(
  query,
  objectValues,
  { successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let options = { successCallback, errorCallback };
  let args = [ query, objectValues, options ];
  let task = {
    args: args,
    fn: update
  };

  tasks.push(tkOpen);
  initStore('initStore()', this.name, 'readwrite');
  tasks.push(task);
};
