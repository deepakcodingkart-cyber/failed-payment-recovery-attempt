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
