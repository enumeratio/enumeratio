// Every combinatorics map, declared typed by carrier (step 6c: each map's data now lives in the
// area owning its `from` carrier — see `map-helpers.ts` for the shared pieces and each area's
// own `src/maps.ts` for its data). This file is the thin composition point: it concatenates
// every area's own map array into `MAPS`, merges in each map's laws (step 6c part 2 — see
// below), and keeps `declareMaps`'s call site exactly where it was.
//
// `declareMaps` stays OUT of `declareCombinatorics`/each area's own `declare<Area>` on purpose:
// it extends shared names (`Inverse`, `Reverse`) other packages also widen, rather than minting
// fresh ones, so it has to run LAST — after every package's own declares, not just
// combinatorics'. Folding it into `declare<Area>` would run it at `declareCombinatorics`'s own
// position instead, ahead of another package's own `Inverse` overload (see `src/index.ts`'s file
// comment, and enumeratio#411). Every host (cli, census, reference's engines.ts) still calls
// this one function, at its own unchanged position, with its own `constructorFor`.

import type { Engine } from "@enumeratio/engine";
import { symbolInfo } from "@enumeratio/manifest";
import { declareMaps as declareMapsGeneric, evaluateDefinition, type Law } from "@enumeratio/structures";
import { CARRIERS } from "./carriers.ts";
import { COMPILED_MAPS } from "./compiled-maps.generated.js";
import { fastDefinition } from "./compiled.ts";
import type { CombinatorialMap } from "./map-helpers.ts";
import { MAP_LAWS } from "./maps-laws.generated.ts";
import { COMPOSITIONS_MAPS } from "../compositions/src/maps.ts";
import { LATTICE_PATHS_MAPS } from "../lattice-paths/src/maps.ts";
import { PARTITIONS_MAPS } from "../partitions/src/maps.ts";
import { declareCycleConversions } from "../permutations/src/cycles-conversion.ts";
import { PERMUTATIONS_MAPS } from "../permutations/src/maps.ts";
import { SET_PARTITIONS_MAPS } from "../set-partitions/src/maps.ts";
import { TREES_MAPS } from "../trees/src/maps.ts";
import { WORDS_MAPS } from "../words/src/maps.ts";

export type { CombinatorialMap } from "./map-helpers.ts";
export type { Law };
export { evaluateDefinition };

// A map's `laws`/`orderIsomorphism` come from its own record's `laws:` front matter (step 6c
// part 2, design §6), generated ahead of time into `maps-laws.generated.ts` by
// `scripts/generate-map-laws.ts` -- no YAML parsing at runtime. An area's own literal only
// still carries `laws` inline for a map with no record to hold it (`Permutation`, see
// `permutations/src/maps.ts`), which this merge leaves alone since `MAP_LAWS` has no entry for it.
const withLaws = (map: CombinatorialMap): CombinatorialMap => ({ ...map, ...MAP_LAWS[`${map.name}@${map.from}`] });

export const MAPS: readonly CombinatorialMap[] = [
  ...PERMUTATIONS_MAPS,
  ...TREES_MAPS,
  ...LATTICE_PATHS_MAPS,
  ...PARTITIONS_MAPS,
  ...SET_PARTITIONS_MAPS,
  ...COMPOSITIONS_MAPS,
  ...WORDS_MAPS,
].map(withLaws);

/** Declare every combinatorics map, typed by carrier, via @enumeratio/structures' generic
 *  `declareMaps`: combinatorics supplies the fast (compiled) definition and the FindStat ids,
 *  which are the two things a generic map declaration knows nothing about. */
export function declareMaps(
  ce: Engine,
  constructorFor: Readonly<Record<string, string>>,
  maps: readonly CombinatorialMap[] = MAPS,
): void {
  const shapeOf = new Map(CARRIERS.map((carrier) => [carrier.type, carrier.shape]));
  declareMapsGeneric(ce, constructorFor, maps, {
    package: "combinatorics",
    // Compiled where compute-engine's compiler takes it, memoized; the interpreter otherwise.
    definitionFor: (map) =>
      map.body === undefined
        ? undefined
        : fastDefinition({
            ce,
            body: map.body,
            guard: map.guard,
            from: shapeOf.get(map.from),
            to: shapeOf.get(map.to),
            interpret: (contents) => evaluateDefinition(ce, map, contents),
            generated: COMPILED_MAPS[`${map.name}@${map.from}`],
          }),
    // FindStat's map ids (`Mp00066`), as the map's record states them.
    findstatFor: (map, from) => [
      ...(map.findstat ?? []),
      ...(map.convert === true ? [] : (symbolInfo(map.name)?.findstat ?? []))
        .filter((ref) => ref.on === undefined || ref.on === from)
        .map((ref) => ref.id),
    ],
  });
  // Overloads across the carrier boundary, which need both heads declared: after the maps.
  declareCycleConversions(ce);
}
