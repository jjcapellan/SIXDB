import { _qrySys } from './qrySys.js';
import { tasks, done, execTasks } from './taskQueue';
import { logEnum, logger } from './logger.js';
import { requestSuccessAction, requestErrorAction } from './helpers';
import { store } from './sixdbStore';

let db = null;
let consoleOff = false;
let dbName;
const voidFn = function() {
  return 0;
};
let customOperator = function(value1, value2) {
  return value1 == value2;
};

//// Shared functions /////////////////////////////

// Opens the database and stores the result in db
const openDb = function() {
  let request = window.indexedDB.open(dbName);

  request.onerror = function() {
    alert('Error. You must allow web app to use indexedDB.');
  };

  request.onsuccess = function(event) {
    db = event.target.result;
    done();
  };
};

// Predefined task to open the actual database
const tkOpen = { args: null, fn: openDb };

// Allows other modules modify variable db
const setDb = function(_db) {
  db = _db;
};

// Creates a store in the database
let _newStore = function(
  storeName,
  { keyPath, autoIncrement, successCallback, errorCallback } = {}
) {
  let version;
  let origin = 'add -> newStore(...)';
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
};

window.sixdb = function(_dbName) {
  dbName = _dbName;

  // Query system from qrySys.js
  let qrySys = _qrySys;

  //// private functions ////////////////////////////
  function newDB(errorCallback = voidFn) {
    let request = window.indexedDB.open(dbName);
    let origin = 'add -> newDB(...)';
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

  function _addDB(errorCallback) {
    let args = [ errorCallback ];
    let task = {
      args: args,
      fn: newDB
    };
    tasks.push(task);
  }

  //// public functions declaration /////////////////
  this.name;
  this.customTask;
  this.aggregateFuncs;
  this.execTasks;
  this.setCustomOperator;
  this.newStore;
  this.openStore;

  //// Initialization ///////////////////////////////
  qrySys.init();
  _addDB();
  execTasks();
};

sixdb.prototype.name = function() {
  return dbName;
};

sixdb.prototype.customTask = function(fn, context, args) {
  let argsArray = [];
  if (args) {
    var i = 0;
    for (i = 2; i < arguments.length; i++) {
      argsArray[2 - i] = arguments[i];
    }
  }
  let task = { type: 'custom', fn: fn, context: context, args: argsArray };

  tasks.push(task);
};

sixdb.prototype.aggregateFuncs = {
  sum(actual, selected) {
    return actual + selected;
  },
  avg(actual, selected, counter) {
    return (actual * (counter - 1) + selected) / counter;
  },
  max(actual, selected) {
    return selected > actual ? selected : actual;
  },
  min(actual, selected, counter) {
    if (counter == 1) {
      // First value of actual is null. Without this, min is allways null
      actual = selected;
    }
    return selected < actual && counter > 1 ? selected : actual;
  }
};

sixdb.prototype.setCustomOperator = function(compareFunction) {
  if (compareFunction) {
    if (typeof compareFunction == 'function') {
      if (compareFunction.length == 2) {
        customOperator = compareFunction;
      }
    }
  }
};

sixdb.prototype.execTasks = function() {
  execTasks();
};

/**
 * Creates a task wich creates a store object in the database.
 * @param  {string} storeName 
 * @param  {object} options [{ keyPath, autoIncrement, successCallback, errorCallback }={}] 
 * @param  {string} [options.keyPath] The key path to be used by the new object store. 
 * <br>If empty or not specified, the object store is created without a key path and uses out-of-line keys. 
 * <br>You can also pass in an array as a keyPath.
 * @param  {Boolean} [options.autoIncrement] If true, the object store has a key generator. Defaults to false.
 * @param  {function} [options.succesCallback] Function called on success. Receives as parameters event and origin.
 * @param  {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
 * @return {void}
 */
sixdb.prototype.newStore = function(
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
    fn: _newStore
  };
  tasks.push(tkOpen);
  tasks.push(task);
};

sixdb.prototype.openStore = function(storeName) {
  return new store(storeName);
};

export { consoleOff, db, _newStore, dbName, tkOpen, setDb, voidFn };
