/* ======================================================
   CONSTANTS
====================================================== */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
};

export const RECOVERY_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FALLBACK_APPLIED: "FALLBACK_APPLIED",
};

export const FALLBACK_ACTION = {
  CANCEL: "CANCEL",
  PAUSE: "PAUSE",
  SKIP: "SKIP",
};

export const RECOVERY_ACTION = {
  RETRY: "RETRY",
  FALLBACK: "FALLBACK",
};

/* ======================================================
   PINO LEVEL -> OTEL SEVERITY NUMBER
   https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
====================================================== */
export const PINO_TO_OTEL_SEVERITY = {
  trace: 1,
  debug: 5,
  info:  9,
  warn:  13,
  error: 17,
  fatal: 21,
};
