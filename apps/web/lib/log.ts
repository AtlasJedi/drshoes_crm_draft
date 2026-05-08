/**
 * Named-logger factory.
 * Emits structured single-line log entries: level=<LEVEL> logger=<name> msg=<msg> key=val ...
 * Debug suppressed unless NEXT_PUBLIC_LOG_LEVEL=debug (server) or globalThis.__LOG_LEVEL__=debug (client).
 */

type Fields = Record<string, unknown>;
type LogFn = (message: string, fields?: Fields) => void;

export interface Logger {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
}

function needsQuoting(v: string): boolean {
  return /[\s="']/.test(v);
}

function serializeValue(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "object" || Array.isArray(v)) return JSON.stringify(v);
  const s = String(v);
  return needsQuoting(s) ? JSON.stringify(s) : s;
}

function formatLine(level: string, name: string, message: string, fields?: Fields): string {
  const msgVal = needsQuoting(message) ? JSON.stringify(message) : message;
  let line = `level=${level} logger=${name} msg=${msgVal}`;
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      line += ` ${k}=${serializeValue(v)}`;
    }
  }
  return line;
}

function isDebugEnabled(): boolean {
  if (typeof process !== "undefined" && process.env["NEXT_PUBLIC_LOG_LEVEL"] === "debug") return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof globalThis !== "undefined" && (globalThis as any).__LOG_LEVEL__ === "debug") return true;
  return false;
}

export function createLogger(name: string): Logger {
  return {
    info:  (msg, fields) => console.info(formatLine("INFO",  name, msg, fields)),
    warn:  (msg, fields) => console.warn(formatLine("WARN",  name, msg, fields)),
    error: (msg, fields) => console.error(formatLine("ERROR", name, msg, fields)),
    debug: (msg, fields) => {
      if (!isDebugEnabled()) return;
      console.debug(formatLine("DEBUG", name, msg, fields));
    },
  };
}

/** App-wide default logger. */
export const log = createLogger("web");
