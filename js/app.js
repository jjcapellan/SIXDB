/** Test indexedDb */

var db, clientes, facturas, actualVersion;

var DBname;

var qeueObjectStore = [];
var taskQeue=[];

// Flags
var addObjStoreWorking=false; // Function addObjStore is working
var dbOpened=false; // Database connection is opened

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


//// Comprueba si indexedDB está disponible
function isIndexedDBavailable() {
    var available = true;
    if (!('indexedDB' in window)) {
        console.log('This browser doesn\'t support IndexedDB');
        available = false;
    };
    return available;
}

//// Abre una base de datos
function openDB(name, version) {

    var request = window.indexedDB.open(name, version);

    request.onerror = function (event) {
        alert("Why didn't you allow my web app to use IndexedDB?!");
    };

    request.onsuccess = function (event) {
        console.log('succes');
        db = event.target.result;
        actualVersion = db.version;
        dbOpened=true;
    };

    request.onupgradeneeded = function (event) {
        db = event.target.result;
        actualVersion = db.version;
        if (qeueObjectStore[0] != undefined) {
            db.createObjectStore(qeueObjectStore[0], {
                keyPath: qeueObjectStore[1],
                autoIncrement: qeueObjectStore[2]
            });
            console.log('New objectStore created');
        };
        dbOpened=true;
    };
};


//// Cierra la base de datos
function closeDB() {
    db.close();
    dbOpened=false;
};



function addObjStore(name, keyPath, autoincrement) {
    
    /*addObjStoreWorking=true;

    if (db) {
        qeueObjectStore[0] = name;
        qeueObjectStore[1] = keyPath;
        qeueObjectStore[2] = autoincrement;
        var newVersion = actualVersion + 1;
        var actualName = db.name;
        closeDB();
        openDB(actualName, newVersion);
        addObjStoreWorking=false;
    } else {
        setTimeout(function () {
            addObjStore(name, keyPath, autoincrement);
            console.log('addObjStore retry');
        }, 200);
    };*/
    var task = {type: 'newStore', name: name, keyPath: keyPath, autoIncrement: autoincrement};

    taskQeue.push(task);


};



//// Añade registros a la base de datos. De uno en uno o un array.
function addRecord(objStore, obj) {
    if (!addObjStoreWorking && dbOpened) {
        var facturasObjectStore = db.transaction(objStore, "readwrite").objectStore(objStore);
        if (Array.isArray(obj)) {
            var i, objSize;
            objSize = obj.length;

            for (i = 0; i < objSize; i++) {
                facturasObjectStore.add(obj[i]);
            };

        } else {
            facturasObjectStore.add(obj);
            console.log('registro añadido');
        };
    } else {
        setTimeout(function () {
            addRecord(objStore, obj);
            console.log('addRecord retry');
        }, 200);
    };
};

openDB('test', 1);
addObjStore('clientes', 'id', true);
addRecord('clientes', cliente1);