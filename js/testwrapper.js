
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
var contenedor=[];

var callback1 = function(resultsArray){
    console.log(resultsArray);
};

var callback2= function(event){
    console.log(event.target.error);
};

/*

//wrapper.remove.db('test3');
//wrapper.get.allRecords('test3','campo1',2);
/*wrapper.add.db('test');
wrapper.add.store('test','store1','id',true);
wrapper.add.records('test','store1',arrayFacturas);*/
//wrapper.get.lastRecords('test','store1',2,callback1);
//wrapper.add.index('test', 'store1', 'cantidad', 'importe');
//wrapper.get.recordsByIndex('test','store1','cantidad',{min: 400},callback1);
wrapper.add.store('test20','store6');
wrapper.add.store('test20','store7');
wrapper.add.store('test20','store8');
wrapper.add.store('test20','store9');
wrapper.execTasks();
