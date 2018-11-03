# SIDB (simple indexedDB)
SIDB is a basic and very easy to use library wrapper for indexedDB.
SIDB uses a task queue to eliminate potential problems derived from the asynchronous nature of indexedDB.

## How to use

### Database structure creation

```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// We need to create at least one object store. An object store is used to store the records (objects).
// An object store is similar to a relational database table.
// We can add an alternative error callback as second parameter.
// In this case one object store named "southFactory" is created.
// 
mydb.add.store('southFactory');


//
// Each store needs one or more index to order and filter the records (objects).
// The index keypath is the object property used to select and order the objects.
// Those objects that hasn't the index keypath as property will not be included in the index.
// In this case we create a single index named "names" with the keypath "name"
// You can include an alternative error callback as fourth parameter.
//
mydb.add.index('southFactory', 'names', 'name');



// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```


### Insert records
With SIDB we can insert records individually or through an objects array. 

```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// Inserts one record in "southFactory" object store
//
mydb.add.records('southFactory',
{name: 'Peter', department: 'manufacturing', age: 32, salary: 1200} // A single object that represents a record
);


//
// Inserts 6 records in "southFactory" object store
//
mydb.add.records('southFactory',
[
    {name: 'Paul', department: 'manufacturing', age: 27, salary: 1150},
    {name: 'Adam', department: 'manufacturing', age: 38, salary: 1260},
    {name: 'Alice', department: 'accounting', age: 41, salary: 1400},
    {name: 'Alex', department: 'manufacturing', age: 33, salary: 1250},
    {name: 'Kathy', department: 'manufacturing', age: 28, salary: 1150},
    {name: 'David', department: 'accounting', age: 32, salary: 1380}
]
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```

### Read records
SIDB can read the records using 5 types of query.

```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// Reads the 5 last records from "southFactory" object store.
// The third parameter is a function that will receive the result of the query.
//
mydb.get.lastRecords('southFactory', 5, readerCallback);


//
// With the second parameter null reads all records from "southFactory" object store. 
//
mydb.get.lastRecords('southFactory', null, readerCallback);


//
// Gets the record with name "Adam" from the index "names" in store "southFactory".
// If you replace 'Adam' with null then the query sends all index records to the function readerCallback
//
mydb.get.records('southFactory', 'names', 'Adam', readerCallback);


//
// Gets employes records from manufacturing department with a salary higher than 1200.
// Here the second parameter is an "conditionObject" array that acts as a filter. 
//
mydb.get.records('southFactory', 'names',
[
    {keyPath: 'department', cond: '=', value: 'manufacturing'},
    {keyPath: 'salary', cond: '>', value: '1200'}
]
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();


//
// Simple function that receives the query result from SIDB methods and show it on console.
// The result can be a single object or an object array.
// 
//
function readerCallback(queryResult) {
    var i = 0;
    if(Array.isArray(queryResult)){
        for (i = 0; i < queryResult.length; i++) {
            console.log(
             'Name: ' + queryResult[i].name +
             'Department: ' + queryResult[i].department + 
             'Age: '+ queryResult[i].age +
             'Salary: '+ queryResult[i].salary
             );
        };
    } else {
        console.log(
         'Name: ' + queryResult.name +
         'Department: ' + queryResult.department + 
         'Age: '+ queryResult.age +
         'Salary: '+ queryResult.salary
         );
    };
};
```

### Update records














## Used tools
This app was developed using **Visual Studio Code**, **Mongoose** as server and **Chrome** for debugging the code.
No framework was used, simply html5, css and pure javascript.
