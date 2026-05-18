import { repository } from "../config/repository.mjs";
import { fallbackExecutor } from "./fallbackExecutor.mjs";
import { shopifyService } from "./shopifyService.mjs";
import { logger } from "../logger.mjs";

/* ======================================================
   RETRY WORKER
====================================================== */
export class RetryWorker {
  async process(msg) {
    const {
      recoveryId,
      shop_id,
      subscription_id,
      billing_cycle_index,
      billing_date,
      attemptNumber,
      max_attempts,
      retry_interval_days,
      grace_period_days,
      fallback_action,
      action,
    } = msg;

    logger.info({
      service: "retry-worker",
      step: "PROCESS_MESSAGE_START",
      recoveryId,
      shop_id,
      subscription_id,
      attemptNumber,
      action,
    });

    /* ---------- 1. DB VALIDATION ---------- */
    const state = await repository.validateRecoveryState(recoveryId);

    if (!state || state.status !== "PENDING" || !state.queued_at) {
      logger.warn({
        service: "retry-worker",
        step: "SKIP_INVALID_STATE",
        recoveryId,
        state,
        message: "Record skipped — not PENDING or not queued",
      });
      return;
    }

    if (state.attempt_count !== attemptNumber - 1) {
      logger.warn({
        service: "retry-worker",
        step: "ATTEMPT_MISMATCH",
        recoveryId,
        dbAttemptCount: state.attempt_count,
        msgAttemptNumber: attemptNumber,
        message: "DB attempt_count does not match message attemptNumber - 1",
      });
      return;
    }

    logger.debug({
      service: "retry-worker",
      step: "DB_VALIDATION_PASS",
      recoveryId,
      state,
    });

    /* ---------- 2. EXECUTION ---------- */
    try {
      const formattedDate = new Date(billing_date).toISOString();
      if (action === "FALLBACK") {
        logger.info({
          service: "retry-worker",
          step: "EXECUTING_FALLBACK",
          recoveryId,
          fallback_action,
        });

        await fallbackExecutor.execute({
          recoveryId,
          shop_id,
          subscription_id,
          billing_cycle_index,
          originTime: formattedDate,
          fallback_action,
        });

        logger.info({
          service: "retry-worker",
          step: "PROCESS_MESSAGE_END",
          recoveryId,
          action: "FALLBACK",
        });
        return;
      }

      /* ---------- RETRY LOGIC ---------- */
      logger.info({
        service: "retry-worker",
        step: "ATTEMPTING_SHOPIFY_CHARGE",
        recoveryId,
        shop_id,
        attemptNumber,
        originTime: formattedDate,
      });

      // Pehle Shopify se paise kaatne ki koshish karo
      await shopifyService.attemptCharge({
        shop_id,
        subscription_id,
        billingCycleIndex: billing_cycle_index,
        attemptNumber,
        originTime: formattedDate,
      });

      logger.info({
        service: "retry-worker",
        step: "SHOPIFY_CHARGE_SUCCESS",
        recoveryId,
        subscription_id,
      });

      // AGAR CHARGE SUCCESS HUA: Tabhi DB update karo
      // Last retry ke baad grace period use karo, warna normal retry interval
      const isLastRetry = attemptNumber >= max_attempts;
      const nextDelayDays = isLastRetry ? grace_period_days : retry_interval_days;

      await repository.updateRecoveryAfterAttempt({
        recoveryId: recoveryId,
        nextDelayDays,
      });

      logger.info({
        service: "retry-worker",
        step: "DB_STATE_UPDATED",
        recoveryId,
        nextAttemptDays: nextDelayDays,
        isLastRetry,
      });

      logger.info({
        service: "retry-worker",
        step: "PROCESS_MESSAGE_END",
        recoveryId,
        action: "RETRY",
      });
    } catch (err) {
      logger.error({
        service: "retry-worker",
        step: "PROCESS_EXECUTION_FAILED",
        recoveryId,
        shop_id,
        subscription_id,
        attemptNumber,
        action,
        error: err.message,
        err,
      });

      // Error throw kar rahe hain taaki main handler ko pata chale
      throw err;
    }
  }
}

export const retryWorker = new RetryWorker();
