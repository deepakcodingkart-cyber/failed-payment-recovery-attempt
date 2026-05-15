import { getShopifyClient } from "./shopifyClient.mjs";
import { getJObClient } from "./dbJobClient.mjs";
import { logger } from "./logger.mjs";

/* ===============================
   GET SHOP ACCESS TOKEN
================================ */
async function getShopAccessToken(shop_id) {
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


/* ===============================
   ATTEMPT BILLING CHARGE
================================ */
export async function attemptCharge({
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

  const accessToken = await getShopAccessToken(shop_id);

  const shopifyClient = getShopifyClient({
    shop: shop_id,
    accessToken,
  });

  const idempotencyKey =
    `retry_failed_payment_${subscription_id}_cycle_${billingCycleIndex}_attempt_${attemptNumber}`;

  const data = await shopifyClient.request(
    `
    mutation subscriptionBillingAttemptCreate(
      $contractId: ID!,
      $index: Int!,
      $originTime: DateTime!,
      $idempotencyKey: String!
    ) {
      subscriptionBillingAttemptCreate(
        subscriptionContractId: $contractId,
        subscriptionBillingAttemptInput: {
          billingCycleSelector: { index: $index },
          idempotencyKey: $idempotencyKey,
          originTime: $originTime
        }
      ) {
        subscriptionBillingAttempt {
          id
          ready
          processingError {
            code
            message
          }
        }
        userErrors {
          field
          message
        }
      }
    }
    `,
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
export async function pauseSub(shop_id, subscription_id) {
  logger.warn({ service: "shopify-billing", step: "PAUSE_SUBSCRIPTION_START", shop_id, subscription_id });

  const accessToken = await getShopAccessToken(shop_id);
  const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

  const data = await shopifyClient.request(
    `
    mutation subscriptionContractPause($id: ID!) {
      subscriptionContractPause(subscriptionContractId: $id) {
        contract { id status }
        userErrors { field message }
      }
    }
    `,
    { id: subscription_id }
  );

  const result = data.subscriptionContractPause;
  if (result.userErrors?.length) {
    logger.error({ service: "shopify-billing", step: "PAUSE_ERROR", error: result.userErrors[0] });
    throw new Error(result.userErrors[0].message);
  }

  logger.info({ service: "shopify-billing", step: "PAUSE_SUCCESS", subscription_id });
  return result.contract;
}

/* ===============================
   CANCEL SUBSCRIPTION
================================ */
export async function cancelSub(shop_id, subscription_id) {
  logger.warn({ service: "shopify-billing", step: "CANCEL_SUBSCRIPTION_START", shop_id, subscription_id });

  const accessToken = await getShopAccessToken(shop_id);
  const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

  const data = await shopifyClient.request(
    `
    mutation subscriptionContractCancel($id: ID!) {
      subscriptionContractCancel(subscriptionContractId: $id) {
        contract { id status }
        userErrors { field message }
      }
    }
    `,
    { id: subscription_id }
  );

  const result = data.subscriptionContractCancel;
  if (result.userErrors?.length) {
    logger.error({ service: "shopify-billing", step: "CANCEL_ERROR", error: result.userErrors[0] });
    throw new Error(result.userErrors[0].message);
  }

  logger.info({ service: "shopify-billing", step: "CANCEL_SUCCESS", subscription_id });
  return result.contract;
}

/* ===============================
   SKIP BILLING CYCLE
================================ */
export async function skipCycle({ shop_id, subscription_id, billingCycleIndex }) {
  logger.info({
    service: "shopify-billing",
    step: "SKIP_CYCLE_START",
    shop_id, subscription_id,
    billingCycleIndex
  });

  const accessToken = await getShopAccessToken(shop_id);
  const shopifyClient = getShopifyClient({ shop: shop_id, accessToken });

  const data = await shopifyClient.request(
    `
    mutation subscriptionBillingCycleSkip($input: SubscriptionBillingCycleInput!) {
      subscriptionBillingCycleSkip(billingCycleInput: $input) {
        billingCycle { skipped cycleIndex }
        userErrors { field message }
      }
    }
    `,
    {
      input: {
        contractId: subscription_id,
        selector: {
          index: billingCycleIndex,
        }
      }
    }
  );

  const result = data.subscriptionBillingCycleSkip;
  if (result.userErrors?.length) {
    logger.error({ service: "shopify-billing", step: "SKIP_ERROR", error: result.userErrors[0] });
    throw new Error(result.userErrors[0].message);
  }

  logger.info({ service: "shopify-billing", step: "SKIP_SUCCESS", subscription_id });
  return result.billingCycle;
}










// import { logger } from "./logger.mjs";

// // Helper function for 0.5 second delay
// const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// /* ===============================
//    ATTEMPT BILLING CHARGE (MOCK)
// ================================ */
// export async function attemptCharge({
//   shop_id,
//   subscription_id,
//   billingCycleIndex,
//   attemptNumber,
// }) {
//   logger.info({
//     service: "shopify-billing-MOCK",
//     step: "ATTEMPT_CHARGE_START",
//     shop_id,
//     subscription_id,
//   });

//   // 0.5 Second ka delay
//   await delay(500);

//   // Mock Success Response
//   const mockResult = {
//     id: `gid://shopify/SubscriptionBillingAttempt/mock_${Date.now()}`,
//     ready: true,
//     processingError: null
//   };

//   logger.info({
//     service: "shopify-billing-MOCK",
//     step: "ATTEMPT_CHARGE_DISPATCHED",
//     shop_id,
//     subscription_id,
//     billingAttemptId: mockResult.id,
//   });

//   return mockResult;
// }

// /* ===============================
//    PAUSE SUBSCRIPTION (MOCK)
// ================================ */
// export async function pauseSub(shop_id, subscription_id) {
//   logger.warn({ service: "shopify-billing-MOCK", step: "PAUSE_START", shop_id });

//   await delay(400);

//   return { id: subscription_id, status: 'PAUSED' };
// }

// /* ===============================
//    CANCEL SUBSCRIPTION (MOCK)
// ================================ */
// export async function cancelSub(shop_id, subscription_id) {
//   logger.warn({ service: "shopify-billing-MOCK", step: "CANCEL_START", shop_id });

//   await delay(400);

//   return { id: subscription_id, status: 'CANCELLED' };
// }

// /* ===============================
//    SKIP BILLING CYCLE (MOCK)
// ================================ */
// export async function skipCycle({ shop_id, subscription_id, billingCycleIndex }) {
//   logger.info({ service: "shopify-billing-MOCK", step: "SKIP_CYCLE_START", shop_id });

//   await delay(400);

//   return { skipped: true, cycleIndex: billingCycleIndex };
// }