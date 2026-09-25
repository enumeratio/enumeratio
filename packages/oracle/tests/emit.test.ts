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
  // threadArg is a Python-family concern only: Wolfram's own heads are already Listable.
  expect(emit(["Sin", ["List", 1, 2]], "wolfram")).toEqual({
    ok: true,
    source: "Sin[List[1, 2]]",
  });
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
    source: "(len(4) if hasattr(4, '__len__') else 0)",
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

test("a String of a bare name emits as a string literal, not a free symbol", () => {
  expect(emit(["GroupBasis", ["String", "s0"]], "oscar")).toEqual({
    ok: true,
    source: 'EnumeratioBasis("s0")',
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
