/** Read synchronously from the user agent, avoiding an async IPC round-trip
 * (and a first paint with the wrong chrome). */
export const isMacOS = navigator.userAgent.includes("Mac OS X");
