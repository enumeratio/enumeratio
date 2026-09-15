// Wikidata as a hub. An item reached from the engine's Q-id or from a Wikipedia title we
// name carries the identifiers the encyclopaedias key on, so one item answers for several
// systems at once (`wikidata-data.ts`, fetched by the script of the same name).

import { type WikidataItem, wikidata } from "../wikidata-data.ts";
import type { Reference } from "./types.ts";

/** A Wikipedia identity as a title: spaces for underscores, no section anchor. */
export const wikipediaTitle = (identity: string): string =>
  identity.replace(/#.*$/, "").replace(/_/g, " ").trim();

const byId = new Map(wikidata.map((item) => [item.id, item]));
const byTitle = new Map(wikidata.flatMap((item) => (item.title ? [[item.title, item]] : [])));

/** The item for a Q-id, or for the Wikipedia page a reference names. */
export function wikidataItem(idOrReference: string | Reference): WikidataItem | undefined {
  if (typeof idOrReference === "string") return byId.get(idOrReference);
  if (idOrReference.system === "wikidata") return byId.get(idOrReference.identity);
  if (idOrReference.system === "wikipedia") {
    return byTitle.get(wikipediaTitle(idOrReference.identity));
  }
  return undefined;
}

/** Everything an item points at, as references -- the item itself included. */
export function referencesOf(item: WikidataItem): Reference[] {
  const out: Reference[] = [{ system: "wikidata", identity: item.id }];
  if (item.title) out.push({ system: "wikipedia", identity: item.title });
  if (item.mathworld) out.push({ system: "mathworld", identity: item.mathworld });
  if (item.oeis) out.push({ system: "oeis", identity: item.oeis });
  if (item.nlab) out.push({ system: "nlab", identity: item.nlab });
  if (item.encyclopediaofmath) {
    out.push({ system: "encyclopediaofmath", identity: item.encyclopediaofmath });
  }
  if (item.britannica) out.push({ system: "britannica", identity: item.britannica });
  // Wikidata cites an equation as `25.2.E1`; the site addresses it as `25.2#E1`.
  if (item.dlmf) out.push({ system: "dlmf", identity: item.dlmf.replace(/\.(?=[^\d.])/, "#") });
  return out;
}
