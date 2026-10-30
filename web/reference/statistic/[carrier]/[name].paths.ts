import { catalogOf, type DistributionSource, distributionSourceOf } from "@enumeratio/frontend/explorer";
import { entries } from "../../../.vitepress/data/reference-node.ts";
import { liveExpression, siblingsOf, statisticPages } from "../../../.vitepress/data/carrier-fields.ts";

const catalog = catalogOf(entries);
const sources = new Map<string, Promise<DistributionSource | undefined>>();
/** The collection a carrier's distributions are tallied over, once per carrier. */
const sourceOf = (carrier: string): Promise<DistributionSource | undefined> => {
  if (!sources.has(carrier)) sources.set(carrier, distributionSourceOf(carrier, entries, catalog));
  return sources.get(carrier)!;
};

// One page per statistic and carrier: a name on two carriers is two implementations. Names only
// travel with a page: the distributions are computed in the browser, on demand.
export default {
  async paths() {
    const all = statisticPages();
    const pages = [];
    for (const field of all) {
      const distribution = await sourceOf(field.carrier);
      pages.push({
        params: {
          carrier: field.carrier,
          name: field.name,
          title: `${field.name} on ${field.carrier}`,
          field,
          live: liveExpression(field),
          siblings: siblingsOf(field),
          distribution,
          carrierStatistics: distribution
            ? all.filter((f) => f.carrier === field.carrier && f.name !== field.name).map((f) => f.name)
            : undefined,
        },
      });
    }
    return pages;
  },
};
