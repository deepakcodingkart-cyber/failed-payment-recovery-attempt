import { cancelSub, pauseSub, skipCycle } from "./shopify.mjs";
import { markFallbackApplied } from "./recoveryQueries.mjs";
  
  export async function executeFallback({
    recoveryId,
    shop_id,
    subscription_id,
    billing_cycle_index,
    originTime,
    fallback_action
  }) {
  
    if (fallback_action === "CANCEL") {
      await cancelSub(shop_id, subscription_id);
    }
  
    if (fallback_action === "PAUSE") {
      await pauseSub(shop_id, subscription_id);
    }
  
    if (fallback_action === "SKIP") {
      await skipCycle({
        shop_id, 
        subscription_id,
        billingCycleIndex: billing_cycle_index,
        originTime
      });
    }
  
    await markFallbackApplied(recoveryId);
  }
  