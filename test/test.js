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
  name: 'Peter',
  department: 'manufacturing',
  age: 32,
  salary: 1200
};

// An array of objects to save in the database
var employeesArray = [
  {
    name: 'Paul',
    department: 'manufacturing',
    age: 27,
    salary: 900
  },
  {
    name: 'Adam',
    department: 'manufacturing',
    age: 38,
    salary: 1260
  },
  {
    name: 'Alice',
    department: 'accounting',
    age: 41,
    salary: 1400
  },
  {
    name: 'Alex',
    department: 'manufacturing',
    age: 33,
    salary: 1250
  },
  {
    name: 'Kathy',
    department: 'manufacturing',
    age: 28,
    salary: 1150
  },
  {
    name: 'David',
    department: 'accounting',
    age: 32,
    salary: 1380
  },
  {
    name: 'Mike',
    department: 'accounting',
    age: 61,
    salary: 1500
  },
  {
    name: 'Juliana',
    department: 'manufacturing',
    age: 44,
    salary: 1600
  }
];

// HTML element to show the resuls
var tableResults = document.getElementById('tbl_results');

// True if there are not errors
var failed = false;

//
// First step is instantiate a Sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//
var mydb = new Sixdb('companyDB');

// Activate this line to turn off the console output
// mydb.setConsoleOff(true);

// Creates a new object store named "southFactory"
mydb.newStore('southFactory', {
  keyPath: 'id',
  autoIncrement: true,
  successCallback: successCallback,
  errorCallback: errorCallback
});


// Stores "southFactory" in a variable
var myStore = mydb.openStore('southFactory');


// Creates a new index named "Names" with keyPath "name"
myStore.newIndex('Names', 'name', {
  successCallback: successCallback,
  errorCallback: errorCallback
});

var myIndex = myStore.openIndex('Names');

// Inserts one object in store "southFactory"
myStore.add(employee, { successCallback: successCallback, errorCallback: errorCallback });



// Inserts an array of objects in the store
myStore.add(employeesArray, {
  successCallback: successCallback,
  errorCallback: errorCallback
});

// Gets all records
myStore.getAll(successCallback, errorCallback);

// Creates other store with an index and some records to test join operation
mydb.newStore('production', {
  keyPath: 'reportId',
  autoIncrement: true,
  successCallback: successCallback,
  errorCallback: errorCallback
});
var productionStore = mydb.openStore('production');
productionStore.newIndex('employeeIds', 'employeeId', {
  successCallback: successCallback,
  errorCallback: errorCallback
});
productionStore.add([
  {employeeId: 2, production: 120},
  {employeeId: 2, production: 110},
  {employeeId: 5, production: 150},
  {employeeId: 2, production: 180},
  {employeeId: 5, production: 100},
  {employeeId: 5, production: 90},
  {employeeId: 9, production: 200},
  {employeeId: 2, production: 85}
], { successCallback: successCallback, errorCallback: errorCallback });

// Join operation
mydb.join({
  store1Name: 'southFactory',
  store2Name: 'production',
  indexName: 'employeeIds',
  successCallback: successCallback,
  errorCallback: errorCallback
});


// Gets all records in index "Names"
myIndex.getAll(successCallback, errorCallback);

// Gets records with salary > 1200
myStore.get('salary > 1200', successCallback, errorCallback);

// Gets records with salary > 1200 in index "Names"
myIndex.get('salary > 1200', successCallback, errorCallback);

// Gets record with primary key = 4
myStore.get(4, successCallback, errorCallback);

// Counts records in manufacturing department
myStore.count(successCallback, {
  query: 'department = manufacturing',
  errorCallback: errorCallback
});

// Counts all records in the store
myStore.count(successCallback);

// Counts all records in the index
myIndex.count(successCallback);

// Counts records in manufacturing department in index
myIndex.count(successCallback, {
  query: 'department = manufacturing',
  errorCallback: errorCallback
});

mydb.customTask(showInfo, this, 'Sum of salaries');
// Sum of salaries
myStore.aggregateFn('salary', mydb.aggregateFuncs.sum, successCallback, {
  errorCallback: errorCallback
});
// Sum of salaries in index 'Names'
myIndex.aggregateFn('salary', mydb.aggregateFuncs.sum, successCallback, {
  errorCallback: errorCallback
});

mydb.customTask(showInfo, this, 'Sum of salaries from manufacturing department');
// Sum of salaries of manufacturing department
myStore.aggregateFn('salary', mydb.aggregateFuncs.sum, successCallback, {
  query: 'department = manufacturing',
  errorCallback: errorCallback
});
// Sum of salaries of manufacturing department
myIndex.aggregateFn('salary', mydb.aggregateFuncs.sum, successCallback, {
  query: 'department = manufacturing',
  errorCallback: errorCallback
});

// Updates salary an age of the record with id = 4
myStore.update(
  4,
  { age: 42, salary: 1450 },
  { successCallback: successCallback, errorCallback: errorCallback }
);

// Gets all records from store
myStore.getAll(successCallback, errorCallback);

// Increases salary of manufacturing department in 100 using a function
myStore.update(
  'department = manufacturing',
  {
    salary: function(oldSalary) {
      return oldSalary + 100;
    }
  },
  { successCallback: successCallback, errorCallback: errorCallback }
);

// Gets all records from store
myStore.getAll(successCallback, errorCallback);

// Deletes record with primary key = 3;
myStore.del(3, { successCallback: successCallback, errorCallback: errorCallback });

// Gets all records
myStore.getAll(successCallback, errorCallback);

// Deletes records with salary > 1500
myStore.del('salary > 1500', {
  successCallback: successCallback,
  errorCallback: errorCallback
});

// Gets all records
myStore.getAll(successCallback, errorCallback);

// Clear store
myStore.clear({successCallback, errorCallback});

// Gets all records
myStore.getAll(successCallback, errorCallback);

// Deletes index "Names" from store
myStore.delIndex('Names', { successCallback: successCallback });

// Deletes store "southFactory"
mydb.delStore('southFactory', { successCallback: successCallback });

// Deletes database
mydb.destroy({ successCallback: successCallback });

// Sends a custom task
mydb.customTask(checkTest, this);

mydb.execTasks();

//
//Custom Functions
/////////////////////////////////////////////////////////////////////////////////////////////////

function successCallback(result, origin, query) {
  var message = origin + ' executed';
  if (query) message += ' with query: ' + query;
  showInfo(message);

  if (
    origin.indexOf('get') >= 0 ||
    (origin.indexOf('count') > 0 || origin.indexOf('aggregate') > 0)
  ) {
    showResults(result);
  }
}

function errorCallback(error) {
  failed = true;
  showInfo(error.origin + ' // ' + error.description, true);
}

function checkTest() {
  var message = '';
  if (failed) {
    message = 'Test failed';
    showInfo(message, true);
  } else {
    message = 'Test passed';
    showInfo(message);
  }
}

function showResults(results) {
  if (!results) {
    showInfo('No results');
    return;
  }
  var cell= null;
  var keys = null;
  var headerRow = null;
  var row = null;
  var i,j,k,l;

  if (Array.isArray(results)) {
    if (!results[0]) {
      console.log('results[0] es null.\n');
      console.log(results);
      return;
    }
    keys = Object.keys(results[0]);
    //Headers
    headerRow = document.createElement('tr');
    for (i = 0; i < keys.length; i++) {
      cell = document.createElement('th');
      cell.textContent = keys[i];
      headerRow.appendChild(cell);
    }
    tableResults.appendChild(headerRow);

    //Data rows
    for (i = 0, j = results.length; i < j; i++) {
      row = document.createElement('tr');
      for (k = 0, l = keys.length; k < l; k++) {
        cell = document.createElement('td');
        cell.textContent = results[i][keys[k]];
        row.appendChild(cell);
      }
      tableResults.appendChild(row);
    }
  } else {
    if (typeof results == 'object') {
      keys = Object.keys(results);
      // Headers
      headerRow = document.createElement('tr');
      for (i = 0, j = keys.length; i < j; i++) {
        cell = document.createElement('th');
        cell.textContent = keys[i];
        headerRow.appendChild(cell);
      }
      tableResults.appendChild(headerRow);
      //Data row
      row = document.createElement('tr');
      for (i = 0, j = keys.length; i < j; i++) {
        cell = document.createElement('td');
        cell.textContent = results[keys[i]];
        row.appendChild(cell);
      }
      tableResults.appendChild(row);
    } else {
      row = document.createElement('tr');
      cell = document.createElement('td');
      cell.textContent = results;
      row.appendChild(cell);
      tableResults.appendChild(row);
    }
  } //end else
}

function showInfo(message, error) {
  var headerRow = document.createElement('tr');
  var cell = document.createElement('th');
  cell.setAttribute('colspan', 8);
  if (error) {
    cell.style.backgroundColor = 'red';
  }
  cell.textContent = message;
  headerRow.appendChild(cell);
  tableResults.appendChild(headerRow);
}
