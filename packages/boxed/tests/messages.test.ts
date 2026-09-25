import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { collectMessages, defineMessages, emit, messageLine } from "../src/index.ts";

const ce = new ComputeEngine();
defineMessages(ce, "F", { bad: "`1` is not `2`." });

test("an emit splices its arguments into the head's template", () => {
  const { messages } = collectMessages(ce, () => emit(ce, "F", "bad", [2, ce.box(["List", 1, 2])], "try 3"));
  expect(messages).toEqual([
    { head: "F", code: "bad", args: ["2", "[1, 2]"], text: "2 is not [1, 2].", hint: "try 3" },
  ]);
  expect(messageLine(messages[0]!)).toBe("F::bad: 2 is not [1, 2]. try 3");
});

test("a code with no template still reads, as its arguments", () => {
  const { messages } = collectMessages(ce, () => emit(ce, "G", "odd", [1n, "x"]));
  expect(messages.map((m) => m.text)).toEqual(["1, x"]);
});

test("collection is per call: repeats fold, nesting reaches both, nothing leaks", () => {
  emit(ce, "F", "bad", [0, 0]);
  const outer = collectMessages(ce, () => {
    emit(ce, "F", "bad", [1, 1]);
    emit(ce, "F", "bad", [1, 1]);
    return collectMessages(ce, () => emit(ce, "F", "bad", [2, 2])).messages;
  });
  expect(outer.value.map((m) => m.text)).toEqual(["2 is not 2."]);
  expect(outer.messages.map((m) => m.text)).toEqual(["1 is not 1.", "2 is not 2."]);
  expect(collectMessages(ce, () => 0).messages).toEqual([]);
});

test("templates are the engine's own", () => {
  const other = new ComputeEngine();
  const { messages } = collectMessages(other, () => emit(other, "F", "bad", [1, 2]));
  expect(messages[0]?.text).toBe("1, 2");
});
