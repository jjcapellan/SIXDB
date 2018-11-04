/**
 *  Simple IndexedDB
 *  @desc Simple IndexedDB (sidb) is a wrapper for indexedDB API.
 *  @author Juan Jose Capellan <soycape@hotmail.com>
 */

/**
 * @license
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
   * Stores the pending tasks. Internal use.
   * @private
   * @type {object[]}
   */
  var taskQueue = [];

  /**
   * Data base name.
   * @private
   * @type {string}
   * @readonly
   */
  var dbName = _dbName;

  /**
   * Flag to check if all task were completed (tasqQueue is empty)
   * @private
   * @type {boolean}
   */
  var idle = true;

  //// PRIVATE FUNCTIONS //////////////////////////////////////////////////////////

  /**
   * Gets last records from an object store
   * @private
   * @param {string} storeName Store name.
   * @param {number} maxResults Limits the records retrieved.
   * @param {function} callback Callback called when done. Receives as parameter the retrieved records in an array.
   */
  function lastRecords(storeName, maxResults, callback) {
    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function(event) {
      var db = event.target.result;
      var resultFiltered=[];

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
                callback(resultFiltered);
                db.close();
                console.log("Database closed");
                console.log(counter + ' last records returned from object store "' + storeName + '"');
                taskQueue.shift();
                checkTasks();
            };
        };

        var onsuccesGetAllFunction = function (event) {
            callback(event.target.result);
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
   * @param {conditionObject[] | any} keyValue Can be a conditionObject array or a single value.
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param {function(object[])} callback Receives as parameter the result. Can be an object array or an object.
   */
  function getRecords(storeName, indexName, query, callback) {
    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      console.log("Database " + dbName + " opened");
      var store = db.transaction(storeName, "readwrite").objectStore(storeName);
      var index;
      var counter = 0;

      if (indexName != null) index = store.index(indexName);

      var filterObjectSize;
      var queryIsArray = Array.isArray(query);
      console.log(queryIsArray);

      if (queryIsArray) filterObjectSize = query.length;

      var resultFiltered = [];

      var onsuccesFunction = function(event) {
        var cursor = event.target.result;

        if (cursor) {
          //// Gets test value. Test is true if the record object is in the query.
          if (queryIsArray) {
            test = true;
            for (i = 0; i < filterObjectSize; i++) {
              test = testCondition(
                cursor.value[query[i].keyPath],
                query[i].cond,
                query[i].value
              );
              if (!test) break;
            }
          } else {
            test = cursor.value[index.keyPath] === query;
          }

          //// If test is true then record is added to resultFiltered
          if (test) {
            resultFiltered.push(cursor.value);
            console.log("pushed");
            counter++;
          }
          cursor.continue();
        } else {
          callback(resultFiltered);
          db.close();
          console.log("Database closed");
          console.log(
            counter + ' records returned from object store "' + storeName + '"'
          );
          taskQueue.shift();
          checkTasks();
        }
      };

      if (indexName != null) {
        index.openCursor().onsuccess = onsuccesFunction;
      } else {
        store.openCursor().onsuccess = onsuccesFunction;
      }
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
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function newStore(storeName, errorCallback) {
    var db;
    var version;

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
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
            errorCallback(event);
          } else {
            console.log("Error in database " + dbName + " : " + db.error);
          }
        };
      };

      request.onsuccess = function(event) {
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
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function newRecord(storeName, obj, errorCallback) {
    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
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
              db.close();
              taskQueue.shift();
              console.log("Database " + dbName + " closed");
              checkTasks();
            }
          };

          request.onerror = function(event) {
            if (errorCallback) {
              errorCallback(event);
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
          db.close();
          taskQueue.shift();
          console.log("Database " + dbName + " closed");
          checkTasks();
        };

        request.onerror = function(event) {
          if (errorCallback) {
            errorCallback(event);
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
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function newIndex(storeName, indexName, keyPath, errorCallback) {
    var db;
    var version;

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
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
        db.close();
        taskQueue.shift();
        console.log(
          "New index " + indexName + " created in objectStore " + storeName
        );
        checkTasks();
      };

      request.onerror = function(event) {
        if (errorCallback) {
          errorCallback(event);
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
   * Removes an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function removeStore(storeName, errorCallback) {
    var db;
    var version;

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
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
        db.close();
        console.log("ObjectStore " + storeName + " deleted");
        taskQueue.shift();
        checkTasks();
      };

      request.onerror = function(event) {
        if (errorCallback) {
          errorCallback(event);
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
   * Removes a Database
   * @private
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function removeDB(errorCallback) {
    var request = window.indexedDB.deleteDatabase(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
      } else {
        console.log(
          "Error deleting database " + dbName + " : " + request.error
        );
      }
    };

    request.onsuccess = function(event) {
      taskQueue.shift();
      console.log("Database " + dbName + " deleted");
      checkTasks();
    };
  }

  /**
   * Removes one or more records from a store. Records are selected by the query.
   * @private
   * @param {string} storeName Object store name.
   * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
   * @param {conditionObject[] | any} query Can be a conditionObject array or a single value.
   * A single value always refers to the index keypath so the index can not be null in this case.
   */
  function removeRecord(storeName, indexName, query) {
    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      console.log("Database " + dbName + " opened");
      var store = db.transaction(storeName, "readwrite").objectStore(storeName);
      var index;
      var counter = 0;

      if (indexName != null) index = store.index(indexName);

      var filterObjectSize;
      var queryIsArray = Array.isArray(query);

      if (queryIsArray) filterObjectSize = query.length;

      var onsuccesFunction = function(event) {
        var cursor = event.target.result;

        if (cursor) {
          //// Gets test value. Test is true if the record object is in the query.
          if (queryIsArray) {
            test = true;
            for (i = 0; i < filterObjectSize; i++) {
              test = testCondition(
                cursor.value[query[i].keyPath],
                query[i].cond,
                query[i].value
              );
              if (!test) break;
            }
          } else {
            test = cursor.value[index.keyPath] === query;
          }

          //// If test is true then record is deleted
          if (test) {
            var request = cursor.delete();
            request.onsuccess = function() {
              counter++;
            };
          }
          cursor.continue();
        } else {
          taskQueue.shift();
          db.close();
          console.log("Database closed");
          console.log(
            counter + " records were removed from object store" + storeName
          );
          checkTasks();
        }
      };

      if (indexName != null) {
        index.openCursor().onsuccess = onsuccesFunction;
      } else {
        store.openCursor().onsuccess = onsuccesFunction;
      }
    };
  }

  /**
   * Removes an index
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function removeIndex(storeName, indexName, errorCallback) {
    var db;
    var version;

    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      if (errorCallback) {
        errorCallback(event);
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
        db.close();
        taskQueue.shift();
        console.log(
          "Index " + indexName + " in objectStore " + storeName + " deleted"
        );
        checkTasks();
      };

      request.onerror = function(event) {
        if (errorCallback) {
          errorCallback(event);
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
   * @param {(conditionObject[] | any)} query Can be a conditionObject array or a single value.
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param  {object} objectValues New property value after update. Can be an array of values.
   * @param  {function} [errorCallback] Function called on error. Receives event parameter.
   */
  function updateByIndex(storeName, indexName, query, objectValues, errorCallback) {
    var request = window.indexedDB.open(dbName);

    request.onerror = function(event) {
      alert("Error. You must allow web app to use indexedDB.");
    };

    request.onsuccess = function(event) {
      var db = event.target.result;

      console.log("Database " + dbName + " opened");
      var store = db.transaction(storeName, "readwrite").objectStore(storeName);
      var index;

      if (indexName != null) index = store.index(indexName);

      var test; // if true then the record is updated
      var filterObjectSize;
      var queryIsArray = Array.isArray(query);

      if (queryIsArray) filterObjectSize = query.length;
      var counter = 0;

      var onsuccesFunction = function(event) {
        var cursor = event.target.result;
        var keys = Object.keys(objectValues);
        var newObjectValuesSize = keys.length;

          if (cursor) {
              //// Gets test value. Test is true if the record object is in the query.
              if (queryIsArray) {
                  test = true;
                  for (i = 0; i < filterObjectSize; i++) {
                      test = testCondition(
                          cursor.value[query[i].keyPath],
                          query[i].cond,
                          query[i].value
                      );
                      if (!test) break;
                  }
              } else {
                  test = cursor.value[index.keyPath] === query;
              }

              //// If test is true then record is updated
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
              }
              cursor.continue();
          } else {
              db.close();
              console.log("Database closed");
              taskQueue.shift();
              console.log(
                  counter +
                  ' records were updated from object store "' +
                  storeName +
                  '"'
              );
              checkTasks();
          }
      };      

      if (indexName != null) {
        index.openCursor().onsuccess = onsuccesFunction;
      } else {
        store.openCursor().onsuccess = onsuccesFunction;
      }
    };
  }

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

    //console.log(type);
    //console.log(taskQueue[0]);

    switch (type) {
      case "newStore":
        newStore(task.storeName, task.errorCallback);
        break;

      case "newRecords":
        newRecord(task.storeName, task.obj, task.errorCallback);
        break;

      case "newDB":
        newDB(task.errorCallback);
        break;

      case "removeStore":
        removeStore(task.storeName, errorCallback);
        break;

      case "removeDB":
        removeDB(task.errorCallback);
        break;

      case "removeRecords":
        //removeRecord(task.dbName, task.storeName, task.recordKey, task.errorCallback);
        removeRecord(task.storeName, task.indexName, task.query);
        break;

      case "removeIndex":
        removeIndex(task.storeName, task.indexName, task.errorCallback);
        break;

      case "updateRecordsByIndex":
        updateByIndex(
          task.storeName,
          task.indexName,
          task.query,
          task.objectValues,
          task.errorCallback
        );
        break;

      case "newIndex":
        newIndex(
          task.storeName,
          task.indexName,
          task.keyPath,
          task.errorCallback
        );
        break;

      case "lastRecords":
        lastRecords(
          task.storeName,
          task.maxResults,
          task.callback
        );
        break;

      case "getRecords":
        getRecords(task.storeName, task.indexName, task.query, task.callback);
        break;

      default:
        break;
    }
  }

  /**
   * Test a conditional expression as false or true
   * @private
   * @param {string | number} value1 First value to compare
   * @param {string} condition Comparison operator ( = , > , < , >= , <= , != )
   * @param {string | number} value2 Second value to compare
   * @returns {boolean}
   */
  function testCondition(value1, condition, value2) {
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

  //// Public //////////////////////////////////

  /**
   * Gets the database name
   * @public
   * @return {string} Database name
   */
  this.getName = function() {
    return dbName;
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
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     * @example
     * var mydb = new sidb();
     *
     * // Callback function to process a possible error
     * var myErrorCallback = function(event){
     *   console.log('Error creating new object store:' + event.target.error);
     * }
     *
     * // This code adds the task "create a new object store" to the task queue
     * mydb.add.store('objectStoreName', myErrorCallback);
     *
     * mydb.execTasks();
     */
    store: function(storeName, errorCallback) {
      // Make the task object
      var task = {
        type: "newStore",
        storeName: storeName,
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
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     * @example
     * var mydb = new sidb();
     *
     * // Object to insert in the object store
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     * // Callback function to process a possible error
     * var myErrorCallback = function(event){
     *     console.log('Error inserting the new record: ' + event.target.error);
     * }
     *
     * // This code adds the task "insert new record in object store" to the task queue
     * mydb.add.records('objectStoreName', person, myErrorCallback);
     *
     * mydb.execTasks();
     */
    records: function(storeName, obj, errorCallback) {
      var task = {
        type: "newRecords",
        storeName: storeName,
        obj: obj,
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
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     * @example
     * var mydb = new sidb();
     *
     * // Object to insert in the object store
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     * // Callback function to process a possible error
     * var myErrorCallback = function(event){
     *     console.log('Error creating the new index: ' + event.target.error);
     * }
     *
     * // This code adds the task "create a new index" to the task queue.
     * // In this case the new index "ages" order the records by the record property "age".
     * // Only records with a property named "age" are in the index "ages".
     * mydb.add.index('objectStoreName', 'ages', 'age', myErrorCallback);
     *
     * mydb.execTasks();
     */
    index: function(storeName, indexName, keyPath, errorCallback) {
      var task = {
        type: "newIndex",
        storeName: storeName,
        indexName: indexName,
        keyPath: keyPath,
        errorCallback
      };

      taskQueue.push(task);
    }
  };

  /**
   * Contains remove methods
   * @namespace
   */
  this.remove = {
    /**
     * Adds the task "remove a database" to the task queue.
     * @public
     * @instance
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    db: function(errorCallback) {
      var task = {
        type: "removeDB",
        errorCallback
      };

      taskQueue.push(task);
    },

    /**
     * Adds the task "remove a store from database" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    store: function(storeName, errorCallback) {
      var task = {
        type: "removeStore",
        storeName: storeName,
        errorCallback: errorCallback
      };

      taskQueue.push(task);
    },

    /**
     * Adds the task "remove a record/s from the object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name.
     * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
     * @param {conditionObject[] | any} query Can be a conditionObject array or a single value.
     * A single value always refers to the index keypath so the index can not be null in this case.
     * @example
     * var mydb = new sidb();
     *
     * // An example of object stored in the object store
     * var person = {
     *     name: 'Peter',
     *     age: 32,
     *     salary: 1200
     * }
     *
     * //
     * // Removes records where age is 40 using the index named 'ages' with the keypath 'age' as query.
     * //
     * mydb.remove.record('objectStoreName', 'ages', 40);
     *
     * //
     * // Removes records with age < 20 and salary > 1500 using a conditionObject array as query.
     * //
     * mydb.remove.records(
     *   'objectStoreName',
     *   null,
     *   [
     *       {keyPath: 'age', cond: '<', value: 20},
     *       {keyPath: 'salary', cond: '>', value: 1500}
     *   ]
     *   );
     *
     * mydb.execTasks();
     */
    records: function(storeName, indexName, query) {
      var task = {
        type: "removeRecords",
        storeName: storeName,
        indexName: indexName,
        query: query
      };

      taskQueue.push(task);
    },

    /**
     * Adds the task "remove an index from an object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name
     * @param {string} indexName Index name
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    index: function(storeName, indexName, errorCallback) {
      var task = {
        type: "removeIndex",
        storeName: storeName,
        indexName: indexName,
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
     * @param {(conditionObject[] | any)} query Can be a conditionObject array or a single value.
     * A single value always refers to the index keypath so the index can not be null in this case.
     * @param  {object} objectValues Object with the new values.
     * The values not only can be a single value, it can be a function that receives the old value and returns a new value.
     * (Example: objectValues = {property1:'value1', property4: value4, property6: function(oldValue){return oldValue + 100;}})
     * @param  {function} [errorCallback] Function called on error. Receives event parameter.
     * @example
     * var mydb = new sidb();
     *
     * // An example of object stored in the object store
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
     *     [{keyPath: 'age', cond: '>', value: 1200}, {keyPath: 'salary', cond: '<', value: 1000}], // conditionObject[]
     *     {salary: function(oldSalary){
     *         return oldSalary + 200;
     *         };
     *     },
     *     myErrorCallback
     * );
     *
     *
     * mydb.execTasks();
     *
     *
     * // Optional callback function to process errors
     * function myErrorCallback(event){
     *     console.log(event.target.error);
     * };
     *
     */
    records: function(
      storeName,
      indexName,
      query,
      objectValues,
      errorCallback
    ) {
      var task = {
        type: "updateRecordsByIndex",
        storeName: storeName,
        indexName: indexName,
        query: query,
        objectValues: objectValues,
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
     * @param {function} callback Callback called when done. Receives as parameter the retrieved records in an array.
     * @example
     * var mydb = new sidb();
     *
     * // An example of object stored in the object store "storeName"
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
     * //
     * //Execs all pending tasks
     * //
     * mydb.execTasks();
     * 
     * // Callback function to process the results
     * function myCallback(resultsArray){
     *     var size = resultsArray.length();
     *     var i=0;
     *     for(i=0;i<size;i++){
     *         console.log('Name: ' + resultsArray[i].name + ' Age: ' + resultsArray[i].age + '\n');
     *     };
     * };     
     *
     */
    lastRecords: function(storeName, maxResults, callback) {
      var task = {
        type: "lastRecords",
        storeName: storeName,
        maxResults: maxResults,
        callback: callback
      };

      taskQueue.push(task);
    },

    /**
     * Adds the task "get one or more records from a object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {string | null} indexName Index name. If it is null then no index is used (It is usually slower).
     * @param {conditionObject[] | any} keyValue Can be a conditionObject array or a single value.
     * A single value always refers to the index keypath so the index can not be null in this case.
     * @param {function(object[])} callback Receives as parameter the result. Can be an object array or an object.
     * @example
     * var mydb = new sidb();
     *
     * // An example of object stored in the object store
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     * // Callback function to process the result
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
     * //
     * // If there is an index named "ages" based on property "age", we can get a person with age = 32.
     * //
     * mydb.get.records('objectStoreName', 'ages', 32, myCallback);
     *
     * // Or we can get persons with age > 30 and name! = Peter
     * mydb.get.records(
     * 'objectStoreName',
     * null,
     * [{keyPath: 'age', cond: '>', value: 30}, {keypath: 'name', cond: '!=', value: 'Peter'}], // here the query is a conditionObject array
     * myCallback);
     *
     * mydb.execTasks();
     */
    records: function(storeName, indexName, query, callback) {
      var task = {
        type: "getRecords",
        storeName: storeName,
        indexName: indexName,
        query: query,
        callback: callback
      };

      taskQueue.push(task);
    }
  };

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
   * Executes pending tasks. The tasks are executed sequentially. A task does not run until the previous one ends. This avoids problems arising from the asynchronous nature of the indexedDB api.
   * @public
   */
  this.execTasks = function() {
    if (idle) {
      checkTasks();
    }
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
  this.add.db();
  this.execTasks();
};
