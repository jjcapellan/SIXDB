import {
  _qrySys,
  aggregateLog,
  checkTasks,
  countLog,
  cursorAggregate,
  cursorCount,
  cursorGetRecords,
  cursorLoop,
  db,
  done,
  initCursorLoop,
  isKey,
  lastErrorObj,
  logEnum,
  logger,
  makeErrorObject,
  queryLog,
  requestErrorAction,
  requestSuccessAction,
  setSharedObj,
  tasks,
  tkOpen,
  tryGetAll,
  tryGetByKey,
  tryOpenCursor,
  voidFn,
} from './index.js';

//// Private variables //////////////////////////////
let _index = null;
let qrySys = _qrySys;

function setIndex(storeName, indexName, rwMode) {
  _index = null;
  let origin = 'initIndex()';
  try {
    let objectStore = db.transaction(storeName, rwMode).objectStore(storeName);
    _index = objectStore.index(indexName);
  } catch (e) {
    makeErrorObject(origin, e);
    logger(lastErrorObj, true);
  }
  done();
}

// Adds setIndex to the task queue
function initIndex(storeName, indexName, rwMode) {
  let args = [storeName, indexName, rwMode];
  let task = {
    args: args,
    fn: setIndex
  };

  tasks.push(task);
}

// Gets all records from a store
function getAll(successCallback, errorCallback) {
  let origin = 'Index.getAll()';
  logger(origin + logEnum.begin);

  let request = tryGetAll(origin, _index, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }

  request.onsuccess = function (event) {
    requestSuccessAction(
      event.target.result,
      origin,
      successCallback,
      `All records returned from index "${_index.name}"`
    );
  };

  request.onerror = function () {
    requestErrorAction(origin, request.error, errorCallback);
  };
}

// Gets records filtered by a query
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
    source: _index.name,
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

  request.onsuccess = function (event) {
    let cursor = event.target.result;
    cursorLoop(cursor);
  };

  request.onerror = function () {
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

  request.onsuccess = function (event) {
    successCallback(event.target.result, origin, query);
    db.close();
    logger(`Records with key "${query}" returned from index "${_index.name}"`);
    done();
  };

  request.onerror = function () {
    requestErrorAction(origin, request.error, errorCallback);
  };
}

// Counts records filtered by a query
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
    source: _index.name,
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

// Counts all records in the index
function countAll(successCallback, errorCallback) {
  let origin = 'Index.countAll()';
  logger(origin + logEnum.begin);
  let request = _index.count();

  request.onsuccess = function (event) {
    let message = `${event.target.result} records in index "${_index.name}"`;
    requestSuccessAction(event.target.result, origin, successCallback, message);
  };

  request.onerror = function () {
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

  let request = tryOpenCursor(origin, _index, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }

  request.onsuccess = function (event) {
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

  request.onerror = function () {
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
  request.onsuccess = function (event) {
    let cursor = event.target.result;
    cursorLoop(cursor);
  };
  request.onerror = function () {
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

  let args = [property, aggregatefn, successCallback, origin, options];

  tasks.push({ args: args, fn: getaggregateFunction });
}

function initTasks(storeName, indexName, task) {
  tasks.push(tkOpen);
  initIndex(storeName, indexName, 'readonly');
  tasks.push(task);
}

/**
 * Constructs a Sixdb Index instance. This constructor is used via Store.openStore() method.
 * @class
 * @param  {string} storeName Name of the parent store.
 * @param  {string} indexName Name of the index.
 * @return {object}
 */
export let Index = function (storeName, indexName) {
  let _indexName = indexName;
  let _storeName = storeName;

  /**
   * Gets the name of the index.
   * @method Index#name
   * @return  {string} Name of the index.
   */
  this.name = function () {
    return _indexName;
  };

  /**
   * Gets the name of the parent store.
   * @method Index#storeName
   * @return  {string} Name of the parent store.
   */
  this.storeName = function () {
    return _storeName;
  };

  //// Public methods /////////////////////////////////////
  /*
  this.getAll;
  this.get;
  this.count;
  this.aggregateFn;
  */
};

/**
 * Gets all records from the index.
 * @method Index#getAll
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
 * // Instantiates the index "Names"
 * //
 * let index = store.openIndex('Names');
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
 * // Gets all records from the index "Names" in store "southFactory"
 * //
 * index.getAll(myCallback);
 *  
 *
 *
 * // Execs all pending tasks
 * mydb.execTasks();
*/
Index.prototype.getAll = function (successCallback, errorCallback = voidFn) {
  let args = [successCallback, errorCallback];
  let task = {
    args: args,
    fn: getAll
  };

  initTasks(this.storeName(), this.name(), task);
};

/**
 * Gets one or more records from an index using a query.
 * @method Index#get
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
 * // Instantiates the index "Names"
 * //
 * let index = store.openIndex('Names');
 * 
 * // Gets all records with salary > 1200 and age < 40 in index "Names"
 * //
 * index.get('salary > 1200 & age < 40', mySuccesCallback);
 * 
 * mydb.execTasks();
 * 
 */
Index.prototype.get = function (query, successCallback, errorCallback = voidFn) {
  let args = [query, successCallback, errorCallback];
  let task = {
    args: args,
    fn: get
  };

  initTasks(this.storeName(), this.name(), task);
};

/**
 * Counts the records in an index.
 * @method Index#count
 * @instance
 * @param  {function} successCallback Function called on success. Receives result (number), origin and query as parameters.
 * @param  {object} [options] 
 * @param  {query} [options.query] The query used to select the records to count.Array
 * @param  {function} [options.errorCallback] Function to handle errors. Receives an error object as argument.
 */
Index.prototype.count = function (
  successCallback,
  { query, errorCallback = voidFn } = {}
) {
  let args = [query, successCallback, errorCallback];
  let task = {
    args: args,
    fn: count
  };

  initTasks(this.storeName(), this.name(), task);
};

/**
 * Iterates the index by applying a function to each record in a specified property.
 * @method Index#aggregateFn
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
 * // Instantiates the index "Names"
 * //
 * let index = store.openIndex('Names');
 * 
 * // Sends to mySuccesCallback the average age of employees with salary highter than 1500
 * //
 * index.aggregateFn('age', mydb.aggregateFuncs.avg, mySuccesCallback, {query: 'salary > 1500'});
 * 
 * mydb.execTasks();
 */
Index.prototype.aggregateFn = function (
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
  initIndex(this.storeName(), this.name(), 'readonly');
  makeAggregateTask(args);
};
