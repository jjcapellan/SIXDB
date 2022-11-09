/**
 * @author       Juan Jose Capellan <soycape@hotmail.com>
 * @copyright    2018 Juan Jose Capellan
 * @license      {@link https://github.com/jjcapellan/SIXDB/blob/master/LICENSE | MIT license}
 */

import {
  _qrySys,
  done,
  execTasks,
  logEnum,
  logger,
  requestErrorAction,
  requestSuccessAction,
  Store,
  tasks,
} from './index.js';


let db = null;
let dbName;
const voidFn = function () {
  return 0;
};

// Opens the database and stores the result in db
function openDb() {
  let request = window.indexedDB.open(dbName);

  request.onerror = function () {
    alert('Error. You must allow web app to use indexedDB.');
  };

  request.onsuccess = function (event) {
    db = event.target.result;
    done();
  };
}

// Predefined task to open the actual database
const tkOpen = { args: null, fn: openDb };

// Allows other modules modify variable db
function setDb(_db) {
  db = _db;
}

function checkStore(storeName, callback) {
  let origin = 'Sixdb.checkStore()';
  logger(origin + logEnum.begin);
  let exists = db.objectStoreNames.contains(storeName);
  db.close();
  callback(exists, origin);
  done();
  return;
}

// Creates a store in the database
function newStore(
  storeName,
  { keyPath, autoIncrement, successCallback, errorCallback } = {}
) {
  let version;
  let origin = 'Sixdb.newStore()';
  logger(origin + logEnum.begin);

  // If store already exist then returns
  if (db.objectStoreNames.contains(storeName)) {
    db.close();
    logger(`Object store "${storeName}" already exists`);
    done();
    return;
  }

  version = db.version;
  db.close();
  let newVersion = version + 1;
  let _store;

  let request = window.indexedDB.open(dbName, newVersion);

  request.onupgradeneeded = function (event) {
    db = event.target.result;

    try {
      _store = db.createObjectStore(storeName, {
        keyPath: keyPath,
        autoIncrement: autoIncrement
      });
    } catch (e) {
      requestErrorAction(origin, e, errorCallback);
      return;
    }

    _store.onerror = function (event) {
      requestErrorAction(origin, event.target.error, errorCallback);
    };
  };

  request.onsuccess = function (event) {
    requestSuccessAction(
      event,
      origin,
      successCallback,
      `New object store "${storeName}" created`
    );
  };
}

function delStore(storeName, { successCallback, errorCallback }) {
  let origin = 'Sixdb.delStore()';
  logger(origin + logEnum.begin);

  //// Gets the new version
  //
  let version = db.version;
  db.close();
  let newVersion = version + 1;

  //// The change of the database schema only can be performed in the onupgradedneeded event
  //// so a new version number is needed to trigger that event.
  //
  let request = window.indexedDB.open(dbName, newVersion);

  request.onupgradeneeded = function (event) {
    db = event.target.result;
    db.deleteObjectStore(storeName);
  };

  request.onsuccess = function (event) {
    requestSuccessAction(
      event,
      origin,
      successCallback,
      `Object store "${storeName}" deleted`
    );
  };

  request.onerror = function () {
    requestErrorAction(origin, request.error, errorCallback);
  };
}

function delDB({ successCallback, errorCallback }) {
  let origin = 'Sixdb.destroy()';
  logger(origin + logEnum.begin);

  let request = window.indexedDB.deleteDatabase(dbName);

  request.onerror = function () {
    requestErrorAction(origin, request.error, errorCallback);
  };

  request.onsuccess = function (event) {
    successCallback(event, origin);
    logger(`Database "${dbName}" deleted`);
    done();
  };
}

// Join operation. (ON store1.primaryKey = store2.index.keyPath)
function join({ store1Name, store2Name, indexName, succesCallback, errorCallback }) {
  let joinResult = [];
  let store1Result = [];
  let store2Result = [];
  let origin = 'getJoin()';
  logger(origin + logEnum.begin);
  let transaction = db.transaction([store1Name, store2Name]);
  let indexKeyPath;
  let posCursor1 = 0;
  let posCursor2 = 0;
  let store1ResultLength;
  let store2ResultLength;

  let store1 = transaction.objectStore(store1Name);
  let store1KeyPath = store1.keyPath;
  store1.getAll().onsuccess = function (event) {
    store1Result = event.target.result;
    store1ResultLength = store1Result.length;

    let store2 = transaction.objectStore(store2Name);
    let store2Index = store2.index(indexName);
    store2Index.getAll().onsuccess = function (event) {
      store2Result = event.target.result;
      store2ResultLength = store2Result.length;
      console.log(store2ResultLength);
      indexKeyPath = store2Index.keyPath;
      makeJoinResult();
    };
  };

  function makeJoinResult() {
    if (
      store1Result[posCursor1][store1KeyPath] == store2Result[posCursor2][indexKeyPath]
    ) {
      joinResult.push(Object.assign(store2Result[posCursor2], store1Result[posCursor1]));
      posCursor2++;
    } else {
      posCursor1++;
    }

    if (posCursor1 == store1ResultLength || posCursor2 == store2ResultLength) {
      requestSuccessAction(
        joinResult,
        origin,
        successCallback,
        'Join operation completed'
      );
    } else {
      makeJoinResult();
    }
  }
}

/**
 * Constructs a Sixdb instance.
 * @class
 * @param  {string} _dbName Name of the database 
 */
window.Sixdb = function (_dbName) {
  dbName = _dbName;

  // Query system from qrySys.js
  let qrySys = _qrySys;

  // Creates or opens the database
  function newDB(errorCallback = voidFn) {
    let request = window.indexedDB.open(dbName);
    let origin = 'Sixdb.newDB()';
    logger(origin + logEnum.begin);

    // Boolean: Database doesn't exist
    let noDb = false;

    // if onupgradeneeded means is a new database
    request.onupgradeneeded = function () {
      noDb = true;
    };

    request.onsuccess = function (event) {
      let db = event.target.result;
      db.close();
      if (noDb) {
        logger(`Database "${dbName}" created`);
      } else {
        logger(`Database "${dbName}" already exists`);
      }
      done();
    };
  }

  // Adds newDB function to the task queue
  function addDB(errorCallback) {
    let args = [errorCallback];
    let task = {
      args: args,
      fn: newDB
    };
    tasks.push(task);
  }

  //// public functions declaration /////////////////
  this.name;
  this.setConsoleOff;
  this.customTask;
  this.aggregateFuncs;
  this.execTasks;
  this.setCustomOperator;
  this.checkStore;
  this.newStore;
  this.openStore;
  this.delStore;
  this.destroy;

  //// Initialization ///////////////////////////////
  qrySys.init();
  addDB();
  execTasks();
};

/**
 * Gets the database name.
 * @method window.Sixdb#name
 * @instance
 * @return Name of the database
 */
Sixdb.prototype.name = function () {
  return dbName;
};

/**
 * Sets the consoleOff value.
 * @param  {boolean} _consoleOff If true, the console output is off and only errors appear in console.
 */
Sixdb.prototype.setConsoleOff = function (_consoleOff) {
  consoleOff = _consoleOff;
};

/**
 * Add a specific function to the Sixdb task queue.
 * @method window.Sixdb#customTask
 * @instance
 * @param  {function} fn Our custom function that we want to add to the task queue.
 * @param  {object} context Usually the keyword "this"
 * @param  {...any} args Arguments for the function.
 * @example
 * var mydb = new Sixdb('companyDB');
 * 
 * // Creates new store
 * mydb.newStore('southFactory');
 * 
 * // Opens the store in a variable
 * var store = mydb.openStore('southFactory');
 *
 *
 * // Inserts one record in "southFactory" object store.
 * //
 * store.add(
 *    {ID: 1, name: 'Peter', department: 'manufacturing', age: 32, salary: 1200}
 * );
 *
 *
 * //
 * // To add an own function to the task queue, the method  customTask() of the Sixdb object is used
 * //
 * //     customTask( fn, context, args)
 * //
 * // This task is executed after the previous insertion task and before the next reading task.
 * //
 * mydb.customTask(
 *    function(m){                                // Custom function
 *        alert(m);
 *    },
 *    this,                                       // Context. Usually "this".
 *    'Inserting operation finished !!'           // Arguments of the function. Can be a variable number of arguments.
 * );
 *
 *
 *
 * // Reads all records from "southFactory" object store.
 * //
 * store.getAll(mySuccessCallback);
 *
 *
 * // ***** VERY IMPORTANT ****
 * // Once we have introduced the operations that we want to perform on the database,
 * // we must use the function execTasks() to execute them.
 * //
 * mydb.execTasks();
 */
Sixdb.prototype.customTask = function (fn, context, args) {
  let argsArray = [];
  if (args) {
    for (let i = 2, j = arguments.length; i < j; i++) {
      argsArray[2 - i] = arguments[i];
    }
  }
  let task = { type: 'custom', fn: fn, context: context, args: argsArray };

  tasks.push(task);
};
/** 
 * Contains predefined aggregate functions to use in aggregateFn method.<br>
 * The method aggregateFn accepts too custom functions.
 * 
 * @memberof window.Sixdb
 * @namespace
*/
Sixdb.prototype.aggregateFuncs = {
  /**
   * Sums two values
   * @param  {string | number} actual Acumulated value
   * @param  {string | number} selected Selected value
   * @return {string | number} Returns the sum.
   */
  sum(actual, selected) {
    return actual + selected;
  },

  /**
   * Calculates the average value.
   * @param  {number} actual Acumulated value.
   * @param  {number} selected Selected value.
   * @param  {number} counter Number of elements.
   * @return {number} average value.
   */
  avg(actual, selected, counter) {
    return (actual * (counter - 1) + selected) / counter;
  },

  /**
   * Returns the maximum value.
   * @param  {string | number} actual 
   * @param  {string | number} selected 
   * @return {string | number} The maximum value.
   */
  max(actual, selected) {
    return selected > actual ? selected : actual;
  },

  /**
   * Returns the minimum value.
   * @param  {string | number} actual 
   * @param  {string | number} selected 
   * @param  {number} counter Number of iteration.
   * @return {string | number} The minimum value.
   */
  min(actual, selected, counter) {
    if (counter == 1) {
      // First value of actual is null. Without this, min is allways null
      actual = selected;
    }
    return selected < actual && counter > 1 ? selected : actual;
  }
};

/**
   * Sets customOperator. To make the queries we can add to the Sixdb comparison operators our own operator.<br>
   * This operator will be represented by <b>~~</b>.
   * @method window.Sixdb#setCustomOperator
   * @instance
   * @param  {function} compareFunction Function to compare a property value with a test value.<br>
   * @example
   * var mydb = new Sixdb('myDatabase');
   *
   * //
   * // The compare function must have two arguments, property value and test value. If this function triggers
   * // an error exception, then the query system returns the condition as false.
   * //
   * mydb.setCustomOperator(
   *     function(propertyValue, testValue){
   *         return (propertyValue.length == testValue.length);
   *     });
   *
   */
Sixdb.prototype.setCustomOperator = function (compareFunction) {
  if (compareFunction) {
    if (typeof compareFunction == 'function') {
      if (compareFunction.length == 2) {
        customOperator = compareFunction;
      }
    }
  }
};

/**
   * Execs pending tasks. The tasks are executed sequentially.
   * A task does not run until the previous one ends.
   * <br>This avoids problems arising from the asynchronous nature of the indexedDB api.
   * @method window.Sixdb#execTask
   * @instance
   */
Sixdb.prototype.execTasks = function () {
  execTasks();
};

/**
 * Gets all records from the object store.
 * @method window.Sixdb#checkStore
 * @instance
 * @param {string} storeName Name of the store 
 * @param  {function} callback Receives a boolean (true if store exists in the database) and origin as parameters. 
 * @example
 * mydb.checkStore('Products', (exists) => {
 *  if(exists){
 *   console.log('Store Products exists in this database')
 *  }
 * });
 */
Sixdb.prototype.checkStore = function (storeName, callback = voidFn) {
  let args = [
    storeName,
    callback
  ];
  let task = {
    args: args,
    fn: checkStore
  };
  tasks.push(tkOpen);
  tasks.push(task);
};

/**
 * Creates a task wich creates a store object in the database.
 * @method window.Sixdb#newStore
 * @instance
 * @param  {string} storeName The store name.
 * @param  {object} [options]
 * @param  {string} [options.keyPath] The key path to be used by the new object store. 
 * <br>If empty or not specified, the object store is created without a key path and uses out-of-line keys. 
 * <br>You can also pass in an array as a keyPath.
 * @param  {Boolean} [options.autoIncrement] If true, the object store has a key generator. Defaults to false.
 * @param  {function} [options.succesCallback] Function called on success. Receives as parameters event and origin.
 * @param  {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
 */
Sixdb.prototype.newStore = function (
  storeName,
  { keyPath, autoIncrement, successCallback=voidFn, errorCallback=voidFn } = {}
) {
  let args = [
    storeName,
    {
      keyPath: keyPath,
      autoIncrement: autoIncrement,
      successCallback: successCallback,
      errorCallback: errorCallback
    }
  ];
  let task = {
    args: args,
    fn: newStore
  };
  tasks.push(tkOpen);
  tasks.push(task);
};

/**
 * Returns an existing store object ready to use
 * @method window.Sixdb#openStore
 * @instance
 * @param  {string} storeName Name of the store.
 * @return {object}
 */
Sixdb.prototype.openStore = function (storeName) {
  return new Store(storeName);
};

/**
 * Deletes an object store.
 * @method window.Sixdb#delStore
 * @instance
 * @param  {string} storeName Name of the object store. 
 * @param  {object} options
 * @param  {function} [options.succesCallback] Function called on success. Receives as parameters event and origin.
 * @param  {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
 */
Sixdb.prototype.delStore = function (
  storeName,
  { successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let options = {
    successCallback: successCallback,
    errorCallback: errorCallback
  };
  let args = [storeName, options];
  let task = {
    args: args,
    fn: delStore
  };

  tasks.push(tkOpen);
  tasks.push(task);
};

/**
 * The current database is deleted.
 * @method window.Sixdb#destroy
 * @instance
 * @param  {object} options
 * @param  {function} [options.succesCallback] Function called on success. Receives as parameters event and origin.
 * @param  {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
 */
Sixdb.prototype.destroy = function (
  { successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let options = {
    successCallback: successCallback,
    errorCallback: errorCallback
  };

  let args = [options];
  let task = {
    args: args,
    fn: delDB
  };

  tasks.push(task);
};

/**
 * Creates a join operation on two stores. Joins those objects where store1.keypath = store2.index.keypath <br>
 * and returns the result to a success callback.
 * @method window.Sixdb#join
 * @instance
 * @param  {object} options
 * @param  {string} options.store1Name Name of the store with a primary unique key
 * @param  {string} options.store2Name Name of the second store
 * @param  {string} options.indexName Name of the second store index
 * @param  {function} options.succesCallback Function called on success. Receives as parameters the join result and origin.
 * @param  {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
 * @example
 * // An example of object stored in store "Employees"
 * //
 * let person = {
 *     id: 1,                // <<<<<< keyPath of store1
 *     name: 'Peter',
 *     age: 32,
 *     salary: 1100
 * };
 * // An example of object stored in store "Productions"
 * //
 * let report = {
 *     reportId: 5,                
 *     employeeId: 1,        // <<<<<<<<<< keyPath of index "employeeIds" in store "Productions"
 *     production: 150
 * };
 * 
 * const mydb = new Sixdb('myDatabase');
 * 
 * mydb.join(
 * {
 * store1Name: 'Employees',
 * store2Name: 'Productions',
 * indexName: 'employeeIds',
 * successCallback: mySuccessCallback
 * }
 * );
 * 
 * // The expected results array received by the successCallback contains objects like:
 * // {id:1, name:'Peter, age:32, salary:1100, reportId:5, employeeId:1, production:150}   <<<<<<< id = employeeId
 * 
 *  
 * mydb.execTasks();
 */
Sixdb.prototype.join = function ({
  store1Name,
  store2Name,
  indexName,
  succesCallback,
  errorCallback = voidFn
}) {
  let args = [
    {
      store1Name,
      store2Name,
      indexName,
      succesCallback,
      errorCallback
    }
  ];

  let task = {
    args: args,
    fn: join
  };

  tasks.push(tkOpen);
  tasks.push(task);
};

export { /*consoleOff,*/ db, newStore, dbName, tkOpen, setDb, voidFn };
