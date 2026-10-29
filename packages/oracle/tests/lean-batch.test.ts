import { expect, test } from "vite-plus/test";
import { leanBatchCode } from "../src/run.ts";

test("the clock-start line comes before item 1, and `header` locates item lines", () => {
  const { code, header } = leanBatchCode(["1 + 1", "Nat.stirlingFirst 50 2"]);
  const lines = code.split("\n");
  expect(lines[header - 1]).toBe('#eval IO.println "<<0>>"');
  expect(lines[header]).toContain('"<<1>>"');
  expect(lines[header + 1]).toContain("Nat.stirlingFirst 50 2");
});
