import { expect, test } from "vite-plus/test";
import { adaptInput, assignedNames, bucketOf, judge, mentions, showsPicture } from "../scripts/wolfram-examples.ts";

test("a documentation input whose names are all ours reads as our MathJSON", () => {
  expect(adaptInput("HoldComplete[Zeta[2]]")).toEqual({ ok: true, expr: ["Zeta", 2] });
  expect(adaptInput("HoldComplete[N[Zeta[3], 50]]")).toEqual({ ok: true, expr: ["N", ["Zeta", 3], 50] });
  expect(adaptInput("HoldComplete[Binomial[n, Plus[n, -1]]]")).toEqual({
    ok: true,
    expr: ["Binomial", "n", ["Add", "n", -1]],
  });
});

test("an input that wouldn't mean the same here is refused, with why", () => {
  const reason = (held: string) => {
    const adapted = adaptInput(held);
    return adapted.ok ? undefined : adapted.reason;
  };
  expect(reason("HoldComplete[Plot[Zeta[x], List[x, -4, 4]]]")).toBe("effect Plot");
  expect(reason("HoldComplete[Timing[Zeta[2]]]")).toBe("effect Timing");
  expect(reason("HoldComplete[Zeta[2`100]]")).toBe("precision mark");
  expect(reason("HoldComplete[Zeta[\\[FormalN]]]")).toBe("named character");
  expect(reason("HoldComplete[f[Zeta[2]]]")).toBe("user function f");
  expect(reason("HoldComplete[Plus[F[x], Series[Zeta[x], List[x, 0, 2]]]]")).toBe("user function F");
  expect(reason("HoldComplete[Comap[List[Zeta, Gamma], 2]]")).toBe("unmapped Comap");
  expect(reason("HoldComplete[Normal[Series[Zeta[x], List[x, 0, 2]]]]")).toBeUndefined();
  expect(reason("HoldComplete[$Aborted]")).toBe("effect $Aborted");
});

test("a capitalised name that isn't a built-in is a free symbol, like a lowercase one", () => {
  expect(adaptInput("HoldComplete[Zeta[A]]")).toEqual({ ok: true, expr: ["Zeta", "A"] });
  expect(adaptInput("HoldComplete[Binomial[B, 2]]")).toEqual({ ok: true, expr: ["Binomial", "B", 2] });
});

test("Wolfram's variables i and e stay variables, not the imaginary unit and Euler's number", () => {
  expect(adaptInput("HoldComplete[Sum[Power[i, 2], List[i, 1, 10]]]")).toEqual({
    ok: true,
    expr: ["Sum", ["Power", "k", 2], ["Tuple", "k", 1, 10]],
  });
  expect(adaptInput("HoldComplete[List[d, e, Power[E, k]]]")).toEqual({
    ok: true,
    expr: ["List", "d", "m", ["Power", "ExponentialE", "k"]],
  });
});

test("a replacement's rules are rules, not key-value pairs", () => {
  expect(adaptInput("HoldComplete[Replace[Power[x, 2], Rule[Power[x, 2], Plus[a, b]]]]")).toEqual({
    ok: true,
    expr: ["Replace", ["Power", "x", 2], ["Rule", ["Power", "x", 2], ["Add", "a", "b"]]],
  });
  expect(adaptInput("HoldComplete[Replace[x, List[List[Rule[x, 1]], List[Rule[y, 2]]]]]")).toEqual({
    ok: true,
    expr: ["Replace", "x", ["List", ["List", ["Rule", "x", 1]], ["List", ["Rule", "y", 2]]]],
  });
});

test("mentions finds a head applied anywhere, or a constant on its own", () => {
  expect(mentions(["N", ["Zeta", 3]], "Zeta")).toBe(true);
  expect(mentions(["Add", "Pi", 1], "Pi")).toBe(true);
  expect(mentions(["Sum", ["Power", "k", -2]], "Zeta")).toBe(false);
});

test("judge keeps a real answer and names what's wrong with the rest", () => {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  expect(judge(["Zeta", 2], ["Divide", ["Power", "Pi", 2], 6], same)).toBe("keep");
  expect(judge(["Zeta", "s", -1], ["Zeta", "s", -1], same)).toEqual({ gap: "unevaluated" });
  expect(judge(["FunctionExpand", ["Gamma", "z"]], ["Gamma", "z"], same)).toEqual({
    gap: "FunctionExpand did nothing",
  });
  expect(judge(["FullSimplify", ["Equal", "a", "b"]], ["Equal", "b", "a"], same)).toEqual({
    gap: "claim not shown True",
  });
  expect(judge(["Gamma", "ComplexInfinity"], "NaN", same)).toEqual({ suspect: "NaN" });
  expect(judge(["FunctionExpand", ["Fibonacci", "n", "x"]], ["Cos", ["Multiply", 3.14159, "n"]], same)).toEqual({
    suspect: "float from exact input",
  });
  expect(judge(["N", ["Zeta", 3]], { num: "1.2020569" }, same)).toBe("keep");
});

test("bucketOf makes a first guess at where a mismatch comes from", () => {
  const row = { expr: ["Zeta", 2], ours: 1.6449340668482264, in: "Zeta[2]", verdict: "disagree" };
  expect(bucketOf({ ...row, in: undefined })).toBe("unscanned");
  expect(bucketOf({ ...row, in: undefined, missing: ["Block/1"] })).toBe("adapt");
  expect(bucketOf({ ...row, wolfram: "Zeta[2]" })).toBe("emit");
  expect(bucketOf({ ...row, wolfram: "1.6449340668482264" })).toBe("compare");
  expect(bucketOf({ ...row, wolfram: "Indeterminate" })).toBe("wolfram?");
  expect(bucketOf({ ...row, wolfram: "Pi^2/7" })).toBe("ours?");
});

test("a picture or a control is not asked of Wolfram, a value that merely mentions one is", () => {
  expect(showsPicture("Plot", ["Plot", ["Sin", "x"], ["Tuple", "x", 0, 1]])).toBe(true);
  expect(showsPicture("Zeta", ["Slider", "k", ["Tuple", 0, 5]])).toBe(true);
  expect(showsPicture("Element", ["Element", "x", ["Disk", ["Tuple", 0, 0], 1]])).toBe(false);
});

test("assignedNames finds what a documentation input defines", () => {
  expect(assignedNames("HoldComplete[Set[g, Graph[List[1, 2]]]]")).toEqual(["g"]);
  expect(assignedNames("HoldComplete[SetDelayed[f[Pattern[x, Blank[]]], x]]")).toEqual(["f"]);
  expect(assignedNames("HoldComplete[Zeta[2]]")).toEqual([]);
});
