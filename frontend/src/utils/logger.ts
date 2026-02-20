/* eslint-disable no-console */

const isDebugLoggingEnabled =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG === "true";

export function logDebug(...args: unknown[]): void {
  if (isDebugLoggingEnabled) {
    console.log(...args);
  }
}

export function logError(...args: unknown[]): void {
  if (isDebugLoggingEnabled) {
    console.error(...args);
  }
}
