### v1.6.0 2018-11-13
* Added an improved error handling system. Now detects and hanle more possible errors.
* Error notifications are not affected by the flag consoleOff.
* All undefined error callbacks are transformed in empty functions. This prevents a problem in the try catch helpers.