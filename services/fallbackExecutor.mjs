import { shopifyService } from "./shopifyService.mjs";
import { repository } from "../config/repository.mjs";
import { logger } from "../logger.mjs";

/* ======================================================
   FALLBACK EXECUTOR
====================================================== */
export class FallbackExecutor {
  async execute({
    recoveryId,
    shop_id,
    subscription_id,
    billing_cycle_index,
    originTime,
    fallback_action,
  }) {
    logger.info({
      service: "fallback-executor",
      step: "EXECUTE_START",
      recoveryId,
      shop_id,
      subscription_id,
      billing_cycle_index,
      fallback_action,
    });

    if (fallback_action === "CANCEL") {
      logger.warn({
        service: "fallback-executor",
        step: "DISPATCH_CANCEL",
        recoveryId,
        subscription_id,
      });
      await shopifyService.cancelSub(shop_id, subscription_id);
    }

    if (fallback_action === "PAUSE") {
      logger.warn({
        service: "fallback-executor",
        step: "DISPATCH_PAUSE",
        recoveryId,
        subscription_id,
      });
      await shopifyService.pauseSub(shop_id, subscription_id);
    }

    if (fallback_action === "SKIP") {
      logger.info({
        service: "fallback-executor",
        step: "DISPATCH_SKIP",
        recoveryId,
        subscription_id,
        billing_cycle_index,
      });
      await shopifyService.skipCycle({
        shop_id,
        subscription_id,
        billingCycleIndex: billing_cycle_index,
        originTime,
      });
    }

    await repository.markFallbackApplied(recoveryId);

    logger.info({
      service: "fallback-executor",
      step: "EXECUTE_DONE",
      recoveryId,
      fallback_action,
    });
  }
}

export const fallbackExecutor = new FallbackExecutor();
