## v3.0.1
* Fix: unique attribute unassigned in Store.newIndex().
* Fix: consoleOff self assigned in Sixdb.setConsoleOff().
## v3.0.0
* Redesigned api. Now databases, stores and indexes are objects with its own methods.
## v2.0.1
* Fix: succesCallback null in cursorLoop().
## v2.0.0
### New features
* Added function get.aggregateFn(). Applies an aggregate function to a property.  
Accepts as arguments predefined functions:  
  * aggregateFuncs.sum. Sums the values of a property.
  * aggregateFuncs.avg. Calculates the average of a property.
  * aggregateFuncs.max. Maximum value of a property.
  * aggregateFuncs.min. Minimum value of a property
* Custom aggregate functions. get.aggregateFn() accepts custom functions.
* Added function get.count(). Returns number of records of a query.
### Minor improvements and fixes
* Optional arguments now are grouped in an object.
* Default values in some arguments to avoid null errors.
* Less size of the minified file.
## v1.9.0
* Added function get.sum(). Sums the values of a property.
* Added function get.avg(). Calculates the average of a property.
* Query is optional in get.records() function.
## v1.8.0
* Added string comparison operator **$** ("ends with") to use in queries.
* Added custom comparison operator **\~\~** wich works with a custom compare function.
## v1.7.0
### New features
* Added string comparison operator **<>** ("contains") to use in queries.
* Added string comparison operator **^** ("starts with") to use in queries.
### Minor improvements and fixes
* DOMexceptions triggered by indexedDB method createdObjectStore now are correctly managed by a trycatch.
* Some refactoring that saves 5Kb to the file.
## v1.6.0
### New features
* Added an improved error handling system. Now detects and hanle more possible errors.
### Minor improvements and fixes
* Error notifications are not affected by the flag consoleOff.
* All undefined error callbacks are transformed in empty functions. This prevents a problem in the try catch helpers.