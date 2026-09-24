import { ComputeEngine } from "@cortex-js/compute-engine";
// Buildless src subpath: the reference tests must run without a prior `vp pack`
// of @enumeratio/analytic (CI runs tests before builds).
import { declareAdeles } from "@enumeratio/adeles/src";
import { declareAestimatio } from "@enumeratio/aestimatio/src";
import { declareAnalytic } from "@enumeratio/analytic/src";
import { declareDiagrams } from "@enumeratio/diagram/src";
import { declareHecke } from "@enumeratio/hecke/src";
import { declareIncidence } from "@enumeratio/incidence/src";
import { declareQuiver } from "@enumeratio/quiver/src";
import { declareHopf } from "@enumeratio/hopf/src";
import { declareGroupAlgebra } from "@enumeratio/groupalgebra/src";
import { declareModular } from "@enumeratio/modular/src";
import { declareNumberTheory } from "@enumeratio/number-theory/src";
import { declareBraid } from "@enumeratio/braid/src";
import { declareHypercomplex } from "@enumeratio/hypercomplex/src";
import { declareNumerals } from "@enumeratio/numerals/src";
import { declareResidues } from "@enumeratio/residues/src";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/index.ts";

const ce = new ComputeEngine();
declareAestimatio(ce);
// The special-functions entries document heads provided by @enumeratio/analytic
// (HurwitzZeta, the two-argument Zeta); declare them so their examples validate.
declareAnalytic(ce);
// …and the hypercomplex unit families, for the Hypercomplex algebra entries.
declareHypercomplex(ce);
// …and the diagram algebras.
declareDiagrams(ce);
// …and arithmetic in ℤ/m, which the numeral systems and number theory build on.
declareResidues(ce);
// …and the numeral systems.
declareNumerals(ce);
// …and the Hecke algebra.
declareHecke(ce);
// …and the incidence algebra.
declareIncidence(ce);
// …and the path algebras.
declareQuiver(ce);
// …and the Hopf algebras.
declareHopf(ce);
// …and the group algebras.
declareGroupAlgebra(ce);
// …and the modular group.
declareModular(ce);
// …and number theory past ℤ/m.
declareNumberTheory(ce);
// …and adèles and idèles over Q (needs residues, numerals and number-theory declared first).
declareAdeles(ce);
// …and the braid groups.
declareBraid(ce);

// Re-evaluate every documented example and pin it to `expected`. A change in
// compute-engine's behaviour (or a bad example) fails here instead of shipping
// a wrong reference page.
for (const entry of entries) {
  for (const [index, example] of entry.examples.entries()) {
    const label = example.aspirational ? " (gap)" : "";
    test(`${entry.name} example ${index + 1}${label}`, () => {
      const input = example.expr as unknown as Parameters<ComputeEngine["box"]>[0];
      const output = ce.box(input).evaluate().json;
      if (example.aspirational) {
        // A documented capability gap: CE should NOT yet match the borrowed
        // target. If this starts matching, promote it (drop `aspirational`).
        expect(output).not.toEqual(example.expected);
      } else {
        expect(output).toEqual(example.expected);
      }
    });
  }
}
