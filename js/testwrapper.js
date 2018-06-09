
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
    importe: 15
}, {
    idcliente: '2',
    importe: 460
}, {
    idcliente: '2',
    importe: 500
}];


// Commands using the indexedDB wrapper

var wrapper = new sidb();

/*
add.db('test3');
add.db('test5');
add.store('test3', 'campo1', 'id', true);
add.store('test3', 'campo2', 'id', true);
add.records('test3', 'campo1', arrayFacturas);
remove.db('test5');
remove.store('test3', 'campo2');
remove.record('test3', 'campo1', 2);*/
//update.records('test3', 'campo1', 3, 'importe', 250);
//add.index('test3', 'campo1', 'indice1', 'importe');
//remove.index('test3','campo1','indice1');
wrapper.remove.db('test3');
wrapper.execTasks();