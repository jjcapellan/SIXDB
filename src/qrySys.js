/* eslint-disable */
import {customOperator} from './main';

export const _qrySys = {
  init() {
    this.blockRgx = /\(.*?(?=\))/g;
    this.blockOperatorRgx = /[\&\|]+(?=(\s*\())/g;
    this.operatorRgx = /(=|>|<|>=|<=|!=|<>|\^|\$|~~)+/g;
    this.rightOperandRgx = /(?:([=><\^\$~]))\s*["']?[^"']+["']?\s*(?=[&\|])|(?:[=><\^\$~])\s*["']?[^"']+["']?(?=$)/g;
    this.leftOperandRgx = /([^"'\s])(\w+)(?=\s*[=|>|<|!|\^|\$~])/g;
  },

  makeConditionsBlocksArray(query) {
    let t = this;
    let conditionsBlocksArray = [];

    //// Gets blocks
    //
    let blocks = query.match(t.blockRgx);

    // Logical operators between blocks, all must be the same type
    let extLogOperator = query.match(t.blockOperatorRgx)
      ? query.match(t.blockOperatorRgx)
      : null;

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

    for (let i = 0; i < blocks.length; i++) {
      t.pushConditionBlockToArray(blocks[i], extLogOperator, conditionsBlocksArray);
    }
    return conditionsBlocksArray;
  },

  deleteLeftParentheses(blocks) {
    let size = blocks.length;
    for (let i = 0; i < size; i++) {
      blocks[i] = blocks[i].substr(1);
    }
  },

  pushConditionBlockToArray(query, extLogOperator, conditionsBlocksArray) {
    let t = this;
    let leftOperands = query.match(t.leftOperandRgx);
    let rightOperands = query.match(t.rightOperandRgx);

    for (let i = 0; i < rightOperands.length; i++) {
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
    for (let i = 0; i < rightOperands.length; i++) {
      query = query.replace(rightOperands[i], '');
    }
    let operators = query.match(t.operatorRgx);

    let conditionsArray = [];

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
      let logOperatorsType = query.match(/[\&\|]+/g)[0];

      if (logOperatorsType == '&' || logOperatorsType == '&&') {
        logOperatorsType = 'and';
      } else {
        logOperatorsType = 'or';
      }

      for (let i = 0; i < operators.length; i++) {
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

  testConditionBlock(cursor, conditionsArray, operator) {
    let t = this;

    let test = operator == 'and' || !operator ? true : false;
    for (let i = 0; i < conditionsArray.length; i++) {
      test = t.testCondition(
        cursor.value[conditionsArray[i].keyPath],
        conditionsArray[i].cond,
        conditionsArray[i].value
      );
      if ((operator == 'and' || !operator) && !test) return false;
      else if (operator == 'or' && test) return true;
    }

    return test;
  },

  testCondition(value1, condition, value2) {
    let result;
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

      case '~~': //custom operator
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
};
