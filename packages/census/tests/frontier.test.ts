// The Wolfram frontier is generated from a kernel, so these check its SHAPE rather than its
// contents — enough to catch a collection run that half-failed and wrote a plausible-looking
// file, which a silent kernel error will otherwise do.

import { isSystemName } from "@enumeratio/wolfram/src";
import { expect, test } from "vite-plus/test";
import { declaredNames } from "../src/engine.ts";
import { CALL_FORMS, FRONTIER } from "../src/wolfram-frontier-data.ts";

test("the frontier is ranked, and every entry is a real Wolfram symbol", () => {
  expect(FRONTIER.length).toBeGreaterThan(100);
  const uses = FRONTIER.map((entry) => entry.uses);
  expect([...uses].sort((a, b) => b - a)).toEqual(uses);
  expect(FRONTIER.filter((entry) => !isSystemName(entry.head))).toEqual([]);
});

test("nothing on the frontier is something we already answer", () => {
  // The whole value of the list is that every line is work we have not done. A head that
  // crept back in — because we implemented it and did not regenerate — makes it a to-do
  // list with done items on it, which is how such a list stops being read.
  const ours = new Set(declaredNames());
  expect(FRONTIER.map((entry) => entry.head).filter((head) => ours.has(head))).toEqual([]);
});

test("call forms are calls to the symbol they are filed under", () => {
  expect(Object.keys(CALL_FORMS).length).toBeGreaterThan(50);
  for (const [symbol, forms] of Object.entries(CALL_FORMS)) {
    expect(isSystemName(symbol), symbol).toBe(true);
    for (const form of forms) expect(form.startsWith(`${symbol}[`), form).toBe(true);
  }
});
