export const logEnum = {
  begin: '//--------------------------------------->'
};

export function logger(message, isError) {
  if (consoleOff && !isError) return;

  if (!isError) console.log(message);
  else console.error(message);
}
