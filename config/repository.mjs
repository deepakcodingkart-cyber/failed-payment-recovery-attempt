import pkg from "pg";
import { logger } from "../logger.mjs";

const { Client } = pkg;

/* ======================================================
   RECOVERY REPOSITORY (DB LAYER)
====================================================== */
export class Repository {
  constructor() {
    this.client = null;
  }

  async getClient() {
    if (!this.client) {
      this.client = new Client({
        host: process.env.PG_HOST,
        port: process.env.PG_PORT,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.DRIFCHARGE_BILLING_DATABAE,
      });
      await this.client.connect();
      logger.info({
        service: "recovery-repository",
        step: "PG_CONNECTED",
        host: process.env.PG_HOST,
        database: process.env.DRIFCHARGE_BILLING_DATABAE,
      });
    }
    return this.client;
  }

  /* ===============================
     GET ACCESS TOKEN
  ================================ */
  async getAccessToken(shopDomain) {
    if (!shopDomain) {
      logger.warn({
        service: "recovery-queries",
        step: "GET_ACCESS_TOKEN",
        message: "No shopDomain provided",
      });
      return null;
    }

    const client = await this.getClient();

    const result = await client.query(
      `SELECT "accessToken" FROM "Session" WHERE "shop" = $1 LIMIT 1`,
      [shopDomain]
    );

    if (!result?.rows?.length) {
      logger.error({
        service: "recovery-queries",
        step: "RETRIEVE_DB_SESSION",
        shopDomain,
        message: "Session not found — invalid shop or app uninstalled",
      });
      return null;
    }

    return result.rows[0].accessToken;
  }

  /* ===============================
     Validation
  ================================ */
  async validateRecoveryState(recoveryId) {
    const client = await this.getClient();

    const res = await client.query(
      `
      SELECT status, attempt_count, queued_at
      FROM recovery_attempts
      WHERE id = $1
    `,
      [recoveryId]
    );

    return res.rows[0];
  }

  /* ===============================
     UPDATE AFTER RETRY ATTEMPT
  ================================ */
  async updateRecoveryAfterAttempt({ recoveryId, retryIntervalDays }) {
    const client = await this.getClient();

    logger.info({
      service: "recovery-queries",
      step: "UPDATE_RECOVERY_AFTER_ATTEMPT_START",
      recoveryId,
      retryIntervalDays,
    });

    await client.query(
      `
      UPDATE recovery_attempts
      SET
        attempt_count = attempt_count + 1,
        next_retry_date = CURRENT_DATE + ($2::int),
        queued_at = NULL,
        updated_at = now()
      WHERE id = $1
      AND status = 'PENDING'
      `,
      [recoveryId, retryIntervalDays]
    );

    logger.info({
      service: "recovery-queries",
      step: "UPDATE_RECOVERY_AFTER_ATTEMPT_DONE",
      recoveryId,
    });
  }

  /* ===============================
     MARK FALLBACK
  ================================ */
  async markFallbackApplied(recoveryId) {
    const client = await this.getClient();

    logger.warn({
      service: "recovery-queries",
      step: "MARK_FALLBACK_APPLIED",
      recoveryId,
    });

    await client.query(
      `
      UPDATE recovery_attempts
      SET status = 'FALLBACK_APPLIED',
        queued_at = NULL,
        updated_at = now()
      WHERE id = $1
      `,
      [recoveryId]
    );
  }

  /* ===============================
     INSERT ATTEMPT ERROR
  ================================ */
  // async insertRecoveryError({
  //   recoveryId,
  //   attemptNumber,
  //   errorCode,
  //   errorMessage,
  // }) {
  //   const client = await this.getClient();

  //   logger.error({
  //     service: "recovery-queries",
  //     step: "INSERT_RECOVERY_ERROR",
  //     recoveryId,
  //     attemptNumber,
  //     errorCode,
  //     errorMessage,
  //   });

  //   await client.query(
  //     `
  //     INSERT INTO recovery_attempt_errors (
  //       recovery_id,
  //       attempt_number,
  //       error_code,
  //       error_message
  //     )
  //     VALUES ($1, $2, $3, $4)
  //     `,
  //     [recoveryId, attemptNumber, errorCode, errorMessage]
  //   );
  // }

  /* ===============================
     FETCH DUE RECOVERIES
  ================================ */
  // async fetchDueRecoveries() {
  //   const client = await this.getClient();

  //   logger.info({
  //     service: "recovery-queries",
  //     step: "FETCH_DUE_RECOVERIES_START",
  //   });

  //   const res = await client.query(`
  //     SELECT
  //       r.id,
  //       r.shop_id,
  //       r.subscription_id,
  //       r.billing_cycle_index,
  //       r.billing_date,
  //       r.attempt_count,
  //       r.next_retry_date,
  //       s.max_attempts,
  //       s.retry_interval_days,
  //       s.fallback_action
  //     FROM recovery_attempts r
  //     JOIN shop_recovery_settings s
  //       ON s.shop_id = r.shop_id
  //     WHERE r.status = 'PENDING'
  //       AND r.next_retry_date <= CURRENT_DATE
  //     FOR UPDATE SKIP LOCKED
  //   `);

  //   logger.info({
  //     service: "recovery-queries",
  //     step: "FETCH_DUE_RECOVERIES_DONE",
  //     count: res.rows.length,
  //   });

  //   return res.rows;
  // }
}

export const repository = new Repository();
