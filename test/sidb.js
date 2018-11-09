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
  //// Private ////////////////////////////////////

  

  /**
   * Data base name.
   * @private
   * @type {string}
   * @readonly
   */
  var dbName = _dbName;  

  

  
  //#region Private functions
  //////////////////////////////////////////////////////////////////////////////////////

  /**
   * Gets last records from an object store
   * @private
   * @param {string} storeName Store name.
   * @param {number} maxResults Limits the records retrieved.
   * @param {function(object[],string)} successCallback Function called when done. Receives as parameters the retrieved records and origin.
   * @param {function(event)} [errorCallback] Optional function to handle errors. Receives event parameter and origin.
   */
  function lastRecords(storeName, maxResults, successCallback, errorCallback) {
    var request = window.indexedDB.open(dbName);
    var origin='lastRecords';

    request.onerror = function (event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function (event) {
      var db = event.target.result;
      var resultFiltered = [];

      console.log("Database " + dbName + " opened");
      var store = db.transaction(storeName, "readwrite").objectStore(storeName);
      var counter = 0;

      

      var onsuccesCursorFunction = function (event) {

        var cursor = event.target.result;

        if (cursor && counter < maxResults) {
          resultFiltered.push(cursor.value);
          console.log("pushed");
          counter++;
          cursor.continue();
        } else {
          successCallback(resultFiltered, origin);
          db.close();
          console.log("Database closed");
          console.log(counter + ' last records returned from object store "' + storeName + '"');
          taskQueue.shift();
          checkTasks();
        };
      };

      var onsuccesGetAllFunction = function (event) {
        successCallback(event.target.result, origin);
        db.close();
        console.log("Database closed");
        console.log('All records returned from object store "' + storeName + '"');
        taskQueue.shift();
        checkTasks();
      };

      var onerrorFunction = function (event) {
        db.close();
        console.log("Database closed");
        console.log('Error retrieving records: ' + event.target.error);
        if (errorCallback)
          errorCallback(event, origin);
        taskQueue.shift();
        checkTasks();
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

    };
    }

  /**
   * Gets a record/s from an object store using a key value from an index.
   * @private
   * @param {string} storeName Store name.
   * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
   * @param {string} query String that contains a query. Example of valid querys:
   * c > 20                                     // Simple query
   * c > 10 & name='peter'                      // Query with 2 conditions
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||).
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks
   * 'peter'                                    // Single value always refers to the index keypath.
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param {function(object[],string)} successCallback Receives as parameters the result and origin. Result can be an object array or an object.
   * @param {function(event)} [errorCallback] Optional function to handle errors. Receives event parameter.
   */
  function getRecords(storeName, indexName, query, successCallback, errorCallback) {
    var request = window.indexedDB.open(dbName);
    var origin='getRecords';
    var isIndexKeyValue;
    if(typeof(query)=='number'){
      isIndexKeyValue=true;
    } else {
      isIndexKeyValue = (query.match(qrySys.operatorRgx))?false:true;
    };
    

    request.onerror = function (event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function (event) {
      var db = event.target.result;   
      var conditionsBlocksArray = (!isIndexKeyValue)?qrySys.makeConditionsBlocksArray(query):null;

      console.log("Database " + dbName + " opened");
      var store = db.transaction(storeName, "readwrite").objectStore(storeName);
      var index;
      var counter = 0;

      if (indexName != null) index = store.index(indexName);

      var resultFiltered = [];

      var onsuccesIndexGetKey = function(event){
        successCallback(event.target.result, origin, query);
        db.close();
        console.log("Database closed");
        console.log('Records with key value "' + query + '" returned from index "' + indexName + '" on object store "'+ storeName+'"');
        taskQueue.shift();
        checkTasks();
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
            if (test == exitsInFirstTrue){
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
          console.log("Database closed");
          console.log('Processed query: "'+query+'" finished\n'+ counter + ' records returned from object store "' + storeName + '"');
          taskQueue.shift();
          checkTasks();
        };

      } // end onsuccesCursor

      var onerrorFunction = function (event) {
        db.close();
        console.log("Database closed");
        console.log('Error retrieving records: ' + event.target.error);
        if (errorCallback)
          errorCallback(event, origin);
        taskQueue.shift();
        checkTasks();
      };

      if (indexName != null) {
        if(!isIndexKeyValue){
        var request = index.openCursor();
        request.onsuccess = onsuccesCursor;
        request.onerror = onerrorFunction;
        }else{
          var request = index.get(query);
        request.onsuccess = onsuccesIndexGetKey;
        request.onerror = onerrorFunction;
        }
      } else {
        var request = store.openCursor();
        request.onsuccess = onsuccesCursor;
        request.onerror = onerrorFunction;
      };
    };
  }

  /**
   * The conditionObject contains the three elements to test a condition.
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
        console.log('Database "' + dbName + '" created.');
      } else {
        console.log('Database "' + dbName + '" already exists.');
      }
      taskQueue.shift();
      checkTasks();
    };

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
      } else {
        console.log(
          "Error creating database " + dbName + " : " + request.error
        );
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
    var origin='newStore';

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        console.log("Error opening database " + dbName + " : " + request.error);
      }
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      // If store already exist then returns
      if (db.objectStoreNames.contains(storeName)) {
        db.close();
        taskQueue.shift();
        console.log('Object store "' + storeName + '" already exists');
        checkTasks();
        return;
      }

      version = db.version;
      db.close();
      console.log("Version tested");
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
          console.log("error");
          if (errorCallback) {
            errorCallback(event, origin);
          } else {
            console.log("Error in database " + dbName + " : " + db.error);
          }
        };
      };

      request.onsuccess = function(event) {
        if(successCallback){
          successCallback(event,origin);
        };
        db.close();
        taskQueue.shift();
        console.log("New objectStore " + storeName + " created");
        checkTasks();
      };
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
    var request = window.indexedDB.open(dbName);
    var origin='newRecord';

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        console.log("Error opening database " + dbName + " : " + request.error);
      }
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      console.log("Database " + dbName + " opened");
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
              console.log("Records added in store " + storeName);
              if(successCallback){
                successCallback(event, origin);
              };
              db.close();
              taskQueue.shift();
              console.log("Database " + dbName + " closed");
              checkTasks();
            }
          };

          request.onerror = function(event) {
            if (errorCallback) {
              errorCallback(event, origin);
            } else {
              console.log(
                "Error adding records to store " +
                  storeName +
                  " : " +
                  request.error
              );
            }
          };
        }
      } else {
        var request = store.add(obj);
        request.onsuccess = function(event) {
          console.log("record added");
          if(successCallback){
            successCallback(event, origin);
          };
          db.close();
          taskQueue.shift();
          console.log("Database " + dbName + " closed");
          checkTasks();
        };

        request.onerror = function(event) {
          if (errorCallback) {
            errorCallback(event, origin);
          } else {
            console.log(
              "Error adding record to store " +
                storeName +
                " : " +
                request.error
            );
          }
        };
      }
    };
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
    var origin='newIndex';

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        console.log("Error opening database " + dbName + " : " + request.error);
      }
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      version = db.version;
      db.close();
      console.log("Version tested");
      var newVersion = version + 1;

      request = window.indexedDB.open(dbName, newVersion);

      request.onupgradeneeded = function(event) {
        db = event.target.result;

        var upgradeTransaction = event.target.transaction;
        var store = upgradeTransaction.objectStore(storeName);
        if (!store.indexNames.contains(indexName)) {
          store.createIndex(indexName, keyPath);
        } else {
          db.close();
          taskQueue.shift();
          console.log(
            'Index "' +
              indexName +
              '" already exists in object store ' +
              storeName
          );
          checkTasks();
          return;
        }
      };

      request.onsuccess = function(event) {
        if(successCallback){
          successCallback(event,origin);
        };
        db.close();
        taskQueue.shift();
        console.log(
          "New index " + indexName + " created in objectStore " + storeName
        );
        checkTasks();
      };

      request.onerror = function(event) {
        if (errorCallback) {
          errorCallback(event, origin);
        } else {
          console.log(
            "Error creating index " +
              indexName +
              " in store " +
              storeName +
              " : " +
              request.error
          );
        }
      };
    };
  }

  /**
   * Deletes an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function deleteStore(storeName, successCallback, errorCallback) {
    var version;
    var origin='deleteStore';

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        console.log("Error opening database " + dbName + " : " + request.error);
      }
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      version = db.version;
      db.close();
      console.log("Version tested");
      var newVersion = version + 1;

      request = window.indexedDB.open(dbName, newVersion);

      request.onupgradeneeded = function(event) {
        db = event.target.result;

        db.deleteObjectStore(storeName);
      };

      request.onsuccess = function(event) {
        if(successCallback){
          successCallback(event,origin);
        };
        db.close();
        console.log("ObjectStore " + storeName + " deleted");
        taskQueue.shift();
        checkTasks();
      };

      request.onerror = function(event) {
        if (errorCallback) {
          errorCallback(event,origin);
        } else {
          console.log(
            "Error deleting store " +
              storeName +
              " in database " +
              dbName +
              " : " +
              request.error
          );
        }
      };
    };
  }

  /**
   * Deletes a Database
   * @private
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function deleteDB( successCallback, errorCallback) {
    var request = window.indexedDB.deleteDatabase(dbName);
    var origin='deleteDB';

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event,origin);
      } else {
        console.log(
          "Error deleting database " + dbName + " : " + request.error
        );
      };
    };

    request.onsuccess = function(event) {
      if(successCallback){
        successCallback(event, origin);
      };
      console.log("Database " + dbName + " deleted");
      taskQueue.shift();      
      checkTasks();
    };
  }

  /**
   * Deletes one or more records from a store. Records are selected by the query.
   * @private
   * @param {string} storeName Object store name.
   * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
   * @param {string} query String that contains a query. Example of valid querys:
   * c > 20                                     // Simple query
   * c > 10 & name='peter'                      // Query with 2 conditions
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||).
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks
   * 'peter'                                    // Single value always refers to the index keypath.
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param {function(event,origin)} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function to handle errors. Receives event as parameter.
   */
  function delRecords(storeName, indexName, query, successCallback, errorCallback) {
    var request = window.indexedDB.open(dbName);
    var origin='deleteRecord';
    var isIndexKeyValue;
    if(typeof(query)=='number'){
      isIndexKeyValue=true;
    } else {
      isIndexKeyValue = (query.match(qrySys.operatorRgx))?false:true;
    };

    request.onerror = function (event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function (event) {
      var db = event.target.result;
      var conditionsBlocksArray;
      conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;

      console.log("Database " + dbName + " opened");
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
          if(successCallback){
            successCallback(event, origin, query);
          };
          db.close();
          console.log("Database closed");
          console.log('Processed query: "' + query + '" finished\n' + counter + ' records deleted from object store "' + storeName + '"');
          taskQueue.shift();
          checkTasks();
        };

      } // end onsuccesCursor

      var onerrorFunction = function (event) {
        if (errorCallback) {
          errorCallback(event, origin);
        };

        taskQueue.shift();
        db.close();
        console.log("Database closed");
        console.log('Error deleting records' + event.target.error);
        checkTasks();
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
    };
  }

  /**
   * Deletes an index
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function deleteIndex(storeName, indexName, successCallback, errorCallback) {
    var version;
    var origin='deleteIndex';

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event, origin);
      } else {
        console.log("Error opening database " + dbName + " : " + request.error);
      }
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      version = db.version;
      db.close();
      console.log("Version tested");
      var newVersion = version + 1;

      request = window.indexedDB.open(dbName, newVersion);

      request.onupgradeneeded = function(event) {
        db = event.target.result;

        var upgradeTransaction = event.target.transaction;
        var store = upgradeTransaction.objectStore(storeName);
        store.deleteIndex(indexName);
      };

      request.onsuccess = function(event) {
        if(successCallback){
          successCallback(event, origin);
        };
        db.close();
        console.log( "Index " + indexName + " in objectStore " + storeName + " deleted");
        taskQueue.shift();        
        checkTasks();
      };

      request.onerror = function(event) {
        if (errorCallback) {
          errorCallback(event, origin);
        } else {
          console.log(
            "Error deleting index " +
              dbName +
              " in object store " +
              storeName +
              " : " +
              request.error
          );
        }
      };
    };
  }

  /**
   * Updates one or more records. Records are selected by the query and updated with the objectValues.
   * @private
   * @param  {string} storeName Object store name.
   * @param  {string | null} indexName Index name. If is null then no index is used (It is usually slower).
   * @param {string} query String that contains a query. Example of valid querys:
   * c > 20                                     // Simple query
   * c > 10 & name='peter'                      // Query with 2 conditions
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||).
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks
   * 'peter'                                    // Single value always refers to the index keypath.
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param  {object} objectValues New property value after update. Can be an array of values.
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param  {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function updateRecords(storeName, indexName, query, objectValues, successCallback, errorCallback) {
    var request = window.indexedDB.open(dbName);
    var origin='updateRecords';
    var isIndexKeyValue;
    if(typeof(query)=='number'){
      isIndexKeyValue=true;
    } else {
      isIndexKeyValue = (query.match(qrySys.operatorRgx))?false:true;
    };

    request.onerror = function (event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function (event) {
      var db = event.target.result;
      var conditionsBlocksArray;
      conditionsBlocksArray = (!isIndexKeyValue) ? qrySys.makeConditionsBlocksArray(query) : null;
      console.log("Database " + dbName + " opened");
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
        var extMode = (conditionsBlocksArray)?conditionsBlocksArray[0].externalLogOperator:null; //external logical operator

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
          if(successCallback){
            successCallback(event, origin, query);
          };
          db.close();
          console.log("Database closed");
          console.log('Processed query: "' + query + '" finished\n' + counter + ' records updated from object store "' + storeName + '"');
          taskQueue.shift();          
          checkTasks();
        };

      }

      var onerrorFunction = function (event) {
        if (errorCallback)
          errorCallback(event, origin);

        db.close();
        console.log("Database closed");
        console.log('Error retrieving records: ' + event.target.error);
        taskQueue.shift();        
        checkTasks();
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

    // Initialization of regex vars used by makeConditionsBlockArray() to parse the query string


    /**
     * Initializes the regex variables used to parse the query string
     * @return {void}
     */
    init: function () {
      this.blockRgx = /(?<=\()([^)]+)(?=\))/g;
      this.blockOperatorRgx = /(?<=(\)\s*))([\&\|]+)(?=(\s*\())/g;
      this.operandRgx = /[\w'"]+/g;
      this.operatorRgx = /(=|>|<|>=|<=|!=)+/g;
      /*
      this.leftOperandRgx = /([\w]+)(?=\s*(=|>|<|>=|<=|!=)+)/g;
      this.rightOperandRgx = /(?<=(=|>|<|>=|<=|!=)+\s*)([\w]+)/g;
      */

     this.rightOperandRgx = /(?<=([=|>|<]\s*["']?))([^"^']+)(?=["']?\s*[\&\|]*)/g;
     this.leftOperandRgx = /(?<!([="']+)[\s\w]*)(\w+)(?=\s*[=|>|<|!]{1})/g;
    },

    /**
     * Transforms a query string into an array of objects that is used by SIDB to process the query.
     * @param  {string} query String that contains a query. Example of valid querys:
     * c > 20                                     // Simple query
     * c > 10 & name='peter'                      // Query with 2 conditions
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||).
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks 
     * @return {object[]} Returns and array of coditions blocks.
     */
    makeConditionsBlocksArray: function (query) {

      var t = this;

      //query = query.replace(/[\"\']/g,'');

      var blocks = query.match(t.blockRgx);

      // Logical operators between blocks, all must be the same type
      var extLogOperator = (query.match(t.blockOperatorRgx)) ? query.match(t.blockOperatorRgx) : null;

      var conditionsBlocksArray = [];

      var pushConditionBlockToArray = function (qry, extLogOperator) {

        var leftOperands = qry.match(t.leftOperandRgx);
        var rightOperands = qry.match(t.rightOperandRgx);
        //
        // Removing righ operands (values) before extract comparison operators avoids 
        // problems with literal values that include comparisson symbols(= , >,...) quoted.
        //
        var operators = qry.replace(t.rightOperandRgx,'').match(t.operatorRgx);

        
        var conditionsArray = [];

        // If query is like: " c = 15 "
        if (leftOperands.length == 1) {

          /*var operands = qry.match(t.operandRgx); // array with 2 elements: keyPath and value
          var operator = qry.match(t.operatorRgx); // the only comparisson operator*/

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
   * Manage the task queue
   * @private
   */
  function checkTasks() {
    if (taskQueue.length == 0) {
      idle = true;
      console.log("No pending tasks");
      return;
    }

    idle = false;

    var type = taskQueue[0].type;
    var task = taskQueue[0];

    switch (type) {
      case "newStore":
        newStore(task.storeName, task.successCallback, task.errorCallback);
        break;

      case "newRecords":
        newRecord(task.storeName, task.obj, task.successCallback, task.errorCallback);
        break;

      case "newDB":
        newDB(task.errorCallback);
        break;

      case "deleteStore":
        deleteStore(task.storeName, task.successCallback, errorCallback);
        break;

      case "deleteDB":
        deleteDB(task.successCallback, task.errorCallback);
        break;

      case "deleteRecords":
        delRecords(task.storeName, task.indexName, task.query, task.successCallback, task.errorCallback);
        break;

      case "deleteIndex":
        deleteIndex(task.storeName, task.indexName, task.successCallback, task.errorCallback);
        break;

      case "updateRecordsByIndex":
        updateRecords( task.storeName, task.indexName, task.query, task.objectValues, task.successCallback, task.errorCallback);
        break;

      case "newIndex":
        newIndex( task.storeName, task.indexName, task.keyPath, task.successCallback, task.errorCallback);
        break;

      case "lastRecords":
        lastRecords( task.storeName, task.maxResults, task.successCallback, task.errorCallback);
        break;

      case "getRecords":
        getRecords(task.storeName, task.indexName, task.query, task.successCallback, task.errorCallback);
        break;

      default:
        break;
    }
  }

  /**
   * Execs pending tasks. The tasks are executed sequentially. A task does not run until the previous one ends. This avoids problems arising from the asynchronous nature of the indexedDB api.
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
      var task = {
        type: "newDB",
        errorCallback: errorCallback
      };

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
     * var mydb = new sidb();
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
    store: function(storeName, successCallback, errorCallback) {
      // Make the task object
      var task = {
        type: "newStore",
        storeName: storeName,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

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
     * var mydb = new sidb();
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
    records: function(storeName, obj, successCallback, errorCallback) {
      var task = {
        type: "newRecords",
        storeName: storeName,
        obj: obj,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

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
     * var mydb = new sidb();
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
    index: function(storeName, indexName, keyPath, successCallback, errorCallback) {
      var task = {
        type: "newIndex",
        storeName: storeName,
        indexName: indexName,
        keyPath: keyPath,
        successCallback: successCallback,
        errorCallback: errorCallback
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
        type: "deleteDB",
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
        type: "deleteStore",
        storeName: storeName,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

      taskQueue.push(task);
    },

    /**
     * Adds the task "delete a record/s from the object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name.
     * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
     * @param {string} query String that contains a query. Example of valid querys:
     * c > 20                                     // Simple query
     * c > 10 & name='peter'                      // Query with 2 conditions
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||).
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks
     * 'peter'                                    // Single value always refers to the index keypath.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb();
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
        type: "deleteRecords",
        storeName: storeName,
        indexName: indexName,
        query: query,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

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
        type: "deleteIndex",
        storeName: storeName,
        indexName: indexName,
        successCallback: successCallback,
        errorCallback: errorCallback
      };

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
     * @param {string} query String that contains a query. Example of valid querys:
     * c > 20                                     // Simple query
     * c > 10 & name='peter'                      // Query with 2 conditions
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||).
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks
     * 'peter'                                    // Single value always refers to the index keypath.
     * @param  {object} objectValues Object with the new values.
     * The values not only can be a single value, it can be a function that receives the old value and returns a new value.
     * (Example: objectValues = {property1:'value1', property4: value4, property6: function(oldValue){return oldValue + 100;}})
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb();
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
     * var mydb = new sidb();
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

      taskQueue.push(task);
    },

    /**
     * Adds the task "get one or more records from a object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
     * @param {string} query String that contains a query. Example of valid querys:
     * c > 20                                     // Simple query
     * c > 10 & name='peter'                      // Query with 2 conditions
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||).
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks
     * 'peter'                                    // Single value always refers to the index keypath.
     * A single value always refers to the index keypath so the index can not be null in this case.
     * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Function called on error. Receives event and origin as parameters.
     * @example
     * var mydb = new sidb();
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

      taskQueue.push(task);
    }
  };  

  //#endregion Task queue system

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
      console.log(Array.isArray(array));
      var pageArray = array.slice(
        (page - 1) * elementsPerPage,
        page * elementsPerPage
      );
      return pageArray;
    }
  };
  

  /**
   * Gets the database name
   * @public
   * @return {string} Database name
   */
  this.getName = function() {
    return dbName;
  };

  /**
   * Checks if indexedDB is available
   *
   * @returns {boolean}
   */
  this.isIndexedDBavailable = function() {
    var available = true;
    if (!("indexedDB" in window)) {
      console.log("This browser doesn't support IndexedDB");
      available = false;
    }
    return available;
  };

  //// Initialization /////////////////////////////
  qrySys.init();
  this.add.db();
  this.execTasks();
};
