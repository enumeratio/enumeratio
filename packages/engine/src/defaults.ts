import type { ComputeEngine } from "@cortex-js/compute-engine";
import { installPurityDefault } from "./purity.ts";

/**
 * The settings every engine we ship or evaluate examples on shares, so a value means the same
 * wherever it is computed. Not for engines that snapshot compute-engine's own bindings.
 *
 * `Round` sends a tie to the even neighbour (`Round(5/2)` is `2`), as Wolfram, SymPy and
 * mpmath do; compute-engine's own default is away from zero. The rule covers evaluate, `N`
 * and compiled code.
 *
 * Heads declared after this are pure unless they say otherwise (`installPurityDefault`), so call
 * it before the first library declares.
 */
export function setEngineDefaults(ce: ComputeEngine): void {
  ce.roundingTies = "to-even";
  installPurityDefault(ce);
}
