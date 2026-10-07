import { liveExpression, siblingsOf, statisticPages } from "../../../.vitepress/data/carrier-fields.ts";

// One page per statistic and carrier: a name on two carriers is two implementations.
export default {
  paths() {
    return statisticPages().map((field) => ({
      params: {
        carrier: field.carrier,
        name: field.name,
        title: `${field.name} on ${field.carrier}`,
        field,
        live: liveExpression(field),
        siblings: siblingsOf(field),
      },
    }));
  },
};
