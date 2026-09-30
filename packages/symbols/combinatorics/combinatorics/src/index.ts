// One entry point for the merged package (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 3): carriers, then the families typed by them -- the one step every
// host (CLI, site, reference, census) agrees on doing, `carrierTypes` included.
//
// For now this is a stand-in that calls the existing `collections`/`carriers` declarations in
// that order; no heads move. Once families and their carriers move together (step 5), this
// becomes the real per-area declare.
//
// `declareCarrierPlurals`, `declareCarrierElement` and `declareMaps` stay OUT of this call, at
// each host's own position in its own declare order:
//
// - `declareCarrierPlurals` mints a plural type-space symbol for a carrier that has no family
//   claiming it already -- `reference`'s engine never called it (or `declareCarrierElement`)
//   at all, so a bare name like `GaussianIntegers` stayed whatever `@enumeratio/number-theory`
//   later gave it. Folding it in here mints `GaussianIntegers` as `set<gaussian_integer>`
//   FIRST, ahead of that library's own declaration, and every reference example that passes
//   the symbol where a `string` carrier-tag was expected then fails a type check that used to
//   pass (caught by `packages/reference`'s `entries.test.ts`). CLI, site and census all called
//   `declareCarrierPlurals` / `declareCarrierElement` right after collections already; they keep
//   doing that themselves.
// - `declareMaps` extends shared names (`Inverse`, `Reverse`) rather than minting fresh ones.
//   `Inverse`'s permutation form is a row in its table (defineOverload), so it no longer has
//   to be declared after modular's; the hosts still call it themselves, with their constructors.
import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCollections } from "../collections/src/index.ts";
import { CARRIERS, declareCombinatoricsCarriers } from "./carriers.ts";

export { CARRIERS, declareCombinatoricsCarriers, LEFTOVER_CARRIERS } from "./carriers.ts";
export { UNDEFINED_MAPS, type UndefinedMap } from "./frontier-maps.ts";
export { checkLaws, type LawFailure } from "./laws.ts";
export { type CombinatorialMap, declareMaps, evaluateDefinition, type Law, MAPS } from "./maps.ts";

/**
 * Declares the carriers and the families typed by them on `ce`: `declareCombinatoricsCarriers`
 * mints the carrier types, and `declareCollections` declares the families typed by them. A host
 * no longer builds or passes `carrierTypes` itself -- it is derived from `CARRIERS` here.
 * `declareCarrierPlurals`, `declareCarrierElement` and `declareMaps` are NOT included; see the
 * file comment above.
 *
 * NOT idempotent: both constituent `declare*` throw on a name already bound in the engine's
 * scope, so calling this twice on the same `ce` throws, same as calling either of them twice
 * today.
 */
export function declareCombinatorics(ce: ComputeEngine): void {
  const carrierTypes = Object.fromEntries(CARRIERS.map((c) => [c.name, c.type]));
  // Carriers first: everything below declares heads OVER these minted types, so they have to
  // exist before a signature can name one.
  declareCombinatoricsCarriers(ce);
  // A combinatorial statistic is a function of a carrier, so that is what these heads take.
  declareCollections(ce, { permutationType: "permutation", carrierTypes });
}
