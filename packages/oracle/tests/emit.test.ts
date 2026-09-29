import { expect, test } from "vite-plus/test";
import { compare, compareCombination, linearCombination, normalise } from "../src/compare.ts";
import { emit, unmappedHeads } from "../src/emit.ts";
import { MAPPINGS, mappingFor } from "../src/mappings.ts";
import { SYSTEMS, wiredSystems } from "../src/systems.ts";

test("a mapping is chosen by signature, not by name alone", () => {
  // The whole reason this table is arity-keyed: one argument is Riemann, two is Hurwitz,
  // and the systems disagree about which name carries which.
  expect(mappingFor("Zeta", 1)?.emit.wolfram).toBe("Zeta[$1]");
  expect(mappingFor("Zeta", 2)?.emit.wolfram).toBe("Zeta[$1, $2]");
  expect(mappingFor("Zeta", 2)?.emit.sage).toBe("hurwitz_zeta($1, $2)");
  // SymPy and mpmath overload one name across both arities.
  expect(mappingFor("Zeta", 1)?.emit.sympy).toBe("zeta($1)");
  expect(mappingFor("Zeta", 2)?.emit.sympy).toBe("zeta($1, $2)");
  // A row without an arity matches anything, and a specific row wins over it.
  expect(mappingFor("Add", 3)?.emit.sympy).toBe("($*+)");
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
      "[binomial(ZZ(2), ZZ(3)), binomial(ZZ(3), ZZ(3)), binomial(ZZ(5), ZZ(3)), binomial(ZZ(7), ZZ(3)), binomial(ZZ(11), ZZ(3))]",
  });
  expect(emit(["GCD", 12, ["List", 3, 7, 40]], "julia")).toEqual({
    ok: true,
    source: "[gcd(ZZ(12), ZZ(3)), gcd(ZZ(12), ZZ(7)), gcd(ZZ(12), ZZ(40))]",
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
  // Julia/Oscar and Lean were never affected: `big($1)` and the negative-literal special
  // case already parenthesise the base.
  expect(emit(["Power", -1, 2], "julia")).toEqual({ ok: true, source: "(big(-1)^2)" });
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
    source: "(len(4) if hasattr(4, '__len__') else (len(4.args) if hasattr(4, 'args') else 0))",
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
      '(len((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d"))) if hasattr((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d")), \'__len__\') else (len((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d")).args) if hasattr((Symbol("a") + Symbol("b") + Symbol("c") + Symbol("d")), \'args\') else 0))',
    freeSymbols: ["a", "b", "c", "d"],
  });
});

test("Length of a compound Sage expression counts its .operands(), Sage's own .args equivalent", () => {
  expect(emit(["Length", ["Add", "a", "b", "c", "d"]], "sage")).toEqual({
    ok: true,
    source:
      '(len((SR.var("a") + SR.var("b") + SR.var("c") + SR.var("d"))) if hasattr((SR.var("a") + SR.var("b") + SR.var("c") + SR.var("d")), \'__len__\') else (len((SR.var("a") + SR.var("b") + SR.var("c") + SR.var("d")).operands()) if hasattr((SR.var("a") + SR.var("b") + SR.var("c") + SR.var("d")), \'operands\') else 0))',
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
  expect(emit(["PowerModList", 2, 3, 7], "wolfram").ok).toBe(true);
  expect(emit(["PowerModList", 2, 3, 7], "sympy").ok).toBe(false);
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
  expect(normalise(" {1, 2} ")).toBe("[1,2]");
});

test("every system is declared, and the unwired ones are honest about it", () => {
  expect(SYSTEMS.map((system) => system.name)).toEqual([
    "wolfram",
    "sympy",
    "mpmath",
    "sage",
    "oscar",
    "julia",
    "mathlib4",
    "rust",
  ]);
  expect(wiredSystems()).toEqual(["wolfram", "sympy", "mpmath", "sage", "oscar", "julia", "mathlib4", "rust"]);
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
