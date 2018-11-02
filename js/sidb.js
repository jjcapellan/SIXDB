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
 * Creates an sidb (simple indexedDB) object that manage the indexedDB databases. 
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
     * Flag to check if all task were completed (tasqQueue is empty)
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
     * Gets a record/s from an object store using a key value from an index.
     * @private
     * @param {string} dbName Database name.
     * @param {string} storeName Store name.
     * @param {string} indexName Index name.
     * @param {(null | conditionObject[] | any)} keyValue Contains the key value. Can be a conditionObject array, a individual value or null.
     * If it's null then returns all records from the index.
     * @param {function(object[])} callback Receives as parameter the result. Can be an object array or an object.
     */
    function getRecords(dbName, storeName, indexName, keyValue, callback) {

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



            var index = store.index(indexName);
            var resultFiltered = [];

            //keyValue parameter can be null/undefined, an array of conditionObjects, or a simple value

            if (keyValue === null || keyValue === undefined) {

                var getRequest = index.getAll();

                getRequest.onsuccess = function (event) {

                    callback(event.target.result);
                    db.close();
                    console.log('Database closed');
                    taskQueue.shift();
                    console.log('All records retrieved from index ' + indexName + ' in object store ' + storeName);
                    checkTasks();

                };

                getRequest.onerror = function (event) {
                    console.log('Error getting records: ' + getRequest.error);
                };

            } else if (Array.isArray(keyValue)) {
                console.log(keyValue);

                index.openCursor().onsuccess = function (event) {

                    var cursor = event.target.result;
                    

                    var i = 0;
                    var filterObjectSize = keyValue.length;
                    var test;

                    if (cursor) {
                        test = true;
                        for (i = 0; i < filterObjectSize; i++) {
                            test = testCondition(cursor.value[keyValue[i].keyPath], keyValue[i].cond, keyValue[i].value);
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
                        console.log('Records filtered from index ' + indexName + ' retrieved from object store ' + storeName);
                        checkTasks();
                    }


                };
            } else {

                var getRequest = index.get(keyValue);

                getRequest.onsuccess = function (event) {

                    callback(event.target.result);
                    db.close();
                    console.log('Database closed');
                    taskQueue.shift();
                    console.log('Record with key value ' + keyValue + ' retrieved from index ' + indexName + ' in object store ' + storeName);
                    checkTasks();

                };

                getRequest.onerror = function (event) {
                    console.log('Error getting record: ' + getRequest.error);
                };

            }



        };
    }

    /**
     * The conditionObject contains the three elements to test a condition.
     * @typedef {Object} conditionObject
     * @property {string} keyPath Indicates a key path to test.
     * @property {string} condition A comparison operator ( "<" , ">" , "=" , "!=" , "<=" , ">=" ).
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
     * var condition = {'age', '<', 45};
     */

    

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
     * Removes a record/s from an index
     * @private
     * @param {string} dbName Database name.
     * @param {string} storeName Object store name.
     * @param {string} indexName Index name.
     * @param {any} keyValue Value of the index keyPath whose object will be deleted.
     */
    function removeRecord(dbName, storeName, indexName, keyValue) {

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

            var index = store.index(indexName);

            index.openCursor().onsuccess = function (event) {

                var cursor = event.target.result;

                if (cursor) {
                    if (cursor.value[index.keyPath] == keyValue) {
                        var request = cursor.delete();
                        request.onsuccess = function () {
                            console.log('Record deleted');
                        };
                    }

                    cursor.continue();

                } else {                   
                    
                    console.log('Database closed');
                    taskQueue.shift();
                    db.close();
                    console.log('Records with property ' + index.keyPath + ' = ' + keyValue + ' were deleted from object store' + storeName);
                    checkTasks();

                }



            };

        };
    }

    /**
     * Removes an index
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
     * @param {any} newValue Property value
     * @param {function} [errorCallback] Function called on error. Receives event parameter.
     */
    function updateRecords(dbName, storeName, recordKey, prop, newValue, errorCallback) {

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
                record[prop] = newValue;

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

    function updateByIndex(dbName, storeName, indexName, keyValue, property, newValue, errorCallback) {

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



            var index = store.index(indexName);

            index.openCursor().onsuccess = function (event) {
                var cursor = event.target.result;
                if (cursor) {
                    if (cursor.value[index.keyPath] === keyValue) {
                        var updateData = cursor.value;                        

                        if(Array.isArray(property)){
                            var i=0;
                            for(i=0;i<property.length;i++){
                                updateData[property[i]] = newValue[i];
                            }
                        } else {
                            updateData[property] = newValue;
                        };

                        var request = cursor.update(updateData);
                        request.onsuccess = function () {
                            console.log('Record updated');
                        };
                    };
                    cursor.continue();

                } else {

                    db.close();
                    console.log('Database closed');
                    taskQueue.shift();
                    console.log('Records with property ' + index.keyPath + ' = ' + keyValue + ' were updated from object store' + storeName);
                    checkTasks();
                }
            }
        }

    }

    

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
                //removeRecord(task.dbName, task.storeName, task.recordKey, task.errorCallback);
                removeRecord(task.dbName, task.storeName, task.indexName, task.keyValue);
                break;

            case 'removeIndex':
                removeIndex(task.dbName, task.storeName, task.indexName, task.errorCallback);
                break;

            case 'updateRecords':
                updateRecords(task.dbName, task.storeName, task.recordKey, task.prop, task.value, task.errorCallback);
                break;

            case 'updateRecordsByIndex':
                updateByIndex(task.dbName, task.storeName, task.indexName, task.keyValue, task.property, task.newValue, task.errorCallback);
                break;

            case 'newIndex':
                newIndex(task.dbName, task.storeName, task.indexName, task.keyPath, task.errorCallback);
                break;

            case 'lastRecords':
                lastRecords(task.dbName, task.storeName, task.maxResults, task.callback);
                break;

            case 'getRecords':
                getRecords(task.dbName, task.storeName, task.indexName, task.keyValue, task.callback);
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
         * Add the task "create new database" to the task queue.
         * @public
         * @instance
         * @param {string} dbName Database name.
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
         * Adds the task "create a new object store" to the task queue.
         * @public
         * @instance
         * @param {string} dbName Database name where the object store is created.
         * @param {string} storeName Object store name.
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         * @example
         * var idb = new sidb();
         * 
         * // Callback function to process a possible error
         * var myErrorCallback = function(event){
         *   console.log('Error creating new object store:' + event.target.error);
         * }
         * 
         * // This code adds the task "create a new object store" to the task queue
         * idb.add.store('databaseName', 'objectStoreName', myErrorCallback);
         * 
         * execTasks();
         */
        store: function (dbName, storeName, errorCallback) {

            // Make the task object
            var task = {
                type: 'newStore',
                dbName: dbName,
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
         * @param {string} dbName Database name.
         * @param {string} storeName Object store name where the record is added.
         * @param {(object | object[])} obj An object or objects array to insert in the object store.
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         * @example
         * var idb = new sidb();
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
         * idb.add.records('databaseName', 'objectStoreName', person, myErrorCallback);
         * 
         * execTasks();
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
         * Adds the task "create a new index" to the task queue.
         * @public
         * @instance
         * @param {string} dbName Database name.
         * @param {string} storeName Object store name where the index is created.
         * @param {string} indexName Index name.
         * @param {string} keyPath Key (property of stored objects) that the index use to order and filter.
         * @param {function} [errorCallback] Function called on error. Receives event parameter.
         * @example
         * var idb = new sidb();
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
         * idb.add.index('databaseName', 'objectStoreName', 'ages', 'age', myErrorCallback);
         * 
         * execTasks();
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
         * Adds the task "remove a database" to the task queue.
         * @public
         * @instance
         * @param {string} dbName Database name.
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
         * Adds the task "remove a store from database" to the task queue.
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
         * Adds the task "remove a record/s from an index whose keypath value is equal to this value" to the task queue.
         * @public
         * @instance
         * @param {string} dbName Database name.
         * @param {string} storeName Object store name.
         * @param {string} indexName Index name
         * @param {any} keyValue Value of the index keyPath which object will be deleted.
         * @example
         * var idb = new sidb();
         * 
         * // An example of object stored in the object store
         * var person = {
         *     name: 'Peter',
         *     age: 32
         * }
         * 
         * // If there is an index named 'ages' with the keypath 'age' then we can delete all records with age = 40.
         * idb.remove.record('databaseName', 'objectStoreName', 'ages', 40);
         * 
         * idb.execTasks();
         */
        record: function (dbName, storeName, indexName, keyValue) {
            var task = {
                type: 'removeRecord',
                dbName: dbName,
                storeName: storeName,
                indexName: indexName,
                keyValue: keyValue
            };

            taskQueue.push(task);
        },

        /**
         * Adds the task "remove an index from an object store" to the task queue.
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
         * Adds the task "update a record property value" to the task queue.The record is selected by its recordKey (all stored objects have a property with unique value named "nid" ).
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

        },

        /**
         * Adds the task "update a record property value" to the task queue. The record is selected by its keypath index.
         * @param  {string} dbName Database name.
         * @param  {string} storeName Object store name.
         * @param  {string} indexName Index name.
         * @param  {any} keyValue Value of the index keypath whose record/s will be updated.  
         * @param  {(string | string[])} property Record property that will be updated. Can be an array of properties.
         * @param  {(any | any[])} newValue New property value after update. Can be an array of values.
         * @param  {any} [errorCallback] Function called on error. Receives event parameter.
         * @example
         * var idb = new sidb();
         * 
         * // An example of object stored in the object store
         * var person = {
         *     name: 'Peter',
         *     age: 32,
         *     salary: 1500
         * }
         * 
         * // Callback function to process errors
         * var myErrorCallback= function(event){
         *     console.log(event.target.error);
         * }
         * 
         * // If we want to change more than one property and we have an index named "names" with keypath 'name'.
         * idb.update.recordsByIndex(
         *     'databaseName', 
         *     'objectStoreName',
         *     'names', 
         *     'Peter', 
         *     ['age', 'salary'], // with one property the array is not necesary
         *     [33, 1650]        // with one property the array is not necesary
         * );
         *
         * 
         * idb.execTasks();
         */
        recordsByIndex: function(dbName, storeName, indexName, keyValue, property, newValue, errorCallback){

            var task = {
                type: 'updateRecordsByIndex',
                dbName: dbName,
                storeName: storeName,
                indexName: indexName,
                keyValue: keyValue,
                property: property,
                newValue: newValue,
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
         * Adds the task "get the last records from the object store" to the task queue.
         * @public
         * @instance
         * @param {strinf} dbName Database name.
         * @param {string} storeName Store name.
         * @param {number} maxResults Limits the records retrieved. 
         * @param {function} callback Callback called when done. Receives as parameter the retrieved records in an array.
         * @example
         * var idb = new sidb();
         * 
         * // An example of object stored in the object store
         * var person = {
         *     name: 'Peter',
         *     age: 32
         * }
         * 
         * // Callback function to process the results
         * var myCallback = function(resultsArray){
         *     var size = resultsArray.length();
         *     var i=0;
         *     for(i=0;i<size;i++){
         *         console.log('Name: ' + resultsArray[i].name + ' Age: ' + resultsArray[i].age + '\n');
         *     }
         * }
         * 
         * // This code adds the task "get the last 200 records from the object store" to the task queue
         * idb.get.lastRecords('databaseName', 'objectStoreName', 200, myCallback);
         * 
         * idb.execTasks();
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
         * Adds the task "get a record from the object store using a key value from an index" to the task queue.
         * @public
         * @instance
         * @param {string} dbName Database name.
         * @param {string} storeName Store name.
         * @param {string} indexName Index name.
         * @param {(null | conditionObject[] | any)} keyValue Contains the key value. Can be a conditionObject array, a individual value or null.
         * If it's null then returns all records from the index.
         * @param {function(object[])} callback Receives as parameter the result. Can be an object array or an object.
         * @example
         * var idb = new sidb();
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
         * // If there is an index named "ages" based on property "age", we can get a person with age = 32.
         * idb.get.records('databaseName', 'objectStoreName', 'ages', 32, myCallback);
         * 
         * // Or we can get persons with age > 30 and name! = Peter
         * idb.get.records('databaseName', 
         * 'objectStoreName', 
         * 'ages', 
         * [{keypath: 'age', cond: '>', 30}, {keypath: 'name', cond: '!=', 'Peter'}], //here key value is a conditionObject array
         * myCallback);
         * 
         * // Or we can get all records from the index
         * idb.get.records('databaseName', 'objectStoreName', 'ages', null, myCallback);
         * 
         * idb.execTasks();
         */
        records: function (dbName, storeName, indexName, keyValue, callback) {

            var task = {

                type: 'getRecords',
                dbName: dbName,
                storeName: storeName,
                indexName: indexName,
                keyValue: keyValue,
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
        pageFromArray: function (array, elementsPerPage, page) {
            console.log(Array.isArray(array));
            var pageArray = array.slice((page - 1) * elementsPerPage, page * elementsPerPage);
            return pageArray;
        }
    }

    /**
     * Executes pending tasks. The tasks are executed sequentially. A task does not run until the previous one ends. This avoids problems arising from the asynchronous nature of the indexedDB api.
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