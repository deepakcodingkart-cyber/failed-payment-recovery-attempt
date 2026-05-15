import { getShopifyClient } from "../config/shopifyClient.mjs";
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
     GET SHOP ACCESS TOKEN
  ================================ */
  async getShopAccessToken(shop_id) {
    // console.log("inside the db function")
    // const client = await getJObClient();

    // logger.info({
    //   service: "shopify-billing",
    //   step: "FETCH_ACCESS_TOKEN_START",
    //   shop_id,
    // });

    // const res = await client.query(
    //   `
    //   SELECT access_token
    //   FROM "Session"
    //   WHERE shop_id = $1
    //   `,
    //   [shop_id]
    // );

    // if (!res.rows.length) {
    //   logger.error({
    //     service: "shopify-billing",
    //     step: "ACCESS_TOKEN_NOT_FOUND",
    //     shop_id,
    //   });

    //   throw new Error(`No access token found for shop ${shop_id}`);
    // }

    // logger.info({
    //   service: "shopify-billing",
    //   step: "FETCH_ACCESS_TOKEN_SUCCESS",
    //   shop_id,
    // });

    // return res.rows[0].access_token;

    let access_token;

    // Hardcoded logic based on shop_id
    if (shop_id === "driftcharge-test1.myshopify.com") {
      access_token = "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";
    } else if (shop_id === "checkout-ui-build.myshopify.com") {
      access_token = "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";
    } else {
      // Default ya Error handling
      console.error("Unknown shop_id:", shop_id);
    }

    // Ab aap 'access_token' variable ko aage use kar sakte hain
    console.log("Using Token:", access_token);
    return access_token;
  }

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

    const accessToken = await this.getShopAccessToken(shop_id);

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

    const accessToken = await this.getShopAccessToken(shop_id);
    const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

    const data = await shopifyClient.request(SUBSCRIPTION_CONTRACT_PAUSE, {
      id: subscription_id,
    });

    const result = data.subscriptionContractPause;
    if (result.userErrors?.length) {
      logger.error({
        service: "shopify-billing",
        step: "PAUSE_ERROR",
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

    const accessToken = await this.getShopAccessToken(shop_id);
    const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

    const data = await shopifyClient.request(SUBSCRIPTION_CONTRACT_CANCEL, {
      id: subscription_id,
    });

    const result = data.subscriptionContractCancel;
    if (result.userErrors?.length) {
      logger.error({
        service: "shopify-billing",
        step: "CANCEL_ERROR",
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

    const accessToken = await this.getShopAccessToken(shop_id);
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
