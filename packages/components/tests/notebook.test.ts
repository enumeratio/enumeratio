import { expect, test } from "vite-plus/test";
import { referencesOrdinal } from "../src/notatio-notebook.ts";

// `referencesOrdinal(src, json)` flags a cell-number reference — the old `@_n`
// shorthand (matched in the raw LaTeX) or a Wolfram-style `In[n]`/`Out[n]` (which
// compute-engine parses to `["At","In"|"Out",n]`). Reactive mode rejects these.

test("plain expressions are not ordinal references", () => {
  expect(referencesOrdinal("a + 1", ["Add", "a", 1])).toBe(false);
  expect(referencesOrdinal("x^2", ["Power", "x", 2])).toBe(false);
});

test("the @_n shorthand is flagged from the raw LaTeX", () => {
  expect(referencesOrdinal("@_2 + 1", ["Add", 1])).toBe(true);
  expect(referencesOrdinal("@_{10}", 0)).toBe(true);
});

test("Out[n]/In[n] are flagged from the parsed At node", () => {
  expect(referencesOrdinal("\\mathrm{Out}[3]", ["At", "Out", 3])).toBe(true);
  expect(referencesOrdinal("\\mathrm{In}[2] + 1", ["Add", ["At", "In", 2], 1])).toBe(true);
});

test("At on an ordinary symbol (indexing) is not an ordinal reference", () => {
  expect(referencesOrdinal("v[2]", ["At", "v", 2])).toBe(false);
});
