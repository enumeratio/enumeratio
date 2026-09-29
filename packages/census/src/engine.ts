// Every library we ship, declared into one engine.
//
// This package exists for this function. Questions about the namespace as a whole — what do
// we add, what does it collide with, what can Wolfram do that we cannot — are only
// answerable against a COMPLETE engine, and a library missing from the list is a library
// those questions pass over in silence. The catalog half (collections, domains, statistics)
// was missing from the reference package's engine for a long time, and the checks there
// were quietly not covering `Subsets`, `Area`, `Order`, `Composition` or `Word` at all.
//
// It is its own package rather than a file in `reference` because reference is a
// DEPENDENCY of collections (which types its entries against it), so reference cannot
// depend back on collections without a cycle the task graph rejects. Nothing depends on
// this package, which is what lets it depend on everything.

import { ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import { declareAdeles } from "@enumeratio/adeles/src";
import { declareEvaluation } from "@enumeratio/evaluation/src";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { declareBraid } from "@enumeratio/braid/src";
import { ENUMERATIO, declareCatalog } from "@enumeratio/catalog/src";
import { CARRIERS, declareCombinatorics, declareMaps } from "@enumeratio/combinatorics/src";
import { declareDiagrams } from "@enumeratio/diagram/src";
import { declareGraphics } from "@enumeratio/formats/src";
import { declareGeometric } from "@enumeratio/geometric/src";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra/src";
import { declareHecke } from "@enumeratio/hecke/src";
import { declareHopf } from "@enumeratio/hopf/src";
import { declareHypercomplex } from "@enumeratio/hypercomplex/src";
import { declareBoxes } from "@enumeratio/boxes/src";
import { declareIncidence } from "@enumeratio/incidence/src";
import { declareModular } from "@enumeratio/modular/src";
import { conventionalLatexDictionary } from "@enumeratio/frontend/conventional-latex";
import { declareFrontendCarriers } from "@enumeratio/frontend/declare-carriers";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareQuiver } from "@enumeratio/quiver/src";
import { declareResidues } from "@enumeratio/residues/src";
import {
  declareCarrierElement,
  declareCarrierPlurals,
  declareCompose,
  declareRestricted,
  declareRestrictions,
  declareStructures,
  ensureAlgebraHeads,
  ensureOperationHeads,
  ensureProtocols,
  RESTRICTIONS,
} from "@enumeratio/structures/src";
import {
  ALL_STATISTICS,
  declareDistributions,
  declareDistributions2,
  declareDistributions3,
  declareDistributions4,
  declareDistributions5,
  declareDistributions6,
  declareProcesses,
  declareStatistics,
} from "@enumeratio/statistics/src";

type Declare = (ce: ComputeEngine) => void;

// Statistics takes each carrier's type by its name, as the site's engine gives it.
const carrierTypes = (): Record<string, string> =>
  Object.fromEntries(CARRIERS.map((carrier) => [carrier.name, carrier.type]));

// `declareMaps` takes the constructor by its type, the other way around.
const constructorTypes = (): Record<string, string> =>
  Object.fromEntries(CARRIERS.map((carrier) => [carrier.type, carrier.name]));

/**
 * Every declaration with the package that owns it, in an order that satisfies what depends
 * on what. The package is the directory name, as the manifest names packages: what a step
 * adds or re-signs is that package's contribution (https://github.com/enumeratio/enumeratio/wiki/Manifest).
 */
export const PACKAGE_DECLARATIONS: readonly (readonly [pkg: string, declare: Declare])[] = [
  ["evaluation", declareEvaluation],
  // The protocols, algebra and operation heads first: the libraries below conform to them and
  // fill their tables. The generic
  // heads come later (below).
  [
    "structures",
    (ce) => {
      ensureProtocols(ce);
      ensureAlgebraHeads(ce);
      ensureOperationHeads(ce);
    },
  ],
  ["analytic", declareAnalytic],
  ["hypercomplex", declareHypercomplex],
  ["geometric", declareGeometric],
  ["diagram", declareDiagrams],
  ["residues", declareResidues],
  ["numerals", declareNumerals],
  ["hecke", declareHecke],
  ["incidence", declareIncidence],
  ["quiver", declareQuiver],
  ["hopf", declareHopf],
  ["groupalgebra", declareGroupAlgebra],
  ["modular", declareModular],
  ["adeles", declareAdeles],
  ["braid", declareBraid],
  // After adeles, as in reference's engines: adeles' Fibonacci/LucasL widening, declared
  // later, would replace this package's wider signature (the real index, the two-argument
  // polynomial). Until overloads dispatch (https://github.com/enumeratio/enumeratio/wiki/Manifest), the last declare wins.
  ["number-theory", declareNumberTheory],
  // Carriers, then the families typed by them -- one call (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible §4 step 3), in place of `declareCombinatoricsCarriers` + `declareCollections`
  // separately.
  ["combinatorics", declareCombinatorics],
  // After collections and analytic: their Floor/Min widenings would narrow the generic ones.
  ["structures", declareStructures],
  ["formats", declareGraphics],
  ["boxes", declareBoxes],
  // AFTER declareCombinatorics (above), so a plural a collection family already claims
  // (Permutations, DyckPaths, ...) is still free when this checks, not raced by minting a
  // bare symbol first.
  [
    "combinatorics",
    (ce) => {
      declareCarrierPlurals(ce, CARRIERS);
      declareCarrierElement(ce, CARRIERS);
    },
  ],
  // GlyphKind — moved here from combinatorics' now-retired domains area's LEFTOVER_CARRIERS. Type, constructor,
  // plural type-space name and `Element` membership, all in `declareFrontendCarriers` now
  // (`declareCarriers`' default folding) — residues/numerals/number-theory/hypercomplex,
  // listed above at their own declare call, already fold theirs the same way.
  ["frontend", declareFrontendCarriers],
  // Statistics keys off the carrier types too, so it has to follow `declareCombinatorics`.
  // combinatorics has no dependency on statistics, so this package still builds and passes
  // its own `domainTypes`.
  [
    "statistics",
    (ce) => {
      declareStatistics(ce, ALL_STATISTICS, { domainTypes: carrierTypes() });
      declareDistributions(ce);
      declareDistributions2(ce);
      declareDistributions3(ce);
      declareDistributions4(ce);
      declareDistributions5(ce);
      declareDistributions6(ce);
      declareProcesses(ce);
    },
  ],
  // `declareMaps` stays out of `declareCombinatorics` and here, at its ORIGINAL position:
  // it widens `Inverse` rather than minting it, and has to run after structures/
  // groupalgebra/modular declare their own `Inverse` so its permutation-carrier overload is
  // the one left standing (see @enumeratio/combinatorics' src/index.ts).
  [
    "combinatorics",
    (ce) => {
      declareMaps(ce, constructorTypes());
      declareRestricted(ce);
      declareRestrictions(ce, RESTRICTIONS);
    },
  ],
  ["combinatorics", declareCompose],
  ["catalog", (ce) => declareCatalog(ce, { bless: [ENUMERATIO] })],
];

/** Every declaration, in order. */
export const DECLARATIONS: readonly Declare[] = PACKAGE_DECLARATIONS.map(([, declare]) => declare);

/** An engine with everything we ship declared on it. */
export const fullEngine = (): ComputeEngine => {
  const ce = new ComputeEngine({
    latexSyntax: new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] }),
  });
  for (const declare of DECLARATIONS) declare(ce);
  return ce;
};

/**
 * Every name bound in an engine's scope chain.
 *
 * compute-engine exposes no public enumeration of its symbol table, so this reaches for the
 * lexical scope it walks internally. That is the one unsupported thing here, and it is
 * worth it: the alternative is trusting a hand-maintained list of what we declare, which is
 * exactly the thing that goes stale.
 */
export function bindings(ce: ComputeEngine): Set<string> {
  const internal = ce as unknown as {
    context: { lexicalScope: Scope };
  };
  const names = new Set<string>();
  let scope: Scope | undefined = internal.context.lexicalScope;
  while (scope !== undefined) {
    for (const name of scope.bindings.keys()) names.add(name);
    scope = scope.parent;
  }
  return names;
}

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}

/** What declaring our libraries ADDS to a bare engine — the census proper. */
export function declaredNames(): string[] {
  const bare = bindings(new ComputeEngine());
  return [...bindings(fullEngine())].filter((name) => !bare.has(name)).toSorted();
}
