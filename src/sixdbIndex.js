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
let _index = null;
let _storeName = '';
let _indexName = '';
let qrySys = _qrySys;

function setIndex(origin, rwMode) {
  _index = null;
  try {
    let objectStore = db.transaction(_storeName, rwMode).objectStore(_storeName);
    _index = objectStore.index(_indexName);
  } catch (e) {
    makeErrorObject(origin, e);
    logger(lastErrorObj, true);
  }
  done();
}

// Adds setIndex to the task queue
function initIndex(origin, rwMode) {
  let args = [ origin, rwMode ];
  let task = {
    args: args,
    fn: setIndex
  };

  tasks.push(task);
}

function getAll(successCallback, errorCallback) {
  let origin = 'Index.getAll()';
  logger(origin + logEnum.begin);

  let request = tryGetAll(origin, _index, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }

  request.onsuccess = function(event) {
    requestSuccessAction(
      event.target.result,
      origin,
      successCallback,
      `All records returned from index "${_indexName}"`
    );
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}

function get(query, successCallback, errorCallback) {
  let origin = 'Index.get()';
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
    source: _indexName,
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

  let request = tryOpenCursor(origin, _index, errorCallback);
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
  let origin = 'Index.getByKey()';
  logger(origin + logEnum.begin);

  let request = tryGetByKey(origin, _index, query, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }

  request.onsuccess = function(event) {
    successCallback(event.target.result, origin, query);
    db.close();
    logger(`Records with key "${query}" returned from index "${_indexName}"`);
    done();
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}

function count(query, successCallback, errorCallback) {
  let origin = 'Index.count()';
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
    source: _indexName,
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

    initCursorLoop(_index, errorCallback);
}

function countAll(successCallback, errorCallback){
  let origin = 'Index.countAll()';
  logger(origin + logEnum.begin);
  let request = _index.count();
  
  request.onsuccess = function(event){
    let message = `${event.target.result} records in index "${_indexName}"`;
    requestSuccessAction(event.target.result, origin, successCallback, message)
  }

  request.onerror = function(){
    requestErrorAction(origin, request.error, errorCallback);
  }
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

  let request = tryOpenCursor(origin, _index, errorCallback);
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
    query = _index.keyPath + '=' + query;
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
  let request = tryOpenCursor(origin, _index, errorCallback);
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

export let Index = function(storeName, indexName) {
  _storeName = storeName;
  _indexName = indexName;
  this.name = indexName;
  this.getAll;
  this.get;
  this.count;
  this.aggregateFn;
};

Index.prototype.getAll = function(successCallback, errorCallback = voidFn) {
  let args = [ successCallback, errorCallback ];
  let task = {
    args: args,
    fn: getAll
  };
  tasks.push(tkOpen);
  initIndex('Index.getAll()', 'readonly');
  tasks.push(task);
};

Index.prototype.get = function(query, successCallback, errorCallback = voidFn) {
  let args = [ query, successCallback, errorCallback ];
  let task = {
    args: args,
    fn: get
  };
  tasks.push(tkOpen);
  initIndex('Index.get()', 'readonly');
  tasks.push(task);
};

Index.prototype.count = function(successCallback, { query, errorCallback = voidFn }={}) {
  let args = [query, successCallback, errorCallback];
  let task = {
    args: args,
    fn: count
  };

  tasks.push(tkOpen);
  initIndex('Index.count()', 'readonly');
  tasks.push(task);
}

Index.prototype.aggregateFn = function(
  property,
  aggregatefn,
  successCallback,
  { query, errorCallback } = {}
) {
  let origin = 'Index.aggregateFn()';
  let args = {
    property: property,
    successCallback: successCallback,
    aggregatefn: aggregatefn,
    origin: origin,
    query: query,
    errorCallback: errorCallback
  };

  tasks.push(tkOpen);
  initIndex('initStore', 'readonly');
  makeAggregateTask(args);  
}
