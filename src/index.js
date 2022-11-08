export { _qrySys } from './qrySys.js';
export { tasks, done, execTasks, checkTasks } from './taskQueue';
export { logEnum, logger } from './logger.js';
export { Store } from './sixdbStore';
export { Index } from './sixdbIndex';
export { makeErrorObject, lastErrorObj } from './errorSys';
export { db, dbName, setDb, tkOpen, voidFn, /*customOperator, consoleOff*/ } from './sixdb';
export {
    aggregateLog,
    countLog,
    cursorAggregate,
    cursorCount,
    cursorDelRecords,
    cursorGetRecords,
    cursorLoop,
    cursorUpdate,
    initCursorLoop,
    isKey,
    queryLog,
    requestErrorAction,
    requestSuccessAction,
    setSharedObj,
    tryGetAll,
    tryGetByKey,
    tryOpenCursor,
} from './helpers';


window.consoleOff = false;
window.customOperator = function (value1, value2) {
    return value1 == value2;
  };