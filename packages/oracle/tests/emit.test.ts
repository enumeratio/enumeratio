import { expect, test } from "vite-plus/test";
import { compare, compareCombination, linearCombination, normalise } from "../src/compare.ts";
import { emit, type MathJSON, unmappedHeads } from "../src/emit.ts";
import { fromWolfram } from "@enumeratio/wolfram";
import { MAPPINGS, mappingFor, mappingsFromBindings } from "../src/mappings.ts";
import { wolframBatchCode } from "../src/run.ts";
import { SYSTEMS, wiredSystems } from "../src/systems.ts";

test("combinatorica emits only through its head map, as Wolfram source", () => {
  expect(emit(["Eulerian", 4, 1], "combinatorica")).toEqual({ ok: true, source: "Eulerian[4, 1]" });
  // A head with no row there belongs to the wolfram lane, not a second answer from the same kernel.
  expect(emit(["Add", 1, 2], "combinatorica")).toEqual({ ok: false, missing: [] });
  // A free symbol goes through verbatim, as in the wolfram lane; one compute-engine reserves (`_a`, a defined name) does not.
  expect(emit(["Eulerian", "n", 1], "combinatorica")).toMatchObject({ ok: true, source: "Eulerian[n, 1]" });
  expect(emit(["Eulerian", "_a", 1], "combinatorica").ok).toBe(false);
});

test("a batch with a preamble runs it before anything else", () => {
  const preamble = 'Quiet[Needs["Combinatorica`"]]; ';
  expect(wolframBatchCode(["1"], 5, preamble).startsWith(preamble)).toBe(true);
});

test("a mapping is chosen by signature, not by name alone", () => {
  // The whole reason this table is arity-keyed: one argument is Riemann, two is Hurwitz,
  // and the systems disagree about which name carries which.
  expect(mappingFor("Zeta", 1, [], "wolfram")?.emit.wolfram).toBe("Zeta[$1]");
  expect(mappingFor("Zeta", 2, [], "wolfram")?.emit.wolfram).toBe("Zeta[$1, $2]");
  expect(mappingFor("Zeta", 2, [], "sage")?.emit.sage).toBe("hurwitz_zeta($1, $2)");
  // SymPy and mpmath overload one name across both arities.
  expect(mappingFor("Zeta", 1, [], "sympy")?.emit.sympy).toBe("zeta($1)");
  expect(mappingFor("Zeta", 2, [], "sympy")?.emit.sympy).toBe("zeta($1, $2)");
  // A row without an arity matches anything, and a specific row wins over it.
  expect(mappingFor("Add", 3, [], "sympy")?.emit.sympy).toBe("($*+)");
});

// Rust's `Max`/`Min` are arity-2 rows; the other systems' are variadic. One system's arity-specific
// row must not shadow another's general one.
test.each(["Max", "Min"])("%s: an arity-specific row for one system shadows nothing for the others", (head) => {
  for (const system of ["wolfram", "sympy", "sage", "julia"] as const)
    for (const arity of [1, 2, 3, 5]) {
      const mapping = mappingFor(head, arity, [], system);
      expect(mapping?.arity, `${system}/${arity}`).toBeUndefined();
      expect(mapping?.emit[system], `${system}/${arity}`).toContain("$*");
    }
  expect(mappingFor(head, 2, [], "rust")?.emit.rust).toMatch(/^(maximum|minimum)\(\$1, \$2\)$/);
  // Rust has no variadic row to fall back to.
  expect(mappingFor(head, 3, [], "rust")).toBeUndefined();
  for (const system of ["sympy", "sage", "julia"] as const) {
    expect(emit([head, 9, 2], system).ok, system).toBe(true);
    expect(emit([head, 9, 2, 4], system).ok, system).toBe(true);
  }
  expect(emit([head, 9, 2], "rust").ok).toBe(true);
});

test("emitting fills positional and variadic templates", () => {
  expect(emit(["Zeta", 2, 1], "sage")).toEqual({ ok: true, source: "hurwitz_zeta(2, 1)" });
  expect(emit(["Add", 1, 2, 3], "sympy")).toEqual({ ok: true, source: "(1 + 2 + 3)" });
  expect(emit(["Multiply", 2, 3], "sympy")).toEqual({ ok: true, source: "(2 * 3)" });
  // Lean reads `f -1` as `f - 1`.
  expect(emit(["Binomial", 5, -1], "mathlib4")).toEqual({
    ok: true,
    source: "(Nat.choose 5 (-1))",
  });
  expect(emit(["List", 1, 2], "sympy")).toEqual({ ok: true, source: "[1, 2]" });
  expect(emit(["Binomial", 10, 3], "wolfram")).toEqual({ ok: true, source: "Binomial[10, 3]" });
  // Constants are per-system.
  expect(emit(["Sin", "Pi"], "mpmath")).toEqual({ ok: true, source: "sin(pi)" });
});

// Found by the oracle Plausible: a Listable head (compute-engine threads it over a List
// natively, as Wolfram does) handed its raw list to SymPy's or mpmath's scalar function,
// which does not auto-thread — sympy's `primepi([10, 2])` raised `AttributeError: 'list'
// object has no attribute 'is_real'` instead of comparing elementwise.
test("threadArg rebuilds a List's nesting as Python list literals, applying the template at each leaf", () => {
  expect(emit(["PrimePi", ["List", 10, 2]], "sympy")).toEqual({
    ok: true,
    source: "[primepi(10), primepi(2)]",
  });
  // Nested (matrix-shaped) lists thread all the way down.
  expect(emit(["Sin", ["List", ["List", 1, 2], ["List", 3, 4]]], "sympy")).toEqual({
    ok: true,
    source: "[[sin(1), sin(2)], [sin(3), sin(4)]]",
  });
  // A fixed second operand carries through unchanged at every leaf.
  expect(emit(["Binomial", ["List", 2, -12, 6], -3], "sympy")).toEqual({
    ok: true,
    source: "[binomial(2, -3), binomial(-12, -3), binomial(6, -3)]",
  });
  // A plain (non-list) operand skips threading and emits as before.
  expect(emit(["PrimePi", 10], "sympy")).toEqual({ ok: true, source: "primepi(10)" });
  // The threaded operand need not be the first: GCD/LCM/Mod thread their second.
  expect(emit(["GCD", 12, ["List", 3, 2, 40]], "sympy")).toEqual({
    ok: true,
    source: "[gcd(12, 3), gcd(12, 2), gcd(12, 40)]",
  });
  expect(emit(["Mod", -10, ["List", 3, 4, 7]], "sympy")).toEqual({
    ok: true,
    source: "[(-10 % 3), (-10 % 4), (-10 % 7)]",
  });
  // threadArg is a Python-family (and Julia) concern: Wolfram's own heads are already Listable.
  expect(emit(["Sin", ["List", 1, 2]], "wolfram")).toEqual({
    ok: true,
    source: "Sin[List[1, 2]]",
  });
});

// Found by the julia rescan (#124): our emit templates for Julia/Nemo are plain calls
// (`binomial(ZZ($1), ZZ($2))`), not `f.($1)` broadcasts, so a raw Julia Vector hit the same
// "no method matching" wall a bare Python list does.
test("threadArg rebuilds a List's nesting as Julia list literals too", () => {
  expect(emit(["Binomial", ["List", 2, 3, 5, 7, 11], 3], "julia")).toEqual({
    ok: true,
    source:
      "Any[binomial(ZZ(2), ZZ(3)), binomial(ZZ(3), ZZ(3)), binomial(ZZ(5), ZZ(3)), binomial(ZZ(7), ZZ(3)), binomial(ZZ(11), ZZ(3))]",
  });
  expect(emit(["GCD", 12, ["List", 3, 7, 40]], "julia")).toEqual({
    ok: true,
    source: "Any[gcd(ZZ(12), ZZ(3)), gcd(ZZ(12), ZZ(7)), gcd(ZZ(12), ZZ(40))]",
  });
});

// Found scanning Sqrt((-1)^2) (#265): a negative base is emitted bare, and Python's `**`
// binds tighter than unary minus, so `-1**2` reads as `-(1**2)` — not the `(-1)**2` we meant.
test("a Power base is parenthesised, so a negative literal doesn't leak past unary minus", () => {
  expect(emit(["Power", -1, 2], "sympy")).toEqual({ ok: true, source: "(S(-1)**2)" });
  expect(emit(["Power", -1, 2], "mpmath")).toEqual({ ok: true, source: "((-1)**2)" });
  expect(emit(["Power", -1, 2], "sage")).toEqual({ ok: true, source: "((-1)^2)" });
  // A positive base picks up the same (harmless) parens, for one template regardless of sign.
  expect(emit(["Power", 2, 10], "mpmath")).toEqual({ ok: true, source: "((2)**10)" });
  // S() keeps a negative exponent exact in SymPy rather than a float.
  expect(emit(["Power", 2, -1], "sympy")).toEqual({ ok: true, source: "(S(2)**-1)" });
  // Julia passes the base as a call argument; Lean's negative-literal special case parenthesises it.
  expect(emit(["Power", -1, 2], "julia")).toEqual({ ok: true, source: "enumeratio_pow(-1, 2)" });
  expect(emit(["Power", -1, 2], "mathlib4")).toEqual({ ok: true, source: "((-1) ^ 2)" });
});

test("Max/Min flatten a (possibly nested) list argument, matching Wolfram — bare SymPy Max() raises on one", () => {
  expect(emit(["Min", ["List", 2, 1, 7, 2]], "sympy")).toEqual({
    ok: true,
    source: "enumeratio_min([2, 1, 7, 2])",
  });
  expect(emit(["Max", 2, 3, ["List", 1, 7]], "sympy")).toEqual({
    ok: true,
    source: "enumeratio_max(2, 3, [1, 7])",
  });
});

test("Length of an atom emits 0 (matching Wolfram), not len()'s TypeError", () => {
  expect(emit(["Length", 4], "sympy")).toEqual({
    ok: true,
    source: "(len(4) if hasattr(4, '__len__') else (len((4).args) if hasattr(4, 'args') else 0))",
  });
});

// Found scanning the newly-emitting free-symbol rows against real sympy (#A-72 phase 2):
// a sympy Add expression has no __len__ (unlike a Python list) but counts its own terms via
// `.args`, so `Length(a + b + c + d)` used to fall through to the atom case and wrongly emit
// 0 instead of 4.
test("Length of a compound sympy expression counts its .args, not just Python's __len__", () => {
  expect(emit(["Length", ["Add", "a", "b", "c", "d"]], "sympy")).toEqual({
    ok: true,
    source:
      '(len((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d"))) if hasattr((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d")), \'__len__\') else (len(((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d"))).args) if hasattr((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d")), \'args\') else 0))',
    freeSymbols: ["a", "b", "c", "d"],
  });
});

test("Length of a compound Sage expression counts its .operands(), Sage's own .args equivalent", () => {
  expect(emit(["Length", ["Add", "a", "b", "c", "d"]], "sage")).toEqual({
    ok: true,
    source: 'enumeratio_length((SR.var("a") + SR.var("b") + SR.var("c") + SR.var("d")))',
    freeSymbols: ["a", "b", "c", "d"],
  });
});

test("an unmappable expression names exactly what is missing", () => {
  // The failure has to be specific: "could not emit" is not a work queue.
  const result = emit(["RademacherSymbol", "'LRRRR'"], "sympy");
  expect(result.ok).toBe(false);
  expect(unmappedHeads(["RademacherSymbol", "'LRRRR'"], "sympy")).toEqual(["RademacherSymbol/1"]);
  // …including when the gap is nested inside something we do know.
  expect(unmappedHeads(["Add", 1, ["JonesPolynomial", 2]], "sympy")).toEqual(["JonesPolynomial/1"]);
  // A head mapped for one system may be unmapped for another; that is not a maths claim.
  expect(emit(["Mean", ["List", 1, 2]], "wolfram").ok).toBe(true);
  expect(emit(["Mean", ["List", 1, 2]], "sympy").ok).toBe(false);
});

test("SymPy keeps a residue class through Power and Divide, and reads an Interval's Abs with abs()", () => {
  const source = (expr: MathJSON): string | undefined => {
    const out = emit(expr, "sympy");
    return out.ok ? out.source : undefined;
  };
  expect(source(["Power", ["IntegerMod", 3, 7], -1])).toBe("(GF(7, symmetric=False)(3)**-1)");
  expect(source(["Divide", 1, 3])).toBe("(S(1) / 3)");
  expect(source(["Abs", ["Interval", -3, 2]])).toBe("abs(AccumBounds(-3, 2))");
  expect(source(["Abs", -3])).toBe("Abs(-3)");
  // factorrat takes rationals, so a Gaussian integer is unmapped, not an AttributeError.
  expect(source(["FactorInteger", ["Complex", 3, 4]])).toBeUndefined();
});

test("a bare Infinity is oo for SymPy and Sage, and Wolfram still reads it as its own", () => {
  expect(emit(["Erf", "Infinity"], "sympy")).toEqual({ ok: true, source: "erf(oo)" });
  expect(emit(["Erf", "Infinity"], "sage")).toEqual({ ok: true, source: "erf(oo)" });
  expect(emit(["Erf", "Infinity"], "wolfram").ok).toBe(true);
});

test("SymPy reads a float past the double range as a Float, not Python's inf", () => {
  expect(emit(["Exp", { num: "1.0e1000" }], "sympy")).toEqual({ ok: true, source: 'exp(Float("1.0e1000"))' });
  expect(emit(["Exp", { num: "1.5" }], "sympy")).toEqual({ ok: true, source: "exp(1.5)" });
});

test("mpmath reads a decimal past a double's digits or range from its text, and N(x, d) runs at d digits", () => {
  const long = "0.12345678901234567890123";
  expect(emit(["Exp", { num: long }], "mpmath")).toEqual({ ok: true, source: `exp(mpf("${long}"))` });
  expect(emit(["Exp", { num: "1.0e1000" }], "mpmath")).toEqual({ ok: true, source: 'exp(mpf("1.0e1000"))' });
  expect(emit(["Exp", { num: "1.5" }], "mpmath")).toEqual({ ok: true, source: "exp(1.5)" });
  expect(emit(["N", ["Exp", 1], 50], "mpmath")).toEqual({ ok: true, source: "enumeratio_n(lambda: (exp(1)), 50)" });
});

test("inside an mpmath N(x, d) past a double's digits every decimal is read from its text", () => {
  expect(emit(["N", ["Sin", 0.1], 50], "mpmath")).toEqual({
    ok: true,
    source: 'enumeratio_n(lambda: (sin(mpf("0.1"))), 50)',
  });
  expect(emit(["N", ["Sin", 0.1], 10], "mpmath")).toEqual({ ok: true, source: "enumeratio_n(lambda: (sin(0.1)), 10)" });
  expect(emit(["Sin", 0.1], "mpmath")).toEqual({ ok: true, source: "sin(0.1)" });
});

test("an mpmath comparison around a nested N(x, d) past a double's digits runs at that precision", () => {
  expect(emit(["LessEqual", "Pi", ["N", "Pi", 40]], "mpmath")).toEqual({
    ok: true,
    source: "enumeratio_at(lambda: ((pi <= enumeratio_nround(lambda: (pi), 40))), 40)",
  });
  expect(emit(["LessEqual", "Pi", ["N", "Pi", 15]], "mpmath")).toEqual({
    ok: true,
    source: "(pi <= enumeratio_nround(lambda: (pi), 15))",
  });
});

test("a nested N(x, d) keeps its digits for mpmath, SymPy and Rust; the answer's own N does not change", () => {
  const row = ["LessEqual", ["N", "Pi", 7], "Pi"] as const;
  expect(emit(row, "mpmath")).toEqual({ ok: true, source: "(enumeratio_nround(lambda: (pi), 7) <= pi)" });
  expect(emit(row, "sympy")).toEqual({ ok: true, source: "Le(N(pi, 7), pi)" });
  expect(emit(row, "rust")).toEqual({
    ok: true,
    source: "less_equal(nfd(x(std::f64::consts::PI), 7), x(std::f64::consts::PI))",
  });
  expect(emit(["N", "Pi", 7], "sympy")).toEqual({ ok: true, source: "N(pi, 30)" });
});

test("Julia reads a constant as a ball, a list as Any, and a decimal past a double from its text", () => {
  expect(emit(["Sin", ["Divide", "Pi", 6]], "julia")).toEqual({
    ok: true,
    source: "enumeratio_ball(sin, enumeratio_div(const_pi(RR), 6))",
  });
  // A mixed list keeps each element's type, where `[1, true]` would promote.
  expect(emit(["List", 1, "True"], "julia")).toEqual({ ok: true, source: "Any[1, true]" });
  // Every decimal is read exactly, as a rational: 0.1 is no double, and 1e-400 does not underflow.
  expect(emit(["Exp", { num: "1.0e1000" }], "julia")).toEqual({
    ok: true,
    source: 'enumeratio_ball(exp, enumeratio_decimal("1.0e1000"))',
  });
  expect(emit(["Exp", 0.1], "julia")).toEqual({ ok: true, source: 'enumeratio_ball(exp, enumeratio_decimal("0.1"))' });
  expect(emit(["Exp", { num: "1e-400" }], "julia")).toEqual({
    ok: true,
    source: 'enumeratio_ball(exp, enumeratio_decimal("1e-400"))',
  });
  // N(x, d) as the answer writes its digits out; below another call it is the rounded number.
  expect(emit(["N", "Pi", 5], "julia")).toEqual({ ok: true, source: "enumeratio_nshow(const_pi(RR), 5)" });
  expect(emit(["List", ["N", "Pi", 5], ["N", "ExponentialE", 5]], "julia")).toEqual({
    ok: true,
    source: "Any[enumeratio_nshow(const_pi(RR), 5), enumeratio_nshow(const_e(RR), 5)]",
  });
  expect(emit(["Equal", ["N", "Pi", 1], "Pi"], "julia")).toEqual({
    ok: true,
    source: "enumeratio_equal(enumeratio_n(const_pi(RR), 1), const_pi(RR))",
  });
  // An infinity is Julia's own, which the ball helpers decline rather than guess at.
  expect(emit(["Gamma", "PositiveInfinity"], "julia")).toEqual({ ok: true, source: "enumeratio_ball(gamma, Inf)" });
  // A threaded special function builds a list of ball calls.
  expect(emit(["Gamma", ["List", 1, 2]], "julia")).toEqual({
    ok: true,
    source: "Any[enumeratio_ball(gamma, 1), enumeratio_ball(gamma, 2)]",
  });
});

test("Rust threads a list into a `list(vec![…])` of calls, and writes a double as a float literal", () => {
  expect(emit(["Quotient", ["List", 10, 20], 7], "rust")).toEqual({
    ok: true,
    source: "list(vec![quotient(n(10), n(7)), quotient(n(20), n(7))])",
  });
  expect(emit(["Sinh", ["List", ["List", 1, 2], ["List", 3, 4]]], "rust")).toEqual({
    ok: true,
    source: "list(vec![list(vec![sinh(n(1)), sinh(n(2))]), list(vec![sinh(n(3)), sinh(n(4))])])",
  });
  // The crate's own argument order, and the reciprocal a template writes out.
  expect(emit(["BetaRegularized", { num: "0.25" }, 2, 3], "rust")).toEqual({
    ok: true,
    source: "beta_regularized(n(2), n(3), x(0.25))",
  });
  expect(emit(["Cot", 1], "rust")).toEqual({ ok: true, source: "(n(1) / tan(n(1)))" });
  // `x(100)` would be an integer where the adapters take a double.
  expect(emit(["Sinh", { num: "1e2" }], "rust")).toEqual({ ok: true, source: "sinh(x(100.0))" });
  // An integer-valued number past 2^53 is that integer, which a float literal would round.
  expect(emit(["PrimePi", 1e16], "rust")).toEqual({ ok: true, source: 'prime_pi(big("10000000000000000"))' });
  expect(emit(["Sinh", { num: "-2.5e-3" }], "rust")).toEqual({ ok: true, source: "sinh(x(-0.0025))" });
});

test("a decimal outside the double range is not written to Rust, where it would be infinity or zero", () => {
  expect(emit(["Sinh", { num: "1.0e1000" }], "rust")).toEqual({
    ok: false,
    missing: ["literal:outside-double-range"],
  });
  expect(emit(["Sinh", { num: "1e-400" }], "rust")).toEqual({
    ok: false,
    missing: ["literal:outside-double-range"],
  });
  // Zero is zero, however it is written.
  expect(emit(["Sinh", { num: "0.0" }], "rust")).toEqual({ ok: true, source: "sinh(x(0.0))" });
});

test("a binding's threadArgOnly threads for its own system alone", () => {
  expect(emit(["FactorInteger", ["List", 12, 18]], "sympy")).toEqual({
    ok: true,
    source: "[list(factorrat(S(12)).items()), list(factorrat(S(18)).items())]",
  });
  expect(emit(["FactorInteger", ["List", 12, 18]], "sage")).toEqual({
    ok: true,
    source: "enumeratio_factor_integer([12, 18])",
  });
});

test("a SymPy Sum takes its iterator as a tuple over a bound Symbol, from 1 when the start is left out", () => {
  const sum = (iterator: MathJSON): string | undefined => {
    const out = emit(["Sum", "k", iterator] as MathJSON, "sympy");
    return out.ok && out.freeSymbols === undefined ? out.source : undefined;
  };
  expect(sum(["Limits", "k", 0, 5])).toBe('summation(Symbol("k"), (Symbol("k"), 0, 5))');
  expect(sum(["Limits", "k", "Nothing", 10])).toBe('summation(Symbol("k"), (Symbol("k"), 1, 10))');
  expect(sum(["Tuple", "k", 10])).toBe('summation(Symbol("k"), (Symbol("k"), 1, 10))');
});

test("comparison is forgiving about spelling and strict about value", () => {
  expect(compare("3", "3")).toBe("agree");
  expect(compare("1.6449340668", "1.6449340668482264")).toBe("agree");
  expect(compare("3", "4")).toBe("disagree");
  expect(compare("[1, 2, 3]", "{1, 2, 3}")).toBe("agree"); // Wolfram braces
  expect(compare("2", "2.0")).toBe("agree");
  expect(compare("0.75", "3/4")).toBe("agree"); // SymPy, Lean
  expect(compare("0.75", "3//4")).toBe("agree"); // Julia
  // A row's own tolerance loosens only that comparison.
  expect(compare("1.0", "1.001")).toBe("disagree");
  expect(compare("1.0", "1.001", 1e-2)).toBe("agree");
  // A symbolic answer against a numeric one settles nothing either way.
  expect(compare("1.644934", "pi**2/6")).toBe("inconclusive");
  expect(compare("3", "")).toBe("inconclusive");
  expect(compare("3", "Indeterminate")).toBe("inconclusive");
  // Ours is NaN or Indeterminate too (both emit as Wolfram's literal `Indeterminate`) --
  // same claim, so this is agreement, not a shrug.
  expect(compare("Indeterminate", "Indeterminate")).toBe("agree");
  expect(normalise(" {1, 2} ")).toBe("[1,2]");
});

test("every system is declared, and the unwired ones are honest about it", () => {
  expect(SYSTEMS.map((system) => system.name)).toEqual([
    "wolfram",
    "combinatorica",
    "sympy",
    "mpmath",
    "sage",
    "oscar",
    "julia",
    "mathlib4",
    "rust",
  ]);
  expect(wiredSystems()).toEqual([
    "wolfram",
    "combinatorica",
    "sympy",
    "mpmath",
    "sage",
    "oscar",
    "julia",
    "mathlib4",
    "rust",
  ]);
  // Naming an unwired system is the point: a scan then reports "unmapped" for it rather
  // than silently never asking.
  for (const system of SYSTEMS) expect(system.strength.length).toBeGreaterThan(20);
});

test("no mapping template references an operand it cannot have", () => {
  for (const mapping of MAPPINGS) {
    for (const [system, template] of Object.entries(mapping.emit)) {
      const highest = [...template.matchAll(/\$(\d)/g)]
        .map((match) => Number(match[1]))
        .reduce((a, b) => Math.max(a, b), 0);
      if (mapping.arity !== undefined) {
        expect(highest, `${mapping.head} → ${system}`).toBeLessThanOrEqual(mapping.arity);
      } else {
        // A variadic row must use the variadic form, not a positional one.
        expect(highest, `${mapping.head} → ${system}`).toBe(0);
        expect(template, `${mapping.head} → ${system}`).toContain("$*");
      }
    }
  }
});

// A free bare symbol (`x` in `Cos(Arcsin(x))`) used to be unconditionally `missing` — fine for
// a numeric lane, which has no way to evaluate a name, but wrong for a symbolic system, which
// can carry one through like any other value (#A-72).
test("a free bare symbol emits verbatim on a symbolic system, and stays missing on a numeric one", () => {
  expect(emit(["Add", "x", 1], "wolfram")).toEqual({ ok: true, source: "Plus[x, 1]", freeSymbols: ["x"] });
  expect(emit(["Add", "x", 1], "sympy")).toEqual({
    ok: true,
    source: '(Symbol("x") + 1)',
    freeSymbols: ["x"],
  });
  expect(emit(["Add", "x", 1], "sage")).toEqual({
    ok: true,
    source: '(SR.var("x") + 1)',
    freeSymbols: ["x"],
  });
  // mpmath, Oscar, Julia, Mathlib and Rust are numeric-only: a name is still missing there.
  expect(emit(["Add", "x", 1], "mpmath")).toEqual({ ok: false, missing: ["symbol:x"] });
  expect(emit(["Add", "x", 1], "julia")).toEqual({ ok: false, missing: ["symbol:x"] });
  expect(emit(["Add", "x", 1], "mathlib4")).toEqual({ ok: false, missing: ["symbol:x"] });
  // Two distinct free symbols, sorted and de-duplicated.
  expect(emit(["Add", "y", "x", "x"], "sympy")).toEqual({
    ok: true,
    source: '(Symbol("y") + Symbol("x") + Symbol("x"))',
    freeSymbols: ["x", "y"],
  });
});

test("a free name that Wolfram reserves goes in our own context, not Wolfram's", () => {
  expect(emit(["Add", "E", 1], "wolfram")).toEqual({ ok: true, source: "Plus[enumeratio`E, 1]", freeSymbols: ["E"] });
  expect(emit(["K", "x"], "wolfram")).toEqual({ ok: true, source: "enumeratio`K[x]", freeSymbols: ["K", "x"] });
  expect(fromWolfram("Plus[enumeratio`E, 1]")).toEqual(["Add", "E", 1]);
});

test("a name that means Wolfram's own goes bare; a free variable that shares a name stays ours", () => {
  // Infinities, attributes, option keys, format symbols, and the Wolfram side of a mapped pair.
  expect(emit(["Erf", "Infinity"], "wolfram")).toEqual({ ok: true, source: "Erf[Infinity]" });
  expect(emit(["SetAttributes", "HarmonicMean", "Orderless"], "wolfram")).toMatchObject({
    source: "SetAttributes[HarmonicMean, Orderless]",
  });
  expect(emit(["FormBox", "'x'", "TeXForm"], "wolfram")).toMatchObject({ source: 'FormBox["x", TeXForm]' });
  expect(emit(["TagBox", "'x'", "Superscript"], "wolfram")).toMatchObject({ source: 'TagBox["x", Superscript]' });
  expect(emit(["ButtonBox", "'d'", ["Tuple", "ButtonData", "'S'"]], "wolfram")).toMatchObject({
    source: expect.stringContaining("ButtonData"),
  });
  expect(emit(["SortBy", ["List", "a"], "Total"], "wolfram")).toMatchObject({ source: "SortBy[List[a], Total]" });
  expect(emit(["Gamma", ["DirectedInfinity", "ImaginaryUnit"]], "wolfram")).toMatchObject({
    source: "Gamma[DirectedInfinity[I]]",
  });
  // `E` and `K` are variables here, and Wolfram's own constants there.
  expect(emit(["Add", "E", "K"], "wolfram")).toMatchObject({
    source: "Plus[enumeratio`E, enumeratio`K]",
    freeSymbols: ["E", "K"],
  });
});

test("an option key and a number set go to Wolfram as its own names", () => {
  expect(emit(["Graph", ["List", 1, 2], ["KeyValuePair", "EdgeWeight", ["List", 5]]], "wolfram")).toMatchObject({
    ok: true,
    source: expect.stringContaining("Rule[EdgeWeight, List[5]]"),
  });
  expect(emit(["FindInstance", ["Equal", "x", 4], "x", "Reals"], "wolfram")).toEqual({
    ok: true,
    source: "FindInstance[(x == 4), x, Reals]",
    freeSymbols: ["x"],
  });
  // Ours alone: `Over` is translated where Wolfram has the ring as an option, held back where it doesn't.
  expect(emit(["IsPrime", 5, ["KeyValuePair", "Over", "GaussianIntegers"]], "wolfram")).toMatchObject({
    source: "PrimeQ[5, Rule[GaussianIntegers, True]]",
  });
  expect(emit(["IsPrime", 5, ["KeyValuePair", "Over", "Foo"]], "wolfram")).toMatchObject({
    source: expect.stringContaining("Rule[enumeratio`Over, Foo]"),
  });
  // Working over the integers mod p is Wolfram's `Modulus -> p`.
  expect(emit(["IsPrime", 5, ["KeyValuePair", "Over", ["QuotientRing", "Integers", 7]]], "wolfram")).toMatchObject({
    source: "PrimeQ[5, Rule[Modulus, 7]]",
  });
  // The option as canonical form writes it, a `Tuple`, is the same option.
  expect(emit(["IsPrime", 5, ["Tuple", "Over", ["QuotientRing", "Integers", 7]]], "wolfram")).toMatchObject({
    source: "PrimeQ[5, Rule[Modulus, 7]]",
  });
});

// Found scanning the newly-emitting free-symbol rows against real kernels (#A-72 phase 2):
// `_a` (our prefix-underscore named-wildcard convention, `Replace`'s patterns) is bare and
// unmapped, so it used to fall into the same "free variable" bucket `x` does — but Wolfram's
// pattern syntax is a SUFFIX underscore (`a_`); `_a` there parses as `Blank[a]`, a different
// pattern. Passing it through as if it were an ordinary symbol silently asks Wolfram the
// wrong question instead of leaving the case honestly unmapped.
test("a prefix-underscore pattern variable (_a) stays missing, not a free symbol", () => {
  expect(emit(["Add", "_a", 1], "wolfram")).toEqual({ ok: false, missing: ["symbol:_a"] });
  expect(emit(["Add", "_a", 1], "sympy")).toEqual({ ok: false, missing: ["symbol:_a"] });
  // The numeric Function-slot form (_1, _2) is unaffected — that's a real, mappable value.
  expect(emit(["Add", "_1", 1], "wolfram")).toEqual({ ok: true, source: "Plus[Slot[1], 1]" });
});

// Found scanning the newly-emitting free-symbol rows against real kernels (#A-72 phase 2):
// Module/With's binding list uses our own `Equal` head (`n == 10`), but Wolfram's Module/With
// need an ASSIGNMENT there (`Set[n, 10]`) or the vars list isn't a valid local-variable spec
// and the whole call stays unevaluated. Confirmed against wolframscript directly.
test("Module/With rewrite an Equal binding to Set, so Wolfram actually localizes it", () => {
  expect(emit(["Module", ["List", ["Equal", "n", 10]], ["Add", "n", 1]], "wolfram")).toEqual({
    ok: true,
    source: "Module[List[Set[n, 10]], Plus[n, 1]]",
    freeSymbols: ["n"],
  });
  expect(emit(["With", ["List", ["Equal", "x", 3], ["Equal", "y", 5]], ["Add", "x", "y"]], "wolfram")).toEqual({
    ok: true,
    source: "With[List[Set[x, 3], Set[y, 5]], Plus[x, y]]",
    // Module/With don't bind these the way Sum/Product's iterator does (emit.ts has no
    // notion of a Module-local), so the names it assigns are reported free too — harmless
    // for the emitted source (they're being assigned, not read), just imprecise metadata.
    freeSymbols: ["x", "y"],
  });
  // A single (non-List) binding, and a binding that isn't `Equal`, pass through unchanged.
  expect(emit(["Module", ["Equal", "n", 10], "n"], "wolfram")).toEqual({
    ok: true,
    source: "Module[Set[n, 10], n]",
    freeSymbols: ["n"],
  });
});

// Found while replacing the lowercase/Capitalized heuristic with a real compute-engine lookup
// (defined-names-data.ts, #A-72): DSolveValue's unknown solution `Y` is Capitalized AND used
// as a CALL HEAD (`Y(x)`), not just a bare operand — the same "undefined name" question, one
// level up. `DEFINED_NAMES` doesn't have `Y` (compute-engine has no definition for it, unlike
// `Primes`), so an unmapped call with that head is now emitted as an unevaluated Wolfram
// function application instead of reported missing.
test("an undefined head used as a call emits as an unevaluated Wolfram function, not `missing`", () => {
  expect(emit(["Y", "x"], "wolfram")).toEqual({ ok: true, source: "Y[x]", freeSymbols: ["Y", "x"] });
  // A domain name (compute-engine-defined) used as a call head is a different question this
  // doesn't answer for — still missing, same as before.
  expect(emit(["Primes", "x"], "wolfram").ok).toBe(false);
});

test("a String of a bare name emits as a string literal, not a free symbol", () => {
  expect(emit(["GroupBasis", ["String", "s0"]], "oscar")).toEqual({
    ok: true,
    source: 'EnumeratioBasis("s0")',
  });
});

// #404 (CutWord): a carrier constructor with no system mapping used to stop emit() cold —
// `missing: ["Permutation/1"]` — silently shrinking oracle coverage for every typed family.
// We decide what counts as equivalent, and the external system's own encoding IS our carrier
// value's contents, with no head wrapper needed.
test("a carrier constructor with no mapping unwraps to its contents, for every system", () => {
  expect(emit(["Permutation", ["List", 2, 1, 3]], "wolfram")).toEqual({ ok: true, source: "List[2, 1, 3]" });
  expect(emit(["Permutation", ["List", 2, 1, 3]], "sympy")).toEqual({ ok: true, source: "[2, 1, 3]" });
  expect(emit(["Permutation", ["List", 2, 1, 3]], "sage")).toEqual({ ok: true, source: "[2, 1, 3]" });
  // Nested: a carrier built from another carrier's value unwraps all the way down.
  expect(emit(["SetPartition", ["Permutation", ["List", 1, 2]]], "sympy")).toEqual({
    ok: true,
    source: "[1, 2]",
  });
  // Not a carrier constructor call (no such head) — still reports missing, as before.
  expect(emit(["NotACarrier", 1], "sympy")).toEqual({ ok: false, missing: ["NotACarrier/1"] });
});

// CycleDecomposition/Permutation, when one wraps the other, is a format conversion (cycle
// notation <-> one-line notation) -- not the plain "carrier's raw contents" unwrap above. The
// naive unwrap would flatten straight past both heads to the bare inner list, losing the
// conversion Wolfram's PermutationCycles/PermutationList need to draw.
test("CycleDecomposition(Permutation(...)) and its reverse emit Wolfram's own conversion, not a bare unwrap", () => {
  expect(emit(["CycleDecomposition", ["Permutation", ["List", 2, 3, 1, 4]]], "wolfram")).toEqual({
    ok: true,
    source: "PermutationCycles[List[2, 3, 1, 4]]",
  });
  expect(emit(["Permutation", ["CycleDecomposition", ["List", ["List", 1, 3], ["List", 2]]]], "wolfram")).toEqual({
    ok: true,
    source: "PermutationList[Cycles[List[List[1, 3], List[2]]]]",
  });
});

// A-126 head survey, #495: `Sign` is overloaded over `complex | permutation` — the SAME
// "outer SPECIAL case never sees the raw carrier" problem as CycleDecomposition/Permutation
// above, from a third mechanism (the generic CARRIER_NAMES unwrap would strip `Permutation`
// down to its bare list before `Sign`'s own dispatch could tell "this call means Wolfram's
// Signature" from "this call means Wolfram's own numeric Sign" apart).
test("Sign(Permutation(...)) emits Wolfram's Signature, not a wrong-meaning bare Sign", () => {
  expect(emit(["Sign", ["Permutation", ["List", 2, 3, 1]]], "wolfram")).toEqual({
    ok: true,
    source: "Signature[List[2, 3, 1]]",
  });
  // The composed cycle-notation form converts the same way CycleDecomposition/Permutation do.
  expect(emit(["Sign", ["Permutation", ["CycleDecomposition", ["List", ["List", 1, 2, 3]]]]], "wolfram")).toEqual({
    ok: true,
    source: "Signature[Cycles[List[List[1, 2, 3]]]]",
  });
  // A numeric argument is Wolfram's own Sign, untouched.
  expect(emit(["Sign", -5], "wolfram")).toEqual({ ok: true, source: "Sign[-5]" });
});

// #A-121: the SAME "outer SPECIAL case never sees the true inner structure" problem
// CycleDecomposition/Permutation above hits from the carrier unwrap, but from TWO other
// generic mechanisms -- `emit()`'s own per-operand `walk()` pre-walk (Count/Random) and
// Equal's own per-system MAPPINGS_DATA template (Thread), both of which run before
// `toWolfram`'s `SPECIAL` case for the OUTER head ever sees the inner call's raw shape. A
// fix that only worked through `toWolfram()` directly (the `to-wolfram.test.ts` unit tests)
// missed all three the first time around -- these go through the actual oracle path.
test("Count/Random/Thread SPECIAL cases work through emit()'s pre-walked path, not just toWolfram() directly", () => {
  // Count(list, Function(...)): the predicate arrives at Count's SPECIAL case as an
  // ALREADY-RENDERED "Function[...]" string (walk() stringifies the Function operand before
  // Count's own case runs), which needs the same head-name parse `headArgs` gives a raw tree.
  expect(emit(["Count", ["List", 1, 2, 3, 4], ["Function", ["Greater", "_1", 2]]], "wolfram")).toEqual({
    ok: true,
    source: "Count[List[1, 2, 3, 4], PatternTest[Blank[], Function[Greater[Slot[1], 2]]]]",
  });
  // Count(collection): Wolfram's Count always needs a pattern, so the 1-arg form needs
  // Length instead -- a free symbol here (no Wolfram TwinPrimes) still comes back missing,
  // but AS Length, not Count.
  expect(emit(["Count", "TwinPrimes"], "wolfram")).toEqual({ ok: false, missing: ["symbol:TwinPrimes"] });
  expect(emit(["Count", ["List", 1, 2, 3]], "wolfram")).toEqual({ ok: true, source: "Length[List[1, 2, 3]]" });
  // Random(collection, n): the domain arrives pre-walked as a string too.
  expect(emit(["Random", ["IntegerPartitions", 10], 3], "wolfram")).toEqual({
    ok: true,
    source: "RandomChoice[IntegerPartitions[10], 3]",
  });
  expect(emit(["Random", ["Range", 10, 20]], "wolfram")).toEqual({
    ok: true,
    source: "RandomChoice[Range[10, 20]]",
  });
  // Thread(Equal(l1, l2)): Equal has its OWN per-system mapping template (`"($1 == $2)"`,
  // infix) that runs before Thread's SPECIAL case would otherwise see `Equal[...]`'s shape.
  expect(emit(["Thread", ["Equal", ["List", 1, 2, 3], ["List", 1, 5, 3]]], "wolfram")).toEqual({
    ok: true,
    source: "Thread[Unevaluated[Equal[List[1, 2, 3], List[1, 5, 3]]]]",
  });
});

// A-92: Tournament/LabeledGraph pack a `carrierParams` prefix (n) onto the element (edges) as a
// Tuple -- `Tournament(n, edges)`. No system has a bare `Tuple/2` mapping (nor should it: the
// arity depends on which family packed it), so this unwraps ONE level further than a plain
// single-arg carrier, straight to the edge list every system already understands.
test("a two-argument graph carrier (carrierParams) unwraps to the edge list, not the packed Tuple", () => {
  const edges = ["List", ["List", 1, 2], ["List", 2, 1]];
  expect(emit(["Tournament", ["Tuple", 3, edges]], "wolfram")).toEqual({
    ok: true,
    source: "List[List[1, 2], List[2, 1]]",
  });
  expect(emit(["Tournament", ["Tuple", 3, edges]], "sympy")).toEqual({ ok: true, source: "[[1, 2], [2, 1]]" });
  expect(emit(["LabeledGraph", ["Tuple", 4, edges]], "sage")).toEqual({ ok: true, source: "[[1, 2], [2, 1]]" });
});

// A composite carrier (`carrierElements`, StandardTableauPair) packs the same shape -- a
// multi-arg Tuple -- but every slot is itself a sub-carrier call, not a param then the
// element. It must NOT collapse to the last slot the way `carrierParams` does above, or `P`
// would silently disappear from the comparison.
test("a composite carrier (carrierElements) unwraps to both slots, not just the last", () => {
  const p = ["List", ["List", 1, 3], ["List", 2]];
  const q = ["List", ["List", 1, 2], ["List", 3]];
  const pair = ["StandardTableauPair", ["Tuple", ["StandardTableau", p], ["StandardTableau", q]]];
  expect(emit(pair, "wolfram")).toEqual({
    ok: true,
    source: "List[List[List[1, 3], List[2]], List[List[1, 2], List[3]]]",
  });
});

test("an algebra element compares as a combination, whatever order its terms are in", () => {
  const ours = ["Add", ["GroupBasis", "'1'"], ["Multiply", 2, ["GroupBasis", `'"s0"'`]]];
  expect(linearCombination(ours)).toEqual(
    new Map([
      ["GroupBasis(1)", 1],
      ["GroupBasis(s0)", 2],
    ]),
  );
  expect(compareCombination(ours, 'combination:{"GroupBasis(s0)":2,"GroupBasis(1)":1}')).toBe("agree");
  expect(compareCombination(ours, 'combination:{"GroupBasis(1)":1}')).toBe("disagree");
  expect(compareCombination("x", 'combination:{"GroupBasis(1)":1}')).toBe("inconclusive");
});

test("compute-engine's canonical Function and iterator forms emit as Wolfram writes them", () => {
  const wolfram = (expr: unknown) => emit(expr as never, "wolfram");
  expect(wolfram(["Map", ["Function", ["Block", ["Power", "_1", 2]], "_1"], ["List", 1, 2]])).toMatchObject({
    ok: true,
    source: "Map[Function[Power[Slot[1], 2]], List[1, 2]]",
  });
  expect(
    wolfram(["Integrate", ["Function", ["Block", ["Sin", "x"]], "x"], ["Limits", "x", "Nothing", "Nothing"]]),
  ).toMatchObject({
    ok: true,
    source: "Integrate[Sin[x], x]",
  });
  expect(wolfram(["Integrate", ["Function", ["Block", ["Sin", "x"]], "x"], ["Limits", "x", 0, 1]])).toMatchObject({
    ok: true,
    source: "Integrate[Sin[x], List[x, 0, 1]]",
  });
  expect(wolfram(["Sum", ["Power", "k", 2], ["Limits", "k", "Nothing", 7]])).toMatchObject({
    ok: true,
    source: "Sum[Power[k, 2], List[k, 7]]",
  });
});

test("SymPy's series order is one past ours, and Normal and the simplifiers go round a series", () => {
  const sympy = (expr: unknown) => {
    const out = emit(expr as never, "sympy");
    return out.ok ? out.source : undefined;
  };
  const series = ["Series", ["Sin", "x"], "x", 0, 5];
  expect(sympy(series)).toBe('series(sin(Symbol("x")), Symbol("x"), 0, 5 + 1)');
  expect(sympy(["Normal", series])).toBe('(series(sin(Symbol("x")), Symbol("x"), 0, 5 + 1)).removeO()');
  expect(sympy(["FullSimplify", ["Normal", series]])).toBe(
    'simplify((series(sin(Symbol("x")), Symbol("x"), 0, 5 + 1)).removeO())',
  );
  // Around anything else a simplifier is SymPy's one `simplify`, threaded over a list, and Normal hands it back.
  expect(sympy(["Normal", ["Sin", "x"]])).toBe('sin(Symbol("x"))');
  expect(sympy(["Simplify", ["Sin", "x"]])).toBe('simplify(sin(Symbol("x")))');
  expect(sympy(["FullSimplify", ["Sin", "x"]])).toBe('simplify(sin(Symbol("x")))');
  // Assumptions are not mapped.
  expect(sympy(["Simplify", ["Sin", "x"], ["Greater", "x", 0]])).toBeUndefined();
});

test("SymPy reads a derivative ours holds at a point as differentiating in each argument, then substituting", () => {
  const source = (expr: unknown): string | undefined => {
    const out = emit(expr as never, "sympy");
    return out.ok ? out.source : undefined;
  };
  expect(source(["Apply", ["Derivative", "ChebyshevT", 0, 5], 5, 0])).toBe(
    '(diff(chebyshevt(5, Symbol("_d1", real=True)), (Symbol("_d1", real=True), 5))).subs({Symbol("_d1", real=True): 0})',
  );
  // Orders and points pair off, one to an argument.
  expect(source(["Apply", ["Derivative", "ChebyshevT", 5], 5, 0])).toBeUndefined();
  // The variable is real only at a real point: sqrt(t**2) differentiates to 1 at I, not to sign(I).
  expect(source(["Apply", ["Derivative", "Sin", 1], ["Complex", 0, 1]])).toBe(
    '(diff(sin(Symbol("_d1")), (Symbol("_d1"), 1))).subs({Symbol("_d1"): (0 + 1*I)})',
  );
  expect(source(["Apply", ["Derivative", "Sin", 1], "x"])).toContain('Symbol("_d1")');
  expect(source(["Apply", ["Derivative", "Sin", 1], "x"])).not.toContain("real=True");
  // A derivative inside a point is its own, under names of its own (the outer point is no plain number).
  expect(source(["Apply", ["Derivative", "Sin", 1], ["Apply", ["Derivative", "Cos", 1], 2]])).toBe(
    '(diff(sin(Symbol("_d1")), (Symbol("_d1"), 1))).subs({Symbol("_d1"): ' +
      '(diff(cos(Symbol("_d2", real=True)), (Symbol("_d2", real=True), 1))).subs({Symbol("_d2", real=True): 2})})',
  );
});

test("SymPy's integrate takes a bare variable or a tuple, its first iterator the innermost", () => {
  const sympy = (expr: unknown) => {
    const out = emit(expr as never, "sympy");
    return out.ok ? out.source : undefined;
  };
  expect(sympy(["Integrate", ["Sin", "x"], "x"])).toBe('integrate(sin(Symbol("x")), Symbol("x"))');
  const body = ["Function", ["Block", ["Sin", "x"]], "x"];
  expect(sympy(["Integrate", body, ["Limits", "x", "Nothing", "Nothing"]])).toBe(
    'integrate(sin(Symbol("x")), Symbol("x"))',
  );
  expect(sympy(["Integrate", body, ["Limits", "x", 0, "Pi"]])).toBe(
    'integrate(sin(Symbol("x")), (Symbol("x"), 0, pi))',
  );
  // Ours integrates the first limit last, as Wolfram's.
  expect(sympy(["Integrate", ["Multiply", "x", "y"], ["Limits", "x", 0, 1], ["Limits", "y", 0, "x"]])).toBe(
    'integrate((Symbol("x") * Symbol("y")), (Symbol("y"), 0, Symbol("x")), (Symbol("x"), 0, 1))',
  );
  // Any number of iterators, reversed; a call with none has no variable to take.
  const triple = ["Multiply", "x", "y", "z"];
  expect(sympy(["Integrate", triple, ["Limits", "x", 0, 1], ["Limits", "y", 0, 1], ["Limits", "z", 0, "y"]])).toBe(
    'integrate((Symbol("x") * Symbol("y") * Symbol("z")), (Symbol("z"), 0, Symbol("y")), (Symbol("y"), 0, 1), (Symbol("x"), 0, 1))',
  );
  expect(sympy(["Integrate", ["Function", ["Block", triple], "x", "y", "z"], "x", "y", "z"])).toBe(
    'integrate((Symbol("x") * Symbol("y") * Symbol("z")), Symbol("z"), Symbol("y"), Symbol("x"))',
  );
  expect(sympy(["Integrate", "x"])).toBeUndefined();
});

test("SymPy's Boole is a Piecewise over its condition, chains and connectives kept whole", () => {
  const sympy = (expr: unknown) => {
    const out = emit(expr as never, "sympy");
    return out.ok ? out.source : undefined;
  };
  expect(sympy(["Boole", ["Less", 1, "x"]])).toBe('Piecewise((1, Lt(1, Symbol("x"))), (0, True))');
  // A chain is the conjunction of its neighbors.
  expect(sympy(["Boole", ["LessEqual", 1, "x", 2]])).toBe(
    'Piecewise((1, And(Le(1, Symbol("x")), Le(Symbol("x"), 2))), (0, True))',
  );
  expect(sympy(["Boole", ["Not", ["Or", ["Greater", "x", 1], ["GreaterEqual", "x", "y"], ["Less", "y", 0]]]])).toBe(
    'Piecewise((1, Not(Or(Gt(Symbol("x"), 1), Ge(Symbol("x"), Symbol("y")), Lt(Symbol("y"), 0)))), (0, True))',
  );
});

test("a library's heads emit through its own mappings, called by namespace", () => {
  const fig = mappingsFromBindings([
    {
      name: "fig.Polygonal",
      bindings: [
        { origin: "mapped", form: "wolfram", arity: 1, template: "PolygonalNumber[$1]" },
        { origin: "mapped", form: "wolfram", arity: 2, template: "PolygonalNumber[$2, $1]" },
      ],
    },
  ]);
  const call = (...args: unknown[]) => ["MemberCall", "fig", "'Polygonal'", ...args] as never;
  expect(emit(call(4, 5), "wolfram", fig)).toEqual({ ok: true, source: "PolygonalNumber[5, 4]" });
  expect(emit(["Add", call(4), 1] as never, "wolfram", fig)).toMatchObject({
    ok: true,
    source: expect.stringContaining("PolygonalNumber[4]"),
  });
  // Another head of the same library, with no mapping: unmapped, not a call the system answers as written.
  expect(emit(["MemberCall", "fig", "'Star'", 4] as never, "wolfram", fig)).toEqual({
    ok: false,
    missing: ["fig.Star/1"],
  });
});

test("BigO emits to Wolfram with the exponent outside O, and the center in it", () => {
  expect(emit(["BigO", ["Power", "x", 8]], "wolfram")).toMatchObject({ ok: true, source: "Power[O[x], 8]" });
  expect(emit(["BigO", "x"], "wolfram")).toMatchObject({ ok: true, source: "O[x]" });
  // `O[x - a]` is rejected (SeriesData::sdatv): the center is O's second argument.
  expect(emit(["Add", 1, ["BigO", ["Power", ["Add", "x", -1], 3]]], "wolfram")).toMatchObject({
    ok: true,
    source: "Plus[1, Power[O[x, Minus[-1]], 3]]",
  });
  expect(emit(["BigO", ["Power", ["Add", "x", "Pi"], 3]], "wolfram")).toMatchObject({
    ok: true,
    source: "Power[O[x, Minus[Pi]], 3]",
  });
  // The canonical forms of x^(1/2) and x^(1/3).
  expect(emit(["BigO", ["Sqrt", "x"]], "wolfram")).toMatchObject({
    ok: true,
    source: "Power[O[x], Rational[1, 2]]",
  });
  expect(emit(["BigO", ["Root", "x", 3]], "wolfram")).toMatchObject({
    ok: true,
    source: "Power[O[x], Rational[1, 3]]",
  });
  // At infinity, BigO(x^-n) is O[x, Infinity]^n.
  expect(emit(["BigO", ["Power", "x", -7]], "wolfram")).toMatchObject({
    ok: true,
    source: "Power[O[x, Infinity], 7]",
  });
});

// Sage takes its sums, integrals, series, graphs and statistics through its own calls, with the variables symbols.
test("Sage: sums and integrals over symbols, a series with its Order term, graphs, and named statistics", () => {
  expect(emit(["Sum", ["Power", "k", 2], ["Limits", "k", 1, 10]], "sage")).toMatchObject({
    source: 'sum(((SR.var("k"))^2), SR.var("k"), 1, 10)',
    freeSymbols: ["k"],
  });
  // The first limit is the outermost integral.
  expect(
    emit(["Integrate", ["Multiply", "x", "y"], ["Limits", "x", 0, 1], ["Limits", "y", 0, 2]], "sage"),
  ).toMatchObject({
    source: 'integrate(integrate((SR.var("x") * SR.var("y")), SR.var("y"), 0, 2), SR.var("x"), 0, 1)',
  });
  expect(emit(["Series", ["Sin", "x"], "x", 0, 5], "sage")).toMatchObject({
    source: 'SR(sin(SR.var("x"))).series(SR.var("x") == 0, 5 + 1)',
  });
  expect(emit(["Graph", ["List", 1, 2, 3], ["List", ["DirectedEdge", 1, 2]]], "sage")).toEqual({
    ok: true,
    source: 'DiGraph([[1, 2, 3], [(1, 2)]], format="vertices_and_edges", loops=True, multiedges=True)',
  });
  expect(emit(["CombinatorialStat", ["Permutation", ["List", 3, 1, 2]], "'Descents'"], "sage")).toEqual({
    ok: true,
    source: 'enumeratio_stat("Permutation", [3, 1, 2], "Descents")',
  });
  // A statistic Sage has no method for stays unmapped.
  expect(emit(["CombinatorialStat", ["Permutation", ["List", 3, 1, 2]], "'NoSuchStat'"], "sage").ok).toBe(false);
});

// Sage differentiates Abs as on the line, so a held derivative is real only at real points, and none is answered off them.
test("Sage: a held derivative's variable is real at real points, and a non-holomorphic one is unmapped at a complex point", () => {
  const at = (point: MathJSON): MathJSON => ["Apply", ["Derivative", "Abs", 1], point];
  expect(emit(at(2), "sage")).toEqual({
    ok: true,
    source:
      '(diff(enumeratio_abs(SR.var("_d1", domain="real")), SR.var("_d1", domain="real"), 1)).subs({SR.var("_d1", domain="real"): 2})',
  });
  expect(emit(at(["Complex", 2, 1]), "sage")).toMatchObject({ ok: false });
  // A holomorphic function is differentiated the same at any point.
  expect(emit(["Apply", ["Derivative", "Sin", 1], ["Complex", 2, 1]], "sage").ok).toBe(true);
});

// Sage's graph families are numbered from 1 in its own sorted order, which ours is not for these three.
test("Sage: a query that reads vertex numbers is unmapped over a graph Sage numbers otherwise, a numbering-free one is not", () => {
  const turan: MathJSON = ["TuranGraph", 5, 3];
  expect(emit(["VertexDegree", turan, 1], "sage")).toMatchObject({ ok: false, missing: ["VertexDegree/numbering"] });
  expect(emit(["GraphDistance", ["GridGraph", ["List", 2, 3]], 1, 6], "sage").ok).toBe(false);
  expect(emit(["EdgeCount", turan], "sage").ok).toBe(true);
  expect(emit(["VertexDegree", ["CycleGraph", 5], 1], "sage").ok).toBe(true);
});

// GammaLn is the principal log of Gamma; LogGamma is the continuous one. They differ by 2πi
// multiples off the positive axis, so the lanes' loggamma belongs to LogGamma alone.
test("GammaLn compares against log(gamma(z)), LogGamma against the continuation", () => {
  const source = (head: string, system: Parameters<typeof emit>[1]) => {
    const out = emit([head, 2.5], system);
    return out.ok ? out.source : undefined;
  };
  expect(source("GammaLn", "wolfram")).toBe("Log[Gamma[2.5]]");
  expect(source("LogGamma", "wolfram")).toBe("LogGamma[2.5]");
  expect(source("GammaLn", "mpmath")).toMatch(/^log\(gamma\(/);
  expect(source("LogGamma", "mpmath")).toMatch(/^loggamma\(/);
  expect(source("GammaLn", "sympy")).toMatch(/^log\(gamma\(/);
  expect(source("LogGamma", "sympy")).toMatch(/^loggamma\(/);
  expect(source("GammaLn", "sage")).toMatch(/^log\(gamma\(/);
  expect(source("GammaLn", "julia")).toContain("log(gamma(z))");
  expect(source("LogGamma", "julia")).toContain("lgamma");
});

test("SymPy's MatrixFunction takes f as an expression of a dummy variable, and Simplify goes round it", () => {
  const sympy = (expr: unknown) => {
    const out = emit(expr as never, "sympy");
    return out.ok ? out.source : undefined;
  };
  const m = ["List", ["List", 4, 0], ["List", 0, 9]];
  const call =
    'Matrix([[4, 0], [0, 9]]).analytic_func(sqrt(Symbol("_mf")), Symbol("_mf")).applyfunc(simplify).tolist()';
  expect(sympy(["MatrixFunction", "Sqrt", m])).toBe(call);
  expect(sympy(["MatrixFunction", ["Function", ["Block", ["Sqrt", "_1"]], "_1"], m])).toBe(call);
  expect(sympy(["Simplify", ["MatrixFunction", "Sqrt", m]])).toBe(call);
  // An undefined name is an unknown function of the variable.
  expect(sympy(["MatrixFunction", "f", m])).toContain('Function("f")(Symbol("_mf"))');
});

test("SymPy's Inverse is the permutation inverse, and nothing else", () => {
  const sympy = (expr: unknown) => {
    const out = emit(expr as never, "sympy");
    return out.ok ? out.source : undefined;
  };
  expect(sympy(["Inverse", ["Permutation", ["List", 2, 3, 1]]])).toContain(
    "Permutation([_j - 1 for _j in [2, 3, 1]]) ** -1",
  );
  expect(sympy(["Inverse", ["List", ["List", 1, 1], ["List", 1, 2]]])).toBeUndefined();
});

test("a SymPy Product takes its iterator as a tuple, as Sum does", () => {
  const out = emit(["Product", "k", ["Limits", "k", 1, 5]] as MathJSON, "sympy");
  expect(out.ok && out.source).toContain('product(Symbol("k"), (Symbol("k"), 1, 5))');
});
