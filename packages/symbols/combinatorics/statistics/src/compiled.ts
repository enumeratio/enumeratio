// A statistic's definition, run from the code compiled ahead of time from its Epsil
// (compiled.generated.js, written by scripts/compile-definitions.ts). An entry is used only while
// its hash matches the definition, and only for a subject and an answer that cross between
// MathJSON and JS exactly; everything else is interpreted.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { definitionHash, fromJs, type MathJSON, runtimeHelpers, toJs } from "@enumeratio/engine/compiled";
import { COMPILED } from "./compiled.generated.js";
import { type Definition, SUBJECT, signatureOf } from "./types.ts";

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
