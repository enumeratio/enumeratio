// Statistic transport along a map: the distribution of `S(map(x))` over the source collection, and
// which statistics of the source carrier share it. "The map sends St A to St B", up to
// equidistribution at the sizes computed -- never proved. The target statistic is tallied over the
// images (the engine does not tally a statistic over a mapped collection, so the images are read
// and the statistic asked of each); the candidates are tallied over the source, so the scan is
// `findEquidistributed` with the transported triangle as its subject.

import {
  type DistributionResult,
  mapDeclineReason,
  readImages,
  readTally,
  showJson,
  triangleOf,
  type Triangle,
} from "@enumeratio/frontend/core";
import {
  countOf,
  type EquidistributionPhase,
  type EquidistributionResult,
  type Evaluate,
  evaluateText,
  findEquidistributed,
} from "./distribution-client.ts";
import type { MapSource } from "./map-client.ts";

export type { EquidistributionResult };

/** The tally of `statistic` over `images`, as one call: the statistic of each image, tallied. */
export const transportText = (images: readonly unknown[], statistic: string): string =>
  `Tally(List(${images.map((image) => `CombinatorialStat(${showJson(image)}, "${statistic}")`).join(", ")}))`;

/** The distribution of `statistic` over the images of `collection` under `map`, or why there is none. */
async function transported(
  map: MapSource,
  collection: string,
  statistic: string,
  evaluate: Evaluate,
): Promise<DistributionResult> {
  const count = await countOf(collection, evaluate);
  const reason = mapDeclineReason({ ...(count !== undefined && { count }) });
  if (reason !== undefined) return { ok: false, reason };
  if (count === undefined) return { ok: false, reason: "the collection's size is not known, so it is not walked" };
  try {
    const images = readImages(await evaluate(`List(CombinatorialMap(${collection}, "${map.name}"))`));
    if (images === undefined || images.length !== Number(count) || images.includes(undefined))
      return { ok: false, reason: `${map.name} is not defined over ${collection}` };
    return readTally(await evaluate(transportText(images, statistic)));
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The distribution of `statistic` (on the map's target carrier) over the map's images, at each of
 * `sizes`: a triangle, stopping at the first size that declines. Sizes past the map explorer's
 * bounds, or collections past its row cap, decline with a reason; a map that is not defined on
 * some element, or a statistic that is not a number there, declines the size too.
 */
export function transportTriangle(
  map: MapSource,
  statistic: string,
  sizes: readonly number[],
  options: { readonly progress?: (n: number) => void; readonly evaluate?: Evaluate } = {},
): Promise<Triangle> {
  const { evaluate = evaluateText } = options;
  return triangleOf(
    map.template,
    sizes,
    async (collection, size) => {
      // The size cap needs no engine: check it before asking for anything.
      const early = mapDeclineReason({ size, ...(map.maxSize !== undefined && { maxSize: map.maxSize }) });
      if (early !== undefined) return { ok: false, reason: early };
      return transported(map, collection, statistic, evaluate);
    },
    options.progress,
  );
}

/**
 * The statistics of the source carrier whose distribution equals the transported one at every size
 * of `subject`, by `findEquidistributed`'s screen-then-confirm scan (budgeted, with progress).
 */
export function findTransports(
  map: MapSource,
  subject: Triangle,
  sourceStatistics: readonly string[],
  options: {
    readonly budgetMs?: number;
    readonly progress?: (checked: number, total: number, phase: EquidistributionPhase) => void;
    readonly evaluate?: Evaluate;
    readonly now?: () => number;
  } = {},
): Promise<EquidistributionResult> {
  return findEquidistributed(map.template, subject, sourceStatistics, {
    ...(map.maxSize !== undefined && { maxSize: map.maxSize }),
    ...options,
  });
}
