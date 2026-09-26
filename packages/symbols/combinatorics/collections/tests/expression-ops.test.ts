import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// ToString: prints Epsil (this repo's own syntax), not Wolfram InputForm.
test("ToString prints a list as Epsil source", () => {
  expect(run(["ToString", ["List", 1, 2, 3]])).toEqual("'[1, 2, 3]'");
});
test("ToString prints an arithmetic expression", () => {
  expect(run(["ToString", ["Add", "x", 1]])).toEqual("'x + 1'");
});

// MapThread(f, {{a, b}, {c, d}}) = {f(a, c), f(b, d)} — corresponding elements, not rows.
test("MapThread applies f across corresponding elements", () => {
  expect(run(["MapThread", "f", ["List", ["List", "a", "b"], ["List", "c", "d"]]])).toEqual([
    "List",
    ["f", "a", "c"],
    ["f", "b", "d"],
  ]);
});
// Cross-check against Add computed on each corresponding pair independently — MapThread
// itself zips the rows in JS (`rows.map(row => row[i])`), so this exercises that zip against
// an answer built without going through it at all.
test("MapThread(Add, rows) agrees with Add computed pairwise", () => {
  const rows = ["List", ["List", 1, 2, 3], ["List", 10, 20, 30]];
  const viaMapThread = run(["MapThread", "Add", rows]);
  const expected = ["List", run(["Add", 1, 10]), run(["Add", 2, 20]), run(["Add", 3, 30])];
  expect(viaMapThread).toEqual(expected);
  expect(viaMapThread).toEqual(["List", 11, 22, 33]);
});
test("MapThread rejects ragged rows", () => {
  expect(run(["MapThread", "f", ["List", ["List", 1, 2], ["List", 3]]])).toEqual([
    "MapThread",
    "f",
    ["List", ["List", 1, 2], ["List", 3]],
  ]);
});

// MapIndexed(f, {a, b}) = {f(a, {1}), f(b, {2})} — the index is a one-element list.
test("MapIndexed pairs each element with its 1-based index, as a list", () => {
  expect(run(["MapIndexed", "f", ["List", "a", "b", "c"]])).toEqual([
    "List",
    ["f", "a", ["List", 1]],
    ["f", "b", ["List", 2]],
    ["f", "c", ["List", 3]],
  ]);
});

// MatchQ: compute-engine's own wildcard grammar (_ / __ / ___).
test("MatchQ(x + 1, _a + _b) is True", () => {
  expect(run(["MatchQ", ["Add", "x", 1], ["Add", "_a", "_b"]])).toEqual("True");
});
test("MatchQ(x * y, _a + _b) is False", () => {
  expect(run(["MatchQ", ["Multiply", "x", "y"], ["Add", "_a", "_b"]])).toEqual("False");
});
test("MatchQ({1, 2, 3}, List(_a, __rest)) is True for a non-empty list", () => {
  expect(run(["MatchQ", ["List", 1, 2, 3], ["List", "_a", "__rest"]])).toEqual("True");
});

// FreeQ: True unless the pattern matches expr itself or some subexpression, at any depth.
test("FreeQ(x^2 + 1, x) is False — x occurs", () => {
  expect(run(["FreeQ", ["Add", ["Power", "x", 2], 1], "x"])).toEqual("False");
});
test("FreeQ(x^2 + 1, y) is True — y never occurs", () => {
  expect(run(["FreeQ", ["Add", ["Power", "x", 2], 1], "y"])).toEqual("True");
});
test("FreeQ looks inside subexpressions, not just the top level", () => {
  expect(run(["FreeQ", ["List", ["List", "a", "b"]], "b"])).toEqual("False");
});

// Replace: top-level only, unlike ReplaceAll (which recurses into subexpressions).
test("Replace rewrites the whole expression when it matches at the top level", () => {
  expect(run(["Replace", ["Add", "x", 1], ["Rule", ["Add", "_a", 1], ["Multiply", "_a", 100]]])).toEqual(
    run(["Multiply", "x", 100]),
  );
});
test("Replace leaves expr untouched when only a subexpression matches", () => {
  expect(run(["Replace", ["List", ["Add", "x", 1]], ["Rule", ["Add", "_a", 1], ["Multiply", "_a", 100]]])).toEqual([
    "List",
    ["Add", "x", 1],
  ]);
});
test("Replace differs from ReplaceAll exactly on that subexpression case", () => {
  const target = ["List", ["Add", "x", 1], "x"];
  const rule = ["Rule", "x", 99];
  const viaReplace = run(["Replace", target, rule]);
  const viaReplaceAll = run(["ReplaceAll", target, rule]);
  // Replace: the top level is a List, not `x`, so nothing matches — expr comes back unchanged.
  expect(viaReplace).toEqual(run(target));
  // ReplaceAll: recurses, so every `x` (inside the Add and standalone) is replaced.
  expect(viaReplaceAll).toEqual(["List", 100, 99]);
  expect(viaReplace).not.toEqual(viaReplaceAll);
});
test("Replace tries a list of rules in order", () => {
  expect(run(["Replace", "b", ["List", ["Rule", "a", 1], ["Rule", "b", 2]]])).toEqual(2);
});

// Through(head(f, g)(x)) = head(f(x), g(x)) for head = List or Add.
test("Through distributes a list of functions over the shared argument", () => {
  expect(run(["Through", [["List", "f", "g"], "x"]])).toEqual(["List", ["f", "x"], ["g", "x"]]);
});
test("Through distributes an Add of functions, and evaluates the sum", () => {
  expect(run(["Through", [["Add", "f", "g"], "x"]])).toEqual(run(["Add", ["f", "x"], ["g", "x"]]));
});

// ToCharacterCode / FromCharacterCode: Unicode code points, round-tripping through non-ASCII.
test("ToCharacterCode reads ASCII code points", () => {
  expect(run(["ToCharacterCode", ["String", "ABC"]])).toEqual(["List", 65, 66, 67]);
});
test("FromCharacterCode inverts ToCharacterCode", () => {
  expect(run(["FromCharacterCode", ["ToCharacterCode", ["String", "hello"]]])).toEqual("'hello'");
});
test("FromCharacterCode(n) gives a single character", () => {
  expect(run(["FromCharacterCode", 65])).toEqual("'A'");
});
test("ToCharacterCode/FromCharacterCode round-trip a non-ASCII string (emoji, astral)", () => {
  const text = "a😀b→c";
  expect(run(["FromCharacterCode", ["ToCharacterCode", ["String", text]]])).toEqual(`'${text}'`);
});

// StringLength / StringTake: code-point counting, like ToCharacterCode and Characters.
test("StringLength counts code points, not UTF-16 units", () => {
  expect(run(["StringLength", ["String", "a😀b"]])).toEqual(3);
});
test("StringTake(s, n) takes the first n characters", () => {
  expect(run(["StringTake", ["String", "hello world"], 5])).toEqual("'hello'");
});
test("StringTake(s, -n) takes the last n characters", () => {
  expect(run(["StringTake", ["String", "hello world"], -5])).toEqual("'world'");
});
test("StringTake(s, {n}) takes the nth character alone", () => {
  expect(run(["StringTake", ["String", "hello"], ["List", 2]])).toEqual("'e'");
});
test("StringTake(s, {m, n}) takes an inclusive range", () => {
  expect(run(["StringTake", ["String", "hello world"], ["List", 1, 5]])).toEqual("'hello'");
});
test("StringTake(s, {m, -n}) counts the end from a negative index", () => {
  expect(run(["StringTake", ["String", "hello world"], ["List", 1, -7]])).toEqual("'hello'");
});

// Level: level 0 is the whole expression; positive n is levels 1..n; {n} is level n alone.
test("Level(expr, 1) gives the top-level operands", () => {
  expect(run(["Level", ["List", 1, ["List", 2, 3], 4], 1])).toEqual(["List", 1, ["List", 2, 3], 4]);
});
test("Level(expr, {0}) is just expr itself", () => {
  expect(run(["Level", ["List", 1, ["List", 2, 3]], ["List", 0]])).toEqual(["List", ["List", 1, ["List", 2, 3]]]);
});
test("Level(expr, 2) gives levels 1 and 2 together, post-order", () => {
  // Wolfram's own order: a node's children come before the node itself, so {2, 3} prints
  // AFTER its own parts 2 and 3 — not before them.
  expect(run(["Level", ["List", 1, ["List", 2, 3], 4], 2])).toEqual(["List", 1, 2, 3, ["List", 2, 3], 4]);
});
test("Level(expr, {-1}) gives every leaf", () => {
  expect(run(["Level", ["List", 1, ["List", 2, 3], 4], ["List", -1]])).toEqual(["List", 1, 2, 3, 4]);
});
test("Level(expr, Infinity) reaches every level, post-order", () => {
  expect(run(["Level", ["List", 1, ["List", 2, ["List", 3]]], "PositiveInfinity"])).toEqual([
    "List",
    1,
    2,
    3,
    ["List", 3],
    ["List", 2, ["List", 3]],
  ]);
});

// Pick(list, sel, patt?): elements of list whose corresponding sel matches patt (default True).
test("Pick keeps elements where sel is True", () => {
  expect(run(["Pick", ["List", "a", "b", "c"], ["List", "True", "False", "True"]])).toEqual(["List", "a", "c"]);
});
test("Pick with an explicit pattern keeps elements matching it", () => {
  expect(run(["Pick", ["List", "a", "b", "c", "d"], ["List", 1, 0, 1, 0], 1])).toEqual(["List", "a", "c"]);
});

// ReplacePart(expr, i -> new): 1-based, negative counts from the end.
test("ReplacePart replaces a single 1-based position", () => {
  expect(run(["ReplacePart", ["List", "a", "b", "c"], ["Rule", 2, "z"]])).toEqual(["List", "a", "z", "c"]);
});
test("ReplacePart with a negative position counts from the end", () => {
  expect(run(["ReplacePart", ["List", "a", "b", "c"], ["Rule", -1, "z"]])).toEqual(["List", "a", "b", "z"]);
});
test("ReplacePart applies a list of rules", () => {
  expect(run(["ReplacePart", ["List", "a", "b", "c"], ["List", ["Rule", 1, "x"], ["Rule", 3, "y"]]])).toEqual([
    "List",
    "x",
    "b",
    "y",
  ]);
});
test("ReplacePart with a nested {i, j} position drills into a sublist", () => {
  expect(run(["ReplacePart", ["List", ["List", "a", "b"], "c"], ["Rule", ["List", 1, 2], "z"]])).toEqual([
    "List",
    ["List", "a", "z"],
    "c",
  ]);
});

// AssociationThread(keys, values) / AssociationThread(keys -> values) build our Association.
test("AssociationThread pairs keys with values, two-argument form", () => {
  expect(run(["AssociationThread", ["List", "a", "b"], ["List", 1, 2]])).toEqual(
    run(["Association", ["Rule", "a", 1], ["Rule", "b", 2]]),
  );
});
test("AssociationThread accepts the one-argument Rule(keys, values) form", () => {
  expect(run(["AssociationThread", ["Rule", ["List", "a", "b"], ["List", 1, 2]]])).toEqual(
    run(["Association", ["Rule", "a", 1], ["Rule", "b", 2]]),
  );
});
test("Length on an AssociationThread result agrees with Association", () => {
  expect(run(["Length", ["AssociationThread", ["List", "a", "b", "c"], ["List", 1, 2, 3]]])).toEqual(3);
});
