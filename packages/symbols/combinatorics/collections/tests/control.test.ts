import { ComputeEngine } from "@cortex-js/compute-engine";
import { collectMessages } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const runExpr = (expr: unknown) => ce.box(expr as never).evaluate();
const run = (expr: unknown) => runExpr(expr).json;

// With

test("With substitutes bound values into the body", () => {
  expect(run(["With", ["List", ["Equal", "x", 1], ["Equal", "y", 2]], ["Add", "x", "y"]])).toEqual(3);
});
test("With's bindings are simultaneous, not sequential", () => {
  // controlTestY's binding value is `x`, evaluated in the OUTER context (where `x` is
  // undeclared) -- not the `1` the sibling binding gives `x` inside this same With.
  expect(run(["With", ["List", ["Equal", "x", 1], ["Equal", "controlTestY", "x"]], "controlTestY"])).toEqual("x");
});

// Module

test("Module locals are invisible outside the call", () => {
  ce.assign("controlTestModA", 100);
  expect(run(["Module", ["List", ["Equal", "controlTestModA", 5]], ["Add", "controlTestModA", 1]])).toEqual(6);
  expect(run("controlTestModA")).toEqual(100);
});
test("Module does not clobber an outer binding of the same name", () => {
  ce.assign("controlTestModB", 7);
  run(["Module", ["List", "controlTestModB"], ["Assign", "controlTestModB", 999]]);
  expect(run("controlTestModB")).toEqual(7);
});
test("nested Module locals of the same name don't collide", () => {
  const expr = ["Module", ["List", ["Equal", "n", 1]], ["Module", ["List", ["Equal", "n", 2]], ["Add", "n", 1]]];
  expect(run(expr)).toEqual(3);
});

// Reap / Sow

// Sequencing several `Sow`s in one expression uses `[Last, [List, ...]]`, never
// compute-engine's own `Block` -- see control.ts's module doc for the `Block` gotcha
// (a symbol referenced inside a `Block` stops `isSame`-matching the same symbol outside
// it, which broke tag matching below until this was tracked down).
test("Reap collects everything Sow-ed, untagged sows sharing one group", () => {
  expect(run(["Reap", ["Last", ["List", ["Sow", 1], ["Sow", 2], 3]]])).toEqual(["List", 3, ["List", ["List", 1, 2]]]);
});
test("Reap with nothing sown gives an empty group list", () => {
  expect(run(["Reap", 5])).toEqual(["List", 5, ["List"]]);
});
test("Reap(expr, tag) collects only the matching tag's group", () => {
  const expr = ["Reap", ["Last", ["List", ["Sow", 1, "a"], ["Sow", 2, "b"], ["Sow", 3, "a"], 0]], "a"];
  expect(run(expr)).toEqual(["List", 0, ["List", ["List", 1, 3]]]);
});
test("Sow outside any Reap is a no-op that still returns its value", () => {
  expect(run(["Sow", 42])).toEqual(42);
});

// Throw / Catch

test("Catch returns the thrown value", () => {
  expect(run(["Catch", ["Throw", "caught"]])).toEqual("caught");
});
test("Catch(expr, tag) only catches a matching tag", () => {
  const expr = ["Catch", ["Throw", "value", "wanted"], "wanted"];
  expect(run(expr)).toEqual("value");
});
test("an expression with no Throw evaluates normally under Catch", () => {
  expect(run(["Catch", ["Add", 1, 2]])).toEqual(3);
});

// Do

test("Do(body, n) runs n times with no loop variable", () => {
  ce.assign("controlTestDoCount", 0);
  run(["Do", ["Assign", "controlTestDoCount", ["Add", "controlTestDoCount", 1]], 5]);
  expect(run("controlTestDoCount")).toEqual(5);
});
test("Do(body, {i, a, b}) sums 1..5", () => {
  ce.assign("controlTestDoSum", 0);
  run(["Do", ["Assign", "controlTestDoSum", ["Add", "controlTestDoSum", "i"]], ["List", "i", 1, 5]]);
  expect(run("controlTestDoSum")).toEqual(15);
});
test("Do(body, {i, a, b, step}) counts down by 2", () => {
  const collected: number[] = [];
  ce.declare("controlTestDoCollect", {
    signature: "(any) -> any",
    evaluate: (ops) => {
      collected.push(ops[0]!.re);
      return ops[0];
    },
  });
  run(["Do", ["controlTestDoCollect", "i"], ["List", "i", 5, 1, -2]]);
  expect(collected).toEqual([5, 3, 1]);
});

// Switch

test("Switch matches the first equal literal form", () => {
  expect(run(["Switch", 2, 1, "one", 2, "two", 3, "three"])).toEqual("two");
});
test("Switch falls through to a Blank default", () => {
  expect(run(["Switch", 99, 1, "one", "_", "other"])).toEqual("other");
});
test("Switch with no match stays unevaluated", () => {
  const result = run(["Switch", 5, 1, "one"]) as readonly unknown[];
  expect(result[0]).toEqual("Switch");
});

// While

test("While counts up to a limit", () => {
  ce.assign("controlTestWhileI", 0);
  run(["While", ["Less", "controlTestWhileI", 5], ["Assign", "controlTestWhileI", ["Add", "controlTestWhileI", 1]]]);
  expect(run("controlTestWhileI")).toEqual(5);
});

// NestWhile / NestWhileList

test("NestWhile halves while even, stopping at the first odd value", () => {
  const halveIfEven = ["Function", ["Divide", "_1", 2]];
  const isEven = ["Function", ["Equal", ["Mod", "_1", 2], 0]];
  expect(run(["NestWhile", halveIfEven, 96, isEven])).toEqual(3);
});
test("NestWhileList collects every intermediate value, including the stopping one", () => {
  const halveIfEven = ["Function", ["Divide", "_1", 2]];
  const isEven = ["Function", ["Equal", ["Mod", "_1", 2], 0]];
  expect(run(["NestWhileList", halveIfEven, 96, isEven])).toEqual(["List", 96, 48, 24, 12, 6, 3]);
});

// FixedPointList

test("FixedPointList collects every step, ending with the repeated fixed point", () => {
  const halveFloor = ["Function", ["Floor", ["Divide", "_1", 2]]];
  expect(run(["FixedPointList", halveFloor, 10])).toEqual(["List", 10, 5, 2, 1, 0, 0]);
});

// Echo

test("Echo returns its argument unchanged", () => {
  expect(run(["Echo", 42])).toEqual(42);
});
test("Echo routes its printed text through the message channel", () => {
  const { value, messages } = collectMessages(ce, () => ce.box(["Echo", 7]).evaluate());
  expect(value.json).toEqual(7);
  expect(messages.map((m) => m.text)).toEqual(["7"]);
});
test("Echo(expr, label) labels the message", () => {
  const { messages } = collectMessages(ce, () => ce.box(["Echo", 7, "'x'"]).evaluate());
  expect(messages.map((m) => m.text)).toEqual(['"x": 7']);
});

// AbsoluteTiming

test("AbsoluteTiming returns {seconds, value} with the value intact (seconds unpinned)", () => {
  const result = runExpr(["AbsoluteTiming", ["Add", 1, 2]]);
  const parts = result.json as readonly unknown[];
  expect(parts[0]).toEqual("List");
  expect(parts[2]).toEqual(3);
  expect(typeof parts[1]).toEqual("number");
});

// Attributes / SetAttributes

test("Attributes reports Add's Flat, HoldAll, Listable and Orderless", () => {
  // Add is associative (Flat), commutative (Orderless), broadcastable (Listable) and lazy
  // (HoldAll, the closest of the Hold* family -- see control.ts's own comment on the
  // approximation) on this engine.
  expect(run(["Attributes", "Add"])).toEqual(["List", "Flat", "HoldAll", "Listable", "Orderless"]);
});
test("Attributes of an undeclared symbol is empty", () => {
  expect(run(["Attributes", "SomeUndeclaredHeadZz"])).toEqual(["List"]);
});
test("SetAttributes flips a flag on a declared head", () => {
  ce.declare("ControlTestSetAttr", { signature: "(any) -> any", evaluate: (ops) => ops[0] });
  expect(run(["Attributes", "ControlTestSetAttr"])).toEqual(["List"]);
  run(["SetAttributes", "ControlTestSetAttr", "Orderless"]);
  expect(run(["Attributes", "ControlTestSetAttr"])).toEqual(["List", "Orderless"]);
});
test("SetAttributes declines an attribute we can't represent", () => {
  ce.declare("ControlTestSetAttr2", { signature: "(any) -> any", evaluate: (ops) => ops[0] });
  const result = run(["SetAttributes", "ControlTestSetAttr2", "Protected"]) as readonly unknown[];
  expect(result[0]).toEqual("SetAttributes");
});

// AppendTo

test("AppendTo appends to a bound list variable and reassigns it", () => {
  ce.assign("controlTestAppend", ce.box(["List", 1, 2, 3]));
  expect(run(["AppendTo", "controlTestAppend", 4])).toEqual(["List", 1, 2, 3, 4]);
  expect(run("controlTestAppend")).toEqual(["List", 1, 2, 3, 4]);
});
