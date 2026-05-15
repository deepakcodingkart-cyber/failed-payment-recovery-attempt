import { logger } from "../logger.mjs";

/* ======================================================
   SHOPIFY GRAPHQL CLIENT
====================================================== */
export class ShopifyClient {
  constructor({ shop, accessToken }) {
    this.shop = shop;
    this.accessToken = accessToken;
  }

  async request(query, variables) {
    const res = await fetch(
      `https://${this.shop}/admin/api/2024-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      }
    );

    const json = await res.json();

    if (json.errors) {
      logger.error({
        service: "shopify-client",
        step: "GRAPHQL_TRANSPORT_ERROR",
        shop: this.shop,
        status: res.status,
        errors: json.errors,
      });
      const err = new Error("Shopify GraphQL Error");
      err.details = json.errors;
      throw err;
    }

    return json.data;
  }
}

export function getShopifyClient({ shop, accessToken }) {
  return new ShopifyClient({ shop, accessToken });
}
