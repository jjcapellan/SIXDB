/** Test indexedDb */

var sidb = function(){

    //// Private ////////////////////////////////////

    // Stores pending tasks
    var taskQueue = [];
    // True when taskQueue is empty
    var idle = true;

    var t = this;

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
    }
    
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
    }
    
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
    }
    
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
    }
    
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
    
            default:
                break;
        }
    
    }; 
    
    //// Public //////////////////////////////////

    this.add = {

        db: function (dbName) {
    
            var task = {
                type: 'newDB',
                dbName: dbName
            };
    
            taskQueue.push(task);
    
        },
    
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
    
        records: function (dbName, storeName, obj) {
    
            var task = {
                type: 'newRecords',
                dbName: dbName,
                storeName: storeName,
                obj: obj
            };
    
            taskQueue.push(task);
    
        },
    
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
    }
    
    this.remove = {
    
        db: function (dbName) {
    
            var task = {
                type: 'removeDB',
                dbName: dbName
            };
    
            taskQueue.push(task);
    
        },
    
        store: function (dbName, storeName) {
            var task = {
                type: 'removeStore',
                dbName: dbName,
                storeName: storeName
            };
    
            taskQueue.push(task);
        },
    
        record: function (dbName, storeName, recordKey) {
            var task = {
                type: 'removeRecord',
                dbName: dbName,
                storeName: storeName,
                recordKey: recordKey
            };
    
            taskQueue.push(task);
        },
    
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
    
    this.update = {
    
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
    }
    
    this.get = {
    
        records: function (dbName, storeName, minKey, maxKey) {
    
            var task = {
                type: 'getRecords',
                dbName: dbName,
                storeName: storeName,
                minKey: minKey,
                maxKey: maxKey
            };
    
            taskQueue.push(task);
    
        }
    }

    this.execTasks= function() {
        if (idle) {
            checkTasks();
        };
    };

    this.isIndexedDBavailable = function() {
        var available = true;
        if (!('indexedDB' in window)) {
            console.log('This browser doesn\'t support IndexedDB');
            available = false;
        };
        return available;
    }

}













