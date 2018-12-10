/**
 * @author       Juan Jose Capellan <soycape@hotmail.com>
 * @copyright    2018 Juan Jose Capellan
 * @license      {@link https://github.com/jjcapellan/SIXDB/blob/master/LICENSE | MIT license}
 */
import { _qrySys } from './qrySys.js';
import { tasks, done, execTasks } from './taskQueue';
import { logEnum, logger } from './logger.js';
import { requestSuccessAction, requestErrorAction } from './helpers';
import { Store } from './sixdbStore';

let db = null;
let consoleOff = false;
let dbName;
const voidFn = function() {
  return 0;
};
export let customOperator = function(value1, value2) {
  return value1 == value2;
};

// Opens the database and stores the result in db
function openDb() {
  let request = window.indexedDB.open(dbName);

  request.onerror = function() {
    alert('Error. You must allow web app to use indexedDB.');
  };

  request.onsuccess = function(event) {
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

  request.onupgradeneeded = function(event) {
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

    _store.onerror = function(event) {
      requestErrorAction(origin, event.target.error, errorCallback);
    };
  };

  request.onsuccess = function(event) {
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

  request.onupgradeneeded = function(event) {
    db = event.target.result;
    db.deleteObjectStore(storeName);
  };

  request.onsuccess = function(event) {
    requestSuccessAction(
      event,
      origin,
      successCallback,
      `Object store "${storeName}" deleted`
    );
  };

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };
}

function delDB({ successCallback, errorCallback }) {
  let origin = 'Sixdb.destroy()';
  logger(origin + logEnum.begin);

  let request = window.indexedDB.deleteDatabase(dbName);

  request.onerror = function() {
    requestErrorAction(origin, request.error, errorCallback);
  };

  request.onsuccess = function(event) {
    successCallback(event, origin);
    logger(`Database "${dbName}" deleted`);
    done();
  };
}

/**
 * Constructs a Sixdb instance.
 * @class
 * @param  {string} _dbName Name of the database 
 */
window.Sixdb = function(_dbName) {
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
    request.onupgradeneeded = function() {
      noDb = true;
    };

    request.onsuccess = function(event) {
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
    let args = [ errorCallback ];
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
Sixdb.prototype.name = function() {
  return dbName;
};

/**
 * Sets the consoleOff value.
 * @param  {boolean} _consoleOff If true, the console output is off and only errors appear in console.
 */
Sixdb.prototype.setConsoleOff = function(_consoleOff) {
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
Sixdb.prototype.customTask = function(fn, context, args) {
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
Sixdb.prototype.setCustomOperator = function(compareFunction) {
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
Sixdb.prototype.execTasks = function() {
  execTasks();
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
Sixdb.prototype.newStore = function(
  storeName,
  { keyPath, autoIncrement, successCallback, errorCallback } = {}
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
Sixdb.prototype.openStore = function(storeName) {
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
Sixdb.prototype.delStore = function(
  storeName,
  { successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let options = {
    successCallback: successCallback,
    errorCallback: errorCallback
  };
  let args = [ storeName, options ];
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
Sixdb.prototype.destroy = function(
  { successCallback = voidFn, errorCallback = voidFn } = {}
) {
  let options = {
    successCallback: successCallback,
    errorCallback: errorCallback
  };

  let args = [ options ];
  let task = {
    args: args,
    fn: delDB
  };

  tasks.push(task);
};

export { consoleOff, db, newStore, dbName, tkOpen, setDb, voidFn };
