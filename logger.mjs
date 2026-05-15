const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";
const LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];

function canLog(level) {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(LOG_LEVEL);
}

function log(level, payload) {
  if (!canLog(level)) return;

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      requestId: payload.requestId,
      ...payload,
    })
  );
}

export const logger = {
  debug: (p) => log("DEBUG", p),
  info: (p) => log("INFO", p),
  warn: (p) => log("WARN", p),
  error: (p) => log("ERROR", p),
};
