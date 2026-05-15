import { getJObClient } from "./dbJobClient.mjs";
import { logger } from "./logger.mjs";

/* ===============================
   Validation
================================ */
export async function validateRecoveryState(recoveryId) {

  const client = await getJObClient();

  const res = await client.query(`
    SELECT status, attempt_count, queued_at 
    FROM recovery_attempts
    WHERE id = $1
  `, [recoveryId]);

  return res.rows[0];
}

/* ===============================
   UPDATE AFTER RETRY ATTEMPT
================================ */
export async function updateRecoveryAfterAttempt({
  recoveryId,
  retryIntervalDays,
}) {

  const client = await getJObClient();

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
export async function markFallbackApplied(recoveryId) {
  const client = await getJObClient();

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
// export async function insertRecoveryError({
//   recoveryId,
//   attemptNumber,
//   errorCode,
//   errorMessage,
// }) {
//   const client = await getJObClient();

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
// export async function fetchDueRecoveries() {
//   const client = await getJObClient();

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