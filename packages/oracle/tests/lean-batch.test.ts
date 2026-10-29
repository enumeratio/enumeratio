import { expect, test } from "vite-plus/test";
import { leanBatchCode, leanItemAt } from "../src/run.ts";

test("the clock-start line comes before item 1, and `header` locates item lines", () => {
  const { code, header } = leanBatchCode(["1 + 1", "Nat.stirlingFirst 50 2"]);
  const lines = code.split("\n");
  expect(lines[header - 1]).toBe('#eval IO.println "<<0>>"');
  expect(lines[header]).toBe('#eval IO.println "<<1->>"');
  expect(lines[header + 1]).toContain('"<<1>>"');
  expect(lines[header + 3]).toContain("Nat.stirlingFirst 50 2");
});

test("a message on an item's line maps back to that item", () => {
  const sources = ["1 + 1", "bad", "Nat.stirlingFirst 50 2"];
  const { code, header } = leanBatchCode(sources);
  const lines = code.split("\n");
  sources.forEach((source, i) => {
    const line = lines.findIndex((l, at) => at >= header && l.includes(`(${source})`)) + 1;
    expect(leanItemAt(line, header)).toBe(i);
  });
});
