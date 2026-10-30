// A map's side of a kernel: the source collection at one size, the map over it, and what the
// images say of the map. Asked of the page's kernel, else its engine; computed on demand, and a
// size past the caps declines with a reason rather than walking.

import {
  checkMap,
  type MapCheck,
  mapDeclineReason,
  type MapRow,
  readCollection,
  readImages,
} from "@enumeratio/frontend/core";
import { countOf, type Evaluate, evaluateText } from "./distribution-client.ts";

export type { MapCheck, MapRow };

/** What the client needs of a map: `MapExplorer` from `@enumeratio/frontend/explorer`, less its drawing. */
export interface MapSource {
  readonly name: string;
  readonly template: string;
  readonly maxSize?: number;
  /** Source and target are one carrier. */
  readonly selfMap?: boolean;
  readonly target?: { readonly template: string; readonly sizeOffset: number };
}

const at = (template: string, size: number): string => template.replace("{size}", String(size));

/** A size of a map: the elements, their images (`undefined` where the map declined), and the check. */
export type MapAtSize =
  | {
      readonly ok: true;
      readonly elements: readonly unknown[];
      readonly images: readonly unknown[]; // `undefined` where the map declined
      readonly check: MapCheck;
    }
  | { readonly ok: false; readonly reason: string };

/** The source collection at `size` mapped by `map`, or why it was not. */
export async function mapAtSize(map: MapSource, size: number, evaluate: Evaluate = evaluateText): Promise<MapAtSize> {
  // The size cap needs no engine: check it before asking for a count.
  const early = mapDeclineReason({ size, ...(map.maxSize !== undefined && { maxSize: map.maxSize }) });
  if (early !== undefined) return { ok: false, reason: early };
  const collection = at(map.template, size);
  const count = await countOf(collection, evaluate);
  const reason = mapDeclineReason({ ...(count !== undefined && { count }) });
  if (reason !== undefined) return { ok: false, reason };
  if (count === undefined) return { ok: false, reason: "the collection's size is not known, so it is not walked" };
  try {
    const elements = readCollection(await evaluate(`List(${collection})`));
    const images = readImages(await evaluate(`List(CombinatorialMap(${collection}, "${map.name}"))`));
    if (elements === undefined) return { ok: false, reason: "the collection did not evaluate" };
    if (images === undefined || images.length !== elements.length)
      return { ok: false, reason: `${map.name} is not defined over ${collection}` };
    const target =
      map.target === undefined
        ? undefined
        : await countOf(at(map.target.template, size + map.target.sizeOffset), evaluate);
    return {
      ok: true,
      elements,
      images,
      check: checkMap(elements, images, {
        ...(target !== undefined && { targetCount: target }),
        sameCarrier: map.selfMap === true,
      }),
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** The map's properties at each of `sizes`, stopping at the first size that declines (every larger one is as large). */
export async function mapProperties(
  map: MapSource,
  sizes: readonly number[],
  options: { readonly progress?: (n: number) => void; readonly evaluate?: Evaluate } = {},
): Promise<MapRow[]> {
  const rows: MapRow[] = [];
  for (const n of sizes) {
    const answer = await mapAtSize(map, n, options.evaluate);
    rows.push(answer.ok ? { n, ok: true, check: answer.check } : { n, ok: false, reason: answer.reason });
    options.progress?.(n);
    if (!answer.ok) break;
  }
  return rows;
}
