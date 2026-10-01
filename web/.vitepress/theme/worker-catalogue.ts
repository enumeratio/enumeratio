// The host's library catalogue for its session kernels
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Kernels-and-Front-Ends): each
// library the site ships, and how to declare it, which a kernel reads to declare only what a
// call needs. Imports are dynamic, so a worker loads a library's chunk when a call first
// needs it.
//
// The resolver learns what each library declares from `@enumeratio/manifest`'s DECLARERS,
// collected over reference's engine, and what each needs declared first from its HIERARCHY.
// Libraries it doesn't cover yet (formats' graphics, geometric, the frontend's carriers) are
// `global`: declared with the first call that declares anything.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { Library } from "@enumeratio/manifest";

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
  { name: "structures", declare: async (ce) => (await import("@enumeratio/structures")).declareStructures(ce) },
  // As reference's LIBRARIES: `CombinatorialStat`'s table is a registry declaring can't see.
  { name: "combinatorics", names: ["CombinatorialStat", "Tally"], declare: combinatorics },
  // The frontend's carriers: as a library it extends structures, not the analytic its plots import.
  {
    name: "frontend",
    global: true,
    declare: async (ce) => (await import("@enumeratio/frontend/declare-carriers")).declareFrontendCarriers(ce),
  },
  {
    name: "analytic",
    declare: async (ce) => {
      const { declareAnalytic, declareFractals } = await import("@enumeratio/analytic");
      declareAnalytic(ce);
      declareFractals(ce);
    },
  },
  { name: "formats", global: true, declare: async (ce) => (await import("@enumeratio/formats")).declareGraphics(ce) },
  { name: "boxes", declare: async (ce) => (await import("@enumeratio/boxes")).declareBoxes(ce) },
  { name: "hypercomplex", declare: async (ce) => (await import("@enumeratio/hypercomplex")).declareHypercomplex(ce) },
  {
    name: "geometric",
    global: true,
    declare: async (ce) => (await import("@enumeratio/geometric")).declareGeometric(ce),
  },
  { name: "diagram", declare: async (ce) => (await import("@enumeratio/diagram")).declareDiagrams(ce) },
  { name: "residues", declare: async (ce) => (await import("@enumeratio/residues")).declareResidues(ce) },
  { name: "numerals", declare: async (ce) => (await import("@enumeratio/numerals")).declareNumerals(ce) },
  { name: "hecke", declare: async (ce) => (await import("@enumeratio/hecke")).declareHecke(ce) },
  { name: "incidence", declare: async (ce) => (await import("@enumeratio/incidence")).declareIncidence(ce) },
  { name: "quiver", declare: async (ce) => (await import("@enumeratio/quiver")).declareQuiver(ce) },
  { name: "hopf", declare: async (ce) => (await import("@enumeratio/hopf")).declareHopf(ce) },
  { name: "groupalgebra", declare: async (ce) => (await import("@enumeratio/groupalgebra")).declareGroupAlgebra(ce) },
  { name: "modular", declare: async (ce) => (await import("@enumeratio/modular")).declareModular(ce) },
  { name: "number-theory", declare: async (ce) => (await import("@enumeratio/number-theory")).declareNumberTheory(ce) },
  { name: "adeles", declare: async (ce) => (await import("@enumeratio/adeles")).declareAdeles(ce) },
  { name: "braid", declare: async (ce) => (await import("@enumeratio/braid")).declareBraid(ce) },
];
