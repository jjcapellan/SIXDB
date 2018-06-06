/** Test indexedDb */

var db, clientes, facturas, actualVersion;

var DBname;

var pendingStore = [];
var taskQueue = [];

// Flags
var dbOpened = false; // Database connection is opened

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



function isIndexedDBavailable() {
    var available = true;
    if (!('indexedDB' in window)) {
        console.log('This browser doesn\'t support IndexedDB');
        available = false;
    };
    return available;
}

function openDB(name, version) {

    var request = window.indexedDB.open(name, version);

    request.onerror = function (event) {
        alert("Why didn't you allow my web app to use IndexedDB?!");
    };

    request.onsuccess = function (event) {
        console.log('db opened');
        db = event.target.result;
        actualVersion = db.version;
        dbOpened = true;
    };

    request.onupgradeneeded = function (event) {
        db = event.target.result;
        actualVersion = db.version;

        if (typeof pendingStore[0] == 'string') {
            db.createObjectStore(pendingStore[0], {
                keyPath: pendingStore[1],
                autoIncrement: pendingStore[2]
            });

            console.log('New objectStore created');
            console.log(pendingStore);
            checkTasks();
        } else if (typeof pendingStore[0] == 'object') {
            var storesNumber = pendingStore.length;
            console.log(storesNumber);
            var i;
            for (i = 0; i < storesNumber; i++) {
                console.log(pendingStore[i]);
                db.createObjectStore(pendingStore[i][0], {
                    keyPath: pendingStore[i][1],
                    autoIncrement: pendingStore[i][2]
                });
            };
            checkTasks();

        };

        dbOpened = true;
    };
};

function closeDB() {
    if(dbOpened){
    db.close();
    console.log('db closed');
    dbOpened = false;
    }
};

function newObjStore(name, keyPath, autoincrement) {

    var task = {
        type: 'newStore',
        name: name,
        keyPath: keyPath,
        autoIncrement: autoincrement
    };

    taskQueue.push(task);

    checkTasks();
};

function newObjStores(storesArray) {

    var task = {
        type: 'newStores',
        objStores: storesArray
    };

    taskQueue.push(task);

    checkTasks();
};

function add(objStore, obj) {

    var task = {
        type: 'add',
        name: objStore,
        obj: obj
    };

    taskQueue.push(task);

};


function checkTasks() {

    if (taskQueue.length == 0) {
        return;
    };

    var type = taskQueue[0].type;

    console.log(type);

    switch (type) {

        case 'newStore':

            if (dbOpened) {
                pendingStore = [];
                pendingStore[0] = taskQueue[0].name;
                pendingStore[1] = taskQueue[0].keyPath;
                pendingStore[2] = taskQueue[0].autoIncrement;
                var newVersion = actualVersion + 1;
                var actualName = db.name;
                closeDB();
                console.log(taskQueue);
                taskQueue.shift();
                openDB(actualName, newVersion);
            } else {
                setTimeout(function () {
                    console.log('addObjStore retry');
                    checkTasks();

                }, 100);
            };
            break;

        case 'newStores':

            if (dbOpened) {
                pendingStore = [];
                pendingStore = taskQueue[0].objStores;
                var newVersion = actualVersion + 1;
                var actualName = db.name;
                closeDB();
                console.log(taskQueue);
                taskQueue.shift();
                openDB(actualName, newVersion);
            } else {
                setTimeout(function () {
                    console.log('addObjStores retry');
                    checkTasks();
                }, 100);
            };
            break;



        case 'add':

            if (dbOpened) {
                var objStore = taskQueue[0].name;
                var obj = taskQueue[0].obj;
                var store = db.transaction(objStore, "readwrite").objectStore(objStore);
                if (Array.isArray(obj)) {
                    var i, objSize;
                    objSize = obj.length;

                    for (i = 0; i < objSize; i++) {
                        store.add(obj[i]);
                    };
                    taskQueue.shift();
                    console.log('records added');

                } else {
                    store.add(obj);
                    taskQueue.shift();
                    console.log('record added');
                };
            } else {

                setTimeout(function () {
                    console.log('addRecord retry in 100ms');
                    checkTasks();
                }, 100);
            };
            break;


        default:
        console.log('idle');
            break;
    }

};



openDB('test', 1);
newObjStores([
    ['clientes', 'id', true],
    ['facturas', 'id2', true],
    ['albaranes', 'id3', true]
]);
add('clientes', arrayFacturas);
closeDB();