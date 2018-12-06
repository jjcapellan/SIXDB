/**
 * Some SIXDB methods receive as parameter to select records a string with an expression that represents the query.<br>
 * A single value is interpreted as a key.<br>
 * Write a query is very intuitive. Is similar to write the condition in an "if" sentence.<br>
 * A simple query would be: <code>recordProperty = value</code><br>
 * There are some rules:<br>
 * You can use these normal comparisson operators:<br>  
 * <code>= , >, <, >=, <=, !=</code><br><br>
 * 
 * There are too "special" operators:<br>
 * <code> <> </code>  : "Contains" operator. Valid for strings.<br>
 * <code>name <> ul // The property name contains the substring "ul". (quotes are optional)</code><br>
 * <code> ^ </code>: "Starts with" operator. Valid for strings. Is case sensitive.<br>
 * <code>name ^ Pe // Means the property name starts with the substring "Pe" (quotes are optional).</code><br><br>
 * 
 * The valid logical operators are:<br> 
 * <code>&, &&, |, ||</code><br>
 * <b>&</b> ("and") has same effect than <b>&&</b>, and the same to <b>|</b> ("or") and <b>||</b>.<br><br>
 * Only one type of logical operator can be used in a group of conditions.<br>
 * <code>salary > 1000 & name != 'Peter' & age > 34      // This is correct<br>
 * salary > 1000 & name != 'Peter' | age > 34      // This is wrong</code><br><br>
 * Groups of conditions within other groups are not allowed.<br>
 * <code>(salary > 1000 & name != 'Peter') | (name = 'Adam' & salary < 900)            // This is correct<br>
 * ((salary > 1000 & name != 'Peter') | ID = 5) | (name = 'Adam' & salary < 900) // This is wrong</code><br><br>
 * 
 * Outside of a conditions group there can't be another without parentheses.<br>
 * <code>(salary > 1000 & name != 'Peter') | (name = 'Adam')   // This is correct<br>
 * (salary > 1000 & name != 'Peter') | name = 'Adam'     // This is wrong</code><br><br>
 * 
 * Only one type of logical operator can be used between groups of conditions<br>
 * <code>(a = 2 & c < 10) | (d != 1) | (d = 10 & e >= 12)  // This is correct<br>
 * (a = 2 & c < 10) | (d != 1) & (d = 10 & e >= 12)  // This is wrong</code><br><br>
 * 
 * A single value as query refers to a key<br>
 * <code>let mydb = new sixdb('myDatabase');<br>
 * let store = mydb.openStore('myStore');<br>
 * store.get('Paul', mySuccesCallback); // Gets the record with key 'Paul' in the store keyPath</code><br><br>
 * 
 * Spaces or symbols in the value of a condition must be enclosed in quotation marks.<br> Parentheses and nested quotes are not supported.<br>
 * <code>name = 'John Smith'     // This is correct<br>
 * equation = 'e = v / t'  // This is correct<br>
 * equation = e = v / t    // This is very wrong. The query system can't parse that "=" without quotes.<br>
 * message = 'This is my "message"'    // This is wrong<br>
 * message = 'This (is) my message'    // This is wrong </code>
 * @typedef {string} query
 */

/**
 * Applies an operation to two values sent from one of the interactions of a cursor's loop in the records of the database.<br>
 * The sixdb object aggregateFuncs contains some predefined aggregate functions: sum, avg, max, min.<br>
 * @typedef {function} aggregateFunction
 * @param  {any} actualValue This value is the result of the previous operations in the loop.<br>
 * In next iteration actualValue will be this returned result.
 * @param  {any} selectedValue Property value selected in the current iteration of the aggregate method loop.
 * @param  {number} counter Interaction number of the aggregate method loop.
 * @returns {any} Result of the operation.
 * @example
 * const mydb = new sixdb('myDatabase');
 * 
 * let store = mydb.openStore('southFactory');
 * 
 * // This function is the same than sixdb.aggregateFuncs.sum.
 * //
 * let myaggregateFunction = function(actualValue, selectedValue){
 *     return actualValue + selectedValue;
 * };
 * 
 * // Sends to mySuccesCallback the sum of all salaries in the store "southFactory"
 * //
 * store.aggregateFn('salary', myaggregateFunction, mySuccessCallback);
 * 
 * // This gets the same result than previous sentence
 * //
 * store.aggregateFn('salary', mydb.aggregateFuncs.sum, mySuccessCallback);
 * 
 * mydb.execTasks();
 */
