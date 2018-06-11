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

    var t = this;

    /**
     * Gets last records from an object store
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Store name
     * @param {number} maxResults Limits the records retrieved 
     * @param {function(object[])} callback Callback called when done. Receives the retrieved records in an array.
     */
    function lastRecords(dbName, storeName, maxResults, callback) {

        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;
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

        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;
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

    /**
     * Creates a new Database.
     * @private
     * @param {String} dbName Database name
     */
    function newDB(dbName) {

        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;
            db.close();
            console.log('Database ' + dbName + ' created');
            taskQueue.shift();
            checkTasks();
        };

    };

    /**
     * Creates a new object store
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Objects store name
     * @param {string} keyPath Key name
     * @param {boolean} autoIncrement True to automatic generate the key
     */
    function newStore(dbName, storeName, keyPath, autoIncrement) {

        var db;
        var version;
        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {

            var db = event.target.result;
            version = db.version;
            db.close();
            console.log('Version tested');
            var newVersion = version + 1;

            request = window.indexedDB.open(dbName, newVersion);

            request.onupgradeneeded = function (event) {

                db = event.target.result;


                db.createObjectStore(storeName, {
                    keyPath: keyPath,
                    autoIncrement: autoIncrement
                });
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
     */
    function newRecord(dbName, storeName, obj) {


        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;
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
            };

        };

    };

    /**
     * Creates a new index in a object store.
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {string} indexName Index name
     * @param {string} keyPath Key that the index use
     */
    function newIndex(dbName, storeName, indexName, keyPath) {

        var db;
        var version;
        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {

            var db = event.target.result;
            version = db.version;
            db.close();
            console.log('Version tested');
            var newVersion = version + 1;

            request = window.indexedDB.open(dbName, newVersion);

            request.onupgradeneeded = function (event) {

                db = event.target.result;

                var upgradeTransaction = event.target.transaction;
                var store = upgradeTransaction.objectStore(storeName);
                store.createIndex(indexName, keyPath);

            };

            request.onsuccess = function (event) {
                db.close();
                taskQueue.shift();
                console.log('New index ' + indexName + ' created in objectStore ' + storeName);
                checkTasks();
            };

        };
    };

    /**
     * Removes an object store.
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     */
    function removeStore(dbName, storeName) {
        var db;
        var version;
        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {

            var db = event.target.result;
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

        };
    };

    /**
     * Removes a Database
     * @private
     * @param {string} dbName Database name
     */
    function removeDB(dbName) {

        var request = window.indexedDB.deleteDatabase(dbName);

        request.onerror = function (event) {
            console.log('Error deleting database ' + dbName);
        };

        request.onsuccess = function (event) {
            taskQueue.shift();
            console.log('Database ' + dbName + ' deleted');
            checkTasks();
        };
    };

    /**
     * Removes a record in object store
     * @private
     * @param {string} dbName Database name
     * @param {string} storeName Object store name
     * @param {number} recordKey Record key
     */
    function removeRecord(dbName, storeName, recordKey) {

        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;
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
     */
    function removeIndex(dbName, storeName, indexName) {

        var db;
        var version;
        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {

            var db = event.target.result;
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
     */
    function updateRecords(dbName, storeName, recordKey, prop, value) {

        var request = window.indexedDB.open(dbName);

        request.onerror = function (event) {
            alert("Error. You must allow web app to use indexedDB.");
        };

        request.onsuccess = function (event) {
            var db = event.target.result;
            console.log('Database ' + dbName + ' opened');
            var store = db.transaction(storeName, "readwrite").objectStore(storeName);
            var getRequest = store.get(recordKey);

            getRequest.onsuccess = function (event) {
                var record = event.target.result;

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
                    console.log('Error updating record: ' + updateRequest.error);
                };

            };

            getRequest.onerror = function (event) {
                console.log('Error getting record: ' + removeRequest.error);
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
                newStore(task.dbName, task.storeName, task.keyPath, task.autoIncrement);
                break;

            case 'newRecords':
                newRecord(task.dbName, task.storeName, task.obj);
                break;

            case 'newDB':
                newDB(task.dbName);
                break;

            case 'removeStore':
                removeStore(task.dbName, task.storeName);
                break;

            case 'removeDB':
                removeDB(task.dbName);
                break;

            case 'removeRecord':
                removeRecord(task.dbName, task.storeName, task.recordKey);
                break;

            case 'removeIndex':
                removeIndex(task.dbName, task.storeName, task.indexName);
                break;

            case 'updateRecords':
                updateRecords(task.dbName, task.storeName, task.recordKey, task.prop, task.value);
                break;

            case 'newIndex':
                newIndex(task.dbName, task.storeName, task.indexName, task.keyPath);
                break;

            case 'lastRecords':
                lastRecords(task.dbName, task.storeName, task.maxResults, task.callback);
                break;

            case 'recordsByIndex':
                recordsByIndex(task.dbName, task.storeName, task.indexName, task.filterObject, task.callback);
                break;

            default:
                break;
        }

    };

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
         */
        db: function (dbName) {

            var task = {
                type: 'newDB',
                dbName: dbName
            };

            taskQueue.push(task);

        },

        /**
         * Add an order in task queue that creates a new object store.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Objects store name
         * @param {string} keyPath Key name
         * @param {boolean} autoIncrement True to automatic generate the key
         */
        store: function (dbName, storeName, keyPath, autoIncrement) {

            // Make the task object
            var task = {
                type: 'newStore',
                dbName: dbName,
                storeName: storeName,
                keyPath: keyPath,
                autoIncrement: autoIncrement
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
         */
        records: function (dbName, storeName, obj) {

            var task = {
                type: 'newRecords',
                dbName: dbName,
                storeName: storeName,
                obj: obj
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
         */
        index: function (dbName, storeName, indexName, keyPath) {

            var task = {
                type: 'newIndex',
                dbName: dbName,
                storeName: storeName,
                indexName: indexName,
                keyPath: keyPath
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
         * Add an order to task queue which removes a database
         * @public
         * @instance
         * @param {string} dbName Database name
         */
        db: function (dbName) {

            var task = {
                type: 'removeDB',
                dbName: dbName
            };

            taskQueue.push(task);

        },

        /**
         * Add an order in task queue which removes an object store.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         */
        store: function (dbName, storeName) {
            var task = {
                type: 'removeStore',
                dbName: dbName,
                storeName: storeName
            };

            taskQueue.push(task);
        },

        /**
         * Add an order in task queue which removes a record.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {number} recordKey Record key
         */
        record: function (dbName, storeName, recordKey) {
            var task = {
                type: 'removeRecord',
                dbName: dbName,
                storeName: storeName,
                recordKey: recordKey
            };

            taskQueue.push(task);
        },

        /**
         * Add an order in task queue which removes an index.
         * @public
         * @instance
         * @param {string} dbName Database name
         * @param {string} storeName Object store name
         * @param {string} indexName Index name
         */
        index: function (dbName, storeName, indexName) {

            var task = {
                type: 'removeIndex',
                dbName: dbName,
                storeName: storeName,
                indexName: indexName
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
         */
        records: function (dbName, storeName, recordKey, prop, value) {

            var task = {
                type: 'updateRecords',
                dbName: dbName,
                storeName: storeName,
                recordKey: recordKey,
                prop: prop,
                value: value
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

        }

    };

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