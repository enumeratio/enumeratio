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

import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import { combineNotation, type PackageNotation, registerNotation } from "@enumeratio/boxes";
import { displayDictionary } from "@enumeratio/frontend/display";
import { NOTATIONS } from "@enumeratio/manifest";
import { declareAdeles } from "@enumeratio/adeles";
import { declareEvaluation } from "@enumeratio/evaluation";
import { declareAnalytic } from "@enumeratio/analytic";
import { declareBraid } from "@enumeratio/braid";
import { ENUMERATIO, declareCatalog } from "@enumeratio/catalog";
import { CARRIERS, declareCombinatorics, declareMaps } from "@enumeratio/combinatorics";
import { declareDiagrams } from "@enumeratio/diagram";
import { declareGraphics } from "@enumeratio/formats";
import { declareGeometric } from "@enumeratio/geometric";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra";
import { declareHecke } from "@enumeratio/hecke";
import { declareHopf } from "@enumeratio/hopf";
import { declareHypercomplex } from "@enumeratio/hypercomplex";
import { declareBoxes } from "@enumeratio/boxes";
import { declareIncidence } from "@enumeratio/incidence";
import { declareModular } from "@enumeratio/modular";
import { declareFrontendCarriers } from "@enumeratio/frontend/declare-carriers";
import { declareNumberTheory } from "@enumeratio/number-theory";
import { declareNumerals } from "@enumeratio/numerals";
import { declareQuiver } from "@enumeratio/quiver";
import { declareResidues } from "@enumeratio/residues";
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
} from "@enumeratio/structures";
import {
  declareDistributions,
  declareDistributions2,
  declareDistributions3,
  declareDistributions4,
  declareDistributions5,
  declareDistributions6,
  declareProcesses,
} from "@enumeratio/statistics";

type Declare = (ce: ComputeEngine) => void;

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
  // The combinatorial statistics moved into `declareCombinatorics` itself (step 6b: each
  // area declares its own statistics after its own carriers and families). What's left here
  // is genuinely `@enumeratio/statistics`'s own: the distributions and processes.
  [
    "statistics",
    (ce) => {
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

/** Every package's notation entry, by manifest name, as the manifest lists them. */
export const NOTATION_ENTRIES: Readonly<Record<string, PackageNotation>> = Object.fromEntries(
  await Promise.all(
    Object.entries(NOTATIONS).map(
      async ([name, specifier]) =>
        [name, ((await import(specifier)) as { notation: PackageNotation }).notation] as const,
    ),
  ),
);

/** Every package's notation as one. */
export const NOTATION = combineNotation(Object.values(NOTATION_ENTRIES));

/** An engine with everything we ship declared on it, and every package's notation. */
export const fullEngine = (): ComputeEngine => {
  const ce = new ComputeEngine({
    latexSyntax: new LatexSyntax({ dictionary: displayDictionary(LATEX_DICTIONARY, NOTATION.latex) as never[] }),
  });
  registerNotation(ce, NOTATION.traditional);
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
