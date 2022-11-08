import { logEnum, logger } from './index.js';

let idle = true;
export let tasks = [];

export function checkTasks() {
  if (tasks.length == 0) {
    idle = true;
    logger('No pending tasks');
    return;
  }
  idle = false;
  let task = tasks[0];
  if (!task.type) {
    task.fn.apply(this, task.args);
  } else {
    logger('Custom task' + logEnum.begin);
    task.fn.apply(task.context, task.args);
    done();
  }
}

export function done() {
  tasks.shift();
  checkTasks();
}

export function execTasks() {
  if (idle) {
    checkTasks();
  }
}
