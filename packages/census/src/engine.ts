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
import { declareAestimatio } from "@enumeratio/aestimatio/src";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { declareBraid } from "@enumeratio/braid/src";
import { ENUMERATIO, declareCatalog } from "@enumeratio/catalog/src";
import { declareCollections } from "@enumeratio/collections/src";
import { declareDiagrams } from "@enumeratio/diagram/src";
import {
  DOMAINS,
  RESTRICTIONS,
  declareCompose,
  declareDomains,
  declareMaps,
  declareRestricted,
  declareRestrictions,
} from "@enumeratio/domains/src";
import { declareGraphics } from "@enumeratio/formats/src";
import { declareGeometric } from "@enumeratio/geometric/src";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra/src";
import { declareHecke } from "@enumeratio/hecke/src";
import { declareHopf } from "@enumeratio/hopf/src";
import { declareHypercomplex } from "@enumeratio/hypercomplex/src";
import { declareIncidence } from "@enumeratio/incidence/src";
import { declareModular } from "@enumeratio/modular/src";
import { conventionalLatexDictionary } from "@enumeratio/notatio/conventional-latex";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareQuiver } from "@enumeratio/quiver/src";
import { declareResidues } from "@enumeratio/residues/src";
import {
  ALL_STATISTICS,
  declareDistributions,
  declareDistributions2,
  declareDistributions3,
  declareDistributions4,
  declareDistributions5,
  declareDistributions6,
  declareStatistics,
} from "@enumeratio/statistics/src";

/** Every declaration, in an order that satisfies what depends on what. */
export const DECLARATIONS: ((ce: ComputeEngine) => void)[] = [
  declareAestimatio,
  declareAnalytic,
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
  declareCollections,
  declareGraphics,
  declareDomains,
  (ce) => {
    // Statistics, maps and restrictions all key off the carrier types, so they take the
    // same (type → constructor) index and have to follow `declareDomains`.
    const domainTypes = Object.fromEntries(DOMAINS.map((domain) => [domain.type, domain.name]));
    declareStatistics(ce, ALL_STATISTICS, { skipDeclared: true, domainTypes });
    declareDistributions(ce);
    declareDistributions2(ce);
    declareDistributions3(ce);
    declareDistributions4(ce);
    declareDistributions5(ce);
    declareDistributions6(ce);
    declareMaps(ce, domainTypes);
    declareRestricted(ce);
    declareRestrictions(ce, RESTRICTIONS, { skipDeclared: true });
  },
  declareCompose,
  (ce) => {
    declareCatalog(ce, { bless: [ENUMERATIO] });
  },
];

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
  return [...bindings(fullEngine())].filter((name) => !bare.has(name)).sort();
}
