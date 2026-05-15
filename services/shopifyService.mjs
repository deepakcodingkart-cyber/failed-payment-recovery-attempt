import { getShopifyClient } from "../config/shopifyClient.mjs";
import { repository } from "../config/repository.mjs";
import { logger } from "../logger.mjs";
import {
  SUBSCRIPTION_BILLING_ATTEMPT_CREATE,
  SUBSCRIPTION_CONTRACT_PAUSE,
  SUBSCRIPTION_CONTRACT_CANCEL,
  SUBSCRIPTION_BILLING_CYCLE_SKIP,
} from "../graphql/mutations.mjs";

/* ======================================================
   SHOPIFY BILLING SERVICE
====================================================== */
export class ShopifyService {
  /* ===============================
     ATTEMPT BILLING CHARGE
  ================================ */
  async attemptCharge({
    shop_id,
    subscription_id,
    billingCycleIndex,
    attemptNumber,
    originTime,
  }) {
    logger.info({
      service: "shopify-billing",
      step: "ATTEMPT_CHARGE_START",
      shop_id,
      subscription_id,
      billingCycleIndex,
      attemptNumber,
      originTime,
    });

    const accessToken = await repository.getAccessToken(shop_id);

    if (!accessToken) {
      logger.error({
        service: "shopify-billing",
        step: "MISSING_ACCESS_TOKEN",
        shop_id,
        subscription_id,
        message: "Cannot attempt charge — no access token available for shop",
      });
      throw new Error(`No access token for shop: ${shop_id}`);
    }

    const shopifyClient = getShopifyClient({
      shop: shop_id,
      accessToken,
    });

    const idempotencyKey = `retry_failed_payment_${subscription_id}_cycle_${billingCycleIndex}_attempt_${attemptNumber}`;

    const data = await shopifyClient.request(
      SUBSCRIPTION_BILLING_ATTEMPT_CREATE,
      {
        contractId: subscription_id,
        index: billingCycleIndex,
        originTime,
        idempotencyKey,
      }
    );

    const result = data.subscriptionBillingAttemptCreate;

    /* ---------- USER ERRORS ---------- */
    if (result.userErrors?.length) {
      logger.error({
        service: "shopify-billing",
        step: "SHOPIFY_USER_ERROR",
        shop_id,
        subscription_id,
        error: result.userErrors[0],
      });

      throw new Error(result.userErrors[0].message);
    }

    /* ---------- PROCESSING ERROR ---------- */
    if (result.subscriptionBillingAttempt?.processingError) {
      const { code, message } =
        result.subscriptionBillingAttempt.processingError;

      logger.error({
        service: "shopify-billing",
        step: "SHOPIFY_PROCESSING_ERROR",
        shop_id,
        subscription_id,
        billingCycleIndex,
        attemptNumber,
        errorCode: code,
        errorMessage: message,
      });

      const err = new Error(message);
      err.code = code;
      throw err;
    }

    logger.info({
      service: "shopify-billing",
      step: "ATTEMPT_CHARGE_DISPATCHED",
      shop_id,
      subscription_id,
      billingCycleIndex,
      attemptNumber,
      billingAttemptId: result.subscriptionBillingAttempt?.id,
    });

    return result.subscriptionBillingAttempt;
  }

  /* ===============================
     PAUSE SUBSCRIPTION
  ================================ */
  async pauseSub(shop_id, subscription_id) {
    logger.warn({
      service: "shopify-billing",
      step: "PAUSE_SUBSCRIPTION_START",
      shop_id,
      subscription_id,
    });

    const accessToken = await repository.getAccessToken(shop_id);

    if (!accessToken) {
      logger.error({
        service: "shopify-billing",
        step: "MISSING_ACCESS_TOKEN",
        shop_id,
        subscription_id,
        message: "Cannot pause — no access token available for shop",
      });
      throw new Error(`No access token for shop: ${shop_id}`);
    }

    const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

    const data = await shopifyClient.request(SUBSCRIPTION_CONTRACT_PAUSE, {
      id: subscription_id,
    });

    const result = data.subscriptionContractPause;
    if (result.userErrors?.length) {
      logger.error({
        service: "shopify-billing",
        step: "PAUSE_ERROR",
        shop_id,
        subscription_id,
        error: result.userErrors[0],
      });
      throw new Error(result.userErrors[0].message);
    }

    logger.info({
      service: "shopify-billing",
      step: "PAUSE_SUCCESS",
      subscription_id,
    });
    return result.contract;
  }

  /* ===============================
     CANCEL SUBSCRIPTION
  ================================ */
  async cancelSub(shop_id, subscription_id) {
    logger.warn({
      service: "shopify-billing",
      step: "CANCEL_SUBSCRIPTION_START",
      shop_id,
      subscription_id,
    });

    const accessToken = await repository.getAccessToken(shop_id);

    if (!accessToken) {
      logger.error({
        service: "shopify-billing",
        step: "MISSING_ACCESS_TOKEN",
        shop_id,
        subscription_id,
        message: "Cannot cancel — no access token available for shop",
      });
      throw new Error(`No access token for shop: ${shop_id}`);
    }

    const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

    const data = await shopifyClient.request(SUBSCRIPTION_CONTRACT_CANCEL, {
      id: subscription_id,
    });

    const result = data.subscriptionContractCancel;
    if (result.userErrors?.length) {
      logger.error({
        service: "shopify-billing",
        step: "CANCEL_ERROR",
        shop_id,
        subscription_id,
        error: result.userErrors[0],
      });
      throw new Error(result.userErrors[0].message);
    }

    logger.info({
      service: "shopify-billing",
      step: "CANCEL_SUCCESS",
      subscription_id,
    });
    return result.contract;
  }

  /* ===============================
     SKIP BILLING CYCLE
  ================================ */
  async skipCycle({ shop_id, subscription_id, billingCycleIndex }) {
    logger.info({
      service: "shopify-billing",
      step: "SKIP_CYCLE_START",
      shop_id,
      subscription_id,
      billingCycleIndex,
    });

    const accessToken = await repository.getAccessToken(shop_id);

    if (!accessToken) {
      logger.error({
        service: "shopify-billing",
        step: "MISSING_ACCESS_TOKEN",
        shop_id,
        subscription_id,
        billingCycleIndex,
        message: "Cannot skip cycle — no access token available for shop",
      });
      throw new Error(`No access token for shop: ${shop_id}`);
    }

    const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

    const data = await shopifyClient.request(SUBSCRIPTION_BILLING_CYCLE_SKIP, {
      input: {
        contractId: subscription_id,
        selector: {
          index: billingCycleIndex,
        },
      },
    });

    const result = data.subscriptionBillingCycleSkip;
    if (result.userErrors?.length) {
      logger.error({
        service: "shopify-billing",
        step: "SKIP_ERROR",
        shop_id,
        subscription_id,
        billingCycleIndex,
        error: result.userErrors[0],
      });
      throw new Error(result.userErrors[0].message);
    }

    logger.info({
      service: "shopify-billing",
      step: "SKIP_SUCCESS",
      subscription_id,
    });
    return result.billingCycle;
  }
}

export const shopifyService = new ShopifyService();
