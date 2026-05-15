
export function getShopifyClient({ shop, accessToken }) {
  return {
    async request(query, variables) {
      const res = await fetch(
        `https://${shop}/admin/api/2024-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query,
            variables,
          }),
        }
      );

      const json = await res.json();

      if (json.errors) {
        const err = new Error("Shopify GraphQL Error");
        err.details = json.errors;
        throw err;
      }

      return json.data;
    },
  };
}
