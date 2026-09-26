import type { ComputeEngine } from "@cortex-js/compute-engine";
import { ellipticEComplex } from "./elliptic-e-complex/patch.ts";
import { hyperbolicZero } from "./hyperbolic-zero/patch.ts";
import { numberTheoryLargeIntegers } from "./number-theory-large-integers/patch.ts";
import { applyPatches, type Patch } from "./patch.ts";

export type { Patch } from "./patch.ts";
export { applyPatch, applyPatches } from "./patch.ts";
export { ellipticEComplex } from "./elliptic-e-complex/patch.ts";
export { hyperbolicZero } from "./hyperbolic-zero/patch.ts";
export { numberTheoryLargeIntegers } from "./number-theory-large-integers/patch.ts";

/** Every patch offered upstream. `tests/landed.test.ts` holds each one to being unfixed. */
export const PATCHES: readonly Patch[] = [hyperbolicZero, ellipticEComplex, numberTheoryLargeIntegers];

/** Apply every patch that has not landed upstream yet, to `ce`. Idempotent per engine. */
export function applyAllPatches(ce: ComputeEngine): void {
  applyPatches(ce, PATCHES);
}
