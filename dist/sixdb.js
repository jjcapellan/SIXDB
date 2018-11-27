/**
 *  Simple IndexedDB
 *  @desc Simple IndexedDB (SIXDB) is a wrapper for indexedDB API.
 *  @author Juan Jose Capellan <soycape@hotmail.com>
 */

/**
 * @license
 * MIT LICENSE
 *
 * Copyright (c) 2018 Juan Jose Capellan
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Creates an sixdb (simple indexedDB) object that manage the new indexedDB database.
 * @class
 * @param  {string} _dbName Name for the new database.
 */
var sixdb = function(_dbName) { // eslint-disable-line no-unused-vars
  var db; // current instance of the opened database

  /**
   * Data base name.
   * @private
   * @type {string}
   * @readonly
   */
  var dbName = _dbName;

  /**
   * Database name getter
   * @public
   * @return {string} Database name
   */
  this.getName = function() {
    return dbName;
  };

  /**
   * Console output mode. True to turn off console output.
   * @private
   * @type {boolean}
   * @default
   * @readonly
   */
  var consoleOff = false;

  /**
   * Sets the consoleOff value
   * @param {boolean} off True turn off the console output.
   * @return {string} Database name
   */
  this.setConsoleOff = function(off) {
    if (typeof off == 'boolean') {
      consoleOff = off;
    }
  };

  // void function
  var voidFn = function() {
    return;
  };

  var _store = null;

  var _index = null;

  /// Object used to pass arguments by reference to cursor async loops
  var sharedObj = {};

  var i = 0;

  /**
   * Function to compare a property value with a test value
   * @private
   * @param  {string | number} value1 Property value
   * @param  {string | number} value2 Value to test
   * @return {boolean}
   */
  var customOperator = function(value1, value2) {
    return value1 == value2;
  };

  /**
   * Sets customOperator. To make the queries we can add to the SIXDB comparison operators our own operator.
   * @param  {function} compareFunction Function to compare a property value with a test value.<br>
   * @return {void}
   * @example
   * var mydb = new sixdb('myDatabase');
   *
   * //
   * // The compare function must have two arguments, property value and test value. If this function triggers
   * // an error exception, then the query system returns the condition as false.
   * //
   * mydb.setCustomOperator(
   *     function(propertyValue, testValue){
   *         return (propertyValue.length == testValue.length);
   *     });
   *
   */
  this.setCustomOperator = function(compareFunction) {
    if (compareFunction) {
      if (typeof compareFunction == 'function') {
        if (compareFunction.length == 2) {
          customOperator = compareFunction;
        }
      }
    }
  };

  //#region Query system
  ///////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * qrySys contains all methods to manage the string queries
   * @private
   * @typedef {Object} qrySys
   * @property {function} init Inits the regex variables used to parse the query strings.
   * @property {function} testConditionBlock Test a conditions block.
   * @property {function} makeConditionsBlocksArray Makes an array of conditions blocks.
   * @property {function} testCondition Test a conditional expression as false or true.
   */
  var qrySys = { 
    /**
   * The conditionObject contains the three elements to test a condition.
   * @private
   * @typedef {Object} conditionObject
   * @property {string} keyPath Indicates a key path to test.
   * @property {string} cond A comparison operator ( "<" , ">" , "=" , "!=" , "<=" , ">=", "<>", ... ).
   * @property {any} value Indicates the value to test.
   * @example
   *
   * //Object to store in the object store
   * var person = {
   *     name: 'Peter',
   *     age: 32
   * }
   *
   * // Example of conditionObject
   * var condition = { keyPath: 'age', cond: '<', value: 45};
   */

    /**
     * @private
     * @typedef conditionsBlock
     * @type {object}
     * @property {conditionObject[]} conditionsArray Array of conditionObjects.
     * @property {string} internalLogOperator Logical operator between conditions (and, or).
     * @property {string} externalLogOperator Logical opertor to apply between blocks of conditions.
     */

    /**
     * Initializes the regex variables used to parse the query string
     * @return {void}
     */
    init: function() {
      this.blockRgx = /\(.*?(?=\))/g;
      this.blockOperatorRgx = /[\&\|]+(?=(\s*\())/g;
      this.operatorRgx = /(=|>|<|>=|<=|!=|<>|\^|\$|~~)+/g;
      this.rightOperandRgx = /(?:([=><\^\$~]))\s*["']?[^"']+["']?\s*(?=[&\|])|(?:[=><\^\$~])\s*["']?[^"']+["']?(?=$)/g; 
      this.leftOperandRgx = /([^"'\s])(\w+)(?=\s*[=|>|<|!|\^|\$~])/g;                                                   
    },
    /**
     * Transforms a query string into an array of objects that is used by SIXDB to process the query.
     * @param  {string} query String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * @return {object[]} Returns and array of coditions blocks.
     */
    makeConditionsBlocksArray: function(query) {
      var t = this;
      var conditionsBlocksArray = [];

      //// Gets blocks
      //
      var blocks = query.match(t.blockRgx);

      // Logical operators between blocks, all must be the same type
      var extLogOperator = query.match(t.blockOperatorRgx) ? query.match(t.blockOperatorRgx) : null;

      // If condition is a single sentence like: " a = 10 & b > 5 "
      if (!blocks) {
        t.pushConditionBlockToArray(query, null, conditionsBlocksArray);
        return conditionsBlocksArray;
      }

      // Delete left parentheses
      t.deleteLeftParentheses(blocks);

      // If condition is a multiple sentence like: " (a = 5 & b = 10) || (c < 4 & f > 10) "
      if (extLogOperator) {
        if (extLogOperator == '&' || extLogOperator == '&&') {
          extLogOperator = 'and';
        } else {
          extLogOperator = 'or';
        }
      }

      for (i = 0; i < blocks.length; i++) {
        t.pushConditionBlockToArray(blocks[i], extLogOperator, conditionsBlocksArray);
      }
      return conditionsBlocksArray;
    },
    /**
     * Deletes left parentheses of a string.
     * @param  {string[]} blocks Each element of blocks is a block (group) of conditions.
     */
    deleteLeftParentheses: function(blocks) {
      var i = 0;
      var size = blocks.length;
      for (i = 0; i < size; i++) {
        blocks[i] = blocks[i].substr(1);
      }
    },
    /**
     * Push conditionsBlock objects to an array
     * @private
     * @param  {string} qry
     * @param  {string} extLogOperator
     * @param  {conditionsBlock[]} conditionsBlocksArray
     * @return {void}
     */
    pushConditionBlockToArray: function(qry, extLogOperator, conditionsBlocksArray) {
      var i = 0;
      var t = this;

      //// Gets left operands
      //
      var leftOperands = qry.match(t.leftOperandRgx);

      //// Gets right operands
      //
      var rightOperands = qry.match(t.rightOperandRgx);
      for (i = 0; i < rightOperands.length; i++) {
        // Delete the operator
        while (rightOperands[i][0].match(/[=><!\^\$~]/g)) {
          rightOperands[i] = rightOperands[i].substr(1);
        }
        // Delete quotes and trim white spaces
        rightOperands[i] = rightOperands[i].replace(/["']/g, '').trim();
      }

      //// Gets operators
      //// Removing righ operands (values) before extract comparison operators avoids
      //// problems with literal values that include comparisson symbols(= , >,...) quoted.
      //
      for (i = 0; i < rightOperands.length; i++) {
        qry = qry.replace(rightOperands[i], '');
      }
      var operators = qry.match(t.operatorRgx);

      var conditionsArray = [];

      // If query is like: " c = 15 "
      if (leftOperands.length == 1) {
        //{property, operator (=,>,<, ...), value}
        conditionsArray.push({
          keyPath: leftOperands[0],
          cond: operators[0],
          value: rightOperands[0]
        });

        conditionsBlocksArray.push({
          conditionsArray: conditionsArray,
          internalLogOperator: null,
          externalLogOperator: extLogOperator
        });

        conditionsArray = null;
      } else {
        // if query is like: " c = 15 & a > 30 "
        var logOperatorsType = qry.match(/[\&\|]+/g)[0];

        if (logOperatorsType == '&' || logOperatorsType == '&&') {
          logOperatorsType = 'and';
        } else {
          logOperatorsType = 'or';
        }

        for (i = 0; i < operators.length; i++) {
          conditionsArray.push({
            keyPath: leftOperands[i],
            cond: operators[i],
            value: rightOperands[i]
          });
        }

        conditionsBlocksArray.push({
          conditionsArray: conditionsArray,
          internalLogOperator: logOperatorsType,
          externalLogOperator: extLogOperator
        });
        conditionsArray = null;
      } // end if else
    },
    /**
     * Test a block of conditions. For example:
     * (a<100 && a>20) || (b = 30 & c != 50 && a >= 200)   <==== Here are 2 conditions blocks. The first block has 2 conditions.
     * @private
     * @param  {IDBCursor} cursor Contains the actual record value to make the comparisson.
     * @param  {conditionObject[]} conditionsArray Contains the conditions.
     * @param  {string | null} operator Is a logical operator that can be "and", "or" or null.
     * @return {boolean} Result after evaluating the conditions block (true/false)
     */
    testConditionBlock: function(cursor, conditionsArray, operator) {
      var t = this;
      var i = 0;

      var test = operator == 'and' || !operator ? true : false;
      for (i = 0; i < conditionsArray.length; i++) {
        test = t.testCondition(cursor.value[conditionsArray[i].keyPath], conditionsArray[i].cond, conditionsArray[i].value);
        if ((operator == 'and' || !operator) && !test) return false;
        else if (operator == 'or' && test) return true;
      }

      return test;
    },
    /**
     * Test a conditional expression as false or true
     * @private
     * @param {string | number} value1 First value to compare
     * @param {string} condition Comparison operator ( = , > , < , >= , <= , != , ...)
     * @param {string | number} value2 Second value to compare
     * @returns {boolean} Result after evaluating the condition
     */
    testCondition: function (value1, condition, value2) {
      var result;
      switch (condition) {
        case '=':
          result = value1 == value2 ? true : false;
          break;

        case '>':
          result = value1 > value2 ? true : false;
          break;

        case '<':
          result = value1 < value2 ? true : false;
          break;

        case '>=':
          result = value1 >= value2 ? true : false;
          break;

        case '<=':
          result = value1 <= value2 ? true : false;
          break;

        case '!=':
          result = value1 != value2 ? true : false;
          break;

        case '<>': // string value1 contains substring value2
          if (typeof value1 != 'string') {
            return false;
          }
          result = value1.indexOf(value2) != -1;
          break;

        case '^':
          if (typeof value1 != 'string') {
            return false;
          }
          result = value1.indexOf(value2) == 0;
          break;

        case '$':
          if (typeof value1 != 'string') {
            return false;
          }
          result = value1.indexOf(value2) == value1.length - value2.length;
          break;

        case '~~':
          try {
            result = customOperator(value1, value2);
          } catch (e) {
            result = false;
          }
          break;

        default:
          break;
      }
      return result;
    }
  }; // end qrySys

  //#endregion Query system

  //#region Task queue system
  //////////////////////////////////////////////////////////////////////////////////////////////  

  /**
   * Flag to check if all task were completed (tasqQueue is empty)
   * @private
   * @type {boolean}
   */
  var idle = true;

  /**
   * Stores the pending tasks. Internal use.
   * @private
   * @type {object[]}
   */
  var taskQueue = [];

  /**
   * Object task to open database used by the Task queue system
   * @private
   */
  var tkOpen = {
    args: null,
    fn: openDb
  };

  /**
   * Delete a task from the queue when a is finished and checks for pending tasks.
   * @private
   * @return {void}
   */
  function done() {
    taskQueue.shift();
    checkTasks();
  }

  /**
   * Manage the task queue. Checks if there is some task in the queue to initiate.
   * @private
   */
  function checkTasks() {
    if (taskQueue.length == 0) {
      idle = true;
      logger('No pending tasks');
      return;
    }

    idle = false;

    //var type = taskQueue[0].type;
    var task = taskQueue[0];

    if (!task.type) {
      task.fn.apply(this, task.args);
    } else {
      logger('Custom task' + logEnum.begin);
      task.fn.apply(task.context, task.args);
      done();
    }
  }

  /**
   * Execs pending tasks. The tasks are executed sequentially.
   * A task does not run until the previous one ends.
   * This avoids problems arising from the asynchronous nature of the indexedDB api.
   * @public
   */
  this.execTasks = function() {
    if (idle) {
      checkTasks();
    }
  };

  /**
   * Contains add methods
   * @namespace
   */
  this.add = {
    /**
     * Add the task "create new database" to the task queue. Internal use only.
     * @private
     * @instance
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    db: function(errorCallback) {
      var args = [errorCallback];
      var task = {
        args: args,
        fn: newDB
      };

      taskQueue.push(task);
    },
    /**
     * Adds the task "create a new object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name.
     * @param {object} [options]
     * @param {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // Callback function to process a possible error
     * //
     * var myErrorCallback = function(e){
     *   console.log(e);
     * }
     *
     *
     * //
     * // This code adds the task "create a new object store" to the task queue
     * //
     * mydb.add.store('objectStoreName', { errorCallback:myErrorCallback });
     *
     *
     * //
     * // Execs all pending tasks
     * //
     * mydb.execTasks();
     */
    store: function(storeName, { successCallback, errorCallback } = {}) {
      var args = [storeName, successCallback, errorCallback];

      var task = { args: args, fn: newStore }; // arguments // private function to execute

      // Adds the task open database to taskQueue
      taskQueue.push(tkOpen);
      // Adds this task to taskQueue
      taskQueue.push(task);
    },
    /**
     * Add the task "insert new record in object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name where the record is added.
     * @param {(object | object[])} obj An object or objects array to insert in the object store.
     * @param {object} [options]
     * @param {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // Object to insert in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     * // Callback function to process a possible error
     * //
     * var myErrorCallback = function(e){
     *     console.log(e);
     * }
     *
     *
     * //
     * // Inserts new record in object store. (needs execTasks() to execute)
     * //
     * mydb.add.records('objectStoreName', person, { errorCallback: myErrorCallback });
     *
     *
     * // Execs all pending tasks.
     * //
     * mydb.execTasks();
     */
    records: function(storeName, obj, { successCallback, errorCallback }={}) {
      var args = [obj, successCallback, errorCallback];
      var task = { args: args, fn: newRecord };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('add -> Records(...)', storeName, 'readwrite');
      taskQueue.push(task);
    },
    /**
     * Adds the task "create a new index" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name where the index is created.
     * @param {string} indexName Index name.
     * @param {string} keyPath Key (property of stored objects) that the index use to order and filter.
     * @param {object} [options]
     * @param {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // Object to insert in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     *
     * //
     * // Callback function to process a possible error
     * //
     * var myErrorCallback = function(e){
     *     console.log(e);
     * }
     *
     *
     * //
     * // This code adds the task "create a new index" to the task queue.
     * // In this case the new index "ages" order the records by the record property "age".
     * // Only records with a property named "age" are in the index "ages".
     * //
     * mydb.add.index('objectStoreName', 'ages', 'age', { errorCallback: myErrorCallback });
     *
     *
     * // Execs all pending tasks
     * //
     * mydb.execTasks();
     */
    index: function(storeName, indexName, keyPath, { successCallback, errorCallback }={}) {
      var args = [storeName, indexName, keyPath, successCallback, errorCallback];

      var task = { args: args, fn: newIndex };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },
    /**
     * Add a specific function to the SIXDB task queue.
     * @public
     * @instance
     * @param  {any} fn Our custom function that we want to add to the task queue.
     * @param  {any} context It is usually "this".
     * @param  {...any} args Arguments for the function.
     * @return {void}
     * @example
     * var mydb = new sixdb('companyDB');
     *
     * var store= 'southFactory';
     *
     * // Inserts one record in "southFactory" object store.
     * //
     * mydb.add.records(
     *    store,                                                                      // Object store name.
     *    {ID: 1, name: 'Peter', department: 'manufacturing', age: 32, salary: 1200}  // A single object that represents a record.
     * );
     *
     *
     * //
     * // To add an own function to the task queue add.customTask is used
     * //
     * //     add.customTask( fn, context, args)
     * //
     * // This task is executed after the previous insertion task and before the next reading task.
     * //
     * add.customTask(
     *    function(m){                                // Custom function
     *        alert(m);
     *    },
     *    this,                                       // Context. Usually "this".
     *    'Inserting operation finished !!'           // Arguments of the function. Can be a variable number of arguments.
     * )
     *
     *
     *
     * // Reads all records from "southFactory" object store.
     * //
     * mydb.get.lastRecords(
     *    store,
     *    null,
     *    readerCallback
     * );
     *
     *
     * // ***** VERY IMPORTANT ****
     * // Once we have introduced the operations that we want to perform on the database,
     * // we must use the function execTasks() to execute them.
     * //
     * mydb.execTasks();
     */
    customTask: function(fn, context, args) {
      var argsArray = [];
      if (args) {
        var i = 0;
        for (i = 2; i < arguments.length; i++) {
          argsArray[2 - i] = arguments[i];
        }
      }
      var task = { type: 'custom', fn: fn, context: context, args: argsArray };

      taskQueue.push(task);
    }
  };

  /**
   * Contains delete methods
   * @namespace
   */
  this.del = {
    /**
     * Adds the task "delete a database" to the task queue.
     * @public
     * @instance
     * @param {object} [options]
     * @param {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    db: function({ successCallback, errorCallback } = {}) {
      var args = [successCallback, errorCallback];
      var task = {
        args: args,
        fn: delDB
      };

      taskQueue.push(task);
    },

    /**
     * Adds the task "delete a store from database" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name
     * @param {object} [options]
     * @param {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    store: function(storeName, { successCallback, errorCallback }={}) {
      var args = [storeName, successCallback, errorCallback];
      var task = {
        args: args,
        fn: delStore
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    },

    /**
     * Adds the task "delete a record/s from the object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name.     
     * @param {string | number} query Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param {object} [options]
     * @param {string} [options.indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {function} [options.successCallback] Function called on success. Receives event, origin and query as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32,
     *     salary: 1200
     * }
     *
     * //
     * // Deletes records where age is 40 using the index named 'ages' with the keypath 'age' as query.
     * //
     * mydb.del.record('objectStoreName', 40, {indexName: 'ages'});
     *
     * //
     * // Deletes records with age < 20 and salary > 1500 using a conditionObject array as query.
     * //
     * mydb.del.records(
     *    'objectStoreName',                  
     *    'age < 20 & salary > 1500'
     * );
     *
     * mydb.execTasks();
     */
    records: function(storeName, query, { indexName, successCallback, errorCallback }={}) {
      var args = [query, successCallback, errorCallback];
      var task = {
        args: args,
        fn: delRecords
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('del -> Records(...)', storeName, 'readwrite');
      if (indexName) {
        setHelpTask.setIndex('del -> Records(...)', indexName);
      }
      taskQueue.push(task);
    },

    /**
     * Adds the task "delete an index from an object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Object store name
     * @param {string} indexName Index name
     * @param {object} [options]
     * @param {function} [options.successCallback] Function called on success. Receives event and origin as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     */
    index: function(storeName, indexName, { successCallback, errorCallback }={}) {
      var args = [storeName, indexName, successCallback, errorCallback];
      var task = {
        args: args,
        fn: delIndex
      };

      taskQueue.push(tkOpen);
      taskQueue.push(task);
    }
  };

  /**
   * Contains update methods
   * @namespace
   */
  this.update = {
    /**
     * Adds the task "update record/s" to the task queue.
     * @public
     * @instance
     * @param  {string} storeName Object store name.     
     * @param {string} query String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'Peter'                                    // Single value always refers to the index keypath<br>
     * @param  {object} objectValues Object with the new values.
     * The values not only can be a single value, it can be a function that receives the old value and returns a new value.
     * (Example: objectValues = {property1:'value1', property4: value4, property6: function(oldValue){return oldValue + 100;}})
     * @param {object} [options]
     * @param  {string} [options.indexName] Index name. If is null then no index is used (It is usually slower).
     * @param {function} [options.successCallback] Function called on success. Receives event, origin and query as parameters.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32,
     *     salary: 1500
     * }
     *
     *
     * //
     * // Changes the age and salary using an index named "names" with keypath 'name' as query.
     * //
     * mydb.update.records(
     *     'objectStoreName',                                       // Store
     *     'Peter',                                                 // Query
     *     {age: 33, salary: 1650},                                 // Object values
     *     {indexName: 'names', errorCallback: myErrorCallback }    // Options
     * );
     *
     *
     * //
     * // Increases the salary in 200 to all persons with age > 40 and salary < 1000 using a conditionObject array as query.
     * // We can send a function to the property salary on selected records.
     * //
     * mydb.update.records(
     *     'objectStoreName',
     *     'age > 40 & salary < 1000',
     *     {salary: function(oldSalary){
     *         return oldSalary + 200;
     *         };
     *     },
     *     { errorCallback: myErrorCallback }
     * );
     *
     *
     * // Execs all pending tasks.
     * //
     * mydb.execTasks();
     *
     *
     * // Optional callback function to process errors
     * //
     * function myErrorCallback(e){
     *     console.log(e);
     * };
     *
     */
    records: function(
      storeName,
      query,
      objectValues,
      { indexName, successCallback, errorCallback } = {}
    ) {
      var args = [query, objectValues, successCallback, errorCallback];
      var task = {
        args: args,
        fn: updateRecords
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('update -> Records(...)', storeName, 'readwrite');
      if (indexName) {
        setHelpTask.setIndex('update -> Records(...)', indexName);
      }
      taskQueue.push(task);
    }
  };

  this.aggregateFuncs = {
    sum: function(actual, selected) {
      return actual + selected;
    },
    avg: function(actual, selected, counter) {
      return (actual * (counter - 1) + selected) / counter;
    },
    max: function(actual, selected) {
      return selected > actual ? selected : actual;
    },
    min: function(actual, selected, counter) {
      if (counter == 1) {
        // First value of actual is null. Without this, min is allways null
        actual = selected;
      }
      return selected < actual && counter > 1 ? selected : actual;
    }
  };

  /**
   * Contains get methods
   * @namespace
   */
  this.get = {
    /**
     * Adds the task "get last records" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {number} maxResults Limits the records retrieved.
     * @param {function} successCallback Function called on success. Receives event and origin as parameters.
     * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // An example of object stored in the object store "storeName"
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     * //
     * // Gets the last 200 records from the object store named "storeName", and sends the result to a function(Callback)
     * //
     * mydb.get.lastRecords('storeName', 200, myCallback);
     *
     *
     * //
     * //Execs all pending tasks
     * //
     * mydb.execTasks();
     *
     *
     * // Callback function to process the results
     * //
     * function myCallback(resultsArray){
     *     var size = resultsArray.length();
     *     var i=0;
     *     for(i=0;i<size;i++){
     *         console.log('Name: ' + resultsArray[i].name + ' Age: ' + resultsArray[i].age + '\n');
     *     };
     * };
     *
     */
    lastRecords: function(storeName, maxResults, successCallback, errorCallback) {
      var args = [maxResults, successCallback, errorCallback];
      var task = {
        args: args,
        fn: lastRecords
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> lastRecords(...)', storeName, 'readonly');
      taskQueue.push(task);
    },

    /**
     * Adds the task "get one or more records from an object store" to the task queue.
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {function} successCallback Function called on success. Receives event, origin and query as parameters.
     * @param {object} [options]
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @param {string} [options.indexName] Index name. If it is null then no index is used (It is usually slower).
     * @param {string} [options.query] String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * 'peter'                                    // Single value always refers to the index keypath.<br>
     * A single value always refers to the index keypath so the index can not be null in this case.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * }
     *
     *
     * //
     * // Callback function to process the result
     * //
     * var myCallback = function(result){
     *
     *     if(Array.isArray(result)){
     *         var i=0;
     *         for(i=0;i<result.length)
     *         console.log('Name: ' + result[i].name + ' Age: ' + result[i].age + '\n');
     *     } else {
     *         console.log('Name: ' + result.name + ' Age: ' + result.age + '\n');
     *     }
     *
     * }
     *
     *
     * //
     * // If there is an index named "ages" based on property "age", we can get a person with age = 32.
     * //
     * mydb.get.records(
     *     'objectStoreName',
     *     myCallback,
     *     {indexNme: 'ages', query: 32}
     * );
     *
     *
     * //
     * // Or we can get persons with age > 30 and name! = Peter
     * //
     * mydb.get.records(
     *     'objectStoreName',
     *     myCallback,
     *     {query: 'age>30 & name != "Peter"' }
     * );
     *
     *
     * // Execs all pending tasks
     * mydb.execTasks();
     */
    records: function(storeName, successCallback, { errorCallback, indexName, query } = {}) {
      _index = null;
      var options = {
        query: query,
        errorCallback: errorCallback
      };
      var args = [successCallback, options];
      var task = {
        args: args,
        fn: getRecords
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Records(...)', storeName, 'readonly');
      if (indexName) {
        setHelpTask.setIndex('get -> Records(...)', indexName);
      }
      taskQueue.push(task);
    },

    /**
   * Add a task which goes through the registers and applies an aggregate function in one property.
   * @public
   * @instance
   * @param {string} storeName Store name.
   * @param  {string} property Represents the column to apply the aggregate function.
   * @param  {function} aggregatefn Function of type aggregate. Receives as arguments: actualValue ,selectedValue and counter.<br>
   * There are predefined functions in the object "aggregateFuncs": sum, avg, max, min. <br>
   * Or we can use a custom function.
   * Example:<br>
   * var myaggregateFunction = function(actualValue, selectedValue){
   *     return actualValue + selectedValue;
   *     };
   * @param  {function} successCallback Receives as parameters the result (one value) and origin.
   * @param {object} [options]
   * @param {string} [options.indexName] Index name. If it is null then no index is used (It is usually slower).
   * @param {string | number} [options.query] Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name = 'peter'                    // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * @param  {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
   * @example
   * var mydb = new sixdb('myDatabase');
   * 
   * //
   * // Gets the average salary of the employees with property age > 50
   * //
   * mydb.get.aggregateFn(
   *     'myObjectStore',
   *     'salary',
   *     aggregateFuncs.avg,
   *     mySuccessCallback,
   *     { query: 'age > 50' }
   * );
   * 
   * // Succes callback
   * //
   * function mySuccesCallback(result){
   *     console.log(result);
   * }
   * 
   * // Execs all pending tasks
   * //
   * mydb.execTasks();
   * 
   */
    aggregateFn: function(
      storeName,
      property,
      aggregatefn,
      successCallback,
      { indexName, query, errorCallback } = {}
    ) {
      _index = null;

      var origin = 'get -> aggregateFn(...)';
      var args = {
        storeName: storeName,
        property: property,
        successCallback: successCallback,
        aggregatefn: aggregatefn,
        origin: origin,
        indexName: indexName,
        query: query,
        errorCallback: errorCallback
      };

      makeAggregateTask(args);
    },

    /**
     * Adds the task "Count the records" to the task queue
     * @public
     * @instance
     * @param {string} storeName Store name.
     * @param {function} successCallback Function called on success. Receives the result (number), origin and query as parameters.
     * @param {object} [options]
     * @param {string} [options.indexName] Index name. The records of the store are counted.
     * @param {string} [options.query] String that contains a query. Example of valid queries:<br>
     * property = value                           // Simple query<br>
     * c > 10 & name='peter'                      // Query with 2 conditions<br>
     * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
     * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
     * With null query, all records are counted.
     * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
     * @example
     * var mydb = new sixdb('myDatabase');
     *
     * // An example of object stored in the object store
     * //
     * var person = {
     *     name: 'Peter',
     *     age: 32
     * };
     *
     * // Simple success callback
     * //
     * function successFunction(count,origin,query){
     *     console.log(count + ' records counted with query "' + query + '"');
     * }
     *
     * //
     * // Counts all records in the store "southFactory"
     * //
     * mydb.get.count('southFactory', successFunction);
     *
     * //
     * // Counts all records in the index 'Names'
     * //
     * mydb.get.count('southFactory', successFunction, { indexName: 'Names' });
     *
     * //
     * // Counts all persons with age > 30
     * //
     * mydb.get.count('southFactory', successFunction, { query: 'age > 30' });
     *
     * //
     * // Execs all pending task
     * //
     * mydb.execTasks();
     *
     */
    count: function(storeName, successCallback, { indexName, query, errorCallback }={}) {
      var args = [query, successCallback, errorCallback];
      var task = {
        args: args,
        fn: count
      };

      taskQueue.push(tkOpen);
      setHelpTask.setStore('get -> Count(...)', storeName, 'readonly');
      if (indexName) {
        setHelpTask.setIndex('get -> Count(...)', indexName);
      }
      taskQueue.push(task);
    }
  };

  var setHelpTask = {
    
    setStore: function(origin, storeName, rwMode) {
      var args = [origin, storeName, rwMode];
      var task = {
        args: args,
        fn: setStore
      };

      taskQueue.push(task);
    },
    setIndex: function(origin, indexName) {
      var args = [origin, indexName];
      var task = {
        args: args,
        fn: setIndex
      };

      taskQueue.push(task);
    }
  };

  function makeAggregateTask({
    storeName,
    property,
    successCallback,
    aggregatefn,
    origin,
    indexName,
    query,
    errorCallback
  }) {
    _index = null;

    var options = {
      query: query,
      errorCallback: errorCallback
    };
    var args = [property, aggregatefn, successCallback, origin, options];
    var task = {
      args: args,
      fn: getaggregateFunction
    };

    taskQueue.push(tkOpen);
    setHelpTask.setStore(origin, storeName, 'readonly');
    if (indexName) {
      setHelpTask.setIndex(origin, indexName);
    }
    taskQueue.push(task);
  }

  //#endregion Task queue system

  //#region Logger system
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  var logEnum = {
    begin: '//--------------------------------------->'
  };

  function logger(message, isError) {
    if (consoleOff && !isError) return;

    if (!isError) console.log(message);
    else console.error(message);
  }

  //#endregion Logger system

  //#region Error handler
  ///////////////////////////////////////////////////////////////////////////////////////////

  var lastErrorObj;

  /**
   * Contains all error codes.
   * @private
   * @type {object}
   * @default
   * @readonly
   */
  var errorSys = {
    codes: {
      // Incorrect parameter
      1: 'storeName must be a string',
      2: 'storeName is null',
      3: 'obj is null',
      4: 'indexName is null',
      5: 'indexName must be a string',
      6: 'keyPath is null',
      7: 'keyPath must be a string',
      8: 'query is null',
      9: 'query must be a string or a number',
      10: 'objectValues is null',
      11: 'objectValues must be an object',
      12: 'maxResults must be a number or null',
      13: 'successCallback is not a function',
      14: 'errorCallback is not a function',
      15: 'obj must be an object or an array of objects',
      16: 'query must be an string',
      17: 'the specified index does not exist',
      //IndexedDB error
      20: 'IndexedDB error'
    },

    testStr: function(str) {
      if (str) {
        if (typeof str != 'string') {
          this.test = 1;
          return 1;
        } // str isn't string
      } else {
        this.test = 2;
        return 2; // str is null
      }
      return false; // str exist and is a string
    },

    testCallback: function(fn) {
      var isFunction = true;
      if (fn) {
        if (typeof fn != 'function') {
          isFunction = false;
        }
        return isFunction;
      }
    },

    /**
     * Makes an error object and stores it in lastErrorObj variable.
     * @private
     * @param  {string} origin Name of the origin function
     * @param  {number} errorCode Id number.
     * @param  {object} domException DOMexception triggered by the error
     * @return {boolean}
     */
    makeErrorObject: function(origin, errorCode, domException) {
      var errorObj = {};
      if (!domException) {
        errorObj.code = errorCode;
        errorObj.type = errorCode < 18 ? 'Invalid parameter' : 'IndexedDB error';
        errorObj.origin = origin;
        errorObj.description = this.codes[errorCode];
      } else {
        errorObj.code = 20;
        errorObj.type = domException.name;
        errorObj.origin = origin;
        errorObj.description = domException.message;
      }

      lastErrorObj = errorObj;

      return true;
    }
  };

  //#endregion Error handler

  //#region Private functions
  //////////////////////////////////////////////////////////////////////////////////////

  /**
   * Opens the database
   * @private
   * @return {void}
   */
  function openDb() {
    var request = window.indexedDB.open(dbName);

    request.onerror = function() {
      alert('Error. You must allow web app to use indexedDB.');
    };

    request.onsuccess = function(event) {
      db = event.target.result;
      done();
    };
  }

  /**
   * Gets last records from an object store
   * @private
   * @param {number} maxResults Limits the records retrieved.
   * @param {function} successCallback Function called when done. Receives as parameters the retrieved records and origin.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function lastRecords(maxResults, successCallback = voidFn, errorCallback = voidFn) {
    var origin = 'get -> lastRecords(...)';
    var resultFiltered = [];
    var counter = 0;
    var request = null;

    logger(origin + logEnum.begin);

    //// Executed if maxResults is not null. Opens a cursor to count the results.
    //
    var onsuccesCursorFunction = function(event) {
      var cursor = event.target.result;

      if (cursor && counter < maxResults) {
        resultFiltered.push(cursor.value);
        counter++;
        cursor.continue();
      } else {
        successCallback(resultFiltered, origin);
        db.close();
        logger(counter + ' last records returned from store "' + _store.name + '"');
        done();
      }
    };

    //// Executed if maxResults is null. Don't needs cursor. (It's faster)
    //
    var onsuccesGetAllFunction = function(event) {
      requestSuccessAction(
        event.target.result,
        origin,
        successCallback,
        'All records returned from store "' + _store.name + '"'
      );
    };

    var onerrorFunction = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };

    //// Gets the correct request
    if (maxResults != null) {
      /// Opens a cursor from last record in reverse direction
      try {
        request = _store.openCursor(null, 'prev').onsuccess = onsuccesCursorFunction;
      } catch (e) {
        db.close();
        errorSys.makeErrorObject(origin, 20, request.error);
        logger(lastErrorObj, true);
        taskQueue.shift();
        errorCallback(lastErrorObj);
        checkTasks();
      }
      request.onsuccess = onsuccesCursorFunction;
      request.onerror = onerrorFunction;
    } else {
      /// Gets all records. It is faster than openCursor.
      request = tryStoreGetAll(origin, _store, errorCallback); //store.getAll();
      if (!request) {
        checkTasks();
        return;
      }
      request.onsuccess = onsuccesGetAllFunction;
      request.onerror = onerrorFunction;
    }
  } //end lastRecords()

  /**
   * Checks _index and query, and call to the correct function to get the record/s.
   * @private
   * @param {function(object[],string)} successCallback Receives as parameters the result and origin. Result can be an object array, single object or string.
   * @param {object} [options]
   * @param {string | number} [options.query] Query
   * @param {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function getRecords(
    successCallback = voidFn,
    { query, errorCallback = voidFn }
  ) {
    var origin = 'get -> getRecords(...)';
    logger(origin + logEnum.begin);

    var commonArgs = {
      origin: origin,
      successCallback: successCallback,
      errorCallback: errorCallback
    };

    if (!_index && !query) getRecordsA(commonArgs);
    else if (!_index && query) getRecordsB(query, commonArgs);
    else if (_index && !query) getRecordsC(commonArgs);
    else if (_index && query) getRecordsD(query, commonArgs);
  }

  function getRecordsA({ origin, successCallback, errorCallback }) {
    var request = null;

    /// Callbacks of request
    var onsuccess = function(event) {
      requestSuccessAction(
        event.target.result,
        origin,
        successCallback,
        'All records returned from store "' + _store.name + '"'
      );
    };
    var onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryStoreGetAll(origin, _store, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccess;
    request.onerror = onerror;
  }

  function getRecordsB(query, { origin, successCallback, errorCallback }) {
    var resultFiltered = [];
    var request = null;

    var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);

    var extMode = conditionsBlocksArray
      ? conditionsBlocksArray[0].externalLogOperator
      : null;
    var exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;

    sharedObj = {
      counter: 0,
      extMode: extMode,
      event: resultFiltered,
      resultFiltered: resultFiltered,
      origin: origin,
      query: query,
      conditionsBlocksArray: conditionsBlocksArray,
      exitsInFirstTrue: exitsInFirstTrue,
      logFunction: queryLog,
      cursorFunction: cursorGetRecords,
      successCallback: successCallback
    };

    /// request callbacks
    var onsucces = function(event) {
      var cursor = event.target.result;
      cursorLoop(cursor);
    };

    var onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryOpenCursor(origin, _store, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsucces;
    request.onerror = onerror;
  }

  function getRecordsC({ origin, successCallback, errorCallback }) {
    var request = null;

    /// request callbacks
    var onsuccesGetAll = function(event) {
      successCallback(event.target.result, origin);
      db.close();
      logger(
        'All records returned from index "' +
          _index.name +
          '" in store "' +
          _index.objectStore.name +
          '"'
      );
      _index = null;
      done();
    };
    var onerrorFunction = function() {
      _index = null;
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryIndexGetAll(origin, _index, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccesGetAll;
    request.onerror = onerrorFunction;
  }

  function getRecordsD(query, { origin, successCallback, errorCallback }) {
    var resultFiltered = [];
    var isIndexKeyValue = isKey(query);
    var request = null;

    if (!isIndexKeyValue) {
      var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
      var extMode = conditionsBlocksArray[0].externalLogOperator;
      var exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;
      sharedObj = {
        counter: 0,
        extMode: extMode,
        event: resultFiltered,
        resultFiltered: resultFiltered,
        origin: origin,
        query: query,
        conditionsBlocksArray: conditionsBlocksArray,
        exitsInFirstTrue: exitsInFirstTrue,
        logFunction: queryLog,
        cursorFunction: cursorGetRecords,
        successCallback: successCallback
      };
    }

    /// request callbacks
    var onsuccesIndexGetKey = function(event) {
      successCallback(event.target.result, origin, query);
      db.close();
      logger(
        'Records with key "' +
          query +
          '" returned from index "' +
          _index.name +
          '" on object store "' +
          _index.objectStore.name +
          '"'
      );
      _index = null;
      done();
    };
    var onsuccesCursor = function(event) {
      var cursor = event.target.result;
      cursorLoop(cursor);
    };
    var onerror = function() {
      _index = null;
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = !isIndexKeyValue
      ? tryOpenCursor(origin, _index, errorCallback)
      : tryIndexGetKey(origin, _index, query, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = isIndexKeyValue ? onsuccesIndexGetKey : onsuccesCursor;
    request.onerror = onerror;
  }

  /**
   * Checks _index and query and calls the correct function to calculate the aggregate operation.
   * @private
   * @param  {string} property Represents the column to apply the aggregate function.
   * @param  {function} aggregatefn Function of type aggregate. Receives as arguments: actualValue ,selectedValue and counter.<br>
   * Example:<br>
   * var myaggregateFunction = function(actualValue, selectedValue){
   *     return actualValue + selectedValue;
   *     };
   * @param  {function} successCallback Receives as parameters the result (a number) and origin.
   * @param {object} [options]
   * @param {string | number} [options.query] Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * @param  {function} [options.errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function getaggregateFunction(
    property,
    aggregatefn,
    successCallback = voidFn,
    origin,
    { query, errorCallback = voidFn }
  ) {
    logger(origin + logEnum.begin);

    var commonArgs = {
      origin: origin,
      property: property,
      aggregatefn: aggregatefn,
      successCallback: successCallback,
      errorCallback: errorCallback
    };

    if (!_index && !query) getaggregateFunctionA(_store, commonArgs);
    else if (!_index && query) getAggregateFunctionB(_store, query, commonArgs);
    else if (_index && !query) getaggregateFunctionA(_index, commonArgs);
    else if (_index && query) getAggregateFunctionB(_index, query, commonArgs);
  }

  function getaggregateFunctionA(
    _store,
    { origin, property, aggregatefn, successCallback, errorCallback }
  ) {
    var request = null;
    var actualValue = null;
    var counter = 0;

    /// request callbacks
    var onsuccess = function(event) {
      var cursor = event.target.result;

      if (cursor) {
        if (cursor.value[property]) {
          counter++;
          actualValue = aggregatefn(actualValue, cursor.value[property], counter);
        }
        cursor.continue();
      } else {
        successCallback(actualValue, origin);
        db.close();
        logger('Result of ' + origin + ' on property "' + property + '": ' + actualValue);
        _index = null;
        done();
      }
    };
    var onerrorFunction = function() {
      _index = null;
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccess;
    request.onerror = onerrorFunction;
  }

  function getAggregateFunctionB(
    _store,
    query,
    { origin, property, aggregatefn, successCallback, errorCallback }
  ) {
    var request = null;
    //var actualValue = null;
    var isIndexKeyValue = isKey(query);
    if (isIndexKeyValue) query = _store.keyPath + '=' + query;
    var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);

    var extMode = conditionsBlocksArray
      ? conditionsBlocksArray[0].externalLogOperator
      : null;
    var exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;
    sharedObj = {
      counter: 0,
      actualValue: null,
      get event() {
        return this.actualValue;
      },
      property: property,
      aggregatefn: aggregatefn,
      extMode: extMode,
      origin: origin,
      query: query,
      conditionsBlocksArray: conditionsBlocksArray,
      exitsInFirstTrue: exitsInFirstTrue,
      logFunction: aggregateLog,
      cursorFunction: cursorAggregate,
      successCallback: successCallback
    };

    /// request callbacks
    var onsuccesCursor = function(event) {
      var cursor = event.target.result;
      cursorLoop(cursor);
    };
    var onerrorFunction = function() {
      _index = null;
      sharedObj = {};
      requestErrorAction(origin, request.error, errorCallback);
    };

    /// request definition
    request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccesCursor;
    request.onerror = onerrorFunction;
  }
  

  /**
   * Creates the new Database.
   * @private
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newDB(errorCallback = voidFn) {
    var request = window.indexedDB.open(dbName);
    var origin = 'add -> newDB(...)';
    logger(origin + logEnum.begin);

    // Boolean: Database doesn't exist (no database = noDb)
    var noDb = false;

    // if onupgradeneeded means is a new database
    request.onupgradeneeded = function() {
      noDb = true;
    };

    request.onsuccess = function(event) {
      var db = event.target.result;
      db.close();
      if (noDb) {
        logger('Database "' + dbName + '" created');
      } else {
        logger('Database "' + dbName + '" already exists');
      }
      done();
    };

    request.onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };
  }

  /**
   * Creates a new object store
   * @private
   * @param {string} dbName Database name
   * @param {string} storeName Objects store name
   * @param {function} [successCallback] Function called on success. Receives as parameters event and origin.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newStore(storeName, successCallback = voidFn, errorCallback = voidFn) {
    var version;
    var origin = 'add -> newStore(...)';
    logger(origin + logEnum.begin);

    // If store already exist then returns
    if (db.objectStoreNames.contains(storeName)) {
      db.close();
      logger('Object store "' + storeName + '" already exists');
      done();
      return;
    }

    version = db.version;
    db.close();
    var newVersion = version + 1;
    var store;

    var request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function(event) {
      db = event.target.result;

      try {
        store = db.createObjectStore(storeName, {
          keyPath: 'nId',
          autoIncrement: true
        });
      } catch (e) {
        requestErrorAction(origin, e, errorCallback);
        return;
      }

      store.onerror = function(event) {
        requestErrorAction(origin, event.target.error, errorCallback);
      };
    };

    request.onsuccess = function(event) {
      requestSuccessAction(
        event,
        origin,
        successCallback,
        'New object store "' + storeName + '" created'
      );
    };
  }

  /**
   * Checks the object to insert in the object store and calls the correct function to do it.
   * @private
   * @param {(object | object[])} obj An object or objects array to insert in object store
   * @param {function} [successCallback] Function called on success. Receives as parameters event and origin.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newRecord(obj, successCallback = voidFn, errorCallback = voidFn) {
    var origin = 'add -> newRecord(...)';
    logger(origin + logEnum.begin);
    var args = { obj, origin, successCallback, errorCallback }; //shorthand properties es6

    if (Array.isArray(obj)) {
      newRecordA(args);
    } else {
      newRecordB(args);
    }
  }

  function newRecordA({ obj, origin, successCallback, errorCallback }) {
    var objSize = obj.length;
    var counter = 0;

    while (counter < objSize) {
      var request = _store.add(obj[counter]);
      counter++;
      request.onerror = function() {
        requestErrorAction(origin, request.error, errorCallback);
      };
    }
    requestSuccessAction(
      event,
      origin,
      successCallback,
      'New record/s added to store "' + _store.name + '"'
    );
  }

  function newRecordB({ obj, origin, successCallback, errorCallback }) {
    var request = _store.add(obj);
    request.onsuccess = function(event) {
      requestSuccessAction(
        event,
        origin,
        successCallback,
        'New record/s added to store "' + _store.name + '"'
      );
    };

    request.onerror = function(event) {
      requestErrorAction(origin, event.target.error, errorCallback);
    };
  }

  /**
   * Creates a new index in an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {string} keyPath Key that the index use
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function newIndex(
    storeName,
    indexName,
    keyPath,
    successCallback = voidFn,
    errorCallback = voidFn
  ) {
    var version;
    var origin = 'add -> newIndex(...)';
    logger(origin + logEnum.begin);

    //// Gets the new version
    //
    version = db.version;
    db.close();
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    var request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function(event) {
      db = event.target.result;
      var store = null;

      var upgradeTransaction = event.target.transaction;

      //// Gets store
      try {
        store = upgradeTransaction.objectStore(storeName);
      } catch (e) {
        requestErrorAction(origin, e, errorCallback);
        return;
      }

      if (!store.indexNames.contains(indexName)) {
        store.createIndex(indexName, keyPath);
      } else {
        db.close();
        logger(
          'The index "' + indexName + '" already exists in store "' + storeName + '"'
        );
        done();
        return;
      }
    };

    request.onsuccess = function(event) {
      requestSuccessAction(
        event,
        origin,
        successCallback,
        'Index "' + indexName + '" created in store "' + storeName + '"'
      );
    };

    request.onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };
  }

  /**
   * Count the records
   * @private
   * @param {string | null} query String that contains a query. Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * With null query, all records are counted.
   * @param {function} [successCallback] Function called on success. Receives the result (number), origin and query as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function count(query, successCallback = voidFn, errorCallback = voidFn) {
    var origin = 'get -> count(...)';
    logger(origin + logEnum.begin);

    if (!query) {
      if (_index) query = _index.keyPath + '!= null';
      else query = _store.keyPath + '!= -1';
    }

    var conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);
    var extMode = conditionsBlocksArray
      ? conditionsBlocksArray[0].externalLogOperator
      : null;
    var exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;
    /// Object used by cursorLoop()
    sharedObj = {
      counter: 0,
      get event() {
        return this.counter;
      },
      extMode: extMode,
      origin: origin,
      query: query,
      conditionsBlocksArray: conditionsBlocksArray,
      exitsInFirstTrue: exitsInFirstTrue,
      logFunction: countLog,
      cursorFunction: cursorCount,
      successCallback: successCallback
    };

    if (_index) {
      initCursorLoop(_index, errorCallback);
    } else {
      initCursorLoop(_store, errorCallback);
    }
  }

  /**
   * Deletes an object store.
   * @private
   * @param {string} storeName Object store name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delStore(storeName, successCallback = voidFn, errorCallback = voidFn) {
    var version;
    var origin = 'del -> delStore(...)';
    logger(origin + logEnum.begin);

    //// Gets the new version
    //
    version = db.version;
    db.close();
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    var request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function(event) {
      db = event.target.result;
      db.deleteObjectStore(storeName);
    };

    request.onsuccess = function(event) {
      requestSuccessAction(
        event,
        origin,
        successCallback,
        'Object store "' + storeName + '" deleted'
      );
    };

    request.onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };
  }

  /**
   * Deletes a Database
   * @private
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delDB(successCallback = voidFn, errorCallback = voidFn) {
    var origin = 'del -> delDB(...)';
    logger(origin + logEnum.begin);

    var request = window.indexedDB.deleteDatabase(dbName);

    request.onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };

    request.onsuccess = function(event) {
      successCallback(event, origin);
      logger('Database "' + dbName + '" deleted');
      done();
    };
  }

  /**
   * Deletes one or more records from a store. Records are selected by the query.
   * @private
   * @param {string | number} query Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * @param {function(event,origin)} [successCallback] Function called on success. Receives event, origin and query as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delRecords(query, successCallback = voidFn, errorCallback = voidFn) {
    var origin = 'del -> delRecords(...)';
    logger(origin + logEnum.begin);
    var request = null;

    //// Gets isIndexKeyValue
    //// True if query is a single value (an index key)
    //
    var isIndexKeyValue = isKey(query);

    var conditionsBlocksArray;
    if (isIndexKeyValue) {
      // if is a number here is converted to string
      query = _index.keyPath + '=' + query;
    }
    conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);

    var extMode = conditionsBlocksArray
      ? conditionsBlocksArray[0].externalLogOperator
      : null;
    var exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;

    sharedObj = {
      counter: 0,
      extMode: extMode,
      event: event,
      origin: origin,
      query: query,
      conditionsBlocksArray: conditionsBlocksArray,
      exitsInFirstTrue: exitsInFirstTrue,
      logFunction: queryLog,
      cursorFunction: cursorDelRecords,
      successCallback: successCallback
    };

    var onsuccesCursor = function(event) {
      var cursor = event.target.result;
      cursorLoop(cursor);
    }; // end onsuccesCursor

    var onerrorFunction = function() {
      _index = null;
      sharedObj = {};
      requestErrorAction(origin, request.error, errorCallback);
    };

    if (_index) {
      request = tryOpenCursor(origin, _index, errorCallback); //index.openCursor();
    } else {
      request = tryOpenCursor(origin, _store, errorCallback); //store.openCursor();
    }
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = onsuccesCursor;
    request.onerror = onerrorFunction;
  }

  /**
   * Deletes an index
   * @private
   * @param {string} storeName Object store name
   * @param {string} indexName Index name
   * @param {function} [successCallback] Function called on success. Receives event and origin as parameters.
   * @param {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function delIndex(
    storeName,
    indexName,
    successCallback = voidFn,
    errorCallback = voidFn
  ) {
    var version;
    var origin = 'del -> delIndex(...)';
    logger(origin + logEnum.begin);

    //// Gets the new version
    //
    version = db.version;
    db.close();
    var newVersion = version + 1;

    //// The change of the database schema only can be performed in the onupgradedneeded event
    //// so a new version number is needed to trigger that event.
    //
    var request = window.indexedDB.open(dbName, newVersion);

    request.onupgradeneeded = function(event) {
      db = event.target.result;
      var store = null;

      var upgradeTransaction = event.target.transaction;

      //// Gets store
      try {
        store = upgradeTransaction.objectStore(storeName);
      } catch (e) {
        requestErrorAction(origin, e, errorCallback);
        return;
      }

      store.deleteIndex(indexName);
    };

    request.onsuccess = function(event) {
      requestSuccessAction(
        event,
        origin,
        successCallback,
        'Index "' + indexName + '" deleted from object store "' + storeName + '"'
      );
    };

    request.onerror = function() {
      requestErrorAction(origin, request.error, errorCallback);
    };
  }

  /**
   * Updates one or more records. Records are selected by the query and updated with the objectValues.
   * Checks query and index and calls to the correct function to update the records.
   * @private
   * @param  {string} storeName Object store name.
   * @param  {string} [indexName] Index name. If is null then no index is used (It is usually slower)
   * @param {string | number} query Example of valid queries:<br>
   * property = value                           // Simple query<br>
   * c > 10 & name='peter'                      // Query with 2 conditions<br>
   * (c > 10 && name = 'peter')                 // Same effect that prev query (&=&& and |=||)<br>
   * (a > 30 & c <= 10) || (b = 100 || d < 50)  // 2 conditions blocks<br>
   * 'Peter'                                    // Single value always refers to the index keypath<br>
   * A single value always refers to the index keypath so the index can not be null in this case.
   * @param  {object} objectValues Object with the new values (ex: {property1: value, property3: value}).
   * @param {function} [successCallback] Function called on success. Receives event, origin and query as parameters.
   * @param  {function} [errorCallback] Optional function to handle errors. Receives an error object as argument.
   */
  function updateRecords(
    query,
    objectValues,
    successCallback = voidFn,
    errorCallback = voidFn
  ) {
    var origin = 'update -> updateRecords(...)';
    logger(origin + logEnum.begin);
    var isIndexKeyValue = false;

    //// Gets isIndexKeyValue
    //// If true then is query is a single value (an index key)
    isIndexKeyValue = isKey(query);

    var conditionsBlocksArray;
    if (isIndexKeyValue) {
      // If query is a single number value then is mofied to be valid to the query system
      query = _index.keyPath + '=' + query;
    }
    conditionsBlocksArray = qrySys.makeConditionsBlocksArray(query);

    var extMode = conditionsBlocksArray
      ? conditionsBlocksArray[0].externalLogOperator
      : null;
    var exitsInFirstTrue = extMode == null || extMode == 'and' ? false : true;

    sharedObj = {
      counter: 0,
      keys: Object.keys(objectValues),
      newObjectValuesSize: Object.keys(objectValues).length,
      extMode: extMode,
      objectValues: objectValues,
      event: event,
      origin: origin,
      query: query,
      conditionsBlocksArray: conditionsBlocksArray,
      exitsInFirstTrue: exitsInFirstTrue,
      logFunction: queryLog,
      cursorFunction: cursorUpdate,
      successCallback: successCallback
    };

    if (_index) {
      initCursorLoop(_index, errorCallback);
    } else {
      initCursorLoop(_store, errorCallback);
    }
  }

  function initCursorLoop(store, errorCallback) {
    var request = tryOpenCursor(sharedObj.origin, store, errorCallback);
    if (!request) {
      checkTasks();
      return;
    }
    request.onsuccess = function(event) {
      var cursor = event.target.result;
      cursorLoop(cursor);
    };
    request.onerror = function() {
      _index = null;
      requestErrorAction(origin, request.error, errorCallback);
    };
  }

  //#endregion Private functions

  //#region helper functions
  /////////////////////////////////////////////////////////////////////////////////////////////////////

  function tryStoreGetAll(origin, store, errorCallback) {
    var request = null;
    try {
      request = store.getAll();
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function tryIndexGetAll(origin, index, errorCallback) {
    var request = null;
    try {
      request = index.getAll();
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function tryIndexGetKey(origin, index, key, errorCallback) {
    var request = null;
    try {
      request = index.getAll(key);
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function tryOpenCursor(origin, openerObj, errorCallback) {
    var request = null;
    try {
      request = openerObj.openCursor();
    } catch (e) {
      reportCatch(origin, e, errorCallback);
      return null;
    }
    return request;
  }

  function reportCatch(origin, e, errorCallback) {
    errorSys.makeErrorObject(origin, 20, e);
    taskQueue.shift();
    db.close();
    errorCallback(lastErrorObj);
    logger(lastErrorObj, true);
  }

  /*
  function invalidArgsAcction(errorCallback) {
    taskQueue.shift(); // Delete actual task prevent problem if custom errorCallback creates a new task
    db.close();
    errorCallback(lastErrorObj);
    logger(lastErrorObj, true);
    checkTasks();
  }*/

  function requestErrorAction(origin, error, errorCallback) {
    db.close();
    errorSys.makeErrorObject(origin, 20, error);
    logger(lastErrorObj, true);
    taskQueue.shift();
    errorCallback(lastErrorObj);
    checkTasks();
  }

  function requestSuccessAction(event, origin, successCallback, message) {
    successCallback(event, origin);
    db.close();
    logger(message);
    done();
  }

  function testCursor(conditionsBlocksArray, exitsInFirst, cursor) {
    var test = false;
    var i = 0;
    var size = conditionsBlocksArray.length;
    for (i = 0; i < size; i++) {
      var conditions = conditionsBlocksArray[i].conditionsArray;
      var intMode = conditionsBlocksArray[i].internalLogOperator;
      test = qrySys.testConditionBlock(cursor, conditions, intMode);
      if (test == exitsInFirst) {
        break;
      }
    }
    return test;
  }

  function isKey(query) {
    var isKey = false;
    if (query) {
      if (typeof query == 'number') {
        isKey = true;
      } else {
        isKey = query.match(qrySys.operatorRgx) ? false : true;
      }
    }
    return isKey;
  }

  function setStore(origin, storeName, rwMode) {
    _store = null;
    try {
      _store = db.transaction(storeName, rwMode).objectStore(storeName);
    } catch (e) {
      errorSys.makeErrorObject(origin, 20, e);
      logger(lastErrorObj, true);
    }
    done();
  }

  function setIndex(origin, indexName) {
    _index = null;
    try {
      _index = _store.index(indexName);
    } catch (e) {
      errorSys.makeErrorObject(origin, 20, e);
      logger(lastErrorObj, true);
    }
    done();
  }

  /// Cursor functions /////////////////////

  function cursorUpdate(cursor) {
    var updateData = cursor.value;
    for (i = 0; i < sharedObj.newObjectValuesSize; i++) {
      // If the new value for the property keys[i] is a function then the new value is function(oldValue)
      updateData[sharedObj.keys[i]] =
        typeof sharedObj.objectValues[sharedObj.keys[i]] == 'function'
          ? sharedObj.objectValues[sharedObj.keys[i]](updateData[sharedObj.keys[i]])
          : sharedObj.objectValues[sharedObj.keys[i]];
    }

    cursor.update(updateData);
    sharedObj.counter++;
  }

  function cursorDelRecords(cursor) {
    cursor.delete();
    sharedObj.counter++;
  }

  function cursorGetRecords(cursor) {
    sharedObj.resultFiltered.push(cursor.value);
    sharedObj.counter++;
  }

  function cursorCount() {
    sharedObj.counter++;
  }

  function cursorAggregate(cursor) {
    if (cursor.value[sharedObj.property]) {
      sharedObj.counter++;
      sharedObj.actualValue = sharedObj.aggregatefn(
        sharedObj.actualValue,
        cursor.value[sharedObj.property],
        sharedObj.counter
      );
    }
  }

  function cursorLoop(cursor) {
    if (cursor) {
      var test = testCursor(
        sharedObj.conditionsBlocksArray,
        sharedObj.exitsInFirstTrue,
        cursor
      );

      if (test) {
        sharedObj.cursorFunction(cursor);
      }
      cursor.continue();
    } else {
      sharedObj.successCallback(sharedObj.event, sharedObj.origin, sharedObj.query);
      db.close();
      sharedObj.logFunction();
      _index = null;
      sharedObj = {};
      done();
    }
  }

  /// Logger functions
  function queryLog() {
    logger(
      'Processed query: "' +
        sharedObj.query +
        '" finished\n' +
        sharedObj.counter +
        ' records returned from object store "' +
        _store.name +
        '"'
    );
  }

  function countLog() {
    logger(
      'Processed query finished: "' +
        sharedObj.query +
        '"\n' +
        sharedObj.counter +
        ' records counted from the query to store: "' +
        _store.name +
        '"'
    );
  }

  function aggregateLog() {
    logger(
      'Result of ' +
        sharedObj.origin +
        ' on property "' +
        sharedObj.property +
        '": ' +
        sharedObj.actualValue
    );
  }

  //#endregion helper functions

  /**
   * Contains some util methods
   * @namespace
   */
  this.utils = {
    /**
     * Extracts a part of n elements from an array wich represents a data page.
     * @public
     * @instance
     * @param {object[]} array Array where the "page" is extracted
     * @param {number} elementsPerPage Number of elements per page
     * @param {number} page The page wich will be extracted from array
     * @returns {Array} The part of original array wich represents the page
     */
    pageFromArray: function(array, elementsPerPage, page) {
      var pageArray = array.slice((page - 1) * elementsPerPage, page * elementsPerPage);
      return pageArray;
    }
  };

  //// Initialization /////////////////////////////
  qrySys.init();
  this.add.db();
  this.execTasks();
};
