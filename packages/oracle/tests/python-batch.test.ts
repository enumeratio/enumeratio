import { expect, test } from "vite-plus/test";
import { pythonBatchCode } from "../src/run.ts";

// The Python family's (SymPy/mpmath/Sage) batch scan used to `eval` every item in one shared
// module namespace, with the loop's own `i`/`src` as plain globals -- the same bug class #352
// fixed for Wolfram's `Do` loop counter (see collect-wolfram.test.ts). A batched item's own
// bare `i`, or an item that assigns a name (a walrus target), could read or corrupt the loop's
// bookkeeping, or leak into a later item. These assert on the generated source's SHAPE, the
// same way the Wolfram test does: no kernel involved.

test("each item gets its own namespace copy, not the loop's shared globals", () => {
  const code = pythonBatchCode(["i", "(x := 1)"], "");
  // A fresh copy of the base namespace precedes the loop and is re-copied every iteration.
  expect(code).toContain("_enumeratio_base_ns = dict(globals())");
  expect(code).toContain("_enumeratio_ns = dict(_enumeratio_base_ns)");
  // The base namespace is snapshotted before the loop's own bookkeeping names exist.
  const baseAt = code.indexOf("_enumeratio_base_ns = dict(globals())");
  const loopAt = code.indexOf("for _enumeratio_i, _enumeratio_src in enumerate(");
  const sourcesAt = code.indexOf("_enumeratio_sources = json.loads(");
  expect(baseAt).toBeGreaterThanOrEqual(0);
  expect(baseAt).toBeLessThan(sourcesAt);
  expect(baseAt).toBeLessThan(loopAt);
});

test("the loop counter and item source are never spelled `i` / `src` -- a batched item's own bare `i` can't collide with them", () => {
  const code = pythonBatchCode(["i"], "", (src, ns) => `eval(${src}, ${ns})`);
  const outsideStrings = code.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  expect(outsideStrings).not.toMatch(/\bfor i, src\b/);
  expect(outsideStrings).toMatch(/\bfor _enumeratio_i, _enumeratio_src\b/);
});

test("the default and Sage evaluators run against the per-item namespace, not `globals()`", () => {
  // `dict(globals())` is the one-time snapshot the isolation relies on; the evaluator call
  // itself must read/write the per-item copy, never `globals()` directly.
  const plain = pythonBatchCode(["1"], "");
  expect(plain).toContain("eval(_enumeratio_src, _enumeratio_ns)");
  expect(plain).not.toMatch(/\beval\(_enumeratio_src, globals\(\)\)/);

  const sage = pythonBatchCode(["1"], "", (src, ns) => `sage_eval(${src}, locals=${ns})`, "enumeratio_value");
  expect(sage).toContain("sage_eval(_enumeratio_src, locals=_enumeratio_ns)");
  expect(sage).not.toContain("locals=globals()");
});

test("the per-item alarm is thirty seconds unless a run names another", () => {
  expect(pythonBatchCode(["1"], "")).toContain("signal.alarm(30)");
  const longer = pythonBatchCode(["1"], "", undefined, undefined, 120);
  expect(longer).toContain("signal.alarm(120)");
  expect(longer).toContain("over 120s");
});

// A live run confirms behavior a shape assertion can't: run once with the offending item
// (`i`, or an assignment) at different batch positions and check neighboring items are
// unaffected. That needs an actual python3/sympy/mpmath process, so it's a manual check
// (see AGENTS.md), not a committed test.
