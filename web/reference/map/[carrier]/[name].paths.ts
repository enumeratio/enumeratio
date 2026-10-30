import { catalogOf, type MapExplorer, mapExplorerOf } from "@enumeratio/frontend/explorer";
import { entries } from "../../../.vitepress/data/reference-node.ts";
import { liveExpression, mapPages, siblingsOf, statisticPages } from "../../../.vitepress/data/carrier-fields.ts";

const catalog = catalogOf(entries);
const statistics = statisticPages();
/** The statistics defined on a carrier, by name. */
const statisticsOn = (carrier: string | undefined): string[] =>
  statistics.filter((f) => f.carrier === carrier).map((f) => f.name);

// One page per map and source carrier. Names and bounds travel with a page: the table and the
// properties are computed in the browser, on demand.
export default {
  async paths() {
    const pages = [];
    for (const field of mapPages()) {
      const explorer: MapExplorer | undefined = await mapExplorerOf(field, entries, catalog);
      pages.push({
        params: {
          carrier: field.carrier,
          name: field.name,
          title: `${field.name} from ${field.carrier}`,
          field,
          live: liveExpression(field),
          siblings: siblingsOf(field),
          explorer,
          // Transport: a statistic of the target is pulled back along the map and compared with the source's.
          sourceStatistics: explorer ? statisticsOn(field.carrier) : undefined,
          targetStatistics: explorer ? statisticsOn(field.to) : undefined,
        },
      });
    }
    return pages;
  },
};
