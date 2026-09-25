import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

const S = (text: string) => ["String", text];
const L = (...items: unknown[]) => ["List", ...items];

// ─── DiagonalMatrix ──────────────────────────────────────────────────────────────────────

test("DiagonalMatrix(list) puts list on the main diagonal", () => {
  expect(run(["DiagonalMatrix", L(1, 2, 3)])).toEqual(L(L(1, 0, 0), L(0, 2, 0), L(0, 0, 3)));
});

// Offset shapes: k > 0 grows the matrix by k rows/cols ABOVE the list, k < 0 below — the
// result is always Length(list) + |k| square (Wolfram's own convention, not a plain n×n
// matrix with the list shifted inside it).
test("DiagonalMatrix(list, k) with k > 0 is (n+k) square, list on the super-diagonal", () => {
  expect(run(["DiagonalMatrix", L(1, 2), 1])).toEqual(L(L(0, 1, 0), L(0, 0, 2), L(0, 0, 0)));
});
test("DiagonalMatrix(list, k) with k < 0 is (n+|k|) square, list on the sub-diagonal", () => {
  expect(run(["DiagonalMatrix", L(1, 2), -1])).toEqual(L(L(0, 0, 0), L(1, 0, 0), L(0, 2, 0)));
});
test("DiagonalMatrix(list, 0) is the same as the 1-argument form", () => {
  expect(run(["DiagonalMatrix", L(5, 6), 0])).toEqual(run(["DiagonalMatrix", L(5, 6)]));
});

// ─── HilbertMatrix ───────────────────────────────────────────────────────────────────────

test("HilbertMatrix(n) entry (i, j) is the exact rational 1/(i+j-1)", () => {
  expect(run(["HilbertMatrix", 3])).toEqual(
    L(
      L(1, ["Rational", 1, 2], ["Rational", 1, 3]),
      L(["Rational", 1, 2], ["Rational", 1, 3], ["Rational", 1, 4]),
      L(["Rational", 1, 3], ["Rational", 1, 4], ["Rational", 1, 5]),
    ),
  );
});
test("HilbertMatrix(n) is symmetric", () => {
  const rows = (run(["HilbertMatrix", 4]) as unknown as unknown[]).slice(1) as unknown[][];
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < rows.length; j++) {
      expect(rows[i]!.slice(1)[j]).toEqual(rows[j]!.slice(1)[i]);
    }
  }
});
// Known closed form (Cauchy determinant): det H(3) = 1/2160 — an independent check that
// doesn't route through HilbertMatrix's own construction logic to verify itself.
test("Determinant(HilbertMatrix(3)) is the textbook 1/2160", () => {
  expect(run(["Determinant", ["HilbertMatrix", 3]])).toEqual(["Rational", 1, 2160]);
});
test("HilbertMatrix(m, n) is rectangular when m ≠ n", () => {
  const rows = (run(["HilbertMatrix", 2, 3]) as unknown as unknown[]).slice(1) as unknown[][];
  expect(rows.length).toBe(2);
  expect((rows[0] as unknown[]).length).toBe(4); // "List" head + 3 entries
});

// ─── Extract ─────────────────────────────────────────────────────────────────────────────

const grid = L(L("a", "b"), L("c", "d"));

test("Extract(expr, {i, j}) drills into nested operands, like Part", () => {
  expect(run(["Extract", grid, L(2, 1)])).toEqual(run(["At", grid, 2, 1]));
  expect(run(["Extract", grid, L(2, 1)])).toEqual("c");
});
test("Extract with a negative position counts from the end", () => {
  expect(run(["Extract", L("a", "b", "c"), -1])).toEqual("c");
});
test("Extract(expr, {{path1}, {path2}}) extracts several parts as a list", () => {
  expect(run(["Extract", grid, L(L(1, 1), L(2, 2))])).toEqual(L("a", "d"));
});
test("Extract(expr, {}) is expr itself — the trivial (zero-step) path", () => {
  expect(run(["Extract", L(1, 2, 3), L()])).toEqual(L(1, 2, 3));
});

// ─── DeleteCases ─────────────────────────────────────────────────────────────────────────
//
// Cross-checked against each element's own MatchQ result, filtered in plain JS — independent
// of DeleteCases's own filter loop (CE's native Select/Function plumbing has its own,
// unrelated quirks that make it a poor vehicle for this check).
const matchQComplement = (list: unknown[], pattern: unknown) =>
  run(["List", ...list.slice(1).filter((item) => run(["MatchQ", item, pattern]) === "False")]);

test("DeleteCases(list, patt) removes every top-level element matching patt", () => {
  const list = L(1, 2, 3, 2, 4);
  expect(run(["DeleteCases", list, 2])).toEqual(L(1, 3, 4));
});
test("DeleteCases agrees with the elements MatchQ(#, patt) calls False", () => {
  const list = L(1, 2, 3, 2, 4) as unknown[];
  expect(run(["DeleteCases", list, 2])).toEqual(matchQComplement(list, 2));
});
test("DeleteCases with a wildcard pattern removes everything", () => {
  expect(run(["DeleteCases", L("x", "y", "z"), "_a"])).toEqual(L());
});
// String literals: DeleteCases is built directly on the same `.match` MatchQ/FreeQ use
// (#241), which does not consider two EQUAL string literals a match (kernel-checked
// divergence: `MatchQ(["String","x"], ["String","x"])` is already `False` on this engine,
// independent of anything DeleteCases adds) — so a string-literal pattern here inherits
// that same no-op, documented on the reference entry rather than patched around here.
test("DeleteCases inherits MatchQ's string-literal quirk (documented, not patched here)", () => {
  const list = L(1, S("x"), 2);
  expect(run(["DeleteCases", list, S("x")])).toEqual(run(list));
  expect(run(["MatchQ", S("x"), S("x")])).toEqual("False");
});

// ─── Key ─────────────────────────────────────────────────────────────────────────────────

test("At(assoc, Key(k)) looks up the value for k", () => {
  const assoc = ["Association", ["Rule", "a", 1], ["Rule", "b", 2]];
  expect(run(["At", assoc, ["Key", "b"]])).toEqual(2);
});
test("At(assoc, Key(k)) is Missing when k isn't a key", () => {
  const assoc = ["Association", ["Rule", "a", 1]];
  expect(run(["At", assoc, ["Key", "z"]])).toEqual("Missing");
});

// ─── CharacterRange ──────────────────────────────────────────────────────────────────────

test("CharacterRange(a, e) lists the letters in order", () => {
  expect(run(["CharacterRange", S("a"), S("e")])).toEqual(L(...["a", "b", "c", "d", "e"].map((c) => `'${c}'`)));
});
test("CharacterRange(n1, n2) works by code point", () => {
  expect(run(["CharacterRange", 97, 101])).toEqual(run(["CharacterRange", S("a"), S("e")]));
});
// Round-trip against FromCharacterCode over the same code-point range — an independent
// construction of the same answer.
test("CharacterRange round-trips through ToCharacterCode/FromCharacterCode", () => {
  const chars = run(["CharacterRange", S("a"), S("e")]) as unknown as unknown[];
  const joined = chars
    .slice(1)
    .map((c) => (c as string).slice(1, -1))
    .join("");
  expect(run(["FromCharacterCode", ["List", 97, 98, 99, 100, 101]])).toEqual(`'${joined}'`);
});

// ─── NumberQ ─────────────────────────────────────────────────────────────────────────────

test("NumberQ is True for an explicit numeric literal", () => {
  expect(run(["NumberQ", 2])).toEqual("True");
  expect(run(["NumberQ", 2.5])).toEqual("True");
  expect(run(["NumberQ", ["Rational", 1, 2]])).toEqual("True");
  expect(run(["NumberQ", ["Complex", 1, 2]])).toEqual("True");
});
// Unlike compute-engine's own `isNumber`, a symbolic constant is NOT NumberQ — the whole
// reason this head exists rather than reusing isNumber directly.
test("NumberQ is False for a symbolic constant like Pi", () => {
  expect(run(["NumberQ", "Pi"])).toEqual("False");
});
test("NumberQ is False for a plain symbol", () => {
  expect(run(["NumberQ", "x"])).toEqual("False");
});

// ─── ReIm ────────────────────────────────────────────────────────────────────────────────

test("ReIm(z) is {Re(z), Im(z)}", () => {
  const z = ["Complex", 3, 4];
  expect(run(["ReIm", z])).toEqual(L(run(["Re", z]), run(["Im", z])));
  expect(run(["ReIm", z])).toEqual(L(3, 4));
});
test("ReIm threads over a list — one {Re, Im} pair per element", () => {
  expect(run(["ReIm", L(["Complex", 1, 2], ["Complex", 3, 4])])).toEqual(L(L(1, 2), L(3, 4)));
});

// ─── RandomComplex ───────────────────────────────────────────────────────────────────────

test("RandomComplex() lands in the unit square", () => {
  const z = run(["RandomComplex"]) as [string, number, number];
  expect(z[1]).toBeGreaterThanOrEqual(0);
  expect(z[1]).toBeLessThanOrEqual(1);
  expect(z[2]).toBeGreaterThanOrEqual(0);
  expect(z[2]).toBeLessThanOrEqual(1);
});
test("RandomComplex(zmax) lands in the rectangle from 0 to zmax", () => {
  const z = run(["RandomComplex", ["Complex", 2, 3]]) as [string, number, number];
  expect(z[1]).toBeGreaterThanOrEqual(0);
  expect(z[1]).toBeLessThanOrEqual(2);
  expect(z[2]).toBeGreaterThanOrEqual(0);
  expect(z[2]).toBeLessThanOrEqual(3);
});
test("RandomComplex({zmin, zmax}) lands in that rectangle", () => {
  const z = run(["RandomComplex", L(["Complex", -1, -1], ["Complex", 1, 1])]) as [string, number, number];
  expect(z[1]).toBeGreaterThanOrEqual(-1);
  expect(z[1]).toBeLessThanOrEqual(1);
  expect(z[2]).toBeGreaterThanOrEqual(-1);
  expect(z[2]).toBeLessThanOrEqual(1);
});

// ─── KaryTree ────────────────────────────────────────────────────────────────────────────
//
// Independent reference: n - 1 edges (a tree), and vertex i's parent is floor((i-2)/k) + 1
// — built from scratch here rather than by calling karyTree's own formula back at itself.
function refKaryTreeEdges(n: number, k: number): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 2; i <= n; i++) edges.push([Math.floor((i - 2) / k) + 1, i]);
  return edges;
}

test("KaryTree(n, k) has n - 1 edges and matches the heap-layout parent formula", () => {
  const g = run(["KaryTree", 10, 3]) as [string, unknown, [string, ...[string, number, number][]]];
  const edgeList = g[2].slice(1) as [string, number, number][];
  expect(edgeList.length).toBe(9);
  const got = edgeList.map(([, a, b]) => [a, b] as [number, number]);
  expect(got).toEqual(refKaryTreeEdges(10, 3));
});
test("KaryTree(n) defaults to k = 2 (binary)", () => {
  expect(run(["KaryTree", 7])).toEqual(run(["KaryTree", 7, 2]));
});

// ─── not implemented / out of scope, documented on the module ──────────────────────────
test("WeightedAdjacencyMatrix and BooleanConvert are intentionally not declared", () => {
  expect(ce.lookupDefinition("WeightedAdjacencyMatrix")).toBeUndefined();
  expect(ce.lookupDefinition("BooleanConvert")).toBeUndefined();
});
