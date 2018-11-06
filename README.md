# SIDB (simple indexedDB)  
  

SIDB is a basic and very easy to use library wrapper for indexedDB.  
IndexedDB is the recommended solution for the persistent storage of large volumes of structured data in the browser.  
But, IndexedDB lacks a query language, is asynchronous and can be complex to manage.  
SIDB adds an abstraction layer over indexedDB that hides that complexity.  

You can learn how to use SIDB in less than 5 minuts (or maybe 10 :)).


## In this document ...
***
* [Features](#Features)
* [Installation](#Installation)
* [Tutorial](#Tutorial)
    * [Database structure creation](#Database-structure-creation)
    * [Insert records](#Insert-records)
    * [Read records](#Read-records)
    * [Update records](#Update-records)
    * [Remove records](#Remove-records)
* [Query system](#Query-system)
* [Using functions as values](#Using-functions)

## <a name="Features"></a>Features
***
* Task queue system that manages all asynchronous operations.
* [Query system](#Query-system) based on groups of conditions (conditionObject[])
* Simple and flexible methods to perform CRUD operations.
* Insertion operations allow several entries to be entered at the same time.
* Update operations accept [functions as value](#Using-functions) to modify the current value of the record.
* Lightweight. SIDB takes less than 20Kb minified and less than 3Kb compressed with gzip.
* Default errorCallback in all methods. ErrorCallback parameter is optional.
* Complete documentation with examples.



## <a name="Installation"></a>Installation
***
Download "sidb.js" or the minified version "sidb.min.js" from src folder to your proyect folder and add a reference in your html:
```html
<script src = "sidb.js"></script>
```


## <a name="Tutorial"></a>Tutorial
***
For the tutorial we will use an employees list from a supposed factory:

| ID | Name | Department    | Age | Salary
| --- |:--- | :--- | ---: | ---:
| 1 | Peter | manufacturing | 32 | 1200
| 2 | Paul | manufacturing | 27 | 1150
| 3 | Adam | manufacturing | 38 | 1260
| 4 | Alice | accounting | 41 | 1400
| 5 | Alex | manufacturing | 33 | 1250
| 6 | Kathy | manufacturing | 28 | 1150
| 7 | David | accounting | 32 | 1380

Each row represents a record. IndexedDB treats records as objects where each property represents a column.  
These records are stored in an **object store**. The **object store** accepts objects of different types.  
I could store other record without age column and with a lastName column.

The **index** is a subset of records from the object store that share the same property (**keypath**).  
We could create at most an **index** for each property (column). The **index** order the records by its **keypath**.


### <a name="Database-structure-creation"></a>**Database structure creation**

```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// We need to create at least one object store. 
// The object store is used to store the records (objects). It's similar to a table in a relational database.
// SIDB adds an autoincrement primary key (named "nid") to each store.
// To create it we need the method add.store():
//
//     add.store( storeName, errorCallback)
//
// In this case one object store named "southFactory" is created.
// 
mydb.add.store('southFactory');


//
// It's a good idea to create one or more indexes for each store to order and filter the records (objects).
// The index keypath is the object property used to select and order the objects.
// Those objects that hasn't the index keypath as property will not be included in the index.
// Using an index we can avoid querying all the object store and losing performance.
// To create a new index we use add.index():
//
//     add.index( storeName, indexName, keyPath, errorCallback)
//
// In this case we create a single index named "IDs" with the keypath "ID"
//
mydb.add.index('southFactory', 'IDs', 'ID');



// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```


### <a name="Insert-records"></a>**Insert records**
With SIDB we can insert records individually or through an objects array.

```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// To insert one or more records is used add.records():
//
//     add.records( storeName, obj, errorCallback)
//
// Inserts one record in "southFactory" object store.
//
mydb.add.records(
    'southFactory',                                                             // Object store name.
    {ID: 1, name: 'Peter', department: 'manufacturing', age: 32, salary: 1200}  // A single object that represents a record.
);


//
// Inserts 6 records in "southFactory" object store using an objects array.
//
mydb.add.records(
    'southFactory',
    [
        {ID: 2, name: 'Paul', department: 'manufacturing', age: 27, salary: 1150},
        {ID: 3, name: 'Adam', department: 'manufacturing', age: 38, salary: 1260},
        {ID: 4, name: 'Alice', department: 'accounting', age: 41, salary: 1400},
        {ID: 5, name: 'Alex', department: 'manufacturing', age: 33, salary: 1250},
        {ID: 6, name: 'Kathy', department: 'manufacturing', age: 28, salary: 1150},
        {ID: 7, name: 'David', department: 'accounting', age: 32, salary: 1380}
    ]
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```

### <a name="Read-records"></a>**Read records**
SIDB can read the records using two methods and 5 types of query.

```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// To get the last records we use get.lastRecords():
//
//     get.lastRecords( storeName, maxResults, succesCallback, errorCallback)
//
// Reads the 5 last records from "southFactory" object store.
// The third parameter is a function that will receive the result of the query.
//
mydb.get.lastRecords(
    'southFactory',         // Object store name
    5,                      // Max number of records retrieved
    readerCallback          // Function to handle the results
);


//
// With the second parameter null, reads all records from "southFactory" object store. 
//
mydb.get.lastRecords(
    'southFactory', 
    null, 
    readerCallback
);


//
// The method get.records() lets us use querys:
//
//     get.records( storeName, indexName, query, succesCallback, errorCallback)
//
// Gets the record with ID "2" from the index "IDs" in store "southFactory".
// If you replace 'Adam' with null then the query sends all index records to the function readerCallback
//
mydb.get.records(
    'southFactory',         // Object store name
    'IDs',                  // Index name
    2,                      // Query. A single value refers to the index keyPath.
    readerCallback
);


//
// Gets employees records from manufacturing department with a salary higher than 1200.
// Here the third parameter (query) is an "conditionObject" array that acts as a filter.
// The query can't be a single value if the index is null.
//
mydb.get.records(
    'southFactory', 
    null,
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
// The result received can be a single object or an object array. 
// 
//
function readerCallback(queryResult) {
    var i = 0;
    if(Array.isArray(queryResult)){
        for (i = 0; i < queryResult.length; i++) {
            console.log(
             'ID: ' + queryResult[i].ID +
             'Name: ' + queryResult[i].name +
             'Department: ' + queryResult[i].department + 
             'Age: '+ queryResult[i].age +
             'Salary: '+ queryResult[i].salary
             );
        };
    } else {
        console.log(
         'ID: ' + queryResult.ID +
         'Name: ' + queryResult.name +
         'Department: ' + queryResult.department + 
         'Age: '+ queryResult.age +
         'Salary: '+ queryResult.salary
         );
    };
};
```

### <a name="Update-records"></a>**Update records**
The method update.records() allows us to update the records in many ways.
```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// We only need one method to update one or more records:
//
//     update.records( storeName, indexName, query, objectValues, errorCallback)
//
// This simple example changes the salary and age of an employee with ID 2 using the index 'IDs'.
//
mydb.update.records(
    'southFactory',             // Object store name
    'IDs',                      // Index name
    2,                          // The query can be a single value (refers to index) or an conditionObject array
    {salary: 1290, age: 39},    // Object with the new values
    myErrorCallback             // Optional function to handle errors
);


//
// Updates the salary of all records where department is manufacturing and age > 30.
// Here a conditionObject array is used as query. The index is null so all the store object is queried.
//
mydb.update.records(
    'southFactory',                                                     // Object store name
    null,                                                               // Index name is null so query can't be a single value
    [                                                                   // Query. In this case a conditionObject[]
        {keyPath: 'department', cond: '=', value: 'manufacturing'},     //
        {keyPath: 'age', cond: '>', value: 30}                          //
    ],
    {salary: 1300},                                                     // Object with the new values
    myErrorCallback                                                     // Optional function to handle errors
);


//
// The object values parameter accepts functions as value whose receives the old value an returns the new value.
// Here all salaries from manufacturing department are increased by 300.
//
mydb.update.records(
    'southFactory',
    null,
    [
        {keyPath: 'department', cond: '=', value: 'manufacturing'}
    ],
    {salary: function(oldSalary){return oldSalary + 300;}},             // A function is used as new value
    myErrorCallback
);


//
// Example of a simple error callback
//
function myErrorCallback(event){
    console.log('Error updating records: ' + event.target.error);
};


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```

### <a name="Remove-records"></a>**Remove records**
SIDB has the method remove.records() for this case.
```javascript
//
// First step is instantiate an sidb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sidb('companyDB');


//
// To remove one or more records there is the method remove.records():
//
//     remove.records( storeName, indexName, query, errorCallback)
//
// For eample, this removes the record with ID 5 from the object store "southFactory"
//
mydb.remove.records(
    'southFactory',     // Object store name
    'IDs',              // Index name
    5,                  // Query. A single value refers to the index keypath.
    myErrorCallback     // Optional parameter. Function to handle errors.                     
);


//
// Removes all records from manufacturing department with salaries highter than 1200 
//
mydb.remove.records(
    'southFactory',
    null,
    [
        {keyPath: 'department', cond: '=', value: 'manufacturing'},
        {keyPath: 'salary', cond: '>', value: 1200}
    ]
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```



## <a name="Query-system"></a>Query system (conditionObject)
***
Some SIDB methods receive as parameter conditionsObject arrays to make complex queries.  
The conditionObject has three properties:
* **keyPath** (The property to be checked) 
* **cond** (The condition operator (>,<,=,>=,<=,!=))
* **value** (The value to test the keyPath)  
Example:
```javascript
//
// Array with 2 conditionObjects.
// The method that receives this query will select the records with department='manufacturing' and salary>1200.
//
var query = [
    {keyPath: 'department', cond: '=', value: 'manufacturing'},
    {keyPath: 'salary', cond: '>', value: '1200'}
];
```



## <a name="Using-functions"></a>Using functions as values
***
SIDB allows send a function in a query to modify records value.  
To do this, we will consider the function as if it were the new value in the update.records() method.  
This function will receive the current record value as a parameter and return the new value.

```javascript
//
// The object values parameter accepts functions as value whose receives the old value an returns the new value.
// Here all salaries from manufacturing department are increased by 300.
//
mydb.update.records(
    'southFactory',
    null,
    [
        {keyPath: 'department', cond: '=', value: 'manufacturing'}
    ],
    {salary: function(oldSalary){return oldSalary + 300;}},             // A function is used as new value
    myErrorCallback
);
```


