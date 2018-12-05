export let lastErrorObj={};

export function makeErrorObject(origin, domException) {
  let errorObj = {};
  if (domException) {
    errorObj.type = domException.name;
    errorObj.origin = origin;
    errorObj.description = domException.message;
  }

  lastErrorObj = errorObj;

  return true;
}
