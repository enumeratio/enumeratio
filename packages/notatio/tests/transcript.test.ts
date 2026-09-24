import { ComputeEngine, type BoxedExpression } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { Transcript } from "../src/transcript.ts";

// A transcript's own evaluate, outside any element: parse `latex` (after `%`
// substitution) inside the transcript's scope, evaluate, and record it as the next
// `In[n]`/`Out[n]` -- what `notatio-out` does for a cell inside a `<notatio-dynamic-module>`
// whose `value` is LaTeX (the fast path a `<notatio-cell>` uses before it has parsed).
function evaluate(t: Transcript, engine: ComputeEngine, latex: string) {
  return t.run(() => {
    const text = t.substitute(latex);
    const raw = engine.parse(text);
    const value = raw.evaluate();
    const n = t.record(latex, raw, value);
    return { n, value };
  });
}

// The MathJSON path a `<notatio-cell>` actually takes once it has parsed its own
// notatio/InputForm source: `Out(1)` and friends are ordinary function calls, boxed
// straight from the parsed tree rather than round-tripped through LaTeX text (which
// has no call syntax for an arbitrary declared symbol).
function evaluateJson(
  t: Transcript,
  engine: ComputeEngine,
  json: Parameters<ComputeEngine["box"]>[0],
  input: string,
) {
  return t.run(() => {
    const raw: BoxedExpression = engine.box(json);
    const value = raw.evaluate();
    const n = t.record(input, raw, value);
    return { n, value };
  });
}

test("a binding made by one cell is visible to a later one in the same transcript", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  evaluate(t, engine, "a\\coloneq 5");
  const second = evaluate(t, engine, "a^2");
  expect(second.value.re).toBe(25);
});

test("the binding does not leak to the page's own root scope", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  evaluate(t, engine, "leaked\\coloneq 42");
  expect(engine.box("leaked").evaluate().re).not.toBe(42);
});

test("two transcripts on the same engine keep separate bindings", () => {
  const engine = new ComputeEngine();
  const a = new Transcript(engine);
  const b = new Transcript(engine);
  evaluate(a, engine, "x\\coloneq 1");
  evaluate(b, engine, "x\\coloneq 2");
  expect(evaluate(a, engine, "x").value.re).toBe(1);
  expect(evaluate(b, engine, "x").value.re).toBe(2);
});

test("line numbers count evaluations, in the order they happen", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  const first = evaluate(t, engine, "1 + 1");
  const second = evaluate(t, engine, "2 + 2");
  expect(first.n).toBe(1);
  expect(second.n).toBe(2);
  expect(t.history.map((e) => e.value.re)).toEqual([2, 4]);
});

test("Out(n) reads back a prior line's frozen value, InString(n) its literal text", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  evaluate(t, engine, "3 + 4");
  expect(evaluateJson(t, engine, ["Out", 1], "Out(1)").value.re).toBe(7);
  expect(evaluateJson(t, engine, ["InString", 1], "InString(1)").value.string).toBe("3 + 4");
});

test("In(n) re-evaluates its input against the CURRENT bindings; Out(n) stays frozen", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  evaluate(t, engine, "a\\coloneq 1");
  evaluate(t, engine, "a + 1"); // line 2, evaluates to 2 while a is still 1
  evaluate(t, engine, "a\\coloneq 5"); // line 3, rebinds a
  expect(evaluateJson(t, engine, ["Out", 2], "Out(2)").value.re).toBe(2); // the frozen result
  expect(evaluateJson(t, engine, ["In", 2], "In(2)").value.re).toBe(6); // re-run against a = 5 now
});

test("Out/In/InString take a negative index counting back from the last line", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  evaluate(t, engine, "10");
  evaluate(t, engine, "20");
  expect(evaluateJson(t, engine, ["Out", -1], "Out(-1)").value.re).toBe(20);
  expect(evaluateJson(t, engine, ["Out", -3], "Out(-3)").value.re).toBe(10);
});

test("a re-evaluated cell gets a new, higher line number rather than overwriting its old one", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  const first = evaluate(t, engine, "a\\coloneq 1");
  const again = evaluate(t, engine, "a\\coloneq 2");
  expect(first.n).toBe(1);
  expect(again.n).toBe(2);
  expect(t.history).toHaveLength(2);
  expect(evaluate(t, engine, "a").value.re).toBe(2); // the later assignment wins
});

test("% is the last Out and %% the one before it -- Wolfram's shorthand for Out(-1)/Out(-2)", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  evaluate(t, engine, "5"); // line 1
  evaluate(t, engine, "6"); // line 2
  expect(evaluate(t, engine, "%").value.re).toBe(6); // line 3: Out(2)
  expect(evaluate(t, engine, "%%").value.re).toBe(6); // line 4: Out(-2) of [5,6,6] is line 2
});

test("%n is Out(n)'s shorthand", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  evaluate(t, engine, "5");
  evaluate(t, engine, "6");
  expect(evaluate(t, engine, "%1").value.re).toBe(5);
});

test("Out(n) with no such line is a diagnostic, not a silent Missing", () => {
  const engine = new ComputeEngine();
  const t = new Transcript(engine);
  expect(() => evaluateJson(t, engine, ["Out", 1], "Out(1)")).toThrow(/no line 1/);
});
