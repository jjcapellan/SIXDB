import {
  _qrySys,
  checkTasks,
  db,
  done,
  lastErrorObj,
  logger,
  makeErrorObject,
  tasks,
} from './index.js';

const qrySys = _qrySys;
let sharedObj = {};

function testCursor(conditionsBlocksArray, exitsInFirst, cursor) {
  let test = false;
  let i = 0;
  let size = conditionsBlocksArray.length;
  for (i = 0; i < size; i++) {
    let conditions = conditionsBlocksArray[i].conditionsArray;
    let intMode = conditionsBlocksArray[i].internalLogOperator;
    test = qrySys.testConditionBlock(cursor, conditions, intMode);
    if (test == exitsInFirst) {
      break;
    }
  }
  return test;
}

function reportCatch(origin, e, errorCallback) {
  makeErrorObject(origin, e);
  tasks.shift();
  db.close();
  errorCallback(lastErrorObj);
  logger(lastErrorObj, true);
}

export function cursorAggregate(cursor) {
  if (cursor.value[sharedObj.property]) {
    sharedObj.counter++;
    sharedObj.actualValue = sharedObj.aggregatefn(
      sharedObj.actualValue,
      cursor.value[sharedObj.property],
      sharedObj.counter
    );
  }
}

export function aggregateLog() {
  logger(
    `Result of ${sharedObj.origin} on property "${sharedObj.property}": ${sharedObj.actualValue}`
  );
}

export function setSharedObj(obj) {
  sharedObj = obj;
}

export function requestSuccessAction(event, origin, successCallback, message) {
  successCallback(event, origin);
  db.close();
  logger(message);
  done();
}

export function requestErrorAction(origin, error, errorCallback) {
  db.close();
  makeErrorObject(origin, error);
  logger(lastErrorObj, true);
  tasks.shift();
  errorCallback(lastErrorObj);
  checkTasks();
}

export function tryGetAll(origin, source, errorCallback) {
  let request = null;
  try {
    request = source.getAll();
  } catch (e) {
    reportCatch(origin, e, errorCallback);
    return null;
  }
  return request;
}

export function tryOpenCursor(origin, source, errorCallback) {
  let request = null;
  try {
    request = source.openCursor();
  } catch (e) {
    reportCatch(origin, e, errorCallback);
    return null;
  }
  return request;
}

export function cursorLoop(cursor) {
  if (cursor) {
    let test = testCursor(
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
    done();
  }
}

export function cursorGetRecords(cursor) {
  sharedObj.resultFiltered.push(cursor.value);
  sharedObj.counter++;
}

export function cursorDelRecords(cursor) {
  cursor.delete();
  sharedObj.counter++;
}

export function cursorCount() {
  sharedObj.counter++;
}

export function cursorUpdate(cursor) {
  let updateData = cursor.value;
  for (let i = 0, j = sharedObj.newObjectValuesSize; i < j; i++) {
    // If the new value for the property keys[i] is a function then the new value is function(oldValue)
    updateData[sharedObj.keys[i]] =
      typeof sharedObj.objectValues[sharedObj.keys[i]] == 'function'
        ? sharedObj.objectValues[sharedObj.keys[i]](updateData[sharedObj.keys[i]])
        : sharedObj.objectValues[sharedObj.keys[i]];
  }

  cursor.update(updateData);
  sharedObj.counter++;
}

export function countLog() {
  logger(
    `Processed query finished: "${sharedObj.query}"\n ${sharedObj.counter} records counted from the query to: "${sharedObj.source}"`
  );
}

export function queryLog() {
  logger(
    `Processed query: "${sharedObj.query}" finished\n ${sharedObj.counter} records returned from object store "${sharedObj.source}"`
  );
}

export function tryGetByKey(origin, source, key, errorCallback) {
  let request = null;
  try {
    request = source.getAll(key);
  } catch (e) {
    reportCatch(origin, e, errorCallback);
    return null;
  }
  return request;
}

export function isKey(query) {
  let isKey = false;
  if (query) {
    if (typeof query == 'number') {
      isKey = true;
    } else {
      isKey = query.match(qrySys.operatorRgx) ? false : true;
    }
  }
  return isKey;
}

export function initCursorLoop(source, errorCallback) {
  let request = tryOpenCursor(sharedObj.origin, source, errorCallback);
  if (!request) {
    checkTasks();
    return;
  }
  request.onsuccess = function (event) {
    let cursor = event.target.result;
    cursorLoop(cursor);
  };
  request.onerror = function () {
    requestErrorAction(origin, request.error, errorCallback);
  };
}
