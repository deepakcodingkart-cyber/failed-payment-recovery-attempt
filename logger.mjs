/* ======================================================
   LOGGER
====================================================== */
class Logger {
  constructor() {
    this.LOG_LEVEL = process.env.LOG_LEVEL || "INFO";
    this.LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];
  }

  canLog(level) {
    return this.LEVELS.indexOf(level) >= this.LEVELS.indexOf(this.LOG_LEVEL);
  }

  log(level, payload) {
    if (!this.canLog(level)) return;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        requestId: payload.requestId,
        ...payload,
      })
    );
  }

  debug(p) {
    this.log("DEBUG", p);
  }

  info(p) {
    this.log("INFO", p);
  }

  warn(p) {
    this.log("WARN", p);
  }

  error(p) {
    this.log("ERROR", p);
  }
}

export const logger = new Logger();
