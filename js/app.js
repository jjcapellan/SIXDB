/** Test indexedDb */


var taskQueue = [];

//Objetos que queremos guardar en la base de datos

var cliente1 = {
    nombre: 'Antonio',
    telefono: '986585254'
};
var cliente2 = {
    nombre: 'Manolo',
    telefono: '600124512'
};
var factura1 = {
    idcliente: '1',
    importe: 120
};
var factura2 = {
    idcliente: '2',
    importe: 320
};
var factura3 = {
    idcliente: '1',
    importe: 145
};

var arrayFacturas = [{
    idcliente: '1',
    importe: '15'
}, {
    idcliente: '2',
    importe: '460'
}, {
    idcliente: '2',
    importe: '500'
}];

var add = {

    db: function (dbName) {

        var task = {
            type: 'newDB',
            dbName: dbName
        };

        taskQueue.push(task);

        checkTasks();

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

        checkTasks();

    },

    records: function (dbName, storeName, obj) {

        var task = {
            type: 'newRecords',
            dbName: dbName,
            storeName: storeName,
            obj: obj
        };

        taskQueue.push(task);

        checkTasks();

    }
}

function isIndexedDBavailable() {
    var available = true;
    if (!('indexedDB' in window)) {
        console.log('This browser doesn\'t support IndexedDB');
        available = false;
    };
    return available;
}

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
            console.log('New objectStore ' + storeName + ' created');
            taskQueue.shift();
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


function checkTasks() {

    if (taskQueue.length == 0) {
        return;
    };

    var type = taskQueue[0].type;
    var task = taskQueue[0];

    console.log(type);

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

        default:
            console.log('No pending tasks');
            break;
    }

};




/*openDB('test', 1);
newObjStores([
    ['clientes', 'id', true],
    ['facturas', 'id2', true],
    ['albaranes', 'id3', true]
]);
add('clientes', arrayFacturas);
closeDB();*/

//newDB('test2');
/*setTimeout(function(){ 
    newStore('test2','Campo1','id',true);
},3000);*/

newRecord('test2', 'Campo1', arrayFacturas);