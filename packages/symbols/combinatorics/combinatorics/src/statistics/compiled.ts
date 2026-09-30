// A statistic's definition, run from the code compiled ahead of time from its Epsil. Each
// area compiles only its OWN definitions (its own `scripts/compile-definitions.ts`, into its
// own `statistics.compiled.generated.js`, one generator per area, step 6b) — this file merges
// their tables into one lookup, keyed by signature (`head@carrier`), which never collides
// across areas. An entry is used only while its hash matches the definition, and only for a
// subject and an answer that cross between MathJSON and JS exactly; everything else is
// interpreted.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { definitionHash, fromJs, type MathJSON, runtimeHelpers, toJs } from "@enumeratio/engine/compiled";
import { COMPILED as PERMUTATIONS_COMPILED } from "../../permutations/src/statistics.compiled.generated.js";
import { COMPILED as PARTITIONS_COMPILED } from "../../partitions/src/statistics.compiled.generated.js";
import { COMPILED as LATTICE_PATHS_COMPILED } from "../../lattice-paths/src/statistics.compiled.generated.js";
import { COMPILED as SET_PARTITIONS_COMPILED } from "../../set-partitions/src/statistics.compiled.generated.js";
import { type Definition, SUBJECT, signatureOf } from "./types.ts";

/** Every area's compiled table, merged. Add a spread here when an area's kernel moves in;
 *  nothing else in this file changes. */
const COMPILED = {
  ...PERMUTATIONS_COMPILED,
  ...PARTITIONS_COMPILED,
  ...LATTICE_PATHS_COMPILED,
  ...SET_PARTITIONS_COMPILED,
};

/** The compiled form of `definition`, as a function of its subject's MathJSON, or undefined
 *  when there is none current. The function answers undefined where it can't answer exactly. */
export function compiledStatistic(
  ce: ComputeEngine,
  definition: Definition,
): ((subject: unknown) => MathJSON | undefined) | undefined {
  const entry = COMPILED[signatureOf(definition)];
  if (entry === undefined || entry.hash !== definitionHash(definition.expr)) return undefined;
  const sys = runtimeHelpers(ce);
  return (subject) => {
    const value = toJs(subject);
    if (value === undefined) return undefined;
    try {
      return fromJs(entry.run(sys, { [SUBJECT]: value }));
    } catch {
      return undefined;
    }
  };
}
