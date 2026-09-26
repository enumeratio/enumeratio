// `configure(ce)` for an `Evaluator -> "Worker"` `<notatio-dynamic-module>`'s
// `@enumeratio/aestimatio/browser` session (`notatio-dynamic-module.ts`'s
// `evaluateRemote`): declares the same libraries `./index.mts`'s `startEngine`
// declares into the PAGE's own engine, minus `@enumeratio/aestimatio` itself -- the
// session's engine already has it (`browser-session-worker.ts` calls
// `declareAestimatio` before importing `setup`, same as `packages/reference/scripts/
// engines.ts`'s own `configure` does for the Node isolated evaluator). The declare
// ORDER and OPTIONS themselves live in `./engine-libraries.ts`, shared with
// `./index.mts`, so the two library sets can't drift apart.
//
// Unlike `./index.mts`, this declares synchronously and eagerly, with static
// (not dynamic) imports: `openSession`'s `setup` contract calls `mod.configure(ce)`
// without awaiting it (`browser-session-worker.ts`), so an async `configure` would
// let the worker start evaluating before its heads exist. This module is its own
// on-demand chunk regardless -- a worker only imports it once, when a page's first
// `Evaluator -> "Worker"` module opens its session -- so there is no bundle-splitting
// reason to defer these imports the way `./index.mts` defers its own.
//
// No LaTeX dictionary here: a session evaluates MathJSON to MathJSON (a cell already
// parsed its input against the PAGE's own engine before sending it over -- see
// `notatio-out.ts`'s worker branch), so the worker's engine is never asked to parse
// LaTeX and needs no notation configured, only the heads themselves.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAdeles } from "@enumeratio/adeles";
import { declareAnalytic, declareFractals } from "@enumeratio/analytic";
import { declareBraid } from "@enumeratio/braid";
import { declareCollections } from "@enumeratio/collections";
import { declareDiagrams } from "@enumeratio/diagram";
import { declareDomainConstructors, declareDomainTypes, declareMaps, DOMAINS } from "@enumeratio/domains";
import { declareGraphics } from "@enumeratio/formats";
import { declareGeometric } from "@enumeratio/geometric";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra";
import { declareHecke } from "@enumeratio/hecke";
import { declareHopf } from "@enumeratio/hopf";
import { declareHypercomplex } from "@enumeratio/hypercomplex";
import { declareIncidence } from "@enumeratio/incidence";
import { declareModular } from "@enumeratio/modular";
import { declareNumberTheory } from "@enumeratio/number-theory";
import { declareNumerals } from "@enumeratio/numerals";
import { declareQuiver } from "@enumeratio/quiver";
import { declareResidues } from "@enumeratio/residues";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics";
import { applyEngineLibraries } from "./engine-libraries.ts";

export function configure(ce: ComputeEngine): void {
  applyEngineLibraries((fn) => fn(ce), {
    declareCollections,
    declareStatistics,
    ALL_STATISTICS,
    declareDomainTypes,
    declareDomainConstructors,
    declareMaps,
    DOMAINS,
    declareAnalytic,
    declareFractals,
    declareGraphics,
    declareHypercomplex,
    declareGeometric,
    declareDiagrams,
    declareResidues,
    declareNumerals,
    declareHecke,
    declareIncidence,
    declareQuiver,
    declareHopf,
    declareGroupAlgebra,
    declareModular,
    declareNumberTheory,
    declareAdeles,
    declareBraid,
  });
}
