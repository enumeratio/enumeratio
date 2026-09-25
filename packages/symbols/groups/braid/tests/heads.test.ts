import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareBraid } from "../src/declare.ts";

const ce = new ComputeEngine();
declareBraid(ce);

type Expr = number | string | readonly [string, ...Expr[]];
const same = (input: Expr, expected: Expr) =>
  expect(ce.box(input).evaluate().json).toEqual(ce.box(expected).evaluate().json);
const B = (strands: number, ...word: number[]): Expr => ["Braid", strands, ["List", ...word]];
/** A MathJSON string literal — the spelling a modular word takes. */
const W = (word: string): Expr => `'${word}'`;
/** T(p, q) as a knot — the other way to name what a TorusBraid closes to. */
const T = (p: number, q: number): Expr => ["TorusKnot", p, q];
/** The twist knot with n half-twists past its clasp. */
const TW = (n: number): Expr => ["TwistKnot", n];
/** The pretzel knot P(p, q, r), for odd p, q, r. */
const PZ = (p: number, q: number, r: number): Expr => ["PretzelKnot", p, q, r];

test("the braid group: products, inverses, powers and the obvious counts", () => {
  same(["BraidStrands", B(4, 1, 2, 3)], 4);
  same(["BraidCrossings", B(4, 1, 2, 3)], 3);
  same(["BraidWrithe", B(3, 1, -2, 1)], 1);
  same(["BraidProduct", B(3, 1), B(3, 2)], B(3, 1, 2));
  same(["BraidInverse", B(3, 1, 2)], B(3, -2, -1));
  same(["BraidPower", B(2, 1), 3], B(2, 1, 1, 1));
  same(["BraidIsPositive", B(3, 1, 2)], "True");
  same(["BraidIsPositive", B(3, 1, -2)], "False");
});

test("the map to the symmetric group, and the closure's components", () => {
  same(["BraidPermutation", B(3, 1)], ["List", 2, 1, 3]);
  same(["BraidPermutation", B(3, 1, 2)], ["List", 2, 3, 1]);
  same(["BraidComponents", B(2, 1, 1, 1)], 1); // the trefoil braid closes to a knot
  same(["BraidComponents", B(2, 1, 1)], 2); // the Hopf link
  same(["BraidIsKnot", ["TorusBraid", 2, 3]], "True");
  same(["BraidIsKnot", ["TorusBraid", 2, 4]], "False");
  same(["PositivePermutationBraid", ["List", 2, 3, 1]], B(3, 1, 2));
});

test("the Alexander polynomial comes back as algebra, not a coefficient list", () => {
  same(["AlexanderPolynomial", B(2, 1, 1, 1)], ["Add", 1, ["Negate", "t"], ["Square", "t"]]);
  // The figure-eight knot.
  same(["AlexanderPolynomial", ["BraidPower", B(3, 1, -2), 2]], ["Add", 1, ["Multiply", -3, "t"], ["Square", "t"]]);
  // Being an expression in `t`, it can just be evaluated — Δ(−1) is the knot determinant,
  // which is 3 for the trefoil and 5 for the figure-eight.
  const at = (input: Expr, value: number) => {
    // A throwaway engine, because an assignment to `t` would leak into later examples.
    const local = new ComputeEngine();
    declareBraid(local);
    local.assign("t", value);
    // Twice: the head hands back a fresh expression, which then needs evaluating itself.
    return local.box(input).evaluate().evaluate().json;
  };
  expect(at(["AlexanderPolynomial", B(2, 1, 1, 1)], -1)).toBe(3);
  expect(at(["AlexanderPolynomial", ["BraidPower", B(3, 1, -2), 2]], -1)).toBe(5);
});

test("Burau and the closed form agree on torus knots", () => {
  for (const [p, q] of [
    [2, 3],
    [2, 5],
    [3, 4],
    [3, 5],
  ] as const) {
    // One head, two routes: naming the knot takes the closed form, naming a braid for
    // it goes through Burau. They have to agree.
    expect(ce.box(["AlexanderPolynomial", ["TorusBraid", p, q]]).evaluate().json, `T(${p},${q})`).toEqual(
      ce.box(["AlexanderPolynomial", T(p, q)]).evaluate().json,
    );
  }
  same(["SeifertGenus", ["TorusBraid", 3, 4]], 3); // (3−1)(4−1)/2
  same(["SeifertGenus", ["TorusBraid", 2, 7]], 3);
});

test("a modular word draws a knot", () => {
  // The bridge: an LR word is accepted wherever a braid is, via its Lorenz braid.
  same(["BraidStrands", W("LLRLR")], 5);
  same(["LorenzBraid", W("LLRLR")], ["Braid", 5, ["List", 2, 1, 3, 2, 4, 3]]);
  same(["BraidIsPositive", W("LLRLR")], "True");
  same(["BraidIsKnot", W("LLRLR")], "True");
  // The shortest geodesic that draws a trefoil.
  same(["AlexanderPolynomial", W("LLRLR")], ["AlexanderPolynomial", T(2, 3)]);
  same(["SeifertGenus", W("LLRLR")], 1);
  // A single hump each way is an unknotted orbit, however long.
  same(["AlexanderPolynomial", W("LLLRRRR")], 1);
  same(["TripNumber", W("LLLRRRR")], 1);
  same(["TripNumber", W("LLRLR")], 2); // braid index 2 — a trefoil
  same(["LorenzPermutation", W("LLRLR")], ["List", 3, 4, 5, 1, 2]);
});

test("a malformed or out-of-range input leaves the call alone", () => {
  expect(ce.box(["BraidStrands", B(3, 5)]).evaluate().operator).toBe("BraidStrands");
  expect(ce.box(["SeifertGenus", B(3, 1, -2)]).evaluate().operator).toBe("SeifertGenus");
  expect(ce.box(["TorusBraid", 1, 3]).evaluate().operator).toBe("TorusBraid");
  expect(ce.box(["TripNumber", W("LRLR")]).evaluate().operator).toBe("TripNumber");
  expect(ce.box(["LorenzBraid", W("LLLL")]).evaluate().operator).toBe("LorenzBraid");
});

test("the Jones polynomial, from the Temperley-Lieb image", () => {
  // The right-handed trefoil.
  same(
    ["JonesPolynomial", B(2, 1, 1, 1)],
    ["Add", ["Negate", ["Power", "t", -4]], ["Power", "t", -3], ["Power", "t", -1]],
  );
  // …and it agrees with the closed form for torus knots.
  for (const [p, q] of [
    [2, 3],
    [2, 5],
    [3, 4],
    [3, 5],
  ] as const) {
    expect(ce.box(["JonesPolynomial", ["TorusBraid", p, q]]).evaluate().json, `T(${p},${q})`).toEqual(
      ce.box(["JonesPolynomial", T(p, q)]).evaluate().json,
    );
  }
  // The figure-eight knot is amphichiral: V is its own mirror.
  same(
    ["JonesPolynomial", ["BraidPower", B(3, 1, -2), 2]],
    ["Add", ["Power", "t", -2], ["Negate", ["Power", "t", -1]], 1, ["Negate", "t"], ["Square", "t"]],
  );
});

test("the bracket is in A, and survives where V does not", () => {
  // The Hopf link has two components, so V would need a square root of t — but the
  // bracket is perfectly well defined.
  expect(ce.box(["JonesPolynomial", B(2, 1, 1)]).evaluate().operator).toBe("JonesPolynomial");
  expect(ce.box(["KauffmanBracket", B(2, 1, 1)]).evaluate().operator).not.toBe("KauffmanBracket");
  expect(ce.box(["BracketInvariant", B(2, 1, 1)]).evaluate().operator).not.toBe("BracketInvariant");
  // The raw bracket is NOT an invariant — one positive crossing on the unknot leaves −A³
  // behind. Dividing out (−A³)^w is exactly what fixes that, and then V = 1.
  same(["KauffmanBracket", B(2, 1)], ["Negate", ["Power", "A", 3]]);
  same(["BracketInvariant", B(2, 1)], 1);
  same(["JonesPolynomial", B(2, 1)], 1);
});

test("a modular geodesic's knot has a Jones polynomial too", () => {
  // The bridge holds all the way through: an LR word is a braid, so it has a V.
  same(["JonesPolynomial", W("LLRLR")], ["JonesPolynomial", T(2, 3)]);
  same(["JonesPolynomial", W("LLLRLLR")], ["JonesPolynomial", T(2, 5)]);
  same(["JonesPolynomial", W("LLLRRRR")], 1); // the unknotted orbits really are unknotted
});

test("an invariant takes the knot, not the presentation", () => {
  // The same knot named three ways — as itself, as a braid it closes from, and as the
  // modular geodesic that draws it — gives one answer per invariant.
  const trefoil: Expr[] = [T(2, 3), ["TorusBraid", 2, 3], B(2, 1, 1, 1), W("LLRLR")];
  for (const head of ["JonesPolynomial", "AlexanderPolynomial", "SeifertGenus"]) {
    const answers = trefoil.map((k) => ce.box([head, k]).evaluate().json);
    for (const a of answers) expect(a, `${head} of the trefoil`).toEqual(answers[0]);
  }
});

test("the genus of a torus knot outlives the braid word for it", () => {
  same(["SeifertGenus", T(2, 3)], 1);
  same(["SeifertGenus", T(3, 7)], 6); // (3−1)(7−1)/2
  // torusBraid stops at 32 strands, so there is no braid to run Bennequin on here.
  same(["SeifertGenus", T(41, 2)], 20);
  // The Jones closed form has a tighter bound of its own (20), and says so by declining
  // rather than by answering something else.
  expect(ce.box(["JonesPolynomial", T(41, 2)]).evaluate().operator).toBe("JonesPolynomial");
  // T(p, q) with a common factor is a link, not a knot, so the genus declines.
  expect(ce.box(["SeifertGenus", T(4, 6)]).evaluate().operator).toBe("SeifertGenus");
});

test("the twist knot family, and the figure-eight under its own name", () => {
  // n = 1 is the figure-eight; n = -1 is the trefoil. Both closed forms agree with the
  // torus-knot and braid routes already checked above.
  same(["AlexanderPolynomial", TW(1)], ["AlexanderPolynomial", ["BraidPower", B(3, 1, -2), 2]]);
  same(["AlexanderPolynomial", TW(-1)], ["AlexanderPolynomial", T(2, 3)]);
  same(["AlexanderPolynomial", ["FigureEightKnot"]], ["AlexanderPolynomial", TW(1)]);
  same(["SeifertGenus", TW(1)], 1);
  same(["SeifertGenus", TW(4)], 1); // genus never grows with the number of half-twists
  // Wolfram's Stevedore knot (6_1) is the twist knot with two half-twists.
  same(["AlexanderPolynomial", TW(2)], ["Add", 2, ["Multiply", -5, "t"], ["Multiply", 2, ["Square", "t"]]]);
  // The figure-eight and the trefoil both carry the known braid for their own case, so
  // JonesPolynomial goes through it rather than declining.
  same(["JonesPolynomial", ["FigureEightKnot"]], ["JonesPolynomial", ["BraidPower", B(3, 1, -2), 2]]);
  same(["JonesPolynomial", TW(-1)], ["JonesPolynomial", B(2, 1, 1, 1)]);
  // No general braid-word family is known for twist knots, so the closed forms are all
  // a knot with |n| ≥ 2 (other than the two special cases above) has to answer with.
  expect(ce.box(["JonesPolynomial", TW(2)]).evaluate().operator).toBe("JonesPolynomial");
  expect(ce.box(["KnotCurve", TW(1)]).evaluate().operator).toBe("KnotCurve");
  expect(ce.box(["TwistKnot", 0]).evaluate().operator).toBe("TwistKnot"); // n = 0 is not a knot
});

test("the pretzel knot family, for odd p, q, r", () => {
  // P(1,1,1) is the trefoil; P(1,1,-1) is the unknot — both classical identities.
  same(["AlexanderPolynomial", PZ(1, 1, 1)], ["AlexanderPolynomial", T(2, 3)]);
  same(["AlexanderPolynomial", PZ(1, 1, -1)], 1);
  same(["SeifertGenus", PZ(1, 1, 1)], 1);
  same(["SeifertGenus", PZ(3, 5, 7)], 1);
  // P(1,1,n) is also a twist knot, so the two closed forms have to agree.
  same(["AlexanderPolynomial", PZ(1, 1, 3)], ["AlexanderPolynomial", TW(-2)]);
  same(["AlexanderPolynomial", PZ(1, 1, -3)], ["AlexanderPolynomial", TW(1)]);
  // No braid is attached to a pretzel knot, so anything needing one declines.
  expect(ce.box(["SeifertGenus", PZ(2, 1, 1)]).evaluate().operator).toBe("SeifertGenus"); // not all odd
  expect(ce.box(["JonesPolynomial", PZ(1, 1, 1)]).evaluate().operator).toBe("JonesPolynomial");
  expect(ce.box(["KnotCurve", PZ(1, 1, 1)]).evaluate().operator).toBe("KnotCurve");
});

test("a knot's curve comes from the knot, not from a head per family", () => {
  const points = ce.box(["KnotCurve", T(2, 3)]).evaluate();
  expect(points.operator).toBe("List");
  expect(ce.box(["KnotCurve", T(2, 3), 64]).evaluate().json).not.toEqual(points.json);
  // T(1, 7) has no braid word, and needs none to be drawn.
  expect(ce.box(["KnotCurve", T(1, 7)]).evaluate().operator).toBe("List");
  // A knot named as a braid has no embedding here; it says so rather than guessing.
  expect(ce.box(["KnotCurve", B(2, 1, 1, 1)]).evaluate().operator).toBe("KnotCurve");
});
