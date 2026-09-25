import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareHypercomplex } from "../src/declare.ts";
import { FAMILIES, generatorOf } from "../src/units.ts";

const ce = new ComputeEngine();
declareHypercomplex(ce);

type Expr = number | string | readonly [string, ...Expr[]];

const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const sameLatex = (latex: string, expected: Expr) =>
  expect(ce.parse(latex).evaluate().json).toEqual(ce.box(expected).evaluate().json);

// ── which symbols are units ─────────────────────────────────────────────────────

test("only <known prefix>_<index> is a generator", () => {
  expect(generatorOf("i_1")?.family.square).toBe(-1);
  expect(generatorOf("j_2")?.family.square).toBe(1);
  expect(generatorOf("epsilon_1")?.family.square).toBe(0);
  expect(generatorOf("e_3")?.family.anticommutes).toBe(true);
  for (const other of ["x_1", "a_2", "i", "e", "n", "i_0", "iota_1", "i_x"]) {
    expect(generatorOf(other)).toBeUndefined();
  }
});

test("\\varepsilon and \\epsilon name the same generator", () => {
  // compute-engine parses the two glyphs to different symbols; aliasing them keeps a
  // user who typed the other one from getting a silently distinct unit.
  expect(generatorOf("epsilonSymbol_1")).toEqual(generatorOf("epsilon_1"));
  sameLatex("\\varepsilon_1 \\epsilon_1", 0);
});

// ── ordinary arithmetic is untouched ───────────────────────────────────────────

test("native arithmetic and native complex i still behave", () => {
  sameLatex("2+3", 5);
  sameLatex("\\frac{1}{2}+\\frac{1}{3}", ["Rational", 5, 6]);
  sameLatex("(1+i)^2", ["Complex", 0, 2]); // compute-engine's own complex unit
  sameLatex("i^2", -1);
  sameLatex("\\sqrt{-1}", ["Complex", 0, 1]);
  sameLatex("(x+1)^2", ["Power", ["Add", "x", 1], 2]); // still unexpanded, as before
});

test("wrapping an operator preserves its result-type inference", () => {
  // Redeclaring replaces the whole definition. `Add` prints `(value+) -> value` but
  // computes a tighter result type through its `type` handler, so a wrapper that
  // forgets to carry it widens every sum to `value` — and then `Conjugate`, whose
  // signature demands `number`, rejects `1 + x` with an incompatible-type error.
  expect(String(ce.parse("1+x").type)).toBe("number");
  expect(ce.box(["Conjugate", ["Add", 1, "x"]]).json).toEqual(["Conjugate", ["Add", "x", 1]]);
  same(["Conjugate", ["Add", 1, "i_1"]], ["Subtract", 1, "i_1"]);
});

test("compute-engine's i is a scalar coefficient, distinct from i_1", () => {
  // i is a number literal, not a symbol, so it rides along inside coefficients.
  // ℝ[i_1] is therefore a genuinely new commuting square root of −1.
  sameLatex("i i_1 i_1", ["Complex", 0, -1]); // i·(i_1²) = −i
  expect(ce.parse("i_1").json).toBe("i_1");
  expect(ce.parse("i").json).toEqual(["Complex", 0, 1]);
});

// ── split / perplex units ───────────────────────────────────────────────────────

test("j_k² = +1 and the split algebra has zero divisors", () => {
  sameLatex("j_1^2", 1);
  sameLatex("(1+j_1)(1-j_1)", 0); // 1 − j_1² = 0
  sameLatex("\\operatorname{Norm}(3+4j_1)", -7); // a² − b², not a² + b²
  sameLatex("\\operatorname{Norm}(1+j_1)", 0);
  expect(ce.parse("\\frac{1}{1+j_1}").evaluate().operator).toBe("Divide"); // no inverse
});

test("(1 ± j_1)/2 are the two primitive idempotents", () => {
  sameLatex("\\left(\\frac{1+j_1}{2}\\right)^2", ["Divide", ["Add", 1, "j_1"], 2]);
  sameLatex("\\left(\\frac{1-j_1}{2}\\right)^2", ["Divide", ["Subtract", 1, "j_1"], 2]);
  sameLatex("\\frac{1+j_1}{2}\\cdot\\frac{1-j_1}{2}", 0); // orthogonal
  sameLatex("\\frac{1+j_1}{2}+\\frac{1-j_1}{2}", 1); // and they resolve the identity
});

test("mixing families: i_1 j_1 is a fourth root of unity times a split unit", () => {
  sameLatex("(i_1j_1)^2", -1); // i_1²·j_1² = (−1)(+1)
  sameLatex("i_1 j_1", ["Multiply", "i_1", "j_1"]);
});

// ── dual / nilpotent units ──────────────────────────────────────────────────────

test("ε_k² = 0 — dual numbers", () => {
  sameLatex("\\epsilon_1^2", 0);
  sameLatex("(1+\\epsilon_1)(1-\\epsilon_1)", 1);
  sameLatex("\\operatorname{Norm}(3+4\\epsilon_1)", 9); // a², the ε-part is invisible
  sameLatex("(2+\\epsilon_1)^{-1}", ["Subtract", ["Rational", 1, 2], ["Multiply", ["Rational", 1, 4], "epsilon_1"]]);
  sameLatex("\\epsilon_1\\epsilon_2", ["Multiply", "epsilon_1", "epsilon_2"]); // distinct: not 0
});

test("dual numbers differentiate: f(a + ε) = f(a) + f'(a)·ε", () => {
  // (2+ε)³ = 8 + 12ε, and d/dx x³ at 2 is 12.
  sameLatex("(2+\\epsilon_1)^3", ["Add", 8, ["Multiply", 12, "epsilon_1"]]);
});

// ── Clifford / anticommuting units ──────────────────────────────────────────────

test("e_k² = +1, and the ORDERED product anticommutes", () => {
  sameLatex("e_1^2", 1); // one generator: no order to lose
  same(["NonCommutativeMultiply", "e_1", "e_2"], ["Multiply", "e_1", "e_2"]);
  same(["NonCommutativeMultiply", "e_2", "e_1"], ["Negate", ["Multiply", "e_1", "e_2"]]);
  same(["NonCommutativeMultiply", "e_1", "e_2", "e_1", "e_2"], -1); // (e_1e_2)² = −1
});

test("f_k² = −1 and anticommute: ⟨f_1, f_2⟩ IS the quaternions", () => {
  // i = f_1, j = f_2, k = f_1f_2 — all three square to −1, and ij = k, ji = −k.
  sameLatex("f_1^2", -1);
  same(["NonCommutativeMultiply", ["Multiply", "f_1", "f_2"], ["Multiply", "f_1", "f_2"]], -1);
  same(["NonCommutativeMultiply", "f_1", "f_2"], ["Multiply", "f_1", "f_2"]);
  same(["NonCommutativeMultiply", "f_2", "f_1"], ["Negate", ["Multiply", "f_1", "f_2"]]);
  // ij·k = −1, the quaternion relation i²  = j² = k² = ijk = −1.
  same(["NonCommutativeMultiply", "f_1", "f_2", ["Multiply", "f_1", "f_2"]], -1);
});

test("θ_k are the Grassmann generators — anticommuting AND nilpotent", () => {
  // The answer to "is there a use for non-commutative nilpotents": these span the
  // exterior algebra, and are the fermionic generators of a superalgebra.
  sameLatex("\\theta_1^2", 0);
  same(["NonCommutativeMultiply", "theta_1", "theta_2"], ["Multiply", "theta_1", "theta_2"]);
  same(["NonCommutativeMultiply", "theta_2", "theta_1"], ["Negate", ["Multiply", "theta_1", "theta_2"]]);
  // A 2-blade of Grassmann generators is itself nilpotent — Λ is graded-nilpotent.
  same(["NonCommutativeMultiply", ["Multiply", "theta_1", "theta_2"], ["Multiply", "theta_1", "theta_2"]], 0);
  // Any repeated generator kills the blade, so Λ(ℝ²) stops at grade 2.
  same(["NonCommutativeMultiply", "theta_1", "theta_2", "theta_1"], 0);
  expect(generatorOf("thetaSymbol_1")).toEqual(generatorOf("theta_1")); // \vartheta alias
});

test("an imaginary Clifford generator is also reachable as i·e_k", () => {
  // (i·e_1)² = i²e_1² = (−1)(+1) = −1, and i commutes, so i·e_k anticommute in pairs
  // just as f_k do. Both routes exist; f_k is the direct one.
  same(["Multiply", ["Complex", 0, 1], ["Multiply", ["Complex", 0, 1], -1]], 1);
  same(["Power", ["Multiply", ["Complex", 0, 1], "e_1"], 2], -1);
});

test("the six families are the whole square × commutation grid", () => {
  const grid = FAMILIES.map((f) => `${f.square}/${f.anticommutes ? "anti" : "comm"}`);
  expect(new Set(grid).size).toBe(6);
  expect([...grid].sort()).toEqual(["-1/anti", "-1/comm", "0/anti", "0/comm", "1/anti", "1/comm"].sort());
});

test("⊗ is an infix alias for the ordered product", () => {
  // `**` is epsil's exponentiation and compute-engine's LaTeX parser rejects it; `\times`
  // and bare `×` are both already Multiply's trigger. `\otimes` was undefined, so it
  // carries the ordered product — and an ordered product is what ⊗ connotes anyway.
  expect(ce.parse("a \\otimes b").operator).toBe("CircleTimes");
  sameLatex("e_2 \\otimes e_1", ["Negate", ["Multiply", "e_1", "e_2"]]);
  sameLatex("e_1 \\otimes e_2", ["Multiply", "e_1", "e_2"]);
  sameLatex("f_1 \\otimes f_2 \\otimes f_1 \\otimes f_2", -1);
  sameLatex("i_1 \\otimes i_1", -1); // agrees with × on the commuting families
});

test("the ordered head follows Wolfram's naming, and keeps its operand order", () => {
  // Wolfram splits the non-commutative product onto its own head (`**`) rather than
  // overloading `Times`, and matrix multiplication onto `Dot` (`.`) for the same
  // reason — compute-engine's `Dot` is likewise declared commutative: false.
  expect(ce.box(["Dot", "b", "a"]).operatorDefinition?.commutative).toBe(false);
  expect(ce.box(["NonCommutativeMultiply", "e_2", "e_1"]).json).toEqual(["NonCommutativeMultiply", "e_2", "e_1"]);
  // GeometricProduct is an alias, so the two agree everywhere.
  for (const pair of [
    ["e_1", "e_2"],
    ["e_2", "e_1"],
    ["i_1", "i_2"],
  ] as const) {
    same(["NonCommutativeMultiply", ...pair], ["GeometricProduct", ...pair]);
  }
});

test("juxtaposition keeps the anticommutation sign", () => {
  // The reason this needs saying: `Multiply` is commutative by declaration, so by the
  // time any evaluate handler runs its operands have been sorted and the transposition
  // sign is gone. Juxtaposition is caught one step earlier, at `InvisibleOperator`.
  sameLatex("e_2e_1", ["Negate", ["Multiply", "e_1", "e_2"]]);
  sameLatex("e_1e_2", ["Multiply", "e_1", "e_2"]);
  sameLatex("e_1e_2e_1", ["Negate", "e_2"]); // = −e_1e_1e_2, and e_1² = +1
  sameLatex("f_1f_2f_1f_2", -1); // f_1f_2 is the quaternion k, and k² = −1
  sameLatex("e_1e_1", 1); // one generator: no order to lose
  sameLatex("(2+3e_1e_2)(1-e_1)", [
    "Add",
    2,
    ["Multiply", -2, "e_1"],
    ["Multiply", 3, "e_2"],
    ["Multiply", 3, "e_1", "e_2"],
  ]);
  sameLatex("\\mathrm{Expand}((2+3e_1e_2)(1-e_1))", [
    "Add",
    2,
    ["Multiply", -2, "e_1"],
    ["Multiply", 3, "e_2"],
    ["Multiply", 3, "e_1", "e_2"],
  ]);
});

test("a juxtaposition already in blade order stays on ×", () => {
  // The ordered head is only reached for a product whose sign the sort would take,
  // so the ordinary reading and the ordinary printed form survive everywhere else.
  expect(ce.parse("e_1e_2").operator).toBe("Multiply");
  expect(ce.parse("3e_1e_2").operator).toBe("Multiply");
  expect(ce.parse("e_2e_1").operator).toBe("NonCommutativeMultiply");
  expect(ce.parse("2x").operator).toBe("Multiply");
  expect(ce.parse("\\sin(e_1e_2)").operator).toBe("Sin"); // not a product at all
});

test("explicit × still REFUSES two distinct anticommuting units rather than guessing", () => {
  // `\times` and `\cdot` parse straight to `Multiply`, with no node in between to
  // intercept, so e_2 × e_1 is sorted to e_1 × e_2 before this package sees anything.
  // It stays symbolic rather than being answered with a sign we cannot justify —
  // `NonCommutativeMultiply` / ⊗ is the ordered product to write instead.
  expect(ce.parse("e_2 \\times e_1").evaluate().json).toEqual(["Multiply", "e_1", "e_2"]);
  expect(ce.box(["Multiply", "e_2", "e_1"]).evaluate().json).toEqual(["Multiply", "e_1", "e_2"]);
  expect(ce.box(["Norm", ["Multiply", "e_1", "e_2"]]).evaluate().operator).toBe("Norm");
});

test("a blade's spelling survives compute-engine's commutative sort", () => {
  // That sort is LEXICOGRAPHIC on the symbol, so e_10 precedes e_2 in it. A blade is
  // spelled as a `Multiply`, which puts it through the sort on the way out — order the
  // generators numerically instead and the blade reads back with the opposite sign.
  same(["NonCommutativeMultiply", "e_10", "e_2"], ["Multiply", "e_10", "e_2"]);
  same(["NonCommutativeMultiply", "e_2", "e_10"], ["Negate", ["Multiply", "e_10", "e_2"]]);
  same(["NonCommutativeMultiply", "e_2", "e_10", "e_2"], ["Negate", "e_10"]);
});

test("the ordered product agrees with × on the commuting families", () => {
  same(["NonCommutativeMultiply", "i_1", "i_2"], ["Multiply", "i_1", "i_2"]);
  same(["NonCommutativeMultiply", "i_1", "i_1"], -1);
  same(["NonCommutativeMultiply", ["Add", 1, "i_1"], ["Add", 1, "i_1"]], ["Multiply", 2, "i_1"]);
});

test("the blade product is associative across mixed families", () => {
  // Associativity is the load-bearing property of the commutation-factor construction
  // (ε(g,h) = (−1)^(anti(g)·anti(h)) is a bicharacter), so check it directly rather
  // than trusting the derivation.
  const units = ["i_1", "j_1", "epsilon_1", "e_1", "e_2", "f_1", "theta_1"] as const;
  for (const x of units) {
    for (const y of units) {
      for (const z of units) {
        const p = "NonCommutativeMultiply";
        const left = ce.box([p, [p, x, y], z]).evaluate();
        const right = ce.box([p, x, [p, y, z]]).evaluate();
        expect(left.json).toEqual(right.json);
      }
    }
  }
});

// ── things we decline to answer ─────────────────────────────────────────────────

test("a unit under an opaque head stays symbolic", () => {
  expect(ce.parse("\\sin(i_1)").evaluate().operator).toBe("Sin");
  expect(ce.box(["Power", "i_1", "n"]).evaluate().operator).toBe("Power");
});
