import { liveExpression, siblingsOf, mapPages } from "../../../.vitepress/data/carrier-fields.ts";

// One page per map and source carrier.
export default {
  paths() {
    return mapPages().map((field) => ({
      params: {
        carrier: field.carrier,
        name: field.name,
        title: `${field.name} from ${field.carrier}`,
        field,
        live: liveExpression(field),
        siblings: siblingsOf(field),
      },
    }));
  },
};
