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
 * Creates an sidb (simple indexedDB) object
 * @class
 */
var sidb = function () {

    //// Private ////////////////////////////////////

    /**
     * Stores the pending tasks
     * @type {object[]}
     */
    var taskQueue = [];

    /**
     * Flag to check if all task were completed (= tasqQueue is empty)
     * @type {boolean}
     */
    var idle = true;

    var bloquedDbName = '';

    var t = this;

    // Object to save cursor position
    var marker = function () {
        this.position = 1;
    };

    /**
     * Gets last records from an object store
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Store name
     * @param {number} maxResults Limits the records retrieved 
     * @param {function(object[])} callback Callback called when done. Receives the retrieved records in an array.
     */
    function lastRecords(dbName, storeName, maxResults, callback) {

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            };

            console.log('Database ' + dbName + ' opened');
            var store = db.transaction(storeName, "readwrite").objectStore(storeName);
            var storeSize = store.count();
            var getRequest;

            storeSize.onsuccess = function () {
                var keyRange = IDBKeyRange.lowerBound(storeSize.result - maxResults, true);
                getRequest = store.getAll(keyRange);

                getRequest.onsuccess = function (event) {
                    callback(event.target.result);
                    db.close();
                    console.log('Database closed');
                    taskQueue.shift();
                    console.log('Last ' + maxResults + 'records retrieved from object store ' + storeName);
                    checkTasks();
                };

                getRequest.onerror = function (event) {
                    console.log('Error getting records: ' + getRequest.error);
                };

            };

        };
    };

    /**
     * Gets records from an object store, using an index to filter the results.
     * At least one of the properties of the filterObject must be defined.
     * @private
     * @param {string} dbName Database name.
     * @param {string} storeName Store name.
     * @param {string} indexName Index name.
     * @param {Object} filterObject Contains filter data.
     * @param {string | number} [filterObject.key] Exact value to search. If exists, max and min parameters will be ignored.
     * @param {string | number} [filterObject.min] Min value to filter the search.
     * @param {string | number} [filterObject.max] Max value to filter the search.
     * @param {function(object[])} callback Receives as parameter the results array
     */
    function recordsByIndex(dbName, storeName, indexName, filterObject, callback) {

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            };

            console.log('Database ' + dbName + ' opened');
            var store = db.transaction(storeName, "readwrite").objectStore(storeName);
            var keyRange;

            // Gets the keyRange from parameter filterObject
            if (filterObject.key) {

                keyRange = filterObject.key;

            } else if (filterObject.max && filterObject.min) {

                keyRange = IDBKeyRange.bound(filterObject.min, filterObject.max);

            } else if (filterObject.min) {

                keyRange = IDBKeyRange.lowerBound(filterObject.min);

            } else if (filterObject.max) {

                keyRange = IDBKeyRange.upperBound(filterObject.max);

            };



            var index = store.index(indexName);
            var getRequest = index.get(keyRange);

            getRequest.onsuccess = function (event) {

                callback(event.target.result);
                db.close();
                console.log('Database closed');
                taskQueue.shift();
                console.log('Records filtered by index ' + indexName + ' retrieved from object store ' + storeName);
                checkTasks();

            };

            getRequest.onerror = function (event) {
                console.log('Error getting records: ' + getRequest.error);
            };

        };
    }

    function recordsFiltered(dbName, storeName, indexName, filterObject, callback) {

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            };

            console.log('Database ' + dbName + ' opened');
            var store = db.transaction(storeName, "readwrite").objectStore(storeName);
            var resultFiltered = [];

            var index = store.index(indexName);

            index.openCursor().onsuccess = function (event) {

                var cursor = event.target.result;

                var i = 0;
                var filterObjectSize = filterObject.length;
                var test;

                if (cursor) {
                    test = true;
                    for (i = 0; i < filterObjectSize; i++) {
                        test = testCondition(cursor.value[filterObject[i].keyPath], filterObject[i].cond, filterObject[i].value);
                        if (!test) {
                            break;
                        };
                    };
                    if (test) {
                        resultFiltered.push(cursor.value);
                    };
                    cursor.continue();
                } else {

                    callback(resultFiltered);
                    db.close();
                    console.log('Database closed');
                    taskQueue.shift();
                    console.log('Records filtered by index ' + indexName + ' retrieved from object store ' + storeName);
                    checkTasks();

                }



            };

        };
    }

    /**
     * Creates a new Database.
     * @private
     * @param {string} dbName Database name
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function newDB(dbName, errorCallback) {

        var request = window.indexedDB.open(dbName);

        request.onsuccess = function (event) {
            var db = event.target.result;
            db.close();
            console.log('Database ' + dbName + ' created');
            taskQueue.shift();
            checkTasks();
        };

        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error creating database ' + dbName + ' : ' + request.error);
            }
        };

    };

    /**
     * Creates a new object store
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Objects store name
     * @param {function} [errorCallback] Function called on error. Receives event parameter.     
     */
    function newStore(dbName, storeName, errorCallback) {

        var db;
        var version;

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);


        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error opening database ' + dbName + ' : ' + request.error);
            };
        };

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onsuccess = function (event) {

            var db = event.target.result;

            if (noDb) {
                db.close();
                bloquedDbName = dbName;
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            }

            // If store already exist then returns
            if (db.objectStoreNames.contains(storeName)) {

                db.close();
                taskQueue.shift();
                console.log('Object store ' + storeName + ' already exists');
                checkTasks();
                return;

            }

            version = db.version;
            db.close();
            console.log('Version tested');
            var newVersion = version + 1;
            var store;

            request = window.indexedDB.open(dbName, newVersion);

            request.onupgradeneeded = function (event) {

                db = event.target.result;

                store = db.createObjectStore(storeName, {
                    keyPath: 'nId',
                    autoIncrement: true
                });


                store.onerror = function (event) {
                    console.log('error');
                    if (errorCallback) {
                        errorCallback(event);
                    } else {
                        console.log('Error in database ' + dbName + ' : ' + db.error);
                    }
                };
            };

            request.onsuccess = function (event) {
                db.close();
                taskQueue.shift();
                console.log('New objectStore ' + storeName + ' created');
                checkTasks();
            };

        };
    };

    /**
     * Insert a new record/s in a object store
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {(object | object[])} obj An object or objects array to insert in object store
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function newRecord(dbName, storeName, obj, errorCallback) {

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };


        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };



        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error opening database ' + dbName + ' : ' + request.error);
            }
        };

        request.onsuccess = function (event) {

            var db = event.target.result;

            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            }

            console.log('Database ' + dbName + ' opened');
            var counter = 0;
            var store = db.transaction(storeName, "readwrite").objectStore(storeName);
            if (Array.isArray(obj)) {
                var i, objSize;
                objSize = obj.length;

                for (i = 0; i < objSize; i++) {
                    var request = store.add(obj[i]);
                    request.onsuccess = function (event) {
                        counter++;
                        if (counter == objSize) {
                            console.log('Records added in store ' + storeName);
                            db.close();
                            taskQueue.shift();
                            console.log('Database ' + dbName + ' closed');
                            checkTasks();
                        };
                    };

                    request.onerror = function (event) {
                        if (errorCallback) {
                            errorCallback(event);
                        } else {
                            console.log('Error adding records to store ' + storeName + ' : ' + request.error);
                        }
                    };
                };

            } else {

                var request = store.add(obj);
                request.onsuccess = function (event) {
                    console.log('record added');
                    db.close();
                    taskQueue.shift()
                    console.log('Database ' + dbName + ' closed');
                    checkTasks();
                };

                request.onerror = function (event) {
                    if (errorCallback) {
                        errorCallback(event);
                    } else {
                        console.log('Error adding record to store ' + storeName + ' : ' + request.error);
                    }
                };
            };

        };

    };

    /**
     * Creates a new index in an object store.
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {string} indexName Index name
     * @param {string} keyPath Key that the index use
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function newIndex(dbName, storeName, indexName, keyPath, errorCallback) {

        var db;
        var version;

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error opening database ' + dbName + ' : ' + request.error);
            };
        };

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onsuccess = function (event) {

            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            }

            version = db.version;
            db.close();
            console.log('Version tested');
            var newVersion = version + 1;

            request = window.indexedDB.open(dbName, newVersion);

            request.onupgradeneeded = function (event) {

                db = event.target.result;

                var upgradeTransaction = event.target.transaction;
                var store = upgradeTransaction.objectStore(storeName);
                if (!store.indexNames.contains(indexName)) {
                    store.createIndex(indexName, keyPath);
                } else {

                    db.close();
                    taskQueue.shift();
                    console.log('Index \"' + indexName + '\" already exists in object store ' + storeName);
                    checkTasks();
                    return;

                }

            };

            request.onsuccess = function (event) {
                db.close();
                taskQueue.shift();
                console.log('New index ' + indexName + ' created in objectStore ' + storeName);
                checkTasks();
            };

            request.onerror = function (event) {
                if (errorCallback) {
                    errorCallback(event);
                } else {
                    console.log('Error creating index ' + indexName + ' in store ' + storeName + ' : ' + request.error);
                }
            };

        };
    };

    /**
     * Removes an object store.
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function removeStore(dbName, storeName, errorCallback) {
        var db;
        var version;

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error opening database ' + dbName + ' : ' + request.error);
            }
        };

        request.onsuccess = function (event) {

            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            };

            version = db.version;
            db.close();
            console.log('Version tested');
            var newVersion = version + 1;

            request = window.indexedDB.open(dbName, newVersion);

            request.onupgradeneeded = function (event) {

                db = event.target.result;

                db.deleteObjectStore(storeName);
            };

            request.onsuccess = function (event) {
                db.close();
                console.log('ObjectStore ' + storeName + ' deleted');
                taskQueue.shift();
                checkTasks();
            };

            request.onerror = function (event) {
                if (errorCallback) {
                    errorCallback(event);
                } else {
                    console.log('Error deleting store ' + storeName + ' in database ' + dbName + ' : ' + request.error);
                }
            };

        };
    };

    /**
     * Removes a Database
     * @private
     * @param {string} dbName Database name
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function removeDB(dbName, errorCallback) {

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.deleteDatabase(dbName);

        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error deleting database ' + dbName + ' : ' + request.error);
            };
        };

        request.onsuccess = function (event) {
            taskQueue.shift();
            console.log('Database ' + dbName + ' deleted');
            checkTasks();
            bloquedDbName = '';
        };
    };

    /**
     * Removes a record in object store
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {number} recordKey Record key
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function removeRecord(dbName, storeName, recordKey, errorCallback) {

        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error opening database ' + dbName + ' : ' + request.error);
            };
        };

        request.onsuccess = function (event) {
            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            };

            console.log('Database ' + dbName + ' opened');
            var store = db.transaction(storeName, "readwrite").objectStore(storeName);
            var removeRequest = store.delete(recordKey);

            removeRequest.onsuccess = function (event) {
                db.close();
                console.log('Database closed');
                taskQueue.shift();
                console.log('Record with primary key ' + recordKey + ' deleted');
                checkTasks();
            };

            removeRequest.onerror = function (event) {
                console.log('Error deleting record: ' + removeRequest.error);
            };

        };



    };

    /**
     * Remove an index
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {string} indexName Index name
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function removeIndex(dbName, storeName, indexName, errorCallback) {

        var db;
        var version;

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error opening database ' + dbName + ' : ' + request.error);
            };
        };

        request.onsuccess = function (event) {

            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            };

            version = db.version;
            db.close();
            console.log('Version tested');
            var newVersion = version + 1;

            request = window.indexedDB.open(dbName, newVersion);

            request.onupgradeneeded = function (event) {

                db = event.target.result;

                var upgradeTransaction = event.target.transaction;
                var store = upgradeTransaction.objectStore(storeName);
                store.deleteIndex(indexName);

            };

            request.onsuccess = function (event) {
                db.close();
                taskQueue.shift();
                console.log('Index ' + indexName + ' in objectStore ' + storeName + ' deleted');
                checkTasks();
            };

            request.onerror = function (event) {
                if (errorCallback) {
                    errorCallback(event);
                } else {
                    console.log('Error deleting index ' + dbName + ' in object store ' + storeName + ' : ' + request.error);
                };
            };

        };
    };

    /**
     * Updates a property value in a record.
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {number} recordKey Record key
     * @param {string} prop Property name
     * @param {any} value Property value
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function updateRecords(dbName, storeName, recordKey, prop, value, errorCallback) {

        if (bloquedDbName == dbName) {
            console.log('Database ' + dbName + ' doesn\'t exist');
            taskQueue.shift();
            checkTasks();
            return;
        };

        var request = window.indexedDB.open(dbName);

        var noDb = false; // Boolean: Database doesn't exist

        // if onupgradeneeded means is a new database
        request.onupgradeneeded = function (event) {
            noDb = true;
        };

        request.onerror = function (event) {
            if (errorCallback) {
                errorCallback(event);
            } else {
                console.log('Error opening database ' + dbName + ' : ' + request.error);
            };
        };

        request.onsuccess = function (event) {
            var db = event.target.result;

            // If database doesn't exist ...
            if (noDb) {
                db.close();
                console.log('Database ' + dbName + ' doesn\'t exist');
                removeDB('dbName');
                return;
            };

            console.log('Database ' + dbName + ' opened');
            var store = db.transaction(storeName, "readwrite").objectStore(storeName);
            var getRequest = store.get(recordKey);

            getRequest.onsuccess = function (event) {
                var record = event.target.result;

                if (!record) {
                    console.log('Error getting record, the key ' + recordKey + ' does\'nt exists');
                    db.close();
                    console.log('Database closed');
                    taskQueue.shift();
                    checkTasks();
                    return;
                };

                // set prop=value in record
                record[prop] = value;

                // Put modified record back in database
                var updateRequest = store.put(record);


                updateRequest.onsuccess = function (event) {
                    db.close();
                    console.log('Database closed');
                    taskQueue.shift();
                    console.log('Record with primary key ' + recordKey + ' updated');
                    checkTasks();
                };

                updateRequest.onerror = function (event) {
                    if (errorCallback) {
                        errorCallback(event);
                    } else {
                        console.log('Error updating record in object store ' + storeName + ' in database ' + dbName + ' : ' + updateRequest.error);
                    };
                };

            };

            getRequest.onerror = function (event) {
                if (errorCallback) {
                    errorCallback(event);
                } else {
                    console.log('Error getting record in object store ' + storeName + ' in database ' + dbName + ' : ' + getRequest.error);
                };
            };

        };
    };

    /**
     * Manage the task queue
     * @private
     */
    function checkTasks() {

        if (taskQueue.length == 0) {
            idle = true;
            console.log('No pending tasks');
            return;
        };

        idle = false;

        var type = taskQueue[0].type;
        var task = taskQueue[0];

        console.log(type);
        console.log(taskQueue[0]);

        switch (type) {

            case 'newStore':
                newStore(task.dbName, task.storeName, task.errorCallback);
                break;

            case 'newRecords':
                newRecord(task.dbName, task.storeName, task.obj, task.errorCallback);
                break;

            case 'newDB':
                newDB(task.dbName, task.errorCallback);
                break;

            case 'removeStore':
                removeStore(task.dbName, task.storeName, errorCallback);
                break;

            case 'removeDB':
                removeDB(task.dbName, task.errorCallback);
                break;

            case 'removeRecord':
                removeRecord(task.dbName, task.storeName, task.recordKey, task.errorCallback);
                break;

            case 'removeIndex':
                removeIndex(task.dbName, task.storeName, task.indexName, task.errorCallback);
                break;

            case 'updateRecords':
                updateRecords(task.dbName, task.storeName, task.recordKey, task.prop, task.value, task.errorCallback);
                break;

            case 'newIndex':
                newIndex(task.dbName, task.storeName, task.indexName, task.keyPath, task.errorCallback);
                break;

            case 'lastRecords':
                lastRecords(task.dbName, task.storeName, task.maxResults, task.callback);
                break;

            case 'recordsByIndex':
                recordsByIndex(task.dbName, task.storeName, task.indexName, task.filterObject, task.callback);
                break;

            case 'recordsFiltered':
                recordsFiltered(task.dbName, task.storeName, task.indexName, task.filterObject, task.callback);
                break;

            default:
                break;
        }

    };

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
            case '=':
                result = (value1 == value2) ? true : false;
                return result;
                break;

            case '>':
                result = (value1 > value2) ? true : false;
                return result;
                break;

            case '<':
                result = (value1 < value2) ? true : false;
                return result;
                break;

            case '>=':
                result = (value1 >= value2) ? true : false;
                return result;
                break;

            case '<=':
                result = (value1 <= value2) ? true : false;
                return result;
                break;

            case '!=':
                result = (value1 != value2) ? true : false;
                return result;
                break;

            default:
                break;
        }
    }

    //// Public //////////////////////////////////

    /** 
     * Contains add methods
     * @namespace
     */
    this.add = {

        /**
         * Add an order in task queue that creates a new database
         * @public
         * @instance
         * @param {string} dbName
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         */
        db: function (dbName, errorCallback) {

            var task = {
                type: 'newDB',
                dbName: dbName,
                errorCallback: errorCallback
            };

            taskQueue.push(task);

        },

        /**
         * Add an order in task queue that creates a new object store.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Objects store name
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         * @example
         * var mycallback = function(event){
         *   console.log('Error creating new object store:' + event.target.error);
         * }
         * sidbobject.add.newStore('myDatabase','myStore',mycallback);
         */
        store: function (dbName, storeName, errorCallback) {

            // Make the task object
            var task = {
                type: 'newStore',
                dbName: dbName,
                storeName: storeName,
                errorCallback: errorCallback
            };

            // Add this task to taskQueue    
            taskQueue.push(task);

        },

        /**
         * Add an order in task queue that "inserts new record/s in a object store".
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {(object | object[])} obj An object or objects array to insert in object store
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         */
        records: function (dbName, storeName, obj, errorCallback) {

            var task = {
                type: 'newRecords',
                dbName: dbName,
                storeName: storeName,
                obj: obj,
                errorCallback: errorCallback
            };

            taskQueue.push(task);

        },

        /**
         * Add an order in task queue that "creates a new index in a object store".
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {string} indexName Index name
         * @param {string} keyPath Key that the index use
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         */
        index: function (dbName, storeName, indexName, keyPath, errorCallback) {

            var task = {
                type: 'newIndex',
                dbName: dbName,
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
         * Removes an order to task queue which removes a database
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         */
        db: function (dbName, errorCallback) {

            var task = {
                type: 'removeDB',
                dbName: dbName,
                errorCallback
            };

            taskQueue.push(task);

        },

        /**
         * Removes an order in task queue which removes an object store.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {function} [errorCallback] Function called on error. Receives event parameter.         
         */
        store: function (dbName, storeName, errorCallback) {
            var task = {
                type: 'removeStore',
                dbName: dbName,
                storeName: storeName,
                errorCallback: errorCallback
            };

            taskQueue.push(task);
        },

        /**
         * Removes an order in task queue which removes a record.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {number} recordKey Record key
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         */
        record: function (dbName, storeName, recordKey, errorCallback) {
            var task = {
                type: 'removeRecord',
                dbName: dbName,
                storeName: storeName,
                recordKey: recordKey,
                errorCallback: errorCallback
            };

            taskQueue.push(task);
        },

        /**
         * Removes an order in task queue which removes an index.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {string} indexName Index name
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         */
        index: function (dbName, storeName, indexName, errorCallback) {

            var task = {
                type: 'removeIndex',
                dbName: dbName,
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
         * Add an order to task queue which updates a property value in a record.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {number} recordKey Record key
         * @param {string} prop Property name
         * @param {any} value Property value
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         */
        records: function (dbName, storeName, recordKey, prop, value, errorCallback) {

            var task = {
                type: 'updateRecords',
                dbName: dbName,
                storeName: storeName,
                recordKey: recordKey,
                prop: prop,
                value: value,
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
         * Add an order to task queue which gets last records from an object store
         * @public
         * @instance
         * @param {strinf} dbName Database name
         * @param {string} storeName Store name
         * @param {number} maxResults Limits the records retrieved 
         * @param {function} callback Callback called when done. Receives as parameter the retrieved records in an array.
         */
        lastRecords: function (dbName, storeName, maxResults, callback) {

            var task = {
                type: 'lastRecords',
                dbName: dbName,
                storeName: storeName,
                maxResults: maxResults,
                callback: callback
            };

            taskQueue.push(task);

        },

        /**
         * Gets records from an object store, using an index to filter the results.
         * At least one of the properties of the filterObject must be defined.
         * @public
         * @instance
         * @param {string} dbName Database name.
         * @param {string} storeName Store name.
         * @param {string} indexName Index name.
         * @param {Object} filterObject Contains filter data.
         * @param {string | number} [filterObject.key] Exact value to search. If exists, max and min parameters will be ignored.
         * @param {string | number} [filterObject.min] Min value to filter the search.
         * @param {string | number} [filterObject.max] Max value to filter the search.
         * @param {function(object[])} callback Receives as parameter the results array
         */
        recordsByIndex: function (dbName, storeName, indexName, filterObject, callback) {

            var task = {

                type: 'recordsByIndex',
                dbName: dbName,
                storeName: storeName,
                indexName: indexName,
                filterObject: filterObject,
                callback: callback
            };

            taskQueue.push(task);

        },

        recordsFiltered: function (dbName, storeName, indexName, filterObject, callback) {

            var task = {

                type: 'recordsFiltered',
                dbName: dbName,
                storeName: storeName,
                indexName: indexName,
                filterObject: filterObject,
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
         * @param {object[]} array Array from the "page" is extracted
         * @param {number} elementsPerPage Number of elements per page
         * @param {number} page The page wich will be extracted from array
         * @returns {Array} The part of original array wich represents the page
         */
        pageFromArray: function(array, elementsPerPage, page){
            var page = array.slice((page-1)*elementsPerPage,page*elementsPerPage);
            return page;
        }
    }

    /**
     * Executes pending tasks
     * @public
     */
    this.execTasks = function () {
        if (idle) {
            checkTasks();
        };
    };

    /**
     * Checks if indexedDB is available
     *
     * @returns {boolean}
     */
    this.isIndexedDBavailable = function () {
        var available = true;
        if (!('indexedDB' in window)) {
            console.log('This browser doesn\'t support IndexedDB');
            available = false;
        };
        return available;
    };



};