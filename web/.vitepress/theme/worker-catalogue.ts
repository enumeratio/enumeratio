// The host's library catalogue for its session kernels
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends): each
// library the site ships, and how to declare it, which a kernel reads to declare only what a
// call needs. Imports are dynamic, so a worker loads a library's chunk when a call first
// needs it.
//
// The resolver learns what each library declares from its `declares.json`, which the library's
// build writes, and what each needs declared first from the manifest's HIERARCHY. The `global`
// ones are declared with the first call that declares anything.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { Library, LibraryDeclares } from "@enumeratio/manifest";
import structuresDeclares from "@enumeratio/structures/declares.json" with { type: "json" };
import combinatoricsDeclares from "@enumeratio/combinatorics/declares.json" with { type: "json" };
import frontendDeclares from "@enumeratio/frontend/declares.json" with { type: "json" };
import analyticDeclares from "@enumeratio/analytic/declares.json" with { type: "json" };
import formatsDeclares from "@enumeratio/formats/declares.json" with { type: "json" };
import boxesDeclares from "@enumeratio/boxes/declares.json" with { type: "json" };
import hypercomplexDeclares from "@enumeratio/hypercomplex/declares.json" with { type: "json" };
import geometricDeclares from "@enumeratio/geometric/declares.json" with { type: "json" };
import diagramDeclares from "@enumeratio/diagram/declares.json" with { type: "json" };
import residuesDeclares from "@enumeratio/residues/declares.json" with { type: "json" };
import numeralsDeclares from "@enumeratio/numerals/declares.json" with { type: "json" };
import heckeDeclares from "@enumeratio/hecke/declares.json" with { type: "json" };
import incidenceDeclares from "@enumeratio/incidence/declares.json" with { type: "json" };
import quiverDeclares from "@enumeratio/quiver/declares.json" with { type: "json" };
import hopfDeclares from "@enumeratio/hopf/declares.json" with { type: "json" };
import groupalgebraDeclares from "@enumeratio/groupalgebra/declares.json" with { type: "json" };
import modularDeclares from "@enumeratio/modular/declares.json" with { type: "json" };
import numberTheoryDeclares from "@enumeratio/number-theory/declares.json" with { type: "json" };
import adelesDeclares from "@enumeratio/adeles/declares.json" with { type: "json" };
import braidDeclares from "@enumeratio/braid/declares.json" with { type: "json" };

const combinatorics = async (ce: ComputeEngine): Promise<void> => {
  const { CARRIERS, declareCombinatorics, declareMaps } = await import("@enumeratio/combinatorics");
  const { declareCarrierElement, declareCarrierPlurals } = await import("@enumeratio/structures");
  declareCombinatorics(ce);
  declareCarrierPlurals(ce, CARRIERS);
  declareCarrierElement(ce, CARRIERS);
  declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
};

// Structures first: the protocols every other library builds on.
export const CATALOGUE: readonly Library<ComputeEngine>[] = [
  {
    name: "structures",
    declares: structuresDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/structures")).declareStructures(ce),
  },
  // As reference's LIBRARIES: `CombinatorialStat`'s table is a registry declaring can't see.
  {
    name: "combinatorics",
    declares: combinatoricsDeclares as LibraryDeclares,
    names: ["CombinatorialStat", "Tally"],
    declare: combinatorics,
  },
  // The frontend's carriers: as a library it extends structures, not the analytic its plots import.
  {
    name: "frontend",
    declares: frontendDeclares as LibraryDeclares,
    global: true,
    declare: async (ce) => (await import("@enumeratio/frontend/declare-carriers")).declareFrontendCarriers(ce),
  },
  {
    name: "analytic",
    declares: analyticDeclares as LibraryDeclares,
    declare: async (ce) => {
      const { declareAnalytic, declareFractals } = await import("@enumeratio/analytic");
      declareAnalytic(ce);
      declareFractals(ce);
    },
  },
  {
    name: "formats",
    declares: formatsDeclares as LibraryDeclares,
    global: true,
    declare: async (ce) => (await import("@enumeratio/formats")).declareGraphics(ce),
  },
  {
    name: "boxes",
    declares: boxesDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/boxes")).declareBoxes(ce),
  },
  {
    name: "hypercomplex",
    declares: hypercomplexDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/hypercomplex")).declareHypercomplex(ce),
  },
  {
    name: "geometric",
    declares: geometricDeclares as LibraryDeclares,
    global: true,
    declare: async (ce) => (await import("@enumeratio/geometric")).declareGeometric(ce),
  },
  {
    name: "diagram",
    declares: diagramDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/diagram")).declareDiagrams(ce),
  },
  {
    name: "residues",
    declares: residuesDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/residues")).declareResidues(ce),
  },
  {
    name: "numerals",
    declares: numeralsDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/numerals")).declareNumerals(ce),
  },
  {
    name: "hecke",
    declares: heckeDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/hecke")).declareHecke(ce),
  },
  {
    name: "incidence",
    declares: incidenceDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/incidence")).declareIncidence(ce),
  },
  {
    name: "quiver",
    declares: quiverDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/quiver")).declareQuiver(ce),
  },
  {
    name: "hopf",
    declares: hopfDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/hopf")).declareHopf(ce),
  },
  {
    name: "groupalgebra",
    declares: groupalgebraDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/groupalgebra")).declareGroupAlgebra(ce),
  },
  {
    name: "modular",
    declares: modularDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/modular")).declareModular(ce),
  },
  {
    name: "number-theory",
    declares: numberTheoryDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/number-theory")).declareNumberTheory(ce),
  },
  {
    name: "adeles",
    declares: adelesDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/adeles")).declareAdeles(ce),
  },
  {
    name: "braid",
    declares: braidDeclares as LibraryDeclares,
    declare: async (ce) => (await import("@enumeratio/braid")).declareBraid(ce),
  },
];
