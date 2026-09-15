import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareHypercomplex } from "../src/declare.ts";
import { multiplyBlades } from "../src/multivector.ts";
import { FAMILIES, type Generator } from "../src/units.ts";

const ce = new ComputeEngine();
declareHypercomplex(ce);

type Expr = number | string | readonly [string, ...Expr[]];

/** Evaluate both sides the same way and compare canonical MathJSON. */
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);

/** Evaluate LaTeX and compare against an evaluated expected expression. */
const sameLatex = (latex: string, expected: Expr) =>
  expect(ce.parse(latex).evaluate().json).toEqual(ce.box(expected).evaluate().json);

const norm = (input: Expr): Expr => ["Norm", input];

// ── the defining relations ──────────────────────────────────────────────────────

test("i_k² = −1, and distinct units commute", () => {
  sameLatex("i_1^2", -1);
  sameLatex("i_2^2", -1);
  sameLatex("i_1 i_2", ["Multiply", "i_1", "i_2"]);
  sameLatex("i_2 i_1", ["Multiply", "i_1", "i_2"]); // commutative, unlike the quaternions
});

test("the mixed signature: (i_1 i_2)² = +1 even though i_1² = i_2² = −1", () => {
  // The blade i_1i_2 squares to i_1²i_2² = (−1)(−1) = +1, so ℂ_2 is NOT a field —
  // it has zero divisors and idempotents that ℂ_1 does not.
  sameLatex("(i_1 i_2)^2", 1);
  sameLatex("(i_1 i_2 i_3)^2", -1); // (−1)³
});

test("j_m² = (−1)^popcount(m) for every blade of ℂ_3", () => {
  // The closed form, checked against the blade product on all 8 basis units.
  const popcount = (m: number): number => (m === 0 ? 0 : (m & 1) + popcount(m >> 1));
  const bladeOf = (m: number): Generator[] =>
    [0, 1, 2].filter((b) => (m >> b) & 1).map((b) => ({ family: FAMILIES[0]!, index: b + 1 }));
  for (let m = 0; m < 8; m++) {
    const { sign, blade } = multiplyBlades(bladeOf(m), bladeOf(m));
    expect(blade).toEqual([]);
    expect(sign).toBe(popcount(m) % 2 === 0 ? 1 : -1);
  }
});

test("j_a · j_b = (−1)^popcount(a∧b) · j_(a⊻b) — the Thue–Morse overlap sign", () => {
  const popcount = (m: number): number => (m === 0 ? 0 : (m & 1) + popcount(m >> 1));
  const bladeOf = (m: number): Generator[] =>
    [0, 1, 2].filter((b) => (m >> b) & 1).map((b) => ({ family: FAMILIES[0]!, index: b + 1 }));
  for (let a = 0; a < 8; a++) {
    for (let b = 0; b < 8; b++) {
      const { sign, blade } = multiplyBlades(bladeOf(a), bladeOf(b));
      expect(sign).toBe(popcount(a & b) % 2 === 0 ? 1 : -1);
      expect(blade).toEqual(bladeOf(a ^ b));
    }
  }
});

// ── ring arithmetic ─────────────────────────────────────────────────────────────

test("(1 + i_1)² = 2i_1 — the ℂ_1 binomial", () => {
  sameLatex("(1+i_1)^2", ["Multiply", 2, "i_1"]);
});

test("(1 + i_1)(1 + i_2) expands over all four ℂ_2 basis units", () => {
  sameLatex("(1+i_1)(1+i_2)", ["Add", 1, "i_1", "i_2", ["Multiply", "i_1", "i_2"]]);
});

test("symbolic coefficients stay symbolic: (a + b·i_1)² = a² − b² + 2ab·i_1", () => {
  sameLatex("(a+bi_1)^2", [
    "Add",
    ["Subtract", ["Power", "a", 2], ["Power", "b", 2]],
    ["Multiply", 2, "a", "b", "i_1"],
  ]);
});

test("conjugation flips every unit: the odd-grade blades negate", () => {
  sameLatex("\\overline{1+i_1+i_2+i_1i_2}", [
    "Add",
    1,
    ["Negate", "i_1"],
    ["Negate", "i_2"],
    ["Multiply", "i_1", "i_2"],
  ]);
  same(["Conjugate", ["Add", 1, "i_1"]], ["Subtract", 1, "i_1"]);
});

test("z·conj(z) is NOT a scalar for n ≥ 2 — why the norm is a determinant", () => {
  // (a+b i_1+c i_2+d i_1i_2)·conj = (a²+b²+c²+d²) + 2(ad−bc)·i_1i_2. At (1,2,3,4):
  // 1+4+9+16 = 30 and 2(1·4 − 2·3) = −4.
  sameLatex("(1+2i_1+3i_2+4i_1i_2)\\overline{(1+2i_1+3i_2+4i_1i_2)}", [
    "Subtract",
    30,
    ["Multiply", 4, "i_1", "i_2"],
  ]);
});

// ── the algebra norm ────────────────────────────────────────────────────────────

test("at n = 1 the norm is the Gaussian norm a² + b²", () => {
  same(norm(["Add", 3, ["Multiply", 4, "i_1"]]), 25);
  same(norm("i_1"), 1);
  same(norm(["Add", 1, "i_1"]), 2);
});

test("N(1 + 2i_1 + 3i_1i_2) = 160 — the 4×4 multiplication determinant", () => {
  // Independently: multiplication by z in the basis (1, i_1, i_2, i_1i_2) is
  //   [1 −2  0  3; 2  1 −3  0; 0 −3  1 −2; 3  0  2  1],  whose determinant is 160
  // (expand along the first row: −4 + 2·28 − 3·(−36)).
  same(norm(["Add", 1, ["Multiply", 2, "i_1"], ["Multiply", 3, "i_1", "i_2"]]), 160);
});

test("the norm is multiplicative on a fixed unit set", () => {
  const z: Expr = ["Add", 1, ["Multiply", 2, "i_1"], ["Multiply", 3, "i_1", "i_2"]];
  const w: Expr = ["Add", 2, "i_1", "i_2"];
  same(norm(w), 32); // u=(2,1), v=(1,0): u²+v² = (3,4) → 9+16
  same(norm(["Multiply", z, w]), ["Multiply", 160, 32]);
});

test("the norm depends on the ambient algebra: N_{n+1} = N_n²", () => {
  // Each factor has norm 2 over ℂ_1, but 2² = 4 over ℂ_2, so the ℂ_2 norm of the
  // product is 4·4 = 16 — not 2·2. Adjoining a generator squares the determinant.
  sameLatex("\\operatorname{Norm}(1+i_1)", 2);
  sameLatex("\\operatorname{Norm}(1+i_2)", 2);
  sameLatex("\\operatorname{Norm}((1+i_1)(1+i_2))", 16);
});

// ── units, zero divisors, idempotents ───────────────────────────────────────────

test("inverse round-trips, exactly", () => {
  sameLatex("\\frac{1}{1+i_1}", [
    "Subtract",
    ["Rational", 1, 2],
    ["Multiply", ["Rational", 1, 2], "i_1"],
  ]);
  sameLatex("(1+i_1)(1+i_1)^{-1}", 1);
  sameLatex("(1+2i_1+3i_1i_2)(1+2i_1+3i_1i_2)^{-1}", 1);
  sameLatex("i_1^{-1}", ["Negate", "i_1"]); // 1/i = −i
});

test("1 + i_1i_2 is a zero divisor: norm 0, no inverse, and it annihilates", () => {
  sameLatex("\\operatorname{Norm}(1+i_1i_2)", 0);
  sameLatex("(1+i_1i_2)(1-i_1i_2)", 0);
  // Not invertible, so Divide is left standing rather than answered.
  expect(ce.parse("\\frac{1}{1+i_1i_2}").evaluate().operator).toBe("Divide");
});

test("(1 + i_1i_2)/2 is idempotent — the primitive idempotent of ℂ_2", () => {
  sameLatex("\\left(\\frac{1+i_1i_2}{2}\\right)^2", [
    "Divide",
    ["Add", 1, ["Multiply", "i_1", "i_2"]],
    2,
  ]);
});
