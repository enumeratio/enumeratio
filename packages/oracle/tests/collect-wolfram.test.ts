import { expect, test } from "vite-plus/test";
import { collectWolfram, wolframBatchCode } from "../src/run.ts";

// The Wolfram lane's transcript, one marked line per form: the value, its N, its InputForm,
// the TeX pair, and for an arbitrary-precision value the digits Wolfram displays.

test("the displayed digits of an arbitrary-precision value come back as `shown`", () => {
  const transcript = [
    "<<1>>0.125`2.",
    "<<1#>>0.125`2.",
    "<<1|>>0.125`2.",
    "<<1~>>0.13",
    "<<2>>Pi",
    "<<2#>>3.141592653589793",
    "<<2|>>Pi",
  ].join("\n");
  const [tie, pi] = collectWolfram(transcript, 2);
  expect(tie).toEqual({
    value: "0.125`2.",
    numeric: "0.125`2.",
    display: "0.125`2.",
    shown: "0.13",
  });
  expect(pi).toEqual({ value: "Pi", numeric: "3.141592653589793", display: "Pi" });
});

// A live-kernel test can't observe the collision itself (that needs wolframscript actually
// binding the batch loop's counter to a value mid-run) -- this asserts on the generated
// source's SHAPE instead: the loop counter is `k`, `Module`-scoped, and a batched item's own
// bare `i` (ours, e.g. a symbol literally named `i` or `i_1`, not the imaginary unit) is never
// the loop's own symbol, so it can't be read back as whatever position that item landed at.
test("the batch loop's counter is Module-scoped and never named `i` -- a batched item's own bare `i` can't collide with it", () => {
  const code = wolframBatchCode(["Element[Subscript[i, 1], Quaternions]", "Sin[x]"]);
  expect(code).toContain("Module[{k}, Do[");
  expect(code).toMatch(/\{k, 1, 2\}/);
  // The loop counter itself is never spelled `i` -- only inside the batched sources, which
  // are opaque JSON string literals `wolframBatchCode` never parses or renames.
  const outsideStrings = code.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  expect(outsideStrings).not.toMatch(/\{i, 1,/);
  expect(outsideStrings).not.toMatch(/"<<", i,/);
});
