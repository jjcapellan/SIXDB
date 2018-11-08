/**
 *  Test the SIDB functionalities
 */

/** Data to use in the test
| ID | Name | Department    | Age | Salary
| --- |:--- | :--- | ---: | ---:
| 1 | Peter | manufacturing | 32 | 1200
| 2 | Paul | manufacturing | 27 | 900
| 3 | Adam | manufacturing | 38 | 1260
| 4 | Alice | accounting | 41 | 1400
| 5 | Alex | manufacturing | 33 | 1250
| 6 | Kathy | manufacturing | 28 | 1150
| 7 | David | accounting | 32 | 1380
| 8 | Mike | accounting | 61 | 1500
| 9 | Julia | manufacturing | 44 | 1100
 */

var employee = {
    id:1,
    name: 'Peter',
    department: 'manufacturing',
    age: 32,
    salary: 1200
}

var employeesArray = [
    {
        id:2,
        name: 'Paul',
        department: 'manufacturing',
        age: 27,
        salary: 900
    },
    {
        id:3,
        name: 'Adam',
        department: 'manufacturing',
        age: 38,
        salary: 1260
    },
    {
        id:4,
        name: 'Alice',
        department: 'accounting',
        age: 41,
        salary: 1400
    },
    {
        id:5,
        name: 'Alex',
        department: 'manufacturing',
        age: 33,
        salary: 1250
    },
    {
        id:6,
        name: 'Kathy',
        department: 'manufacturing',
        age: 28,
        salary: 1150
    },
    {
        id:7,
        name: 'David',
        department: 'accounting',
        age: 32,
        salary: 1380
    },
    {
        id:8,
        name: 'Mike',
        department: 'accounting',
        age: 61,
        salary: 1500
    },
    {
        id:9,
        name: 'Julia',
        department: 'manufacturing',
        age: 44,
        salary: 1600
    }
];


var tableResults = document.getElementById('tbl_results');



//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');

var store='southFactory';
var index='IDs';

showInfo("var mydb = new sidb('companyDB')");

//
// Creates object store named "southFactory" is created.
// 
mydb.add.store(store, successCallback, errorCallback);

// To create a new index we use add.index():
//
//     add.index( storeName, indexName, keyPath, errorCallback)
//
// Creates a single index named "IDs" with the keypath "ID"
//
mydb.add.index(store, index, 'id',successCallback,errorCallback);
mydb.execTasks();

// Insert one record (object employee) in the store "southFactory"
mydb.add.records(store,employee,successCallback,errorCallback);

mydb.get.records(store,index,1,successCallback,errorCallback);

mydb.add.records(store,employeesArray,successCallback,errorCallback);

mydb.get.lastRecords(store,null,successCallback,errorCallback);

mydb.get.records(store,index,1,successCallback,errorCallback);

mydb.get.records(store,null,'department=manufacturing & age > 30',successCallback,errorCallback);

mydb.get.records(store,null,'department="manufacturing" || salary > 1390',successCallback,errorCallback);

mydb.get.records(store,null,'(department="manufacturing" & salary > 1500) || (department!="manufacturing" & salary>1400)',successCallback,errorCallback);

mydb.update.records(store,index,4,{salary: 1450, age: 42},successCallback, errorCallback);

mydb.get.lastRecords(store,null,successCallback,errorCallback);

mydb.update.records(store,null,'department="accounting"',{salary: function(oldSalary){return oldSalary+200}},successCallback,errorCallback);

mydb.get.records(store,null,'department="accounting"',successCallback,errorCallback);

mydb.remove.index(store,index,successCallback,errorCallback);

mydb.remove.store(store,successCallback,errorCallback);

mydb.remove.db(successCallback,errorCallback);

mydb.execTasks();

showInfo('Test finished');



function successCallback(event, origin, query) {
    console.log(event);
    var message = origin + ' executed';
    if (query != null && query != undefined)
        message += ' with query: ' + query;
    showInfo(message);
    if (origin == 'lastRecords' || origin == 'getRecords') {
        showResults(event);
    };
}

function errorCallback(event,origin){
    var message = 'Error on method ' + origin;
    showInfo(message);
}


function showResults(results){
    if(!results){
        showInfo('No results');
        return;
    };

    if(Array.isArray(results)){
        if(!results[0]){
            console.log('results[0] es null.\n');
            console.log(results);
            return;
        }
        var keys = Object.keys(results[0]);
        //Headers
        var headerRow = document.createElement('tr');
        var i=0;
            for(i=0;i<keys.length;i++){
            var cell = document.createElement('th');
            cell.textContent=keys[i];
            headerRow.appendChild(cell);
            };
            tableResults.appendChild(headerRow);

        //Data rows
        for(i=0;i<results.length;i++){
            var row = document.createElement('tr');
            var j=0;
            for(j=0;j<keys.length;j++){
                var cell = document.createElement('td');
            cell.textContent=results[i][keys[j]];
            row.appendChild(cell);
            };
            tableResults.appendChild(row);            
        }
            
    } else {
        var keys = Object.keys(results);
        // Headers
        var headerRow = document.createElement('tr');
        var i=0;
            for(i=0;i<keys.length;i++){
            var cell = document.createElement('th');
            cell.textContent=keys[i];
            headerRow.appendChild(cell);
            };
            tableResults.appendChild(headerRow);
            //Data row
        var row = document.createElement('tr');
            for(i=0;i<keys.length;i++){
                var cell = document.createElement('td');
            cell.textContent=results[keys[i]];
            row.appendChild(cell);
            };
            tableResults.appendChild(row);
    }
}

function showInfo(message){
    var headerRow = document.createElement('tr');
    var cell=document.createElement('th');
    cell.setAttribute("colspan", 6);
    cell.textContent=message;
    headerRow.appendChild(cell);
    tableResults.appendChild(headerRow);
}
