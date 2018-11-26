# SIXDB (simple indexedDB)  



![GitHub tag (latest by date)](https://img.shields.io/github/tag-date/jjcapellan/sixdb.svg)
![GitHub file size](https://img.shields.io/github/size/jjcapellan/SIXDB/src/sixdb.min.js.svg)
![Docs status](https://inch-ci.org/github/jjcapellan/SIXDB.svg?branch=master)
![GitHub license](https://img.shields.io/github/license/jjcapellan/SIXDB.svg)


  

SIXDB is a basic and very easy to use library wrapper for indexedDB.  
IndexedDB is the recommended solution for the persistent storage of large volumes of structured data in the browser.  
But, IndexedDB lacks a query language, is asynchronous and can be complex to manage.  
SIXDB adds an abstraction layer over indexedDB that hides that complexity.  

You can learn how to use SIXDB in less than 5 minutes (or maybe 6 ;)).  
**Complete SIXDB documentation available [here](https://jjcapellan.github.io/SIXDB/)**


## In this document ...
***
* [Features](#Features)
* [Installation](#Installation)
* [Tutorial](#Tutorial)
    * [Database structure creation](#Database-structure-creation)
    * [Insert records](#Insert-records)
    * [Read records](#Read-records)
    * [Update records](#Update-records)
    * [Delete records](#Delete-records)
* [Query language](#Query-system)
* [Custom comparison operator](#Custom-operator)
* [Using functions as values](#Using-functions)
* [The task queue](#Task-queue)
* [The SIXDB error handling](#Error-handling)
* [License](#License)

## <a name="Features"></a>Features
***
* [Task queue](#Task-queue) system that manages all asynchronous operations.
* Natural and intuitive [Query language](#Query-system).
* Simple and flexible methods to perform CRUD operations.
* In addition to the predefined aggregate functions (sum, max, min, avg) you can use your own functions.
* Insertion operations allow several entries to be entered at the same time.
* Update operations accept [functions as value](#Using-functions) to modify the current value of the record.
* Lightweight. SIXDB takes less than 100Kb minified and less than 10Kb compressed with gzip.
* Default errorCallback in all methods. ErrorCallback parameter is optional.
* Complete [documentation](https://jjcapellan.github.io/SIXDB/) with examples.



## <a name="Installation"></a>Installation
***
There are two alternatives:
* Download the file [sixdb.js](https://cdn.jsdelivr.net/gh/jjcapellan/SIXDB@2.0.0/dist/sixdb.js) or the minified version [sixdb.min.js](https://cdn.jsdelivr.net/gh/jjcapellan/SIXDB@2.0.0/dist/sixdb.min.js) to your proyect folder and add a reference in your html:
```html
<script src = "sixdb.min.js"></script>
```
* Point a script tag to the CDN link:
```html
<script src = "https://cdn.jsdelivr.net/gh/jjcapellan/SIXDB@2.0.0/dist/sixdb.min.js"></script>
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
// First step is instantiate an SIXDB object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sixdb('companyDB');


//
// We need to create at least one object store. 
// The object store is used to store the records (objects). It's similar to a table in a relational database.
// SIXDB adds an autoincrement primary key (named "nid") to each store.
// To create it we need the method add.store():
//
//     add.store(storeName, { successCallback, errorCallback } = {})
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
//     add.index(storeName, indexName, keyPath, { successCallback, errorCallback }={})
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
With SIXDB we can insert records individually or through an objects array.

```javascript
//
// First step is instantiate a sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sixdb('companyDB');


//
// To insert one or more records is used add.records():
//
//     add.records(storeName, obj, { successCallback, errorCallback }={})
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
SIXDB can read the records using two methods and 5 types of query.

```javascript
//
// First step is instantiate an sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sixdb('companyDB');


//
// To get the last records we use get.lastRecords():
//
//     get.lastRecords (storeName, maxResults, successCallback, errorCallback)
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
//     get.records (storeName, successCallback, { errorCallback, indexName, query } = {})
//
// Gets the record with ID "2" from the index "IDs" in store "southFactory".
// If you don't use query then the function sends all index records to the function readerCallback
//
mydb.get.records(
    'southFactory',                   
    readerCallback,
    {indexName: 'IDs', query: 2}    // A single value of the query refers to the index keyPath.
);


//
// Gets employees records from manufacturing department with a salary higher than 1200.
// The query can't be a single value if the index is null.
//
mydb.get.records(
    'southFactory', 
    readerCallback,
    { query: 'department = "manufacturing" & salary > 1200' }
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();


//
// Simple function that receives the query result from SIXDB methods and show it on console.
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
// First step is instantiate an sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sixdb('companyDB');


//
// We only need one method to update one or more records:
//
//     update.recordsfunction(storeName, query, objectValues, { indexName, successCallback, errorCallback } = {})
//
// This simple example changes the salary and age of an employee with ID 2 using the index 'IDs'.
//
mydb.update.records(
    'southFactory',                                                // Object store name
    {salary: 1290, age: 39},                                       // Object with the new values
    {indexName: 'IDs', query: 2, errorCallback: myErrorCallback}   // Optional arguments
);


//
// Updates the salary of all records where department is manufacturing and age > 30 to a new salary of 1300.
// Here a conditional expression is used as query. The index is null so all the store object is queried.
//
mydb.update.records(
    'southFactory',                                       // Object store name
    { salary: 1300 },                                     // Object with the new values
    { query: 'department = "manufacturing" & age > 30',   // Optional arguments
    errorCallback: myErrorCallback }   
);


//
// The object values parameter accepts functions as value whose receives the old value an returns the new value.
// Here all salaries from employees with age highter than 40 or with salary less than 600, are increased by 300.
//
mydb.update.records(
    'southFactory',
    { salary: function(oldSalary) { return oldSalary + 300;} },           // A function is used as new value
    { query: 'age > 40 | salary < 600',                                   // Optional arguments
    errorCallback: myErrorCallback }
);


//
// Example of a simple error callback
//
function myErrorCallback(e){
    console.error(e);
};


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```

### <a name="Delete-records"></a>**Delete records**
SIXDB has the method del.records() for this case.
```javascript
//
// First step is instantiate an sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
var mydb = new sixdb('companyDB');


//
// To delete one or more records there is the method del.records():
//
//     del.records (storeName, query, { indexName, successCallback, errorCallback } = {})
//
// For eample, this deletes the record with ID 5 from the object store "southFactory".
//
mydb.del.records(
    'southFactory',                   // Object store name
    5,                                // Query. A single value refers to the index keypath.
    { indexName: 'IDs', 
    errorCallback: myErrorCallback }                    
);


//
// deletes all records from manufacturing department with salaries highter than 1200 or age highter than 60
//
mydb.del.records(
    'southFactory',
    '(department="manufacturing") & (salary > 1200 | age > 60)'             // Query with 2 groups of conditions
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```



## <a name="Query-system"></a>**Query language**
***
Some SIXDB methods receive as parameter to select records a string with an expression that represents the query.
Write a query is very intuitive. Is similar to write the condition in an "if" sentence.  
A simple query would be: `recordProperty = value` 
There are some rules:
* You can use these normal comparisson operators:  **=** , **>**, **\<**, **>=**, **<=**, **!=**
* There are too "special" operators:
  * **<>**   : "Contains" operator. Valid for strings.
  ```javascript
  name <> ul // The property name contains the substring "ul". (quotes are optional)
  ```
  * **^**    : "Starts with" operator. Valid for strings. Is case sensitive.
  ```javascript
  name ^ Pe // Means the property name starts with the substring "Pe" (quotes are optional).
  ```
* The valid logical operators are: **&**, **&&**, **|**, **||**
* **&** ("and") has same effect than **&&**, and the same to **|** ("or") and **||**.
* Only one type of logical operator can be used in a group of conditions. 
```javascript
salary > 1000 & name != 'Peter' & age > 34      // This is correct
salary > 1000 & name != 'Peter' | age > 34      // This is wrong
```
* Groups of conditions within other groups are not allowed.
```javascript
(salary > 1000 & name != 'Peter') | (name = 'Adam' & salary < 900)            // This is correct
((salary > 1000 & name != 'Peter') | ID = 5) | (name = 'Adam' & salary < 900) // This is wrong
```
* Outside of a conditions group there can't be another without parentheses.
```javascript
(salary > 1000 & name != 'Peter') | (name = 'Adam')   // This is correct
(salary > 1000 & name != 'Peter') | name = 'Adam'     // This is wrong
```
* Only one type of logical operator can be used between groups of conditions
```javascript
(a = 2 & c < 10) | (d != 1) | (d = 10 & e >= 12)  // This is correct
(a = 2 & c < 10) | (d != 1) & (d = 10 & e >= 12)  // This is wrong
```
* Some functions accepts a single value as a query when the value refers to the keypath of an existing index
```javascript
mydb.del.records(
    'southFactory',                   // Object store name     
    5,                                // Query. A single value refers to the index keypath.
    { indexName: 'IDs',               // Index. Contains all objects with ID property in the object store "southFactory"
    errorCallback: myErrorCallback }  // Function to handle errors.                     
);
```
* Spaces or symbols in the value of a condition must be enclosed in quotation marks. Parentheses and nested quotes are not supported.
```javascript
name = 'John Smith'     // This is correct
equation = 'e = v / t'  // This is correct
equation = e = v / t    // This is very wrong. The query system can't parse that "=" without quotes.
message = 'This is my "message"'    // This is wrong.
message = 'This (is) my message'    // This is wrong.
```

## <a name="Custom-operator"></a>**Custom comparison operator**
***
We can create our own operator to use in the queries.  
The custom operator is represented in the query system with "\~\~".   
To get it we must make a compare function and set the customOperator variable.  
By default "\~\~" acts like "=".
```javascript
//
// The compare function must have two arguments, property value and test value. If this function triggers
// an error exception then the query system returns the condition result as false.
// In this example the function returns true when the length of property and test value is equal.
//
var compareFunction = function(propValue, testValue){
    return propValue.length == testValue.length;
    };

//
// Assigns compareFunction to the customOperator variable
//
mydb.setCustomOperator(compareFunction);
``` 


## <a name="Using-functions"></a>**Using functions as values**
***
SIXDB allows send a function in a query to modify records value.  
To do this, we will consider the function as if it were the new value in the update.records() method.  
This function will receive the current record value as a parameter and return the new value.

```javascript
//
// The object values parameter accepts functions as value whose receives the old value an returns the new value.
// Here all salaries from manufacturing department are increased by 300.
//
mydb.update.records(
    'southFactory',
    { salary: function(oldSalary) { return oldSalary + 300;} },           // A function is used as new value
    { query: 'department = "manufacturing"',                              // Optional arguments
    errorCallback: myErrorCallback }
);
```

## <a name="Task-queue"></a>**The SIXDB task queue**  
***
SIXDB is based on a **task queue** to manage the creation, insertion, reading, and deletion orders.  
The task queue is a list that uses the method FIFO (first in first out) to decide which task is executed.  
When a task finishes it is deleted from the list and the queue is checked to execute pending tasks.  
The result is that the orders are executed sequentially.  
The method *add.customTask* allows us to add our own task to the queue. 
Here a quick example:
```Javascript
var mydb = new sixdb('companyDB');

var store= 'southFactory';

// Inserts one record in "southFactory" object store.
//
mydb.add.records(
    store,                                                                      // Object store name.
    {ID: 1, name: 'Peter', department: 'manufacturing', age: 32, salary: 1200}  // A single object that represents a record.
);


//
// To add an own function to the task queue add.customTask is used
//
//     add.customTask( fn, context, args)
// 
// This task is executed after the previous insertion task and before the next reading task.
//
mydb.add.customTask(
    function(m){                                // Custom function
        alert(m);
    },
    this,                                       // Context. Usually "this".
    'Inserting operation finished !!'           // Arguments of the function. Can be a variable number of arguments.
)



// Reads all records from "southFactory" object store. (Without query parameter, get.records() returns all records)
//
mydb.get.records(
    store, 
    readerCallback
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the function execTasks() to execute them.
//
mydb.execTasks();
```
## <a name="Error-handling"></a>**The SIXDB error handling**  
By default all errors are catched and hanled by a basic function that sends the error object to console and prevents an exception to stop the execution of the task queue.  
When an error is captured, the transaction is closed, the current task is stopped and the next one is started.  
The error callbacks reciebe an error object.  
The error object has this properties:
* code: {number} An id number.
* type: {string} Type of error.
* origing: {string} Function where the error occurred.
* description: {string} More detailed info about the error.



## <a name="License"></a>**License**  
SIXDB is licensed under the terms of the MIT open source license.


