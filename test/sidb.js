/**
 *  Simple IndexedDB
 *  @desc Simple IndexedDB (SIDB) is a wrapper for indexedDB API.
 *  @author Juan Jose Capellan <soycape@hotmail.com>
 */

/** 
 * @license
 * MIT LICENSE
 * 
 * Copyright (c) 2018 Juan Jose Capellan
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Creates an sidb (simple indexedDB) object that manage the new indexedDB database.
 * @class
 * @param  {string} _dbName Name for the new database.
 */
var sidb = function(_dbName) {


  var db; // current instance of the opened database

  /**
   * Data base name.
   * @private
   * @type {string}
   * @readonly
   */
  var dbName = _dbName;

  /**
   * Database name getter
   * @public
   * @return {string} Database name
   */
  this.getName = function () {
    return dbName;
  };

  /**
 * Console output mode. True to turn off console output.
 * @private
 * @type {boolean} 
 * @default
 * @readonly
 */
  var consoleOff = false;

  /**
   * Sets the consoleOff value
   * @param {boolean} off True turn off the console output.
   * @return {string} Database name
   */
  this.setConsoleOff = function (off) {
    if (typeof (off) == 'boolean') {
      consoleOff = off;
    };
  }
  
  //#region Private functions
  //////////////////////////////////////////////////////////////////////////////////////

  function openDb(){
    var request = window.indexedDB.open(dbName);

    request.onerror = function (event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function (event) {
      db = event.target.result;
      logger(logEnum.open);
      done();
    }
  }

  /**
   * Gets last records from an object store
   * @private
   * @param {string} storeName Store name.
   * @param {number} maxResults Limits the records retrieved.
   * @param {function(object[],string)} successCallback Function called when done. Receives as parameters the retrieved records and origin.
   * @param {function(event)} [errorCallback] Optional function to handle errors. Receives event parameter and origin.
   */
  function lastRecords(storeName, maxResults, successCallback, errorCallback) {
    var origin = 'get -> lastRecords(...)';
    logger(logEnum.begin,[origin]);
    var resultFiltered = [];
    var store = db.transaction(storeName, "readwrite").objectStore(storeName);
    var counter = 0;

    //// Executed if maxResults is not null. Opens a cursor to count the results.
    //
    var onsuccesCursorFunction = function (event) {

      var cursor = event.target.result;

      if (cursor && counter < maxResults) {
        resultFiltered.push(cursor.value);
        counter++;
        cursor.continue();
      } else {
        successCallback(resultFiltered, origin);
        db.close();
        logger(logEnum.close);
        logger(logEnum.lastRecords, [counter, storeName]);
        done();
      };
    };
    
    //// Executed if maxResults is null. Is faster. Don't needs cursor. (It's faster)
    //
    var onsuccesGetAllFunction = function (event) {
      successCallback(event.target.result, origin);
      db.close();
      logger(logEnum.close);
      logger(logEnum.getAll, [storeName]);
      done();
    };

    var onerrorFunction = function (event) {
      db.close();
      logger(logEnum.close);
      logger(logEnum.error, [origin, event.target.error]);
      if (errorCallback)
        errorCallback(event, origin);
      done();
    };

    if (maxResults != null) {
      // Opens a cursor from last record in reverse direction
      var request = store.openCursor(null, 'prev').onsuccess = onsuccesCursorFunction;
      request.onsuccess = onsuccesCursorFunction;
      request.onerror = onerrorFunction;
    } else {
      // Gets all records. It is faster than openCursor.
      var request = store.getAll();
      request.onsuccess = onsuccesGetAllFunction;
      request.onerror = onerrorFunction;
    };

  }

  /**
   * Gets a record/s from an object store using a key value from an index.
   * @private
   * @param {string} storeName Store name.
   * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
   * @param {string} query String that contains a query. Example of valid querys:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param {function(object[],string)} successCallback Receives as parameters the result and origin. Result can be an object array or an object.
   * @param {function(event)} [errorCallback] Optional function to handle errors. Receives event parameter.
   */
  function getRecords(storeName, indexName, query, successCallback, errorCallback) {
    var origin = 'get -> getRecords(...)';
    logger(logEnum.begin,[origin]);
    var isIndexKeyValue;
    if (typeof (query) == 'number') {
      isIndexKeyValue = true;
    } else {
      isIndexKeyValue = (query.match(qrySys.operatorRgx)) ? false : true;
    };

    var conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;
    logger(logEnum.open);
    var store = db.transaction(storeName, "readwrite").objectStore(storeName);
    var index;
    var counter = 0;

    if (indexName != null) index = store.index(indexName);

    var resultFiltered = [];

    var onsuccesIndexGetKey = function (event) {
      successCallback(event.target.result, origin, query);
      db.close();
      logger(logEnum.close);
      logger(logEnum.getByIndexKey, [query, indexName, storeName]);
      done();
    };

    var onsuccesCursor = function (event) {

      var cursor = event.target.result;
      var extMode = conditionsBlocksArray[0].externalLogOperator;

      var test = false;

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = (extMode == null || extMode == 'and') ? false : true;
      if (cursor) {
        var i = 0;
        var test = false;
        for (i = 0; i < conditionsBlocksArray.length; i++) {
          var conditions = conditionsBlocksArray[i].conditionsArray;
          var intMode = conditionsBlocksArray[i].internalLogOperator;
          test = qrySys.testConditionBlock(cursor, conditions, intMode);
          if (test == exitsInFirstTrue) {
            break;
          }
        };

        if (test) {
          resultFiltered.push(cursor.value);
          counter++;
        };
        cursor.continue();

      } else {
        successCallback(resultFiltered, origin, query);
        db.close();
        logger(logEnum.close);
        logger(logEnum.query, [query, counter, storeName]);
        done();
      };

    } // end onsuccesCursor

    var onerrorFunction = function (event) {
      db.close();
      logger(logEnum.close);
      logger(logEnum.error, [origin, event.target.error]);
      if (errorCallback)
        errorCallback(event, origin);
      done();
    };

    if (indexName != null) {
      if (!isIndexKeyValue) {
        var request = index.openCursor();
        request.onsuccess = onsuccesCursor;
        request.onerror = onerrorFunction;
      } else {
        var request = index.get(query);
        request.onsuccess = onsuccesIndexGetKey;
        request.onerror = onerrorFunction;
      }
    } else {
      var request = store.openCursor();
      request.onsuccess = onsuccesCursor;
      request.onerror = onerrorFunction;
    };
  }

  /**
   * The conditionObject contains the three elements to test a condition.
   * @private
   * @typedef {Object} conditionObject
   * @property {string} keyPath Indicates a key path to test.
   * @property {string} cond A comparison operator ( "<" , ">" , "=" , "!=" , "<=" , ">=" ).
   * @property {any} value Indicates the value to test.
   * @example
   *
   * //Object to store in the object store
   * var person = {
   *     name: 'Peter',
   *     age: 32
   * }
   *
   * // Example of conditionObject
   * var condition = { keyPath: 'age', cond: '<', value: 45};
   */

  /**
   * Creates the new Database.
   * @private
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function newDB(errorCallback) {
    var request = window.indexedDB.open(dbName);
    var origin='add -> newDB(...)';
    logger(logEnum.begin,[origin]);

    // Boolean: Database doesn't exist (no database = noDb)
    var noDb = false;

    // if onupgradeneeded means is a new database
    request.onupgradeneeded = function(event) {
      noDb = true;
    };

    request.onsuccess = function(event) {
      var db = event.target.result;
      db.close();
      if (noDb) {
        logger(logEnum.dbCreated);
      } else {
        logger(logEnum.dbExists);
      }
      done();
    };

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
      } else {
        logger(logEnum.error,[origin,event.target.error]);
      }
    };
  }

  /**
   * Creates a new object store
   * @private
   * @param {string} dbName Database name
   * @param {string} storeName Objects store name
   * @param {function} [successCallback] Function called on success. Receives as parameters event and origin.
   * @param {function} [errorCallback] Function called on error. Receives as parameters event and origin.
   */
  function newStore(storeName, successCallback, errorCallback) {
    var version;
    var origin='add -> newStore(...)';
    logger(logEnum.begin,[origin]);

      // If store already exist then returns
      if (db.objectStoreNames.contains(storeName)) {
        db.close();
        logger(logEnum.existStore,[storeName]);
        done();
        return;
      }

      version = db.version;
      db.close();
      logger(logEnum.version);
      var newVersion = version + 1;
      var store;

      request = window.indexedDB.open(dbName, newVersion);

      request.onupgradeneeded = function(event) {
        db = event.target.result;

        store = db.createObjectStore(storeName, {
          keyPath: "nId",
          autoIncrement: true
        });

        store.onerror = function(event) {
          logger(logEnum.error,[origin,event.target.result]);
          if (errorCallback) {
            errorCallback(event, origin);
          } else {
            logger(logEnum.error,[origin,event.target.result]);
          }
        };
      };

      request.onsuccess = function(event) {
        if(successCallback){
          successCallback(event,origin);
        };
        db.close();
        logger(logEnum.newStore,[storeName]);
        done();
      };
  }

  /**
   * Insert a new record/s in a object store
   * @private
   * @param {string} storeName Object store name
   * @param {(object | object[])} obj An object or objects array to insert in object store
   * @param {function} [successCallback] Function called on success. Receives as parameters event and origin.
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function newRecord(storeName, obj, successCallback, errorCallback) {
    var origin = "add -> newRecord(...)";
    logger(logEnum.begin,[origin]);
    var counter = 0;
    var store = db.transaction(storeName, "readwrite").objectStore(storeName);
    if (Array.isArray(obj)) {
      var i, objSize;
      objSize = obj.length;

      for (i = 0; i < objSize; i++) {
        var request = store.add(obj[i]);
        request.onsuccess = function(event) {
          counter++;
          if (counter == objSize) {
            logger(logEnum.newRecord, [storeName]);
            if (successCallback) {
              successCallback(event, origin);
            }
            db.close();
            logger(logEnum.close);
            done();
          }
        };

        request.onerror = function(event) {
          if (errorCallback) {
            errorCallback(event, origin);
          } else {
            logger(logEnum.error, [origin, event.target.error]);
          }
        };
      }
    } else {
      var request = store.add(obj);
      request.onsuccess = function(event) {
        logger(logEnum.newRecord, [storeName]);
        if (successCallback) {
          successCallback(event, origin);
        }
        db.close();
        logger(logEnum.close);
        done();
      };

      request.onerror = function(event) {
        if (errorCallback) {
          errorCallback(event, origin);
        } else {
          logger(logEnum.error, [origin, event.target.error]);
        }
      };
    }
  }

  /**
   * Creates a new index in an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {string} keyPath Key that the index use
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
   */
  function newIndex(storeName, indexName, keyPath, successCallback, errorCallback) {
    var version;
    var origin = 'add -> newIndex()';
    logger(logEnum.begin,[origin]);

    //// Gets the new version
    //
    version = db.version;
    db.close();
    logger(logEnum.version);
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function (event) {
      db = event.target.result;

      var upgradeTransaction = event.target.transaction;
      var store = upgradeTransaction.objectStore(storeName);
      if (!store.indexNames.contains(indexName)) {
        store.createIndex(indexName, keyPath);
      } else {
        db.close();
        logger(logEnum.existIndex, [indexName, storeName]);
        done();
        return;
      }
    };

    request.onsuccess = function (event) {
      if (successCallback) {
        successCallback(event, origin);
      };
      db.close();
      logger(logEnum.newIndex, [indexName, storeName]);
      done();
    };

    request.onerror = function (event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        logger(logEnum.error, [origin, event.target.error]);
      }
    };
  }


  /**
     * Count the records
     * @private
     * @param  {string} storeName Store name.
     * @param {string | null} indexName Index name. The records of the store are counted.
     * @param {string | null} query String that contains a query. Example of valid querys:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * With null query, all records are counted.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     */
  function count(storeName, indexName, query, successCallback, errorCallback) {
    var origin = 'get -> count(...)'
    logger(logEnum.begin,[origin]);
    var store = db.transaction(storeName, "readwrite").objectStore(storeName);
    var index;
    var counter = 0;

    if (indexName != null)
      index = store.index(indexName);

    if (!query) {
      if (indexName)
        query = index.keyPath + '!= null';
      else
        query = store.keyPath + '!= -1';
    }

    var onSuccessNoQuery = function (event) {
      var cursor = event.target.result;
      var message;
      if (cursor) {
        counter++;
        cursor.continue();
      } else {
        if (indexName) {
          message = 'There are ' + counter + 'records in the index "' + indexName + '" from store "' + storeName + "'";
        } else {
          message = 'There are ' + counter + 'records in the store "' + storeName;
        }
        if (successCallback)
          successCallback(event.target.result, origin);
        logger(logEnum.custom, [message]);
        done();
      }
    };

    var onSuccessQuery = function (event) {
      var cursor = event.target.result;
      var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
      var extMode = conditionsBlocksArray[0].externalLogOperator; //external logical operator

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = (extMode == null || extMode == 'and') ? false : true;

      if (cursor) {
        var i = 0;
        var test = false;
        for (i = 0; i < conditionsBlocksArray.length; i++) {
          var conditions = conditionsBlocksArray[i].conditionsArray;
          var intMode = conditionsBlocksArray[i].internalLogOperator;
          test = qrySys.testConditionBlock(cursor, conditions, intMode);
          if (test == exitsInFirstTrue) {
            break;
          }
        };

        if (test) {
          counter++;
        };
        cursor.continue();

      } else {
        if (successCallback) {
          successCallback(counter, origin, query);
        };
        db.close();
        logger(logEnum.close);
        logger(logEnum.countQuery, [query, counter, storeName]);
        done();
      };

    };

    var onError = function (event) {
      if (errorCallback)
        errorCallback(event.target.error);
      db.close();
      logger(logEnum.error, [event.target.error]);
      done();
    };

    if (indexName) {
      var request = index.openCursor();
      request.onsuccess = onSuccessQuery;
      request.onerror = onError;
    } else {
      var request = store.openCursor();
      request.onsuccess = onSuccessQuery;
      request.onerror = onError;
    }; //end if else block


  }

  /**
   * Deletes an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function delStore(storeName, successCallback, errorCallback) {
    var version;
    var origin = 'del -> delStore(...)';
    logger(logEnum.begin,[origin]);

    //// Gets the new version
    //
    version = db.version;
    db.close();
    logger(logEnum.version);
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function (event) {
      db = event.target.result;
      db.deleteObjectStore(storeName);
    };

    request.onsuccess = function (event) {
      if (successCallback) {
        successCallback(event, origin);
      };
      db.close();
      logger(logEnum.delStore, [storeName]);
      done();
    };

    request.onerror = function (event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        logger(logEnum.error, [origin, event.target.error]);
      }
    };
  }

  /**
   * Deletes a Database
   * @private
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function delDB( successCallback, errorCallback) {
    var request = window.indexedDB.deleteDatabase(dbName);
    var origin='del -> delDB(...)';
    logger(logEnum.begin,[origin]);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event,origin);
      } else {
        logger(logEnum.error,[origin,event.target.error]);
      };
    };

    request.onsuccess = function(event) {
      if(successCallback){
        successCallback(event, origin);
      };
      logger(logEnum.delDb);
      done();
    };
  }

  /**
   * Deletes one or more records from a store. Records are selected by the query.
   * @private
   * @param {string} storeName Object store name.
   * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
   * @param {string} query String that contains a query. Example of valid querys:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param {function(event,origin)} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function to handle errors. Receives event as parameter.
   */
  function delRecords(storeName, indexName, query, successCallback, errorCallback) {
    var origin = 'del -> delRecords(...)';
    logger(logEnum.begin,[origin]);

    //// Gets isIndexKeyValue
    //// True if query is a single value (an index key)
    // 
    var isIndexKeyValue;
    if (typeof (query) == 'number') {
      isIndexKeyValue = true;
    } else {
      isIndexKeyValue = (query.match(qrySys.operatorRgx)) ? false : true;
    };

    var conditionsBlocksArray;
    conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;
    var store = db.transaction(storeName, "readwrite").objectStore(storeName);
    var index;
    var counter = 0;

    if (indexName != null) index = store.index(indexName);

    var onsuccesCursor = function (event) {

      var cursor = event.target.result;
      var extMode = conditionsBlocksArray[0].externalLogOperator;

      var test = false;

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = (extMode == null || extMode == 'and') ? false : true;
      if (cursor) {
        var i = 0;
        var test = false;
        for (i = 0; i < conditionsBlocksArray.length; i++) {
          var conditions = conditionsBlocksArray[i].conditionsArray;
          var intMode = conditionsBlocksArray[i].internalLogOperator;
          test = qrySys.testConditionBlock(cursor, conditions, intMode);
          if (test == exitsInFirstTrue) {
            break;
          }
        };

        if (test) {
          var request = cursor.delete();
          request.onsuccess = function () {
            counter++;
          };
        };
        cursor.continue();

      } else {
        if (successCallback) {
          successCallback(event, origin, query);
        };
        db.close();
        logger(logEnum.close);
        logger(logEnum.query, [query, counter, storeName]);
        done();
      };

    } // end onsuccesCursor

    var onerrorFunction = function (event) {
      if (errorCallback) {
        errorCallback(event, origin);
      };
      db.close();
      logger(logEnum.close);
      logger(logEnum.error, [origin, event.target.error]);
      done();
    }

    if (indexName != null) {
      if (isIndexKeyValue) {
        // if is a number here is converted to string
        query = index.keyPath + '=' + query;
        conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
      };
      var request = index.openCursor();
      request.onsuccess = onsuccesCursor;
      request.onerror = onerrorFunction;
    } else {
      var request = store.openCursor();
      request.onsuccess = onsuccesCursor;
      request.onerror = onerrorFunction;
    }
  }

  /**
   * Deletes an index
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function delIndex(storeName, indexName, successCallback, errorCallback) {
    var version;
    var origin = 'del -> delIndex(...)';
    logger(logEnum.begin,[origin]);

    //// Gets the new version
    //
    version = db.version;
    db.close();
    logger(logEnum.version);
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function (event) {
      db = event.target.result;

      var upgradeTransaction = event.target.transaction;
      var store = upgradeTransaction.objectStore(storeName);
      store.deleteIndex(indexName);
    };

    request.onsuccess = function (event) {
      if (successCallback) {
        successCallback(event, origin);
      };
      db.close();
      logger(logEnum.delIndex, [indexName, storeName]);
      done();
    };

    request.onerror = function (event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        logger(logEnum.error, [origin, event.target.error]);
      }
    };
  }

  /**
   * Updates one or more records. Records are selected by the query and updated with the objectValues.
   * @private
   * @param  {string} storeName Object store name.
   * @param  {string | null} indexName Index name. If is null then no index is used (It is usually slower)
   * @param {string} query String that contains a query. Example of valid querys:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param  {object} objectValues New property value after update. Can be an array of values.
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param  {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function updateRecords(storeName, indexName, query, objectValues, successCallback, errorCallback) {
    var origin = 'update -> updateRecords(...)';

    //// Gets isIndexKeyValue
    //// If true then is query is a single value (an index key)
    var isIndexKeyValue;
    if (typeof (query) == 'number') {
      isIndexKeyValue = true;
    } else {
      isIndexKeyValue = (query.match(qrySys.operatorRgx)) ? false : true;
    };

    var conditionsBlocksArray;
    conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;
    var store = db.transaction(storeName, "readwrite").objectStore(storeName);
    var index;

    if (indexName != null) {
      index = store.index(indexName);
    };

    var counter = 0;

    var onsuccesCursor = function (event) {

      var cursor = event.target.result;
      var keys = Object.keys(objectValues); //Array with the property names that will be updated
      var newObjectValuesSize = keys.length;
      var extMode = (conditionsBlocksArray) ? conditionsBlocksArray[0].externalLogOperator : null; //external logical operator

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = (extMode == null || extMode == 'and') ? false : true;
      if (cursor) {
        var i = 0;
        var test = false;
        for (i = 0; i < conditionsBlocksArray.length; i++) {
          var conditions = conditionsBlocksArray[i].conditionsArray;
          var intMode = conditionsBlocksArray[i].internalLogOperator;
          test = qrySys.testConditionBlock(cursor, conditions, intMode);
          if (test == exitsInFirstTrue) {
            break;
          }
        };

        if (test) {
          var updateData = cursor.value;
          var i = 0;
          for (i = 0; i < newObjectValuesSize; i++) {
            // If the new value for the property keys[i] is a function then the new value is function(oldValue)
            updateData[keys[i]] =
              typeof objectValues[keys[i]] == "function"
                ? objectValues[keys[i]](updateData[keys[i]])
                : objectValues[keys[i]];
          }

          var request = cursor.update(updateData);
          request.onsuccess = function () {
            counter++;
          };
        };
        cursor.continue();

      } else {
        if (successCallback) {
          successCallback(event, origin, query);
        };
        db.close();
        logger(logEnum.close);
        logger(logEnum.query, [query, counter, storeName]);
        done();
      };

    }

    var onerrorFunction = function (event) {
      if (errorCallback)
        errorCallback(event, origin);
      db.close();
      logger(logEnum.close);
      logger(logEnum.error, [origin, event.target.error]);
      done();
    }

    if (indexName != null) {
      if (isIndexKeyValue) {
        // If query is a single number value then is mofied to be valid to the query system
        query = index.keyPath + '=' + query;
        conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
      };
      var request = index.openCursor();
      request.onsuccess = onsuccesCursor;
      request.onerror = onerrorFunction;
    } else {
      var request = store.openCursor();
      request.onsuccess = onsuccesCursor;
      request.onerror = onerrorFunction;
    };
  }

  //#endregion Private functions


  //#region Query system
  ///////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * qrySys contains all methods to manage the string queries
   * @typedef {Object} qrySys
   * @property {function} init Inits the regex variables used to parse the query strings.
   * @property {function} testConditionBlock Test a conditions block.
   * @property {function} makeConditionsBlocksArray Makes an array of conditions blocks.
   * @property {function} testCondition Test a conditional expression as false or true.
   */
  var qrySys = {

    /**
     * Initializes the regex variables used to parse the query string
     * @return {void}
     */
    init: function () {
      this.blockRgx = /\(.*?(?=\))/g;
      this.blockOperatorRgx = /[\&\|]+(?=(\s*\())/g;
      this.operatorRgx = /(=|>|<|>=|<=|!=)+/g;
      this.rightOperandRgx = /(?:([=><]))\s*["']?[^"']+["']?\s*(?=[&\|])|(?:[=><])\s*["']?[^"']+["']?(?=$)/g;
      this.leftOperandRgx = /([^"'\s])(\w+)(?=\s*[=|>|<|!])/g;
    },

    /**
     * Transforms a query string into an array of objects that is used by SIDB to process the query.
     * @param  {string} query String that contains a query. Example of valid querys:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * @return {object[]} Returns and array of coditions blocks.
     */
    makeConditionsBlocksArray: function (query) {

      var t = this;
      var conditionsBlocksArray = [];

      //// Gets blocks
      //
      var blocks = query.match(t.blockRgx);
      // Delete left parentheses
      if(blocks){
        var i=0;
        for(i=0;i<blocks.length;i++){
          blocks[i]=blocks[i].substr(1);
        };
      };

      // Logical operators between blocks, all must be the same type
      var extLogOperator = (query.match(t.blockOperatorRgx)) ? query.match(t.blockOperatorRgx) : null;

      

      var pushConditionBlockToArray = function (qry, extLogOperator) {

        //// Gets left operands
        //
        var leftOperands = qry.match(t.leftOperandRgx);

        //// Gets right operands
        //
        var rightOperands = qry.match(t.rightOperandRgx);
        var i=0;
        for(i=0;i<rightOperands.length;i++){
          // Delete the operator
          while(rightOperands[i][0].match(/[=><!]/g)){
            rightOperands[i]=rightOperands[i].substr(1);
          };
          // Delete quotes and trim white spaces
          rightOperands[i] = rightOperands[i].replace(/["']/g, '').trim();
        };

        //// Gets operators
        //// Removing righ operands (values) before extract comparison operators avoids 
        //// problems with literal values that include comparisson symbols(= , >,...) quoted.
        //
        for(i=0;i<rightOperands.length;i++){
          qry=qry.replace(rightOperands[i],'');
        };
        var operators = qry.match(t.operatorRgx);

        
        var conditionsArray = [];

        // If query is like: " c = 15 "
        if (leftOperands.length == 1) {

          conditionsArray.push(
            {
              keyPath: leftOperands[0],   // property
              cond: operators[0],         // =, >, <, ...
              value: rightOperands[0]     // value
            }
          );

          conditionsBlocksArray.push(
            {
              conditionsArray: conditionsArray,
              internalLogOperator: null,
              externalLogOperator: extLogOperator
            }
          );

          conditionsArray = null;

        } else {

          // if query is like: " c = 15 & a > 30 "
          var logOperatorsType = qry.match(/[\&\|]+/g)[0];

          if (logOperatorsType == '&' || logOperatorsType == '&&') {
            logOperatorsType = 'and';
          } else {
            logOperatorsType = 'or';
          };

          var i = 0;
          for (i = 0; i < operators.length; i++) {
            conditionsArray.push(
              {
                keyPath: leftOperands[i],
                cond: operators[i],
                value: rightOperands[i]
              }
            );
          };

          conditionsBlocksArray.push(
            {
              conditionsArray: conditionsArray,
              internalLogOperator: logOperatorsType,
              externalLogOperator: extLogOperator
            }
          );
          conditionsArray = null;
        }; // end if else
      };


      // If condition is a single sentence like: " a = 10 & b > 5 "
      if (!blocks) {
        pushConditionBlockToArray(query, null);
        return conditionsBlocksArray;
      } else {
        // If condition is a multiple sentence like: " (a = 5 & b = 10) || (c < 4 & f > 10) "        
        if (extLogOperator) {
          if (extLogOperator == '&' || extLogOperator == '&&') {
            extLogOperator = 'and';
          } else {
            extLogOperator = 'or';
          };
        };

        var i = 0;
        for (i = 0; i < blocks.length; i++) {

          pushConditionBlockToArray(blocks[i], extLogOperator);

        }
        return conditionsBlocksArray;
      };
    },

    /**
     * Test a block of conditions. For example:
     * (a<100 && a>20) || (b = 30 & c != 50 && a >= 200)   <==== Here are 2 conditions blocks. The first block has 2 conditions.
     * @param  {IDBCursor} cursor Contains the actual record value to make the comparisson. 
     * @param  {conditionObject[]} conditionsArray Contains the conditions.
     * @param  {string | null} operator Is a logical operator that can be "and", "or" or null.
     * @return {boolean} Result after evaluating the conditions block (true/false)
     */
    testConditionBlock: function (cursor, conditionsArray, operator) {

      var t = this;

      var test = (operator == 'and' || operator == null) ? true : false;
      if (operator == 'and' || operator == null) {
        for (i = 0; i < conditionsArray.length; i++) {
          test = t.testCondition(
            cursor.value[conditionsArray[i].keyPath],
            conditionsArray[i].cond,
            conditionsArray[i].value
          );
          if (!test) return false;
        }
      } else {
        for (i = 0; i < conditionsArray.length; i++) {
          test = t.testCondition(
            cursor.value[conditionsArray[i].keyPath],
            conditionsArray[i].cond,
            conditionsArray[i].value
          );
          if (test) return true;
        }
      }
      return test;
    },
    

    /**
     * Test a conditional expression as false or true
     * @private
     * @param {string | number} value1 First value to compare
     * @param {string} condition Comparison operator ( = , > , < , >= , <= , != )
     * @param {string | number} value2 Second value to compare
     * @returns {boolean} Result after evaluating the condition
     */
    testCondition: function (value1, condition, value2) {
      var result;
      switch (condition) {
        case "=":
          result = value1 == value2 ? true : false;
          return result;
          break;

        case ">":
          result = value1 > value2 ? true : false;
          return result;
          break;

        case "<":
          result = value1 < value2 ? true : false;
          return result;
          break;

        case ">=":
          result = value1 >= value2 ? true : false;
          return result;
          break;

        case "<=":
          result = value1 <= value2 ? true : false;
          return result;
          break;

        case "!=":
          result = value1 != value2 ? true : false;
          return result;
          break;

        default:
          break;
      }
    }
  } // end qrySys



  //#endregion Query system


  //#region Task queue system
  //////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Flag to check if all task were completed (tasqQueue is empty)
   * @private
   * @type {boolean}
   */
  var idle = true;

  /**
   * Stores the pending tasks. Internal use.
   * @private
   * @type {object[]}
   */
  var taskQueue = [];

  /**
   * Object task to open database used by the Task queue system 
   * @private
   */
  var tkOpen={
    type:"openDb"
  };

  /**
   * Delete a task from the queue when a is finished and checks for pending tasks.
   * @private
   * @return {void}
   */
  function done() {
    taskQueue.shift();
    checkTasks();
  }

  /**
   * Manage the task queue
   * @private
   */
  function checkTasks() {
    if (taskQueue.length == 0) {
      idle = true;      
      logger(logEnum.noTask);
      return;
    }

    idle = false;

    var type = taskQueue[0].type;
    var task = taskQueue[0];

    switch (type) {

      case 'openDb':
        openDb();
        break;

      case "newStore":
        newStore(task.storeName, task.successCallback, task.errorCallback);
        break;

      case "newRecords":
        newRecord(task.storeName, task.obj, task.successCallback, task.errorCallback);
        break;

      case "newDB":
        newDB(task.errorCallback);
        break;

      case "count":
        count(task.storeName, task.indexName, task.query, task.successCallback, task.errorCallback);
        break;

      case "custom":
        logger(logEnum.begin,['custom task']);
        task.fn.apply(task.context, task.args);
        done();
        break;

      case "delStore":
        delStore(task.storeName, task.successCallback, errorCallback);
        break;

      case "delDB":
        delDB(task.successCallback, task.errorCallback);
        break;

      case "delRecords":
        delRecords(task.storeName, task.indexName, task.query, task.successCallback, task.errorCallback);
        break;

      case "delIndex":
        delIndex(task.storeName, task.indexName, task.successCallback, task.errorCallback);
        break;

      case "updateRecordsByIndex":
        updateRecords(task.storeName, task.indexName, task.query, task.objectValues, task.successCallback, task.errorCallback);
        break;

      case "newIndex":
        newIndex(task.storeName, task.indexName, task.keyPath, task.successCallback, task.errorCallback);
        break;

      case "lastRecords":
        lastRecords(task.storeName, task.maxResults, task.successCallback, task.errorCallback);
        break;

      case "getRecords":
        getRecords(task.storeName, task.indexName, task.query, task.successCallback, task.errorCallback);
        break;

      default:
        break;
    }
  }

  /**
   * Execs pending tasks. The tasks are executed sequentially. 
   * A task does not run until the previous one ends. 
   * This avoids problems arising from the asynchronous nature of the indexedDB api.
   * @public
   */
  this.execTasks = function() {
    if (idle) {
      checkTasks();
    }
  };

  

  /**
   * Contains add methods
   * @namespace
   */
  this.add = { 
    
    /**
     * Add the task "create new database" to the task queue. Internal use only.
     * @private
     * @instance
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    db: function(errorCallback) {
      var task = { type: "newDB", errorCallback: errorCallback };

      taskQueue.push(task);
    },

    /**
     * Adds the task "create a new object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
     *
     * // Callback function to process a possible error
     * //
     * var myErrorCallback = function(event){
     *   console.log('Error creating new object store:' + event.target.error);
     * }
     *
     *
     * //
     * // This code adds the task "create a new object store" to the task queue
     * //
     * mydb.add.store('objectStoreName', myErrorCallback);
     *
     *
     * //
     * // Execs all pending tasks
     * //
     * mydb.execTasks();
     */
    store: function (storeName, successCallback, errorCallback) {
      // Make the task object
      var task = {
        type: "newStore",
        storeName: storeName,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      // Adds the task open database to taskQueue
      taskQueue.push(tkOpen);
      // Adds this task to taskQueue
      taskQueue.push(task);
    },

    /**
     * Add the task "insert new record in object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name where the record is added.
     * @param {(object | object[])} obj An object or objects array to insert in the object store.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
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
     * var myErrorCallback = function(event){
     *     console.log('Error inserting the new record: ' + event.target.error);
     * }
     *
     *
     * //
     * // Inserts new record in object store. (needs execTasks() to execute)
     * //
     * mydb.add.records('objectStoreName', person, myErrorCallback);
     *
     *
     * // Execs all pending tasks.
     * //
     * mydb.execTasks();
     */
    records: function (storeName, obj, successCallback, errorCallback) {
      var task = {
        type: "newRecords",
        storeName: storeName,
        obj: obj,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },

    /**
     * Adds the task "create a new index" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name where the index is created.
     * @param {string} indexName Index name.
     * @param {string} keyPath Key (property of stored objects) that the index use to order and filter.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
     *
     * // Object to insert in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     *
     * //
     * // Callback function to process a possible error
     * //
     * var myErrorCallback = function(event){
     *     console.log('Error creating the new index: ' + event.target.error);
     * }
     *
     *
     * //
     * // This code adds the task "create a new index" to the task queue.
     * // In this case the new index "ages" order the records by the record property "age".
     * // Only records with a property named "age" are in the index "ages".
     * //
     * mydb.add.index('objectStoreName', 'ages', 'age', myErrorCallback);
     *
     *
     * // Execs all pending tasks
     * //
     * mydb.execTasks();
     */
    index: function (storeName, indexName, keyPath, successCallback, errorCallback) {
      var task = {
        type: "newIndex",
        storeName: storeName,
        indexName: indexName,
        keyPath: keyPath,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },

    /**
     * Add a specific function to the SIDB task queue.
     * @param  {any} fn Our custom function that we want to add to the task queue.
     * @param  {any} context It is usually "this".
     * @param  {...any} args Arguments for the function.
     * @return {void}
     * @example
     * var mydb = new sidb('companyDB');
     *
     * var store= 'southFactory';
     *
     * // Inserts one record in "southFactory" object store.
     * //
     * mydb.add.records(
     *    store,                                                                      // Object store name.
     *    {ID: 1, name: 'Peter', department: 'manufacturing', age: 32, salary: 1200}  // A single object that represents a record.
     * );
     *
     *
     * //
     * // To add an own function to the task queue add.customTask is used
     * //
     * //     add.customTask( fn, context, args)
     * //
     * // This task is executed after the previous insertion task and before the next reading task.
     * //
     * add.customTask(
     *    function(m){                                // Custom function
     *        alert(m);
     *    },
     *    this,                                       // Context. Usually "this".
     *    'Inserting operation finished !!'           // Arguments of the function. Can be a variable number of arguments.
     * )
     *
     *
     *
     * // Reads all records from "southFactory" object store.
     * //
     * mydb.get.lastRecords(
     *    store,
     *    null,
     *    readerCallback
     * );
     *
     *
     * // ***** VERY IMPORTANT ****
     * // Once we have introduced the operations that we want to perform on the database,
     * // we must use the function execTasks() to execute them.
     * //
     * mydb.execTasks();
     */
    customTask: function (fn, context, args) {
      var argsArray = [];
      if (args) {
        var i = 0;
        for (i = 2; i < arguments.length; i++) {
          argsArray[2 - i] = arguments[i];
        }
      }
      var task = {
        type: "custom",
        fn: fn,
        context: context,
        args: argsArray
      };

      taskQueue.push(task);
    }
  };

  /**
   * Contains delete methods
   * @namespace
   */
  this.del = {
    /**
     * Adds the task "delete a database" to the task queue.
     * @public
     * @instance
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     */
    db: function( successCallback, errorCallback) {
      var task = {
        type: "delDB",
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(task);
    },

    /**
     * Adds the task "delete a store from database" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     */
    store: function(storeName, successCallback, errorCallback) {
      var task = {
        type: "delStore",
        storeName: storeName,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },

    /**
     * Adds the task "delete a record/s from the object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name.
     * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
     * @param {string} query String that contains a query. Example of valid querys:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32,
     *     salary: 1200
     * }
     *
     * //
     * // Deletes records where age is 40 using the index named 'ages' with the keypath 'age' as query.
     * //
     * mydb.del.record('objectStoreName', 'ages', 40);
     *
     * //
     * // Deletes records with age < 20 and salary > 1500 using a conditionObject array as query.
     * //
     * mydb.del.records(
     *    'objectStoreName',          
     *    null,                       // If we had an index with keypath "age" or "salary", use it could improve performance.
     *    'age < 20 & salary > 1500'      
     * );
     *
     * mydb.execTasks();
     */
    records: function(storeName, indexName, query, successCallback, errorCallback) {
      var task = {
        type: "delRecords",
        storeName: storeName,
        indexName: indexName,
        query: query,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },

    /**
     * Adds the task "delete an index from an object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name
     * @param {string} indexName Index name
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     */
    index: function(storeName, indexName, successCallback, errorCallback) {
      var task = {
        type: "delIndex",
        storeName: storeName,
        indexName: indexName,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    }
  };

  /**
   * Contains update methods
   * @namespace
   */
  this.update = {
    /**
     * Adds the task "update record/s" to the task queue.
     * @param  {string} storeName Object store name.
     * @param  {string | null} indexName Index name. If is null then no index is used (It is usually slower).
     * @param {string} query String that contains a query. Example of valid querys:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {object} objectValues Object with the new values.
     * The values not only can be a single value, it can be a function that receives the old value and returns a new value.
     * (Example: objectValues = {property1:'value1', property4: value4, property6: function(oldValue){return oldValue + 100;}})
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32,
     *     salary: 1500
     * }
     *
     *
     * //
     * // Changes the age and salary using an index named "names" with keypath 'name' as query.
     * //
     * mydb.update.records(
     *     'objectStoreName',
     *     'names',
     *     'Peter',
     *     {age: 33, salary: 1650},
     *     null,
     *     myErrorCallback
     * );
     *
     *
     * //
     * // Increases the salary in 200 to all persons with age > 40 and salary < 1000 using a conditionObject array as query.
     * // We can send a function to the property salary on selected records.
     * //
     * mydb.update.records(
     *     'objectStoreName',
     *     null,
     *     'age > 40 & salary < 1000',
     *     {salary: function(oldSalary){
     *         return oldSalary + 200;
     *         };
     *     },
     *     null,
     *     myErrorCallback
     * );
     * 
     *
     * // Execs all pending tasks.
     * //
     * mydb.execTasks();
     *
     *
     * // Optional callback function to process errors
     * //
     * function myErrorCallback(event){
     *     console.log(event.target.error);
     * };
     *
     */
    records: function(storeName, indexName, query, objectValues, successCallback, errorCallback) {
      var task = {
        type: "updateRecordsByIndex",
        storeName: storeName,
        indexName: indexName,
        query: query,
        objectValues: objectValues,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    }
  };

  /**
   * Contains get methods
   * @namespace
   */
  this.get = {
    /**
     * Adds the task "get the last records" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {number} maxResults Limits the records retrieved.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
     *
     * // An example of object stored in the object store "storeName"
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     * //
     * // Gets the last 200 records from the object store named "storeName", and sends the result to a function(Callback)
     * //
     * mydb.get.lastRecords('storeName', 200, myCallback);
     * 
     * 
     * //
     * //Execs all pending tasks
     * //
     * mydb.execTasks();
     * 
     * 
     * // Callback function to process the results
     * //
     * function myCallback(resultsArray){
     *     var size = resultsArray.length();
     *     var i=0;
     *     for(i=0;i<size;i++){
     *         console.log('Name: ' + resultsArray[i].name + ' Age: ' + resultsArray[i].age + '\n');
     *     };
     * };     
     *
     */
    lastRecords: function(storeName, maxResults, successCallback, errorCallback) {
      var task = {
        type: "lastRecords",
        storeName: storeName,
        maxResults: maxResults,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },

    /**
     * Adds the task "get one or more records from a object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
     * @param {string} query String that contains a query. Example of valid querys:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'peter'                                    // Single value always refers to the index keypath.<br>
     * A single value always refers to the index keypath so the index can not be null in this case.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     * 
     * //
     * // Callback function to process the result
     * //
     * var myCallback = function(result){
     *
     *     if(Array.isArray(result)){
     *         var i=0;
     *         for(i=0;i<result.length)
     *         console.log('Name: ' + result[i].name + ' Age: ' + result[i].age + '\n');
     *     } else {
     *         console.log('Name: ' + result.name + ' Age: ' + result.age + '\n');
     *     }
     *
     * }
     *
     * 
     * //
     * // If there is an index named "ages" based on property "age", we can get a person with age = 32.
     * //
     * mydb.get.records(
     *    'objectStoreName', 
     *    'ages', 
     *    32, 
     *    myCallback
     * );
     * 
     * 
     * //
     * // Or we can get persons with age > 30 and name! = Peter
     * //
     * mydb.get.records(
     *    'objectStoreName',
     *    null,
     *    'age>30 & name != "Peter"', 
     *    myCallback
     * );
     *
     * 
     * // Execs all pending tasks
     * mydb.execTasks();
     */
    records: function(storeName, indexName, query, successCallback, errorCallback) {
      var task = {
        type: "getRecords",
        storeName: storeName,
        indexName: indexName,
        query: query,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },

    /**
     * Adds the task "Count the records" to the task queue
     * @param  {string} storeName Store name.
     * @param {string | null} indexName Index name. The records of the store are counted.
     * @param {string | null} query String that contains a query. Example of valid querys:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * With null query, all records are counted.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * };
     * 
     * //
     * // Counts all records in the store "southFactory"
     * //
     * mydb.get.count('southFactory',null,null,succesFunction);
     * 
     * //
     * // Counts all records in the index 'Names'
     * //
     * mydb.get.count('southFactory','Names',null,succesFunction); 
     * 
     * //
     * // Counts all persons with age > 30
     * //
     * mydb.get.count('southFactory',null,'age > 30',succesFunction);
     * 
     * //
     * // Execs all pending task
     * //
     * mydb.execTasks();
     * 
     */
    count: function(storeName,indexName,query,successCallback,errorCallback){
      var task = {
        type: "count",
        storeName: storeName,
        indexName: indexName,
        query: query,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    }
  };  

  //#endregion Task queue system


  //#region Logger system
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  
  var logEnum = {
    open: 1,
    close: 2,
    lastRecords: 3,
    getAll: 4,
    getByIndexKey: 5,
    error: 6,
    dbCreated: 7,
    dbExists: 8,
    query: 9,
    noTask: 10,
    newRecord: 11,
    version: 12,
    newIndex: 13,
    newStore: 14,
    delIndex: 15,
    delStore: 16,
    delDb: 17,
    existIndex: 18,
    existStore: 19,
    countQuery: 20,
    custom:21,
    begin:22,
    finish:23
  };

  function logger(t, args) {
    if (consoleOff)
      return;

    switch (t) {

      case 21:
        console.log(args[0]);
        break;
      case 22:
      console.log('//--- ' + args[0] + ' ---------------------------->');
      break;

      case 23:
      console.log('<--------------- ' + args[0] + ' finished -------//');
      break;

      /*case 1:
        console.log('Database ' + dbName + ' opened');
        break;

      case 2:
        console.log('Database ' + dbName + ' closed');
        break;*/

      case 3:
        console.log(args[0] + ' last records returned from store "' + args[1] + '"');
        break;

      case 4:
        console.log('All records returned from store "' + args[0] + '"');
        break;

      case 5:
        console.log('Records with key "' + args[0] + '" returned from index "' + args[1] + '" on object store "' + args[2] + '"')
        break;

      case 6:
        console.error('Error in ' + args[0] + ':');
        console.error(args[1]);
        break;

      case 7:
        console.log('Database "' + dbName + '" created');
        break;

      case 8:
        console.log('Database "' + dbName + '" already exists');
        break;

      case 9:
        console.log('Processed query: "' + args[0] + '" finished\n' + args[1] + ' records returned from object store "' + args[2] + '"');
        break;

      case 10:
        console.log("No pending tasks");
        break;

      case 11:
        console.log('New record/s added to store "' + args[0] + '"');
        break;

      case 12:
        console.log('Database version tested');
        break;

      case 13:
        console.log('New index "' + args[0] + '" in store "' + args[1] + '"');
        break;

      case 14:
        console.log('New store "' + args[0] + '" created');
        break;

      case 15:
        console.log('Index "' + args[0] + '" deleted from store "' + args[1] + '"');
        break;

      case 16:
        console.log('Store "' + args[0] + '" deleted');
        break;

      case 17:
        console.log('Database "' + dbName + '" deleted');
        break;

      case 18:
        console.log('Index "' + args[0] + '" already exists in store "' + args[1] + '"');
        break;

      case 19:
        console.log('Store "' + args[0] + '" already exists');
        break;

        case 20:
        console.log('Processed query finished: "'+args[0]+'"\n'+ args[1] +' records counted from the query to store: "'+args[2]+'"');
        break;
        

      default:
        break;
    }
  }

  //#endregion Logger system


  /**
   * Contains some util methods
   * @namespace
   */
  this.utils = {
    /**
     * Extracts a part of n elements from an array wich represents a data page.
     * @public
     * @instance
     * @param {object[]} array Array where the "page" is extracted
     * @param {number} elementsPerPage Number of elements per page
     * @param {number} page The page wich will be extracted from array
     * @returns {Array} The part of original array wich represents the page
     */
    pageFromArray: function(array, elementsPerPage, page) {
      var pageArray = array.slice(
        (page - 1) * elementsPerPage,
        page * elementsPerPage
      );
      return pageArray;
    }
  };
  

  

  

  //// Initialization /////////////////////////////
  qrySys.init();
  this.add.db();
  this.execTasks();
};
