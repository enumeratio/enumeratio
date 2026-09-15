import type { ReferenceEntry } from "./types.ts";
import { arithmetic } from "./entries/arithmetic.ts";
import { combinatorics } from "./entries/combinatorics.ts";
import { collections } from "./entries/collections.ts";
import { enumerableFamilies } from "./entries/enumerable-families.ts";
import { diagramAlgebras } from "./entries/diagram.ts";
import { elementary } from "./entries/elementary.ts";
import { hecke } from "./entries/hecke.ts";
import { groupAlgebras } from "./entries/groupalgebra.ts";
import { braids } from "./entries/braid.ts";
import { modular } from "./entries/modular.ts";
import { hopf } from "./entries/hopf.ts";
import { incidence } from "./entries/incidence.ts";
import { quiverAlgebras } from "./entries/quiver.ts";
import { numerals } from "./entries/numerals.ts";
import { hypercomplex } from "./entries/hypercomplex.ts";
import { numberTheory } from "./entries/number-theory.ts";
import { sequences } from "./entries/sequences.ts";
import { specialFunctions } from "./entries/special-functions.ts";
import { analyticSpecial } from "./entries/analytic-special.ts";

// One flat list assembled from the per-domain files. Add a new domain by
// creating a sibling file under `entries/` and importing it here.
export const entries: readonly ReferenceEntry[] = [
  ...combinatorics,
  ...sequences,
  ...numberTheory,
  ...arithmetic,
  ...elementary,
  ...specialFunctions,
  ...analyticSpecial,
  ...hypercomplex,
  ...diagramAlgebras,
  ...numerals,
  ...hecke,
  ...incidence,
  ...quiverAlgebras,
  ...hopf,
  ...groupAlgebras,
  ...modular,
  ...braids,
  ...collections,
  ...enumerableFamilies,
];
