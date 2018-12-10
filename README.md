# SIXDB (simple indexedDB)  



![GitHub tag (latest by date)](https://img.shields.io/github/tag-date/jjcapellan/sixdb.svg)
![GitHub file size](https://img.shields.io/github/size/jjcapellan/SIXDB/dist/sixdb.js.svg)
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
* Download the file [sixdb.js](https://cdn.jsdelivr.net/gh/jjcapellan/SIXDB@3.0.0/dist/sixdb.js) to your proyect folder and add a reference in your html:
```html
<script src = "sixdb.js"></script>
```
* Point a script tag to the CDN link:
```html
<script src = "https://cdn.jsdelivr.net/gh/jjcapellan/SIXDB@3.0.0/dist/sixdb.js"></script>
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
The **index** order the records by its **keypath**.


### <a name="Database-structure-creation"></a>**Database structure creation**

```javascript
// First step is instantiate an SIXDB object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
const mydb = new Sixdb('companyDB');

// Now a store named "southFactory" with keyPath "id" and autoIncrement attribute activated is created.
// With this arguments, each new record added to store will receive a property "id" with a self-generated value.
// We need to create at least one store.
//
mydb.newStore(
    'southFactory',                            // Name of the new store.
    { keyPath: 'ID', autoIncrement: true }     // Optional object. Options are: keyPath, autoIncrement, successCallback, errorCallback.
);

// openStore() instantiates the new store. 
//
let myStore = mydb.openStore('southFactory');


//
// It's a good idea to create one or more indexes for each store to order the records (objects).
// The index keypath is the object property used to select and order the objects.
// Those objects that hasn't the index keypath as property will not be included in the index.
// The "unique" attribute prevents add two records with the same key. By default, "unique" is false.
//
// In this case we create a single index named "Names" with the keypath "name". 
//
myStore.newIndex(
    'Names',            // Name of the new index.
    'name',             // Keypath.
    { unique: false}    // Optional object. Options are: unique, succesCallback, errorCallback.
);



// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the Sixdb method execTasks() to execute them.
//
mydb.execTasks();
```


### <a name="Insert-records"></a>**Insert records**
With SIXDB we can insert records individually or through an objects array.

```javascript
//
// First step is instantiate a sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
const mydb = new Sixdb('companyDB');

// Opens "southFactory" object store
//
let myStore = mydb.openStore('southFactory');


// Inserts one record in "southFactory" object store.
//
myStore.add(
    {name: 'Peter', department: 'manufacturing', age: 32, salary: 1200}    // A single object that represents a record.
);


//
// Inserts 6 records in "southFactory" object store using an objects array.
//
myStore.add(
    'southFactory',
    [
        { name: 'Paul', department: 'manufacturing', age: 27, salary: 1150},
        { name: 'Adam', department: 'manufacturing', age: 38, salary: 1260},
        { name: 'Alice', department: 'accounting', age: 41, salary: 1400},
        { name: 'Alex', department: 'manufacturing', age: 33, salary: 1250},
        { name: 'Kathy', department: 'manufacturing', age: 28, salary: 1150},
        { name: 'David', department: 'accounting', age: 32, salary: 1380}
    ]
);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the Sixdb method execTasks() to execute them.
//
mydb.execTasks();
```

### <a name="Read-records"></a>**Read records**
SIXDB can read the records using the Store or the Index objects.  
The Index sorts the results by its keypath and the Store uses its primary key.  
Store and Index objects have the methods **get()** and **getAll()**.

```javascript
//
// First step is instantiate an sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
const mydb = new Sixdb('companyDB');

// Opens "southFactory" store
//
let myStore = mydb.openStore('southFactory');

// Opens "Names" index
//
let myIndex = myStore.openIndex('Names');


// Gets all records in the store. Gets the records sorted by the store primary key ("ID").
myStore.getAll(succesCallback);

// Gets all records in the index. Gets the records sorted by the index keypath ("name").
myIndex.getAll(successCallback);

// Gets the record with primary key ("ID") 4 from the store. Single value in first parameter refers to the keypath.
//
myStore.get(
    4,                 // The query.
    successCallback    // Success callback wich receives the result.
);

// Gets records from manufacturing department with salary > 1200.
//
myStore.get('department = manufacturing & salary > 1200', successCallback);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the Sixdb method execTasks() to execute them.
//
mydb.execTasks();


//
// Simple function that receives the uery result from SIXDB methods and show it on console.
// The result received can be a single object or an object array. 
// 
//
function successCallback(result) {
    if(Array.isArray(result)){
        for (let i = 0, j = result.length; i < j; i++) {
            console.log(
             `Name: ${result[i].name}\n` +
             `Department: ${result[i].department}\n` + 
             `Age: ${result[i].age}\n` +
             `Salary: ${result[i].salary}\n`
             );
        }
    } else {
        console.log(
         `Name: ${result[i].name}\n` +
         `Department: ${result[i].department}\n` + 
         `Age: ${result[i].age}\n` +
         `Salary: ${result[i].salary}\n`
         );
    }
}
```

### <a name="Update-records"></a>**Update records**
The Store method **update()** allows us to update the records in many ways.
```javascript
//
// First step is instantiate an sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
const mydb = new Sixdb('companyDB');

// Opens "southFactory" store
//
let myStore = mydb.openStore('southFactory');

// This simple example changes the salary and age of the employee with ID 2.
//
myStore.update(
    2,                                  // The query.
    {salary: 1290, age: 39},            // Object with the new values.
    {errorCallback: myErrorCallback}    // Optional object. Options are: successCallback, errorCallback.
);

// Updates the salary of all records where department is manufacturing and age > 30 to a new salary of 1300.
//
myStore.update(
    'department = "manufacturing" & age > 30',    // The query
    {salary: 1300},                               // Object with the new values
    {errorCallback: myErrorCallback }             // Optional object.
);

// The object values parameter accepts functions as value whose receives the old value an returns the new value.
// Here all salaries from employees with age highter than 40 or with salary less than 600, are increased by 300.
//
myStore.update(
    'age > 40 | salary < 600',
    {salary: function(oldSalary) { return oldSalary + 300;} },           // A function is used as new value for salary.
    {errorCallback: myErrorCallback}
);

// Simple error callback
//
function myErrorCallback(e){
    console.error(e);
};


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the Sixdb method execTasks() to execute them.
//
mydb.execTasks();
```

### <a name="Delete-records"></a>**Delete records**
Store object uses the method **del()** for delete one or more records.
```javascript
//
// First step is instantiate an sixdb object, it checks if already exists a database called "companyDB" (If doesn't, a new one is created).
//   
const mydb = new Sixdb('companyDB');

// Opens "southFactory" store
//
let myStore = mydb.openStore('southFactory');

// Deletes the record with ID 5 from the object store "southFactory".
//
myStore.del(
    5,                                  // Query. A single value refers to the primary key.
    {errorCallback: myErrorCallback}    // Optional object. Options are: successCallback, errorCallback.            
);

// deletes all records from manufacturing department with salaries highter than 1200 or age highter than 60
//
myStore.del(
    '(department = manufacturing) & (salary > 1200 | age > 60)'             // Query with 2 groups of conditions
);

// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the Sixdb method execTasks() to execute them.
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
* A single value refers to a keypath
```javascript
myStore.del(
    5,                                  // Query. A single value refers to the primary key.
    {errorCallback: myErrorCallback}    // Optional object. Options are: successCallback, errorCallback.            
);
```
* Spaces or symbols in the value of a condition must be enclosed in quotation marks. Parentheses and nested quotes are not supported.
```javascript
name = 'John Smith'                 // This is correct
equation = 'e = v / t'              // This is correct
equation = e = v / t                // This is wrong. The query system can't parse that "=" without quotes.
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
const compareFunction = function(propValue, testValue){
    return propValue.length == testValue.length;
};

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
// The object values parameter accepts functions as value whose receives the old value an returns the new value.
// Here all salaries from employees with age highter than 40 or with salary less than 600, are increased by 300.
//
myStore.update(
    'age > 40 | salary < 600',
    {salary: function(oldSalary) { return oldSalary + 300;} },           // A function is used as new value for salary.
    {errorCallback: myErrorCallback}
);
```

## <a name="Task-queue"></a>**The SIXDB task queue**  
***
SIXDB is based on a **task queue** to manage the creation, insertion, reading, and deletion orders.  
The task queue is a list that uses the method FIFO (first in first out) to decide which task is executed.  
When a task finishes it is deleted from the list and the queue is checked to execute pending tasks.  
The result is that the orders are executed sequentially.  
The Sixdb method **customTask()** allows us to add our own task to the queue. 
Here a quick example:
```Javascript
let mydb = new Sixdb('companyDB');

let myStore = mydb.openStore('southFactory');

// Inserts one record in "southFactory" object store.
//
myStore.add(
    {name: 'Peter', department: 'manufacturing', age: 32, salary: 1200}  // A single object that represents a record.
);


// Our function is executed after the previous insertion task and before the next reading task.
//
mydb.add.customTask(
    function(m){                                // Custom function
        alert(m);
    },
    this,                                       // Context. Usually "this".
    'Inserting operation finished !!'           // Arguments of the function. Can be a variable number of arguments.
)



// Reads all records from "southFactory" object store.
//
myStore.getAll(readerCallback);


// ***** VERY IMPORTANT ****
// Once we have introduced the operations that we want to perform on the database, 
// we must use the Sixdb method execTasks() to execute them.
//
mydb.execTasks();
```
## <a name="Error-handling"></a>**The SIXDB error handling**  
By default all errors are catched and hanled by a basic function that sends the error object to console and prevents an exception to stop the execution of the task queue.  
When an error is captured, the transaction is closed, the current task is stopped and the next one is started.  
The error callbacks reciebe an error object.  
The error object has this properties:
* type: {string} Type of error.
* origing: {string} Function where the error occurred.
* description: {string} More detailed info about the error.



## <a name="License"></a>**License**  
SIXDB is licensed under the terms of the MIT open source license.


