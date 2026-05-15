import { shopifyService } from "./shopifyService.mjs";
import { repository } from "../config/repository.mjs";

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

    if (fallback_action === "CANCEL") {
      await shopifyService.cancelSub(shop_id, subscription_id);
    }

    if (fallback_action === "PAUSE") {
      await shopifyService.pauseSub(shop_id, subscription_id);
    }

    if (fallback_action === "SKIP") {
      await shopifyService.skipCycle({
        shop_id,
        subscription_id,
        billingCycleIndex: billing_cycle_index,
        originTime,
      });
    }

    await repository.markFallbackApplied(recoveryId);
  }
}

export const fallbackExecutor = new FallbackExecutor();
