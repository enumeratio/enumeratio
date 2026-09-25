import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareHypercomplex } from "@enumeratio/hypercomplex";
import { expect, test } from "vite-plus/test";
import { declareGeometric } from "../src/index.ts";

function engine(): ComputeEngine {
  const ce = new ComputeEngine();
  declareHypercomplex(ce);
  declareGeometric(ce);
  return ce;
}

const ce = engine();
/** Evaluate a LaTeX source and return its LaTeX, so the tests read like the algebra. */
const ev = (src: string): string => ce.parse(src).evaluate().latex;

// --- the outer product ------------------------------------------------------------

test("the wedge of two distinct generators is their blade, and it anticommutes", () => {
  expect(ev("\\mathrm{Wedge}(e_1, e_2)")).toBe("e_1e_2");
  expect(ev("\\mathrm{Wedge}(e_2, e_1)")).toBe(ev("-e_1e_2"));
});

test("a generator wedged with itself is zero, whatever it squares to", () => {
  for (const g of ["e_1", "f_1", "\\theta_1"]) {
    expect(ev(`\\mathrm{Wedge}(${g}, ${g})`)).toBe("0");
  }
  // The geometric product does NOT vanish for e_1 — that is the metric half of it.
  expect(ev("\\mathrm{GeometricProduct}(e_1, e_1)")).toBe("1");
});

test("the wedge is associative, so it folds any number of operands", () => {
  expect(ev("\\mathrm{Wedge}(e_1, e_2, e_3)")).toBe("e_1e_2e_3");
  expect(ev("\\mathrm{Wedge}(e_1, e_2, e_1)")).toBe("0");
});

test("the wedge is linear in each argument", () => {
  expect(ev("\\mathrm{Wedge}(2e_1 + 3e_2, e_2)")).toBe("2e_1e_2");
});

// --- contractions -----------------------------------------------------------------

test("contracting with a higher grade gives zero; with a lower one, the complement", () => {
  expect(ev("\\mathrm{LeftContraction}(e_1, e_1e_2)")).toBe("e_2");
  expect(ev("\\mathrm{LeftContraction}(e_1e_2, e_1)")).toBe("0");
  expect(ev("\\mathrm{RightContraction}(e_1e_2, e_2)")).toBe("e_1");
});

test("the scalar product is the grade-0 part, so a generator with itself is its square", () => {
  expect(ev("\\mathrm{ScalarProduct}(e_1, e_1)")).toBe("1");
  expect(ev("\\mathrm{ScalarProduct}(f_1, f_1)")).toBe("-1");
  expect(ev("\\mathrm{ScalarProduct}(\\theta_1, \\theta_1)")).toBe("0");
  expect(ev("\\mathrm{ScalarProduct}(e_1, e_2)")).toBe("0");
});

// --- grade ------------------------------------------------------------------------

test("Grade answers only for a homogeneous element", () => {
  expect(ev("\\mathrm{Grade}(e_1e_2)")).toBe("2");
  expect(ev("\\mathrm{Grade}(3e_1 + 4e_2)")).toBe("1");
  // A rotor has two grades and therefore no grade; it stays unevaluated.
  expect(ev("\\mathrm{Grade}(1 + e_1e_2)")).toBe("\\mathrm{Grade}(e_1e_2+1)");
});

test("GradePart splits a rotor into its parts", () => {
  expect(ev("\\mathrm{GradePart}(2 + 3e_1e_2, 0)")).toBe("2");
  expect(ev("\\mathrm{GradePart}(2 + 3e_1e_2, 2)")).toBe("3e_1e_2");
  expect(ev("\\mathrm{GradePart}(2 + 3e_1e_2, 1)")).toBe("0");
});

// --- involutions ------------------------------------------------------------------

test("reversion flips grades 2 and 3 and leaves 0 and 1 alone", () => {
  expect(ev("\\mathrm{Reversion}(1 + e_1 + e_1e_2 + e_1e_2e_3)")).toBe(ev("1 + e_1 - e_1e_2 - e_1e_2e_3"));
});

test("grade involution flips the odd grades", () => {
  expect(ev("\\mathrm{GradeInvolution}(1 + e_1 + e_1e_2 + e_1e_2e_3)")).toBe(ev("1 - e_1 + e_1e_2 - e_1e_2e_3"));
});

test("Clifford conjugation is reversion after grade involution", () => {
  const x = "1 + 2e_1 + 3e_1e_2 + 4e_1e_2e_3";
  expect(ev(`\\mathrm{CliffordConjugate}(${x})`)).toBe(ev(`\\mathrm{Reversion}(\\mathrm{GradeInvolution}(${x}))`));
});

test("every involution is an involution", () => {
  const x = "1 + 2e_1 + 3e_1e_2 + 4e_1e_2e_3 + 5e_1e_2e_3e_4";
  for (const f of ["Reversion", "GradeInvolution", "CliffordConjugate"]) {
    expect(ev(`\\mathrm{${f}}(\\mathrm{${f}}(${x}))`)).toBe(ev(x));
  }
});

// --- duality ----------------------------------------------------------------------

const CL2 = "\\mathrm{CliffordAlgebra}(2)";
const PGA2 = "\\mathrm{CliffordAlgebra}(2,0,1)";

test("the pseudoscalar is the top blade of the algebra it is asked about", () => {
  expect(ev(`\\mathrm{Pseudoscalar}(${CL2})`)).toBe("e_1e_2");
  expect(ev(`\\mathrm{Pseudoscalar}(\\mathrm{CliffordAlgebra}(3)) `)).toBe("e_1e_2e_3");
  // 2-D PGA: two positive generators and one degenerate one, which is the theta family.
  expect(ev(`\\mathrm{Pseudoscalar}(${PGA2})`)).toBe("e_1e_2\\theta_1");
});

test("the dual of a blade is its complement in the algebra it is taken in", () => {
  expect(ev(`\\mathrm{Dual}(e_1, ${CL2})`)).toBe("e_2");
  // The SAME element dualises differently in a bigger algebra — which is why the
  // algebra is an argument and not something read off the expression.
  expect(ev("\\mathrm{Dual}(e_1, \\mathrm{CliffordAlgebra}(3))")).toBe("e_2e_3");
});

test("the dual is signed so that b wedge dual(b) is the pseudoscalar", () => {
  for (const algebra of [CL2, "\\mathrm{CliffordAlgebra}(3)", PGA2]) {
    const generators = algebra === PGA2 ? ["e_1", "e_2", "\\theta_1", "e_1e_2"] : ["e_1", "e_2", "1"];
    for (const b of generators) {
      expect(ev(`\\mathrm{Wedge}(${b}, \\mathrm{Dual}(${b}, ${algebra}))`)).toBe(
        ev(`\\mathrm{Pseudoscalar}(${algebra})`),
      );
    }
  }
});

test("the dual survives a degenerate metric, where the pseudoscalar has no inverse", () => {
  // In 2-D PGA the pseudoscalar squares to zero, so "multiply by I inverse" is not
  // available at all; the complement definition still answers.
  expect(ev(`\\mathrm{GeometricProduct}(\\mathrm{Pseudoscalar}(${PGA2}), \\mathrm{Pseudoscalar}(${PGA2}))`)).toBe("0");
  expect(ev(`\\mathrm{Dual}(\\theta_1, ${PGA2})`)).toBe("e_1e_2");
});

test("a generator outside the algebra leaves the dual unevaluated", () => {
  expect(ev(`\\mathrm{Dual}(e_3, ${CL2})`)).toBe(`\\mathrm{Dual}(e_3, ${CL2})`);
});

test("the vee is the wedge of the duals, dualised back", () => {
  expect(ev(`\\mathrm{Vee}(e_1e_2, e_1e_2, ${PGA2})`)).toBe(
    ev(`\\mathrm{Dual}(\\mathrm{Wedge}(\\mathrm{Dual}(e_1e_2, ${PGA2}), \\mathrm{Dual}(e_1e_2, ${PGA2})), ${PGA2})`),
  );
});

// --- versors ----------------------------------------------------------------------

test("a bivector rotor turns a vector a quarter turn through the sandwich", () => {
  // In Cl(2,0), R = e_1e_2 is the rotor for a half turn: R e_1 ~R = -e_1.
  expect(ev("\\mathrm{Sandwich}(e_1e_2, e_1)")).toBe("-e_1");
  expect(ev("\\mathrm{Sandwich}(e_1e_2, e_2)")).toBe("-e_2");
});

test("a reflection is its own inverse", () => {
  expect(ev("\\mathrm{Sandwich}(e_1, \\mathrm{Sandwich}(e_1, e_2))")).toBe("e_2");
});

// --- exactness --------------------------------------------------------------------

test("coefficients stay exact and may stay symbolic", () => {
  expect(ev("\\mathrm{Wedge}(\\frac{1}{3}e_1, \\pi e_2)")).toBe(ev("\\frac{\\pi}{3}e_1e_2"));
  expect(ev("\\mathrm{Reversion}(a e_1e_2)")).toBe(ev("-a e_1e_2"));
});
