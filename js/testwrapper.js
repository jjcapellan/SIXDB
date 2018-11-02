
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
    idcliente: '2',
    importe: 490
};

var arrayFacturas = [{
    idcliente: 1,
    importe: 15
}, {
    idcliente: 1,
    importe: 460
}, {
    idcliente: 2,
    importe: 500
}, {
    idcliente: 5,
    importe: 800
}, {
    idcliente: 6,
    importe: 490
}];


// Commands using the indexedDB wrapper

var wrapper = new sidb();
var contenedor=[];

var callback1 = function (resultsArray) {
    var i = 0;
    console.log(resultsArray);
    for (i = 0; i < resultsArray.length; i++) {
        console.log('Idcliente: ' + resultsArray[i].idcliente + ' Importe: ' + resultsArray[i].importe + '\n');
    }
    //var array = wrapper.utils.pageFromArray(resultsArray,2,2);
    //console.log(array);
};

var callback2= function(event){
    console.log(event.target.error);
};



//wrapper.remove.db('test3');
//wrapper.get.allRecords('test3','campo1',2);

//wrapper.get.lastRecords('test','store1',2,callback1);
//wrapper.add.index('test', 'store1', 'cantidad', 'importe');

//wrapper.add.db('test');
//wrapper.add.store('test','store1');
//wrapper.add.index('test', 'store1', 'cantidad', 'importe');

//wrapper.add.records('test','store1',arrayFacturas);
//wrapper.get.recordsFiltered('test','store1','cantidad',
var conditions = [{keyPath: 'idcliente', cond: '>',value: 1},
{keyPath: 'importe', cond: '>',value: 499}];
//wrapper.add.records('test','store1',factura3);
//wrapper.indexKey('test','store1','cantidad',490,null);
//wrapper.get.lastRecords('test', 'store1',5,callback1);
//wrapper.remove.record('test','store1','cantidad',490);

//wrapper.get.recordsFiltered('test','store1','cantidad',
//[{keyPath: 'importe', cond: '>',value: 15}],callback1);

/*wrapper.update.recordsByIndex('test','store1','cantidad',
[{keyPath: 'idcliente', cond: '<', value: 2},{keyPath: 'importe', cond: '<', value: 460}],
['idcliente','importe'],[3,655]);*/

//wrapper.get.records('test','store1','cantidad',500,callback1);

wrapper.execTasks();
