import { db, dbName, tkOpen, setDb, voidFn } from './main';
import { logger, logEnum } from './logger';
import { done, tasks, checkTasks} from './taskQueue';
import { makeErrorObject, lastErrorObj} from './errorSys';
import {
  requestErrorAction,
  requestSuccessAction,
  tryGetAll,
  cursorAggregate,
  cursorLoop,
  cursorGetRecords,
  cursorDelRecords,
  cursorCount,
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
  let args = [ origin, storeName, rwMode];
  let task = {
    args: args,
    fn: setStore
  };

  tasks.push(task);
}

//// Private functions //////////////////////////////

// Creates a new index in the store
function _newIndex(
  storeName,
  indexName,
  keyPath,
  { unique, successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let version;
  let origin = 'add -> newIndex(...)';
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
      _store.createIndex(indexName, keyPath, ({ unique } = {}));
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
  let origin = 'addRecord(...)';
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
  let origin = 'store.getAll()';
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
  let origin = 'store.get()';
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
  let origin = 'store.getByKey()';
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
function del(query, successCallback, errorCallback) {
  let origin = 'store.del()';
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
function delByKey(query, successCallback, errorCallback) {
  let origin = 'store.delByKey()';
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
function count(query, successCallback, errorCallback) {
  let origin = 'store.count()';
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
function countAll(successCallback, errorCallback){
  let origin = 'store.countAll()';
  logger(origin + logEnum.begin);
  let request = _store.count();
  
  request.onsuccess = function(event){
    let message = `${event.target.result} records in store "${_store.name}"`;
    requestSuccessAction(event.target.result, origin, successCallback, message)
  }

  request.onerror = function(){
    requestErrorAction(origin, request.error, errorCallback);
  }
}
function delIndex(storeName, indexName, successCallback, errorCallback) {
  let version;
  let origin = 'store.delIndex()';
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
function getaggregateFunction(
  property,
  aggregatefn,
  successCallback = voidFn,
  origin,
  {query,
  errorCallback = voidFn}
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
function getaggregateFunctionA(
  { origin, property, aggregatefn, successCallback, errorCallback }
) {
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

  let args = [property, aggregatefn, successCallback, origin, options];
  
  tasks.push({args: args, fn: getaggregateFunction});
}

export let store = function(storeName) {
  //// Public properties ////////////////////////////
  this.name = storeName;

  //// Public Methods declaration ///////////////////
  this.newIndex; //completed
  this.delIndex; //completed
  this.add; //completed
  this.getAll; //completed
  this.get; //completed
  this.del; //completed
  this.count; //completed
  this.aggregateFn; //completed
};

store.prototype.newIndex = function(
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
    fn: _newIndex
  };
  tasks.push(tkOpen);
  tasks.push(task);
};

store.prototype.add = function(obj, { successCallback, errorCallback } = {}) {
  let args = [ obj, { successCallback, errorCallback } ];
  let task = { args: args, fn: addRecord };

  tasks.push(tkOpen);
  initStore('store.add(...)', this.name, 'readwrite');
  tasks.push(task);
};

store.prototype.getAll = function(successCallback, errorCallback = voidFn) {
  let args = [ successCallback, errorCallback ];
  let task = {
    args: args,
    fn: getAll
  };
  tasks.push(tkOpen);
  initStore('store.getAll()', this.name, 'readonly');
  tasks.push(task);
};

store.prototype.get = function(query, successCallback, errorCallback = voidFn) {
  let args = [ query, successCallback, errorCallback ];
  let task = {
    args: args,
    fn: get
  };
  tasks.push(tkOpen);
  initStore('store.get()', this.name, 'readonly');
  tasks.push(task);
};

store.prototype.del = function(
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

store.prototype.count = function(successCallback, { query, errorCallback = voidFn }={}) {
  var args = [query, successCallback, errorCallback];
  var task = {
    args: args,
    fn: count
  };

  tasks.push(tkOpen);
  initStore('store.count()', this.name, 'readonly');
  tasks.push(task);
}

store.prototype.delIndex = function(indexName, { successCallback = voidFn, errorCallback=voidFn }={}) {
  let args = [this.name, indexName, successCallback, errorCallback];
  let task = {
    args: args,
    fn: delIndex
  };

  tasks.push(tkOpen);
  tasks.push(task);
}

store.prototype.aggregateFn = function(
  property,
  aggregatefn,
  successCallback,
  { query, errorCallback } = {}
) {
  var origin = 'store.aggregateFn()';
  var args = {
    property: property,
    successCallback: successCallback,
    aggregatefn: aggregatefn,
    origin: origin,
    query: query,
    errorCallback: errorCallback
  };

  tasks.push(tkOpen);
  initStore('initStore',this.name, 'readonly');
  makeAggregateTask(args);
  
}