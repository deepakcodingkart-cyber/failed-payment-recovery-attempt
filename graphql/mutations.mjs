/* ======================================================
   SHOPIFY GRAPHQL MUTATIONS
====================================================== */

export const SUBSCRIPTION_BILLING_ATTEMPT_CREATE = `
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
`;

export const SUBSCRIPTION_CONTRACT_PAUSE = `
  mutation subscriptionContractPause($id: ID!) {
    subscriptionContractPause(subscriptionContractId: $id) {
      contract { id status }
      userErrors { field message }
    }
  }
`;

export const SUBSCRIPTION_CONTRACT_CANCEL = `
  mutation subscriptionContractCancel($id: ID!) {
    subscriptionContractCancel(subscriptionContractId: $id) {
      contract { id status }
      userErrors { field message }
    }
  }
`;

export const SUBSCRIPTION_BILLING_CYCLE_SKIP = `
  mutation subscriptionBillingCycleSkip($input: SubscriptionBillingCycleInput!) {
    subscriptionBillingCycleSkip(billingCycleInput: $input) {
      billingCycle { skipped cycleIndex }
      userErrors { field message }
    }
  }
`;
