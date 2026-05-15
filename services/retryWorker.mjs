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
      retry_interval_days,
      fallback_action,
      action,
    } = msg;

    logger.info({
      step: "PROCESS_MESSAGE_START",
      recoveryId,
      attemptNumber,
      action,
    });

    /* ---------- 1. DB VALIDATION ---------- */
    const state = await repository.validateRecoveryState(recoveryId);

    if (!state || state.status !== "PENDING" || !state.queued_at) {
      logger.warn({ step: "SKIP_INVALID_STATE", recoveryId, state });
      return;
    }

    if (state.attempt_count !== attemptNumber - 1) {
      logger.warn({
        step: "ATTEMPT_MISMATCH",
        recoveryId,
        db: state.attempt_count,
        msg: attemptNumber,
      });
      return;
    }

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
      await repository.updateRecoveryAfterAttempt({
        recoveryId: recoveryId,
        retryIntervalDays: retry_interval_days,
      });

      logger.info({
        service: "retry-worker",
        step: "DB_STATE_UPDATED",
        recoveryId,
        nextAttemptDays: retry_interval_days,
      });
    } catch (err) {
      logger.error({
        step: "PROCESS_EXECUTION_FAILED",
        recoveryId,
        error: err.message,
      });

      // Error throw kar rahe hain taaki main handler ko pata chale
      throw err;
    }
  }
}

export const retryWorker = new RetryWorker();
