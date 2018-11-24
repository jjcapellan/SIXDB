/**
 *  Simple IndexedDB
 *  @desc Simple IndexedDB (SIXDB) is a wrapper for indexedDB API.
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
 * Creates an sixdb (simple indexedDB) object that manage the new indexedDB database.
 * @class
 * @param  {string} _dbName Name for the new database.
 */
var sixdb = function(_dbName) {


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
    }
  };

  /**
   * Function to compare a property value with a test value
   * @private
   * @param  {string | number} value1 Property value
   * @param  {string | number} value2 Value to test
   * @return {boolean}
   */
  var customOperator = function (value1, value2) {
    return (value1 == value2);
  };

  var _store = null;

  /**
   * Sets customOperator. To make the queries we can add to the SIXDB comparison operators our own operator.
   * @param  {function} compareFunction Function to compare a property value with a test value.<br>
   * @return {void}
   * @example 
   * var mydb = new sixdb('myDatabase');
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
  this.setCustomOperator = function (compareFunction){
    if(compareFunction){
      if(typeof(compareFunction)=='function'){
        if(compareFunction.length == 2){
        customOperator = compareFunction;
        }
      }
    }
  };
  
  //#region Private functions
  //////////////////////////////////////////////////////////////////////////////////////

  /**
   * Opens the database
   * @private
   * @return {void}
   */
  function openDb(){
    var request = window.indexedDB.open(dbName);

    request.onerror = function (event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function (event) {
      db = event.target.result;
      done();
    };
  }

  /**
   * Gets last records from an object store
   * @private
   * @param {string} storeName Store name.
   * @param {number} maxResults Limits the records retrieved.
   * @param {function(object[],string)} successCallback Function called when done. Receives as parameters the retrieved records and origin.
   * @param {function(event)} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function lastRecords(maxResults, successCallback, errorCallback) {
    var origin = "get -> lastRecords(...)";
    var resultFiltered = [];
    var counter = 0;
    var request = null;

    logger(origin + logEnum.begin);

    if (!errorCallback) errorCallback = function() {
        return;
      };

      /*
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }*/

    //// Executed if maxResults is not null. Opens a cursor to count the results.
    //
    var onsuccesCursorFunction = function(event) {
      var cursor = event.target.result;

      if (cursor && counter < maxResults) {
        resultFiltered.push(cursor.value);
        counter++;
        cursor.continue();
      } else {
        successCallback(resultFiltered, origin);
        db.close();
        logger(counter + ' last records returned from store "' + _store.name + '"');
        done();
      }
    };

    //// Executed if maxResults is null. Don't needs cursor. (It's faster)
    //
    var onsuccesGetAllFunction = function(event) {
      successCallback(event.target.result, origin);
      db.close();
      logger('All records returned from store "' + _store.name + '"');
      done();
    };

    var onerrorFunction = function(event) {
      requestErrorAction(origin,request.error, errorCallback);
    };

    //// Gets the correct request
    if (maxResults != null) {
      /// Opens a cursor from last record in reverse direction
      try{
      request = (_store.openCursor(null, "prev").onsuccess = onsuccesCursorFunction);
      } catch(e){
        db.close();
      errorSys.makeErrorObject(origin, 20, request.error);
      logger(lastErrorObj, true);
      taskQueue.shift();
      errorCallback(lastErrorObj);
      checkTasks();
      }
      request.onsuccess = onsuccesCursorFunction;
      request.onerror = onerrorFunction;


    } else {
      /// Gets all records. It is faster than openCursor.
      request = tryStoreGetAll(origin,_store,errorCallback); //store.getAll();
      if(!request){
        checkTasks();
        return;
      }
      request.onsuccess = onsuccesGetAllFunction;
      request.onerror = onerrorFunction;
    }
  } //end lastRecords()

  /**
   * Gets a record/s from an object store using a key value from an index.
   * @private
   * @param {string} storeName Store name.
   * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
   * @param {string | number} [query] Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param {function(object[],string)} successCallback Receives as parameters the result and origin. Result can be an object array, single object or string.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */  
  function getRecords(_storeName, successCallback, {indexName, query, errorCallback}) {
    var origin = "get -> getRecords(...)";
    var index = null;
    logger(origin + logEnum.begin);

    if (!errorCallback) 
    errorCallback = function () {
      return;
    };

    /*
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }*/

    //// Gets index
    if (indexName) {
      index = getIndex(origin, _store, indexName, errorCallback);
      if (!index) {
        checkTasks();
        return;
      }
    }

    var commonArgs = {origin: origin, successCallback: successCallback, errorCallback: errorCallback};

    if (!indexName && !query)
      getRecordsA(commonArgs);
    else
      if (!indexName && query)
        getRecordsB(query, commonArgs);
      else
        if (indexName && !query)
          getRecordsC(index, commonArgs);
        else
          if (indexName && query)
            getRecordsD(index, query, commonArgs);

  }

  function getRecordsA({origin, successCallback, errorCallback}) {

    var request = null;


    /// Callbacks of request
    var onsuccess = function (event) {
      successCallback(event.target.result, origin);
      db.close();
      logger('All records returned from store "' + _store.name + '"');
      done();
    };
    var onerror = function (event) {
      requestErrorAction(origin, request.error, errorCallback);
    };


    /// request definition
    request = tryStoreGetAll(origin, _store, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccess;
    request.onerror = onerror;

  }

  function getRecordsB(query, {origin, successCallback, errorCallback}) {
    var counter = 0;
    var resultFiltered = [];
    var request = null;

    var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);


    /// request callbacks
    var onsucces = function (event) {
      var cursor = event.target.result;
      var extMode = conditionsBlocksArray[0].externalLogOperator;
      var test = false;

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = extMode == null || extMode == "and" ? false : true;
      if (cursor) {

        test = testCursor(conditionsBlocksArray, exitsInFirstTrue, cursor);

        if (test) {
          resultFiltered.push(cursor.value);
          counter++;
        }
        cursor.continue();
      } else {
        successCallback(resultFiltered, origin, query);
        db.close();
        logger('Processed query: "' + query + '" finished\n' + counter + ' records returned from object store "' + _store.name + '"');
        done();
      }
    };
    var onerror = function (event) {
      requestErrorAction(origin, request.error, errorCallback);
    };


    /// request definition
    request = tryOpenCursor(origin, _store, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsucces;
    request.onerror = onerror;
  }

  function getRecordsC(index, {origin, successCallback, errorCallback}) {

    var request = null;

    /// request callbacks
    var onsuccesGetAll = function (event) {
      successCallback(event.target.result, origin);
      db.close();
      logger('All records returned from index "' + index.name + '" in store "'+index.objectStore.name+'"');
      done();
    };
    var onerrorFunction = function (event) {
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryIndexGetAll(origin, index, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccesGetAll;
    request.onerror = onerrorFunction;
  }

  function getRecordsD(index, query, {origin, successCallback, errorCallback}) {
    var counter = 0;
    var resultFiltered = [];
    var isIndexKeyValue = isKey(query);
    var request = null;


    var conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;

    /// request callbacks
    var onsuccesIndexGetKey = function (event) {
      successCallback(event.target.result, origin, query);
      db.close();
      logger('Records with key "' + query + '" returned from index "' + index.name + '" on object store "' + index.objectStore.name + '"');
      done();
    };
    var onsuccesCursor = function (event) {
      var cursor = event.target.result;
      var extMode = conditionsBlocksArray[0].externalLogOperator;
      var test = false;

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = extMode == null || extMode == "and" ? false : true;
      if (cursor) {

        test = testCursor(conditionsBlocksArray, exitsInFirstTrue, cursor);

        if (test) {
          resultFiltered.push(cursor.value);
          counter++;
        }
        cursor.continue();
      } else {
        successCallback(resultFiltered, origin, query);
        db.close();
        logger('Processed query: "' + query + '" finished\n' + counter + ' records returned from object store "' + index.objectStore.name + '"');
        done();
      }
    };
    var onerror = function (event) {
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = (!isIndexKeyValue) ? tryOpenCursor(origin, index, errorCallback) : tryIndexGetKey(origin, index, query, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = (isIndexKeyValue) ? onsuccesIndexGetKey : onsuccesCursor;
    request.onerror = onerror;

  }


  /**
   * This thing goes through the registers and applies an aggregate function in one property.
   * @private
   * @param {string} storeName Store name.
   * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
   * @param {string | number} [query] Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * @param  {string} property Represents the column to apply the aggregate function.
   * @param  {function} aggregatefn Function of type aggregate. Receives as arguments: actualValue ,selectedValue and counter.<br>
   * Example:<br>
   * var myaggregateFunction = function(actualValue, selectedValue){
   *     return actualValue + selectedValue;
   *     };
   * @param  {function} successCallback Receives as parameters the result (a number) and origin.
   * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function getaggregateFunction( property, aggregatefn, successCallback, origin,{indexName, query, errorCallback}) {

    var index = null;

    logger(origin + logEnum.begin);

    if (!errorCallback) errorCallback = function () {
      return;
    };

    /*
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }*/

    //// Gets index
    if (indexName != null) {
      index = getIndex(origin, _store, indexName, errorCallback);
      if (!index) {
        checkTasks();
        return;
      }
    }

    var commonArgs = {origin: origin, property: property, aggregatefn: aggregatefn, successCallback: successCallback, errorCallback: errorCallback};

    if (!indexName && !query)
      getaggregateFunctionA(_store, commonArgs);
    else if (!indexName && query)
      getAggregateFunctionB(_store, query, commonArgs);
    else if (indexName && !query)
      getaggregateFunctionA(index, commonArgs);
    else if (indexName && query)
      getAggregateFunctionB(index, query, commonArgs);

  }

  function getaggregateFunctionA(_store, {origin, property, aggregatefn, successCallback, errorCallback}) {
    var request = null;
    var actualValue = null;
    var counter = 0;

    /// request callbacks
    var onsuccess = function (event) {
      var cursor = event.target.result;

      if (cursor) {
        if (cursor.value[property]) {
          counter++;
          actualValue = aggregatefn(actualValue, cursor.value[property], counter);
        }
        cursor.continue();

      } else {
        successCallback(actualValue, origin);
        db.close();
        logger('Result of ' + origin + ' on property "' + property + '": ' + actualValue);
        done();

      }
    };
    var onerrorFunction = function (event) {
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccess;
    request.onerror = onerrorFunction;

  }

  function getAggregateFunctionB(_store,  query, {origin, property, aggregatefn, successCallback, errorCallback}) {

    var request = null;
    var actualValue = null;
    var isIndexKeyValue = isKey(query);
    if (isIndexKeyValue)
      query = _store.keyPath + '=' + query;
    var counter = 0;
    var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);

    /// request callbacks
    var onsuccesCursor = function (event) {
      var cursor = event.target.result;
      var extMode = conditionsBlocksArray[0].externalLogOperator;
      var test = false;

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = extMode == null || extMode == "and" ? false : true;
      if (cursor) {

        test = testCursor(conditionsBlocksArray, exitsInFirstTrue, cursor);

        if (test) {
          if (cursor.value[property]) {
            counter++;
            actualValue = aggregatefn(actualValue, cursor.value[property], counter);
          }
        }
        cursor.continue();
      } else {
        successCallback(actualValue, origin, query);
        db.close();
        logger('Result of ' + origin + ' on property "' + property + '": ' + actualValue);
        done();
      }
    };
    var onerrorFunction = function (event) {
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccesCursor;
    request.onerror = onerrorFunction;

  }


  /**
   * The conditionObject contains the three elements to test a condition.
   * @private
   * @typedef {Object} conditionObject
   * @property {string} keyPath Indicates a key path to test.
   * @property {string} cond A comparison operator ( "<" , ">" , "=" , "!=" , "<=" , ">=", "<>" ).
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
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newDB(errorCallback) {
    var request = window.indexedDB.open(dbName);
    var origin='add -> newDB(...)';
    logger(origin + logEnum.begin);

    if(!errorCallback){
      errorCallback=function(){return;};
    }

    // Boolean: Database doesn't exist (no database = noDb)
    var noDb = false;

    // if onupgradeneeded means is a new database
    request.onupgradeneeded = function(event) {
      noDb = true;
    };

    request.onsuccess = function(event) {
      var db = event.target.result;
      dbVersion = db.version;
      db.close();
      if (noDb) {
        logger('Database "' + dbName + '" created');
      } else {
        logger('Database "' + dbName + '" already exists');
      }
      done();
    };

    request.onerror = function(event) {
      requestErrorAction(origin,request.error, errorCallback);
    };
  }

  /**
   * Creates a new object store
   * @private
   * @param {string} dbName Database name
   * @param {string} storeName Objects store name
   * @param {function} [successCallback] Function called on success. Receives as parameters event and origin.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newStore(storeName, successCallback, errorCallback) {
    var version;
    var origin='add -> newStore(...)';
    logger(origin + logEnum.begin);

    if(!errorCallback){
      errorCallback=function(){return;};
    }

    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }

      // If store already exist then returns
      if (db.objectStoreNames.contains(storeName)) {
        db.close();
        logger('Object store "' + storeName + '" already exists');
        done();
        return;
      }

      
      version = db.version;
      db.close();
      var newVersion = version + 1;
      var store;

      request = window.indexedDB.open(dbName, newVersion);

      request.onupgradeneeded = function(event) {
        db = event.target.result;

        try {
          store = db.createObjectStore(storeName, {
            keyPath: "nId",
            autoIncrement: true
          });
        } catch (e) {
          requestErrorAction(origin, e, errorCallback);
          return;
        }

        store.onerror = function(event) {
          requestErrorAction(origin,event.target.error, errorCallback);
        };
      };

      request.onsuccess = function(event) {
        if(successCallback){
          successCallback(event,origin);
        }
        db.close();
        logger('New object store "'+storeName+'" created');
        done();
      };
  }

  /**
   * Insert a new record/s in a object store
   * @private
   * @param {string} storeName Object store name
   * @param {(object | object[])} obj An object or objects array to insert in object store
   * @param {function} [successCallback] Function called on success. Receives as parameters event and origin.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newRecord(obj, successCallback, errorCallback) {
    var origin = "add -> newRecord(...)";
    var request;
    logger(origin + logEnum.begin);

    if(!errorCallback)
      errorCallback=function(){return;};

      /*
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }*/

    var counter = 0;
    if (Array.isArray(obj)) {
      var i, objSize;
      objSize = obj.length;

      for (i = 0; i < objSize; i++) {
        request = _store.add(obj[i]);
        request.onsuccess = function(event) {
          counter++;
          if (counter == objSize) {
            logger('New record/s added to store "' + _store.name + '"');
            if (successCallback) {
              successCallback(event, origin);
            }
            db.close();
            done();
          }
        };

        request.onerror = function(event) {
          requestErrorAction(origin,request.error, errorCallback);
        };
      }
    } else {
      request = _store.add(obj);
      request.onsuccess = function(event) {
        insertFinished(event);
      };

      request.onerror = function(event) {
        requestErrorAction(origin,event.target.error, errorCallback);
      };
    }

    function insertFinished(event) {
      logger('New record/s added to store "' + _store.name + '"');
      if (successCallback) {
        successCallback(event, origin);
      }
      db.close();
      done();
    }
  }

  /**
   * Creates a new index in an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {string} keyPath Key that the index use
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newIndex(storeName, indexName, keyPath, successCallback, errorCallback) {
    var version;
    var origin = 'add -> newIndex(...)';
    logger(origin + logEnum.begin);

    if(!errorCallback)
      errorCallback=function(){return;};

    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }

    //// Gets the new version
    //
    version = db.version;
    db.close();
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function (event) {
      db = event.target.result;
      var store = null;

      var upgradeTransaction = event.target.transaction;

      //// Gets store
      try {
        store = upgradeTransaction.objectStore(storeName);
      } catch (e) {
        requestErrorAction(origin, e, errorCallback);
        return;
      }

      if (!store.indexNames.contains(indexName)) {
        store.createIndex(indexName, keyPath);
      } else {
        db.close();
        logger('The index "' + indexName + '" already exists in store "' + storeName + '"');
        done();
        return;
      }
    };

    request.onsuccess = function (event) {
      if (successCallback) {
        successCallback(event, origin);
      }
      db.close();
      logger('Index "' + indexName + '" created in store "' + storeName + '"');
      done();
    };

    request.onerror = function (event) {
      requestErrorAction(origin,request.error, errorCallback);
    };
  }

  /**
     * Count the records
     * @private
     * @param  {string} storeName Store name.
     * @param {string | null} indexName Index name. With null is not used.
     * @param {string | null} query String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * With null query, all records are counted.
     * @param {function} [successCallback] Function called on success. Receives the result (number), origin and query as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
  function count(indexName, query, successCallback, errorCallback) {
    var origin = 'get -> count(...)';
    logger(origin + logEnum.begin);
    var request = null;

    if(!errorCallback)
      errorCallback = function(){return;};

      /*
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }*/

    // Gets index
    var index;
    if(indexName){
      index = getIndex(origin,_store,indexName,errorCallback);
      if(!index){
        checkTasks();
        return;
      }
    }


    var counter = 0;

    if (!query) {
      if (indexName)
        query = index.keyPath + '!= null';
      else
        query = _store.keyPath + '!= -1';
    }

    var onSuccessQuery = function (event) {
      var cursor = event.target.result;
      var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
      var extMode = conditionsBlocksArray[0].externalLogOperator; //external logical operator

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = (extMode == null || extMode == 'and') ? false : true;

      if (cursor) {

        test = testCursor(conditionsBlocksArray, exitsInFirstTrue, cursor);

        if (test) {
          counter++;
        }
        cursor.continue();

      } else {
        if (successCallback) {
          successCallback(counter, origin, query);
        }
        db.close();
        logger('Processed query finished: "' + query + '"\n'+ counter +' records counted from the query to store: "' + _store.name + '"');
        done();
      }

    };

    var onError = function (event) {
      requestErrorAction(origin,request.error,errorCallback);
    };

    if (indexName) {
      request = tryOpenCursor(origin, index, errorCallback); //index.openCursor();
      if (!request) {
        checkTasks();
        return;
      }
      request.onsuccess = onSuccessQuery;
      request.onerror = onError;
    } else {
      request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
      if (!request) {
        checkTasks();
        return;
      }
      request.onsuccess = onSuccessQuery;
      request.onerror = onError;
    } //end if else block


  }

  /**
   * Deletes an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delStore(storeName, successCallback, errorCallback) {
    var version;
    var origin = 'del -> delStore(...)';
    logger(origin + logEnum.begin);
    
    if(!errorCallback){
      errorCallback=function(){return;};
    }
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }

    //// Gets the new version
    //
    version = db.version;
    db.close();
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
      }
      db.close();
      logger('Object store "'+ storeName + '" deleted');
      done();
    };

    request.onerror = function (event) {
      requestErrorAction(origin,request.error,errorCallback);
    };
  }

  /**
   * Deletes a Database
   * @private
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delDB( successCallback, errorCallback) {    
    var origin='del -> delDB(...)';
    logger(origin + logEnum.begin);

    if(!errorCallback){
      errorCallback=function(){return;};
    }

    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }
    var request = window.indexedDB.deleteDatabase(dbName);

    request.onerror = function(event) {
      requestErrorAction(origin,request.error,errorCallback);
    };

    request.onsuccess = function(event) {
      if(successCallback){
        successCallback(event, origin);
      }
      logger('Database "' + dbName + '" deleted');
      done();
    };
  }

  /**
   * Deletes one or more records from a store. Records are selected by the query.
   * @private
   * @param {string} storeName Object store name.
   * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
   * @param {string | number} query Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * @param {function(event,origin)} [successCallback] Function called on success. Receives event, origin and query as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delRecords(indexName, query, successCallback, errorCallback) {
    var origin = 'del -> delRecords(...)';
    logger(origin + logEnum.begin);
    var request = null;
    var isIndexKeyValue = false;
    

    if(!errorCallback)
      errorCallback=function(){return;};

      /*
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }*/

    // Gets index
    var index;
    if(indexName!=null){
      index=getIndex(origin,_store,indexName,errorCallback);
      if(!index){
        checkTasks();
        return;
      }
    }

    //// Gets isIndexKeyValue
    //// True if query is a single value (an index key)
    // 
    isIndexKeyValue = isKey(query);


    var conditionsBlocksArray;
    conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;
    var counter = 0;

    var onsuccesCursor = function (event) {

      var cursor = event.target.result;
      var extMode = conditionsBlocksArray[0].externalLogOperator;

      var test = false;

      // If operator between condition blocks is "&" then all blocks must be true: (true) & (true) & (true) ===> true
      // If operator between is "|" then at least one must be true: (false) | (true) | (false) ===> true
      //
      var exitsInFirstTrue = (extMode == null || extMode == 'and') ? false : true;
      if (cursor) {

        test = testCursor(conditionsBlocksArray, exitsInFirstTrue, cursor);

        if (test) {
          var request = cursor.delete();
          request.onsuccess = function () {
            counter++;
          };
        }
        cursor.continue();

      } else {
        if (successCallback) {
          successCallback(event, origin, query);
        }
        db.close();
        logger('Processed query: "' + query + '" finished\n' + counter + ' records returned from object store "' + _store.name + '"');
        done();
      }

    }; // end onsuccesCursor

    var onerrorFunction = function (event) {
      requestErrorAction(origin,request.error, errorCallback);
    };

    if (indexName != null) {
      if (isIndexKeyValue) {
        // if is a number here is converted to string
        query = index.keyPath + '=' + query;
        conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
      }
      request = tryOpenCursor(origin, index, errorCallback); //index.openCursor();
      if (!request) {
        checkTasks();
        return;
      }
      request.onsuccess = onsuccesCursor;
    } else {
      request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
      if (!request) {
        checkTasks();
        return;
      }
      request.onsuccess = onsuccesCursor;
    }
    request.onerror = onerrorFunction;
  }

  /**
   * Deletes an index
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delIndex(storeName, indexName, successCallback, errorCallback) {
    var version;
    var origin = 'del -> delIndex(...)';
    logger(origin + logEnum.begin);

    if(!errorCallback)
      errorCallback=function(){return;};

    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }

    //// Gets the new version
    //
    version = db.version;
    db.close();
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function (event) {
      db = event.target.result;
      var store = null;

      var upgradeTransaction = event.target.transaction;

      //// Gets store
      try {
        store = upgradeTransaction.objectStore(storeName);
      } catch (e) {
        requestErrorAction(origin, e, errorCallback);
        return;
      }

      store.deleteIndex(indexName);
    };

    request.onsuccess = function (event) {
      if (successCallback) {
        successCallback(event, origin);
      }
      db.close();
      logger('Index "' + indexName + '" deleted from object store "' + storeName + '"');
      done();
    };

    request.onerror = function (event) {
      requestErrorAction(origin, request.error, errorCallback);
    };
  }

  /**
   * Updates one or more records. Records are selected by the query and updated with the objectValues.
   * @private
   * @param  {string} storeName Object store name.
   * @param  {string} [indexName] Index name. If is null then no index is used (It is usually slower)
   * @param {string | number} query Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param  {object} objectValues Object with the new values (ex: {property1: value, property3: value}).
   * @param {function} [successCallback] Function called on success. Receives event, origin and query as parameters.
   * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function updateRecords(indexName, query, objectValues, successCallback, errorCallback) {
    var origin = 'update -> updateRecords(...)';
    logger(origin + logEnum.begin);
    var isIndexKeyValue = false;
    var request = null;
    var i = 0;

    /*
    // Test arguments
    if (errorSys.testArgs(origin, arguments)) {
      invalidArgsAcction(errorCallback);
      return;
    }*/

    //// Gets index
    var index;
    if (indexName != null) {
      index = getIndex(origin, _store, indexName, errorCallback);
      if (!index) {
        checkTasks();
        return;
      }
    }

    //// Gets isIndexKeyValue
    //// If true then is query is a single value (an index key)
    isIndexKeyValue = isKey(query);

    var conditionsBlocksArray;
    conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;

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

        var test = testCursor(conditionsBlocksArray, exitsInFirstTrue, cursor);

        if (test) {
          var updateData = cursor.value;
          for (i = 0; i < newObjectValuesSize; i++) {
            // If the new value for the property keys[i] is a function then the new value is function(oldValue)
            updateData[keys[i]] =
              typeof objectValues[keys[i]] == "function" ? objectValues[keys[i]](updateData[keys[i]]) : objectValues[keys[i]];
          }

          var request = cursor.update(updateData);
          request.onsuccess = function () {
            counter++;
          };
        }
        cursor.continue();

      } else {
        if (successCallback) {
          successCallback(event, origin, query);
        }
        db.close();
        logger('Processed query: "' + query + '" finished\n' + counter + ' records returned from object store "' + _store.name + '"');
        done();
      }

    };

    var onerrorFunction = function (event) {
      requestErrorAction(origin,request.error, errorCallback);
    };

    if (indexName != null) {
      if (isIndexKeyValue) {
        // If query is a single number value then is mofied to be valid to the query system
        query = index.keyPath + '=' + query;
        conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
      }
      request = tryOpenCursor(origin, index, errorCallback);// index.openCursor();
      if (!request) {
        checkTasks();
        return;
      }
      request.onsuccess = onsuccesCursor;
      request.onerror = onerrorFunction;
    } else {
      request = tryOpenCursor(origin, _store, errorCallback); // store.openCursor();
      if (!request) {
        checkTasks();
        return;
      }
      request.onsuccess = onsuccesCursor;
      request.onerror = onerrorFunction;
    }
  }

  //#endregion Private functions

  //#region helper functions
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  function getIndex(origin, store, indexName, errorCallback) {
    var index = null;
    try {
      index = store.index(indexName);
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return index;
  }

  function tryStoreGetAll(origin, store, errorCallback){
    var request = null;
    try{
      request = store.getAll();
    } catch(e){
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function tryIndexGetAll(origin, index, errorCallback) {
    var request = null;
    try {
      request = index.getAll();
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function tryIndexGetKey(origin, index, key, errorCallback) {
    var request = null;
    try {
      request = index.getAll(key);
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function tryOpenCursor(origin, openerObj, errorCallback) {
    var request = null;
    try {
      request = openerObj.openCursor();
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function reportCatch(origin, e, errorCallback) {
    errorSys.makeErrorObject(origin, 20, e);
    taskQueue.shift();
    db.close();
    errorCallback(lastErrorObj);
    logger(lastErrorObj, true);
  }

  function invalidArgsAcction(errorCallback) {
    taskQueue.shift(); // Delete actual task prevent problem if custom errorCallback creates a new task
    db.close();
    errorCallback(lastErrorObj);
    logger(lastErrorObj, true);
    checkTasks();
  }

  function requestErrorAction(origin,error,errorCallback) {
    db.close();
    errorSys.makeErrorObject(origin, 20, error);
    logger(lastErrorObj, true);
    taskQueue.shift();
    errorCallback(lastErrorObj);
    checkTasks();
  }

  function testCursor(conditionsBlocksArray, exitsInFirst, cursor) {
    var test = false;
    var i = 0;
    var size = conditionsBlocksArray.length;
    for (i = 0; i < size; i++) {
      var conditions = conditionsBlocksArray[i].conditionsArray;
      var intMode = conditionsBlocksArray[i].internalLogOperator;
      test = qrySys.testConditionBlock(cursor, conditions, intMode);
      if (test == exitsInFirst) {
        break;
      }
    }
    return test;
  }

  function isKey(query) {
    var isKey = false;
    if (query) {
      if (typeof query == "number") {
        isKey = true;
      } else {
        isKey = query.match(qrySys.operatorRgx) ? false : true;
      }
    }
    return isKey;
  }

  function setStore(origin, storeName, rwMode) {
    _store = null;
    try {
      _store = db.transaction(storeName, rwMode).objectStore(storeName);
    }
    catch (e) {
      errorSys.makeErrorObject(origin, 20, e);
      logger(lastErrorObj, true);
    }
    done();
  }

  //#endregion helper functions

  //#region Query system
  ///////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * qrySys contains all methods to manage the string queries
   * @private
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
      this.operatorRgx = /(=|>|<|>=|<=|!=|<>|\^|\$|~~)+/g;
      this.rightOperandRgx = /(?:([=><\^\$~]))\s*["']?[^"']+["']?\s*(?=[&\|])|(?:[=><\^\$~])\s*["']?[^"']+["']?(?=$)/g;
      this.leftOperandRgx = /([^"'\s])(\w+)(?=\s*[=|>|<|!|\^|\$~])/g;
    },

    /**
     * Transforms a query string into an array of objects that is used by SIXDB to process the query.
     * @param  {string} query String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * @return {object[]} Returns and array of coditions blocks.
     */
    makeConditionsBlocksArray: function (query) {

      var t = this;
      var conditionsBlocksArray = [];
      var i = 0;

      //// Gets blocks
      //
      var blocks = query.match(t.blockRgx);
      // Delete left parentheses
      if(blocks){
        t.deleteLeftParentheses(blocks);
      }

      // Logical operators between blocks, all must be the same type
      var extLogOperator = (query.match(t.blockOperatorRgx)) ? query.match(t.blockOperatorRgx) : null;

      

      /*var pushConditionBlockToArray = function (qry, extLogOperator) {

        //// Gets left operands
        //
        var leftOperands = qry.match(t.leftOperandRgx);

        //// Gets right operands
        //
        var rightOperands = qry.match(t.rightOperandRgx);
        var i=0;
        for(i=0;i<rightOperands.length;i++){
          // Delete the operator
          while(rightOperands[i][0].match(/[=><!\^\$~]/g)){
            rightOperands[i]=rightOperands[i].substr(1);
          }
          // Delete quotes and trim white spaces
          rightOperands[i] = rightOperands[i].replace(/["']/g, '').trim();
        }

        //// Gets operators
        //// Removing righ operands (values) before extract comparison operators avoids 
        //// problems with literal values that include comparisson symbols(= , >,...) quoted.
        //
        for(i=0;i<rightOperands.length;i++){
          qry=qry.replace(rightOperands[i],'');
        }
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
          }

          
          for (i = 0; i < operators.length; i++) {
            conditionsArray.push(
              {
                keyPath: leftOperands[i],
                cond: operators[i],
                value: rightOperands[i]
              }
            );
          }

          conditionsBlocksArray.push(
            {
              conditionsArray: conditionsArray,
              internalLogOperator: logOperatorsType,
              externalLogOperator: extLogOperator
            }
          );
          conditionsArray = null;
        } // end if else
      };*/


      // If condition is a single sentence like: " a = 10 & b > 5 "
      if (!blocks) {
        t.pushConditionBlockToArray(query, null, conditionsBlocksArray);
        return conditionsBlocksArray;
      } else {
        // If condition is a multiple sentence like: " (a = 5 & b = 10) || (c < 4 & f > 10) "        
        if (extLogOperator) {
          if (extLogOperator == '&' || extLogOperator == '&&') {
            extLogOperator = 'and';
          } else {
            extLogOperator = 'or';
          }
        }

        
        for (i = 0; i < blocks.length; i++) {

          t.pushConditionBlockToArray(blocks[i], extLogOperator, conditionsBlocksArray);

        }
        return conditionsBlocksArray;
      }
    },

    deleteLeftParentheses: function (blocks) {
      var i = 0;
      var size = blocks.length;
      for (i = 0; i < size; i++) {
        blocks[i] = blocks[i].substr(1);
      }
    },

    pushConditionBlockToArray: function (qry, extLogOperator, conditionsBlocksArray) {

      var i = 0;
      var t = this;

      //// Gets left operands
      //
      var leftOperands = qry.match(t.leftOperandRgx);

      //// Gets right operands
      //
      var rightOperands = qry.match(t.rightOperandRgx);
      for (i = 0; i < rightOperands.length; i++) {
        // Delete the operator
        while (rightOperands[i][0].match(/[=><!\^\$~]/g)) {
          rightOperands[i] = rightOperands[i].substr(1);
        }
        // Delete quotes and trim white spaces
        rightOperands[i] = rightOperands[i].replace(/["']/g, '').trim();
      }

      //// Gets operators
      //// Removing righ operands (values) before extract comparison operators avoids 
      //// problems with literal values that include comparisson symbols(= , >,...) quoted.
      //
      for (i = 0; i < rightOperands.length; i++) {
        qry = qry.replace(rightOperands[i], '');
      }
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
        }


        for (i = 0; i < operators.length; i++) {
          conditionsArray.push(
            {
              keyPath: leftOperands[i],
              cond: operators[i],
              value: rightOperands[i]
            }
          );
        }

        conditionsBlocksArray.push(
          {
            conditionsArray: conditionsArray,
            internalLogOperator: logOperatorsType,
            externalLogOperator: extLogOperator
          }
        );
        conditionsArray = null;
      } // end if else

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
      var i=0;

      var test = (operator == 'and' || operator == null) ? true : false;
      for (i = 0; i < conditionsArray.length; i++) {
        test = t.testCondition(cursor.value[conditionsArray[i].keyPath], conditionsArray[i].cond, conditionsArray[i].value);
        if ((operator == "and" || operator == null) && !test) return false;
        else if (operator == "or" && test) return true;
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

        case ">":
          result = value1 > value2 ? true : false;
          return result;

        case "<":
          result = value1 < value2 ? true : false;
          return result;

        case ">=":
          result = value1 >= value2 ? true : false;
          return result;

        case "<=":
          result = value1 <= value2 ? true : false;
          return result;

        case "!=":
          result = value1 != value2 ? true : false;
          return result;

        case "<>":                        // string value1 contains substring value2
        if(typeof(value1)!='string'){
          return false;
        }
        result=(value1.indexOf(value2)!=-1);
        return result;

        case "^":
          if (typeof (value1) != 'string') {
            return false;
          }
          result = (value1.indexOf(value2) == 0);
          return result;

        case "$":
        if(typeof(value1)!='string'){
          return false;
        }
        result=(value1.indexOf(value2)==value1.length-value2.length);
        return result;

        case "~~":
        try{
        result = customOperator(value1,value2);
        } catch(e){
          result = false;
        }
        return result;

        default:
          break;
      }
    }
  }; // end qrySys



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
      logger('No pending tasks');
      return;
    }

    idle = false;

    var type = taskQueue[0].type;
    var task = taskQueue[0];

    switch (type) {

      case 'openDb':
        openDb();
        break;
      
      case 'setStore':
        setStore(task.origin, task.storeName, task.rwMode);
        break;

      case "newStore":
        newStore(task.storeName, task.successCallback, task.errorCallback);
        break;

      case "newRecords":
        newRecord(task.obj, task.successCallback, task.errorCallback);
        break;

      case "newDB":
        newDB(task.errorCallback);
        break;

      case "count":
        count(task.indexName, task.query, task.successCallback, task.errorCallback);
        break;

      case "custom":
        logger('Custom task' + logEnum.begin);
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
        delRecords(task.indexName, task.query, task.successCallback, task.errorCallback);
        break;

      case "delIndex":
        delIndex(task.storeName, task.indexName, task.successCallback, task.errorCallback);
        break;

      case "updateRecordsByIndex":
        updateRecords(task.indexName, task.query, task.objectValues, task.successCallback, task.errorCallback);
        break;

      case "newIndex":
        newIndex(task.storeName, task.indexName, task.keyPath, task.successCallback, task.errorCallback);
        break;

      case "lastRecords":
        lastRecords(task.maxResults, task.successCallback, task.errorCallback);
        break;

      case "getRecords":
        getRecords(task.storeName, task.successCallback, task.options);
        break;

      case "getAggregateFunction":
        getaggregateFunction(task.property, task.aggregatefn, task.successCallback, task.origin, task.options);
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
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
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
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // Callback function to process a possible error
     * //
     * var myErrorCallback = function(e){
     *   console.log(e);
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
    store: function (storeName, {successCallback, errorCallback}) {
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
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
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
     * // Inserts new record in object store. (needs execTasks() to execute)
     * //
     * mydb.add.records('objectStoreName', person, myErrorCallback);
     *
     *
     * // Execs all pending tasks.
     * //
     * mydb.execTasks();
     */
    records: function (storeName, obj, {successCallback, errorCallback}) {
      var task = {
        type: "newRecords",
        obj: obj,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('add -> Records(...)', storeName, 'readwrite');
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
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
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
     * var myErrorCallback = function(e){
     *     console.log(e);
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
    index: function (storeName, indexName, keyPath, {successCallback, errorCallback}) {
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
     * Add a specific function to the SIXDB task queue.
     * @param  {any} fn Our custom function that we want to add to the task queue.
     * @param  {any} context It is usually "this".
     * @param  {...any} args Arguments for the function.
     * @return {void}
     * @example
     * var mydb = new sixdb('companyDB');
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
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    db: function( {successCallback, errorCallback}) {
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
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    store: function(storeName, {successCallback, errorCallback}) {
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
     * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string | number} query Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param {function} [successCallback] Function called on success. Receives event, origin and query as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
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
    records: function(storeName, query, {indexName, successCallback, errorCallback}) {
      var task = {
        type: "delRecords",
        indexName: indexName,
        query: query,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('del -> Records(...)', storeName, 'readwrite');
      taskQueue.push(task);
    },

    /**
     * Adds the task "delete an index from an object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name
     * @param {string} indexName Index name
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    index: function(storeName, indexName, {successCallback, errorCallback}) {
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
     * @param  {string} [indexName] Index name. If is null then no index is used (It is usually slower).
     * @param {string} query String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {object} objectValues Object with the new values.
     * The values not only can be a single value, it can be a function that receives the old value and returns a new value.
     * (Example: objectValues = {property1:'value1', property4: value4, property6: function(oldValue){return oldValue + 100;}})
     * @param {function} [successCallback] Function called on success. Receives event, origin and query as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
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
     * function myErrorCallback(e){
     *     console.log(e);
     * };
     *
     */
    records: function (storeName, query, objectValues, {indexName, successCallback, errorCallback}) {
      if (!errorCallback)
        errorCallback = function () { return; };

      var task = {
        type: "updateRecordsByIndex",
        indexName: indexName,
        query: query,
        objectValues: objectValues,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('update -> Records(...)', storeName, 'readwrite');
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
     * @param {function} successCallback Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
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
        maxResults: maxResults,
        successCallback: successCallback,
        errorCallback: errorCallback
      };     

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> lastRecords(...)', storeName, 'readonly');
      taskQueue.push(task);
    },

    /**
     * Adds the task "get one or more records from a object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string} [query] String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'peter'                                    // Single value always refers to the index keypath.<br>
     * A single value always refers to the index keypath so the index can not be null in this case.
     * @param {function} successCallback Function called on success. Receives event, origin and query as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
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
    records: function(storeName, successCallback, {errorCallback, indexName, query}) {

      var options = {
        indexName: indexName,
        query: query,
        errorCallback: errorCallback
      }

      var task = {
        type: "getRecords",
        storeName: storeName,
        successCallback: successCallback,
        options: options
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Records(...)', storeName, 'readonly');
      taskQueue.push(task);
    },

    /**
     * Returns the sum of a property to the success callback.
     * @param {string} storeName Store name.
     * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string | number} [query] Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {string} property Represents the column to apply the sum function.
     * @param  {function} successCallback Receives as parameters the result (a number) and origin.
     * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example 
     * // Object store "southFactory":
     * // ID    name    salary
     * // 1     Adam    1500
     * // 2     Paul    1200
     * // 3     Peter   1000
     * 
     * var mydb = new sixdb('myDatabase');
     * 
     * //
     * // Sums all values of salary.
     * // Sends the number 3700 to mySuccesCallback.
     * //
     * mydb.get.sum( 'southFactory', null, null, 'salary', mySuccessCallback, myErrorCallback); 
     * 
     * //
     * // Sums all values of salary where name starts with "P".
     * // Sends the number 2200 to mySuccesCallback.
     * //
     * mydb.get.sum( 'southFactory', null, 'name ^ P', 'salary', mySuccessCallback, myErrorCallback);
     * 
     * // Execs all pending tasks
     * //
     * mydb.execTasks();
     */
    sum: function (storeName, property, successCallback, {indexName, query, errorCallback}) {
      var aggregatefn = function (actual, selected) {
        return actual + selected;
      };

      var options = {
        indexName: indexName,
        query: query,
        errorCallback
      }

      var task = {
        type: 'getAggregateFunction',
        property: property,
        aggregatefn: aggregatefn,
        successCallback: successCallback,        
        origin: 'get -> Sum -> getaggregateFunction(...)',
        options: options
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Sum(...)', storeName, 'readonly');
      taskQueue.push(task);

    },

    /**
     * Returns the average value of a property to the success callback.
     * @param {string} storeName Store name.
     * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string | number} [query] Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {string} property Represents the column to apply the average function.
     * @param  {function} successCallback Receives as parameters the result (a number) and origin.
     * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * // Object store "southFactory":
     * // ID    name    salary
     * // 1     Adam    1500
     * // 2     Paul    1200
     * // 3     Peter   1000
     * 
     * var mydb = new sixdb('myDatabase');
     * 
     * //
     * // Calculates the average of all the values of salary.
     * // Sends the number 1233.333333333333 to mySuccesCallback.
     * //
     * mydb.get.sum( 'southFactory', null, null, 'salary', mySuccessCallback, myErrorCallback); 
     * 
     * //
     * // Calculates the average of all the values of salary where name starts with "P".
     * // Sends the number 1100 to mySuccesCallback.
     * //
     * mydb.get.sum( 'southFactory', null, 'name ^ P', 'salary', mySuccessCallback, myErrorCallback);
     * 
     * // Execs all pending tasks
     * //
     * mydb.execTasks();
     */
    avg: function(storeName, property, successCallback, {indexName, query, errorCallback}){

      var aggregatefn=function(actual,selected,counter){
        return (actual*(counter-1)+selected)/counter;
      };

      var options = {
        indexName: indexName,
        query: query,
        errorCallback
      }

      var task = {
        type: 'getAggregateFunction',
        property: property,
        aggregatefn: aggregatefn,
        successCallback: successCallback,
        origin: 'get -> Average -> getaggregateFunction(...)',
        options: options
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Average(...)', storeName, 'readonly');
      taskQueue.push(task);

    },

    /**
     * Returns to the succes callback the maximum value of a property
     * @param {string} storeName Store name.
     * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string | number} [query] Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {string} property Represents the column to apply the max function.
     * @param  {function} successCallback Receives as parameters the result (a number) and origin.
     * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    max: function (storeName, property, successCallback, {indexName, query, errorCallback}) {

      var aggregatefn = function (actual, selected) {
        return (selected > actual) ? selected : actual;
      };

      var options = {
        indexName: indexName,
        query: query,
        errorCallback
      }

      var task = {
        type: 'getAggregateFunction',
        property: property,
        aggregatefn: aggregatefn,
        successCallback: successCallback,
        origin: 'get -> Max -> getaggregateFunction(...)',
        options: options
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Max(...)', storeName, 'readonly');
      taskQueue.push(task);
    },

    /**
     * Returns to the succes callback the minimum value of a property
     * @param {string} storeName Store name.
     * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string | number} [query] Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {string} property Represents the column to apply the min function.
     * @param  {function} successCallback Receives as parameters the result (a number) and origin.
     * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    min: function (storeName, property, successCallback, {indexName, query, errorCallback}) {

      var aggregatefn = function (actual, selected, counter) {
        if (counter == 1) {  // First value of actual is null. Without this, min is allways null
          actual = selected;
        }
        return ((selected < actual) && (counter > 1)) ? selected : actual;
      };

      var options = {
        indexName: indexName,
        query: query,
        errorCallback
      }

      var task = {
        type: 'getAggregateFunction',
        property: property,
        aggregatefn: aggregatefn,
        successCallback: successCallback,
        origin: 'get -> Min -> getaggregateFunction(...)',
        options: options
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Min(...)', storeName, 'readonly');
      taskQueue.push(task);
    },

    /**
     * Returns to the succes callback the value of a property calculated by a custom aggregate function
     * @param {string} storeName Store name.
     * @param {string} [indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string | number} [query] Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {string} property Represents the column to apply the min function.
     * @param  {function} aggregatefn Aggregate function wich receives each one of the property values and the number of iteration.
     * @param  {function} successCallback Receives as parameters the result (a number) and origin.
     * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // The aggregate function is applied to each one of the property values of queried records in a loop.
     * // The aggregate function receives 3 parameters:
     * // selectedValue --> The property value of the selected record.
     * // actualValue --> The actual value calculated by our custom function. In the first iteration this value is null.
     * // counter --> The number of iteration. First iteration is 1. 
     * //
     * // This simple function returns the longest string of all values.(not valid with numbers)
     * //
     * var myCustomFunction = function(actualValue, selectedValue, Counter){
     *     if(counter == 1)
     *         actualValue = selectedValue;
     *     return actualValue.length < selectedValue.length ? selectedValue : actualValue;
     *     };
     *
     * //
     * // Gets one of the longest names of employees with salary > 1600
     * //
     * mydb.get.customAggregateFn('storeName', null, 'salary > 1600', 'name', myCustomFunction, successCallback, errorCallback);
     * 
     * 
     * //
     * //Execs all pending tasks
     * //
     * mydb.execTasks();
     */
    customAggregateFn: function (storeName, property, aggregatefn, successCallback, {indexName, query, errorCallback}) {

      var options = {
        indexName: indexName,
        query: query,
        errorCallback
      }

      var task = {
        type: 'getAggregateFunction',
        property: property,
        aggregatefn: aggregatefn,
        successCallback: successCallback,
        origin: 'get -> Custom -> getaggregateFunction(...)',
        options: options
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> customAggregateFuction(...)', storeName, 'readonly');
      taskQueue.push(task);
    },

    /**
     * Adds the task "Count the records" to the task queue
     * @param  {string} storeName Store name.
     * @param {string} [indexName] Index name. The records of the store are counted.
     * @param {string} [query] String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * With null query, all records are counted.
     * @param {function} successCallback Function called on success. Receives the result (number), origin and query as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * };
     * 
     * // Simple success callback
     * //
     * function successFunction(count,origin,query){
     *     console.log(count + ' records counted with query "' + query + '"");
     * }
     * 
     * //
     * // Counts all records in the store "southFactory"
     * //
     * mydb.get.count('southFactory',null,null,successFunction);
     * 
     * //
     * // Counts all records in the index 'Names'
     * //
     * mydb.get.count('southFactory','Names',null,successFunction); 
     * 
     * //
     * // Counts all persons with age > 30
     * //
     * mydb.get.count('southFactory',null,'age > 30',successFunction);
     * 
     * //
     * // Execs all pending task
     * //
     * mydb.execTasks();
     * 
     */
    count: function (storeName, successCallback, { indexName, query, errorCallback }) {
      var task = {
        type: "count",
        indexName: indexName,
        query: query,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Count(...)', storeName, 'readonly');
      taskQueue.push(task);
    }
  };  

  var setHelpTask = {
    setStore: function(origin, storeName, rwMode){
      var task = {
        type: "setStore",
        origin: origin,
        storeName: storeName,
        rwMode: rwMode
      };    

      taskQueue.push(task);
    }
  }

  //#endregion Task queue system

  //#region Logger system
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  
  var logEnum = {
    begin: '//--------------------------------------->'
  };

  
  function logger(message, isError){
    if(consoleOff && !isError)
    return;

    if(!isError)
    console.log(message);
    else
    console.error(message);
  }

  //#endregion Logger system

  //#region Error handler
  ///////////////////////////////////////////////////////////////////////////////////////////

  var lastErrorObj;
  
  /**
  * Contains all error codes.
  * @private
  * @type {object} 
  * @default
  * @readonly
  */
  var errorSys = {
    codes: {
      // Incorrect parameter
      1: 'storeName must be a string',
      2: 'storeName is null',
      3: 'obj is null',
      4: 'indexName is null',
      5: 'indexName must be a string',
      6: 'keyPath is null',
      7: 'keyPath must be a string',
      8: 'query is null',
      9: 'query must be a string or a number',
      10: 'objectValues is null',
      11: 'objectValues must be an object',
      12: 'maxResults must be a number or null',
      13: 'successCallback is not a function',
      14: 'errorCallback is not a function',
      15: 'obj must be an object or an array of objects',
      16: 'query must be an string',
      17: 'the specified index does not exist',
      //IndexedDB error
      20: 'IndexedDB error'
    },

    testArgs: function (origin, args) {      
      var errorId = 0;

      switch (origin) {

        case 'get -> lastRecords(...)':
          errorId = this.testLastRecordsArgs(args);
          break;

        case 'get -> getRecords(...)':
          errorId = this.testGetRecordsArgs(args);
          break;

        case 'add -> newStore(...)':
          errorId = this.testStoreArgs(args);
          break;

        case 'add -> newRecord(...)':
          errorId = this.testNewRecordArgs(args);
          break;

        case 'add -> newIndex(...)':
          errorId = this.testNewIndexArgs(args);
          break;

        case 'get -> count(...)':
          errorId = this.testCountArgs(args);
          break;

        case 'del -> delStore(...)':
          errorId = this.testStoreArgs(args);
          break;

        case 'del -> delDB(...)':
          errorId = this.testDelDBArgs(args);
          break;

        case 'del -> delRecords(...)':
          errorId = this.testDelRecordsArgs(args);
          break;

        case 'del -> delIndex(...)':
          errorId = this.testDelIndexArgs(args);
          break;

        case 'update -> updateRecords(...)':
          errorId = this.testUpdateRecordsArgs(args);
          break;


        default:
          return false;
      }

      if (errorId != 0)
        return this.makeErrorObject(origin, errorId);
      else
        return false;

    },

    testStr: function (str) {
      if (str) {
        if (typeof (str) != 'string') {
          this.test = 1;
          return 1;
        }                  // str isn't string
      } else {
        this.test = 2;
        return 2;                   // str is null
      }
      return false;                  // str exist and is a string
    },

    testCallback: function (fn) {
      if (fn) {
        if (typeof (fn) != 'function') {
          return false;
        }
        return true;
      }
    },

    /**
     * Makes an error object, stores it in lastErrorObj variable. 
     * @private
     * @param  {string} origin Name of the origin function
     * @param  {number} errorCode Id number.
     * @param  {object} domException DOMexception triggered by the error
     * @return {boolean}
     */
    makeErrorObject: function(origin,errorCode, domException){
      var errorObj = {};
      if(!domException){
      errorObj.code = errorCode;
      errorObj.type = (errorCode<17)?'Invalid parameter':'IndexedDB error';
      errorObj.origin = origin;
      errorObj.description = this.codes[errorCode];
      } else {
      errorObj.code = 20;
      errorObj.type = domException.name;
      errorObj.origin = origin;
      errorObj.description = domException.message;
      }

      lastErrorObj = errorObj;

      return true;
    },

    testLastRecordsArgs: function (args) {

      var errorId = -1;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }
        // maxResults
        if (typeof (args[1]) != 'number' && args[1] != null) {
          errorId = 12;
          break;
        }
        // succesCallback
        if (!this.testCallback(args[2])) {
          errorId = 13;
          break;
        }
        // errorCallback
        if (!this.testCallback(args[3])) {
          errorId = 14;
          break;
        }
        errorId = 0;
      }
      return errorId;
    },

    testGetRecordsArgs: function (args) {
      var errorId = -1;
      var qtype = null;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }

        // indexName
        if (this.testStr(args[1])) {
          if (this.test == 1) {
            errorId = 5;
            break;
          }
        }

        //query
        if (args[2]) {
          qtype = typeof (args[2]);
          if (qtype != 'string' && qtype != 'number') {
            errorId = 9;
            break;
          }
        }

        // succesCallback
        if (!this.testCallback(args[3])) {
          errorId = 13;
          break;
        }

        // errorCallback
        if (!this.testCallback(args[4])) {
          errorId = 14;
          break;
        }

        errorId = 0;
      }
      return errorId;

    },

    testStoreArgs: function(args){

      var errorId=-1;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }
        // succesCallback
        if (!this.testCallback(args[1])) {
          errorId = 13;
          break;
        }
        // errorCallback
        if (!this.testCallback(args[2])) {
          errorId = 14;
          break;
        }
        errorId = 0;
      }
      return errorId;
      
    },

    testNewRecordArgs: function(args){
      var errorId = -1;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }
        // obj
        if (args[1]) {
          if (typeof (args[1]) != 'object') {
            errorId = 15;
            break;
          }
        }
        else {
          errorId = 3;
          break;
        }
        // succesCallback
        if (!this.testCallback(args[2])) {
          errorId = 13;
          break;
        }
        // errorCallback
        if (!this.testCallback(args[3])) {
          errorId = 14;
          break;
        }
        errorId = 0;
      }

      return errorId;
      
    },

    testNewIndexArgs: function(args){

      var errorId = -1;
      
      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }
        //indexName
        if (this.testStr(args[1])) {
          errorId = (this.test == 1) ? 5 : 4;
          break;
        }
        // keyPath
        if (this.testStr(args[2])) {
          errorId = (this.test == 1) ? 7 : 6;
          break;
        }
        // succesCallback
        if (!this.testCallback(args[3])) {
          errorId = 13;
          break;
        }
        // errorCallback
        if (!this.testCallback(args[4])) {
          errorId = 14;
          break;
        }
        errorId = 0;
      }
      return errorId;
      
    },

    testCountArgs: function (args) {
      var errorId = -1;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }

        // indexName
        if (args[1]) {
          if (typeof (args[1]) != 'string') {
            errorId = 5;
            break;
          }
        }

        // query
        if (args[2]) {
          if (typeof (args[2]) != 'string') {
            errorId = 16;
            break;
          }
        }

        // succesCallback
        if (!this.testCallback(args[3])) {
          errorId = 13;
          break;
        }

        // errorCallback
        if (!this.testCallback(args[4])) {
          errorId = 14;
          break;
        }

        errorId = 0;
      }
      return errorId;
    },

    testDelDBArgs: function (args) {
      var errorId = -1;

      while (errorId < 0) {
        // succesCallback
        if (!this.testCallback(args[0])) {
          errorId = 13;
          break;
        }

        // errorCallback
        if (!this.testCallback(args[1])) {
          errorId = 14;
          break;
        }

        errorId = 0;
      }
      return errorId;
    },

    testDelRecordsArgs: function (args) {
      var errorId = -1;
      var qtype = null;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }

        // indexName
        if (args[1]) {
          if (typeof (args[1]) != 'string') {
            errorId = 5;
            break;
          }
        }

        //query
        if (args[2]) {
          qtype = typeof (args[2]);
          if (qtype != 'string' && qtype != 'number') {
            errorId = 9;
            break;
          }
        } else {
          errorId = 8;
          break;
        }

        // succesCallback
        if (!this.testCallback(args[3])) {
          errorId = 13;
          break;
        }

        // errorCallback
        if (!this.testCallback(args[4])) {
          errorId = 14;
          break;
        }

        errorId = 0;

      }
      return errorId;
    },

    testDelIndexArgs: function (args) {
      var errorId = -1;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }

        //indexName
        if (this.testStr(args[1])) {
          errorId = (this.test == 1) ? 5 : 4;
          break;
        }

        // succesCallback
        if (!this.testCallback(args[2])) {
          errorId = 13;
          break;
        }

        // errorCallback
        if (!this.testCallback(args[3])) {
          errorId = 14;
          break;
        }

        errorId = 0;
      }
      return errorId;
    },

    testUpdateRecordsArgs: function (args) {
      var errorId = -1;
      var qtype = null;

      while (errorId < 0) {
        // storeName
        if (this.testStr(args[0])) {
          errorId = (this.test == 1) ? 1 : 2;
          break;
        }

        // indexName
        if (args[1]) {
          if (typeof (args[1]) != 'string') {
            errorId = 5;
            break;
          }
        }

        //query
        if (args[2]) {
          qtype = typeof (args[2]);
          if (qtype != 'string' && qtype != 'number') {
            errorId = 9;
            break;
          }
        } else {
          errorId = 8;
          break;
        }

        // objectValues
        if (args[3]) {
          if (typeof (args[3]) != 'object') {
            errorId = 11;
            break;
          }
        } else {
          errorId = 10;
          break;
        }

        // succesCallback
        if (!this.testCallback(args[4])) {
          errorId = 13;
          break;
        }

        // errorCallback
        if (!this.testCallback(args[5])) {
          errorId = 14;
          break;
        }

        errorId = 0;
      }
      return errorId;
    } 
  };

  //#endregion Error handler

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
