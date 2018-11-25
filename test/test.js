/**
 *  Test the SIXDB functionalities
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
| 9 | Juliana | manufacturing | 44 | 1100
 */

 // An object to save in the database
var employee = {
    id:1,
    name: 'Peter',
    department: 'manufacturing',
    age: 32,
    salary: 1200
};

// An array of objects to save in the database
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
        name: 'Juliana',
        department: 'manufacturing',
        age: 44,
        salary: 1600
    }
];

// HTML element to show the resuls
var tableResults = document.getElementById('tbl_results');

//Object store name
var store = /*'southFactory'*/'southFactory';

// Index name
var index = 'IDs';

// True if there are not errors
var failed = false;



//
// First step is instantiate a sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sixdb('companyDB');

// Example of custom comparison operator (represented in querys by "~~")
mydb.setCustomOperator(function(value1,value2){
    return (value1.length == value2.length);
});

// Activate this line to turn off the console output
// mydb.setConsoleOff(true);

// Creates a store named 'southFactory'
mydb.add.store(store, {successCallback: successCallback, errorCallback: errorCallback});

// Creates an index named 'IDs'
mydb.add.index(store, index, 'id', {successCallback: successCallback, errorCallback: errorCallback});

// Insert one object
mydb.add.records(store, employee, {successCallback: successCallback, errorCallback: errorCallback});

/*Insert a totally different object
mydb.add.records(store, {
    model: 'large',
    power: 500
}, successCallback, errorCallback);*/

// Gets the record with id = 1
mydb.get.records(store, successCallback, { indexName: index, query: 1, errorCallback: errorCallback});

// Insert an array of objects
mydb.add.records(store, employeesArray, {successCallback: successCallback, errorCallback: errorCallback});

// Execs the custom task showInfo 
mydb.add.customTask(showInfo, this, 'Custom task executed');

// Gets all records
mydb.get.lastRecords(store, null, successCallback, errorCallback);

// Gets all records
mydb.get.records(store, successCallback, {errorCallback: errorCallback});

// Sum of salaries
//mydb.get.sum(store, 'salary', successCallback, {errorCallback: errorCallback});
mydb.get.aggregateFn(store,'salary',mydb.aggregateFuncs.sum, successCallback, {errorCallback: errorCallback});

// Sum of salaries with index
mydb.get.aggregateFn(store, 'salary', mydb.aggregateFuncs.sum , successCallback, {errorCallback: errorCallback, indexName: index});

// Sum of salaries with index and query
mydb.get.aggregateFn(store, 'salary', mydb.aggregateFuncs.sum, successCallback, {errorCallback: errorCallback, indexName: index, query: 'name ^ Al'});

// Sum of salaries with index and indexKey
mydb.get.aggregateFn(store, 'salary', mydb.aggregateFuncs.sum, successCallback, {errorCallback: errorCallback, indexName: index, query: 3});

// Average of salaries
mydb.get.aggregateFn(store, 'salary', mydb.aggregateFuncs.avg, successCallback ,successCallback, {errorCallback: errorCallback});

// Average of salaries with index and query
mydb.get.aggregateFn(store, 'salary',mydb.aggregateFuncs.avg, successCallback, {errorCallback: errorCallback, indexName: index, query: 'name ^ Al'});

// Max of salaries
mydb.get.aggregateFn(store, 'salary',mydb.aggregateFuncs.max, successCallback, {errorCallback: errorCallback});

// Min of salaries
mydb.get.aggregateFn(store, 'salary', mydb.aggregateFuncs.min, successCallback, {errorCallback: errorCallback});

// Longest name with custom aggregate function
mydb.get.aggregateFn(
    store,
    'name',
    function (actual, selected, counter) {
        if (counter == 1)
            actual = selected;
        return actual.length < selected.length ? selected : actual;
    },
    successCallback,
    { errorCallback: errorCallback, query: 'salary > 900' }
);

// Gets records wich name contains "ul" with index
mydb.get.records(store, successCallback, {indexName: index, query: 'name <> ul', errorCallback: errorCallback});

// Gets records wich name starts with "al"
mydb.get.records(store, successCallback, {query: 'name ^ Al', errorCallback: errorCallback});

// Gets records wich name ends with "e"
mydb.get.records(store, successCallback, {query: 'name $ e', errorCallback: errorCallback});

// Gets records wich name have same number of characters than "Mary" (custom operator)
mydb.get.records(store, successCallback, {query: 'name ~~ Mary', errorCallback: errorCallback});

// Gets records using a query of 2 conditions and logical operator &
mydb.get.records(store, successCallback, {query: 'department = manufacturing & age > 30', errorCallback: errorCallback});

// Gets records using a query with quotes and the logical operator ||
mydb.get.records(store, successCallback, {query: 'department= "manufacturing" || salary > 1390', errorCallback: errorCallback});

//Counts records
mydb.get.count(store, successCallback, {query: 'salary > 1000'});

//Counts records
mydb.get.count(store, successCallback, {indexName: index, query: 'id = 3'});

//Counts all records in store
mydb.get.count(store, successCallback, {});

//Counts all records in index
mydb.get.count(store, successCallback, {indexName: index});

// Query with 2 sets of conditions
mydb.get.records(store, successCallback, 
{query: '(department="manufacturing" & salary > 1500) || (department!="manufacturing" & salary>1400)', errorCallback: errorCallback});

// Updates salary an age of the record with id = 4
mydb.update.records(store, 4, { salary: 1450, age: 42 }, {indexName: index, successCallback: successCallback, errorCallback: errorCallback});

// Gets all records
mydb.get.lastRecords(store, null, successCallback, errorCallback);

// Updates the salary of records with accounting department using a function
mydb.update.records(store,
    'department="accounting"',
    { salary: function (oldSalary) { return oldSalary + 200 } },
    { successCallback: successCallback, errorCallback: errorCallback });

// Gets the records from the accounting department
mydb.get.records(store, 
    successCallback, 
    { query: 'department="accounting"', errorCallback: errorCallback });

// Delete the record wich id = 4
mydb.del.records(store, 4, {indexName: index, successCallback: successCallback, errorCallback: errorCallback});

// Gets all records
mydb.get.lastRecords(store, null, successCallback, errorCallback);

// Delete records with a query
mydb.del.records(store, 'salary>1300', {indexName: index, successCallback: successCallback, errorCallback: errorCallback});

// Gets all records
mydb.get.lastRecords(store, null, successCallback, errorCallback);

// Deletes a index
mydb.del.index(store, index, {successCallback: successCallback, errorCallback: errorCallback});

// Deletes a store
mydb.del.store(store, {successCallback: successCallback, errorCallback: errorCallback});

// Deletes the database
mydb.del.db({successCallback: successCallback, errorCallback: errorCallback});

// Sends a custom task
mydb.add.customTask(checkTest, this);

// Execs all pending task
mydb.execTasks();


//
//Custom Functions
/////////////////////////////////////////////////////////////////////////////////////////////////


function successCallback(result, origin, query) {
  var message = origin + " executed";
  if (query) message += " with query: " + query;
  showInfo(message);

  if (/*origin == "get -> lastRecords(...)" || origin == "get -> getRecords(...)" || */ origin.indexOf('get')==0) {
    showResults(result);
  }
}

function errorCallback(error){
    failed = true;
    showInfo(error.origin+' // '+ error.description,true);
};

function checkTest() {
    if (failed) {
        message = 'Test failed';
        showInfo(message, true);
    }
    else {
        message = 'Test passed';
        showInfo(message);
    };
}

function showResults(results) {
    if (!results) {
        showInfo('No results');
        return;
    };

    if (Array.isArray(results)) {
        if (!results[0]) {
            console.log('results[0] es null.\n');
            console.log(results);
            return;
        }
        var keys = Object.keys(results[0]);
        //Headers
        var headerRow = document.createElement('tr');
        var i = 0;
        for (i = 0; i < keys.length; i++) {
            var cell = document.createElement('th');
            cell.textContent = keys[i];
            headerRow.appendChild(cell);
        };
        tableResults.appendChild(headerRow);

        //Data rows
        for (i = 0; i < results.length; i++) {
            var row = document.createElement('tr');
            var j = 0;
            for (j = 0; j < keys.length; j++) {
                var cell = document.createElement('td');
                cell.textContent = results[i][keys[j]];
                row.appendChild(cell);
            };
            tableResults.appendChild(row);
        }

    } else {
        if(typeof(results)=='object'){
                
            var keys = Object.keys(results);
            // Headers
            var headerRow = document.createElement('tr');
            var i = 0;
            for (i = 0; i < keys.length; i++) {
                var cell = document.createElement('th');
                cell.textContent = keys[i];
                headerRow.appendChild(cell);
            };
            tableResults.appendChild(headerRow);
            //Data row
            var row = document.createElement('tr');
            for (i = 0; i < keys.length; i++) {
                var cell = document.createElement('td');
                cell.textContent = results[keys[i]];
                row.appendChild(cell);
            };
            tableResults.appendChild(row);
        } else {
            var row = document.createElement('tr');
            var cell = document.createElement('td');
            cell.textContent = results;
            row.appendChild(cell);
            tableResults.appendChild(row);
        }
        
    }//end else
}

function showInfo(message,error) {
    var headerRow = document.createElement('tr');
    var cell = document.createElement('th');
    cell.setAttribute("colspan", 6);
    if(error){
        cell.style.backgroundColor='red';
    };
    cell.textContent = message;
    headerRow.appendChild(cell);
    tableResults.appendChild(headerRow);
}
