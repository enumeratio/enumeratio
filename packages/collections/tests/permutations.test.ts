import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, afterAll } from "vite-plus/test";
import { entries } from "../src/packs/permutations.ts";

// Certify every permutation-carrier pack: rank(unrank(p, r), p) === r across the whole
// family, unranked elements are valid members, and count matches the enumeration —
// same recipe as packs.test.ts, at sizes that stay well under the exhaustive suite's
// budget (ConnectedPermutations and the pattern avoiders grow fastest of the batch).
const PARAMS: Record<string, number[][]> = {
  EvenPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  Arrangements: [
    [0, 0],
    [3, 0],
    [3, 1],
    [3, 2],
    [3, 3],
    [5, 2],
  ],
  LehmerCodes: [[0], [1], [2], [3], [4], [5]],
  SubexcedantSeqs: [[0], [1], [2], [3], [4], [5]],
  AlternatingPermutations: [[0], [1], [2], [3], [4], [5], [6], [7]],
  ConnectedPermutations: [[0], [1], [2], [3], [4], [5], [6]],
  KCyclePermutations: [
    [0, 0],
    [1, 1],
    [4, 1],
    [4, 2],
    [4, 3],
    [4, 4],
    [5, 2],
  ],
  KDescentPermutations: [
    [0, 0],
    [1, 0],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
    [5, 2],
  ],
  KInversionPermutations: [
    [0, 0],
    [1, 0],
    [4, 0],
    [4, 1],
    [4, 2],
    [4, 3],
    [4, 6],
    [5, 4],
  ],
  PermutationsAvoiding123: [[0], [1], [2], [3], [4], [5], [6]],
  PermutationsAvoiding132: [[0], [1], [2], [3], [4], [5], [6]],
  PermutationsAvoiding213: [[0], [1], [2], [3], [4], [5], [6]],
  PermutationsAvoiding231: [[0], [1], [2], [3], [4], [5], [6]],
  PermutationsAvoiding312: [[0], [1], [2], [3], [4], [5], [6]],
  PermutationsAvoiding321: [[0], [1], [2], [3], [4], [5], [6]],
};

for (const entry of entries) {
  for (const p of PARAMS[entry.head] ?? [[3]]) {
    test(`${entry.head}(${p.join(", ")}) round-trips`, () => {
      const total = entry.count(p);
      for (let r = 0; r < total; r++) {
        const element = entry.unrank(p, r);
        expect(entry.valid(element, p)).toBe(true);
        expect(entry.rank(element, p)).toBe(r);
      }
    });
  }
}

// Counts against OEIS, independent of the round-trip above (a family could round-trip
// consistently against a WRONG count if unrank/rank/count were all wrong the same way).
const byHead = Object.fromEntries(entries.map((e) => [e.head, e]));
const countsOf = (head: string, ps: number[][]) => ps.map((p) => byHead[head].count(p));

test("EvenPermutations count = A001710 (n!/2, n<=1 -> 1)", () => {
  expect(countsOf("EvenPermutations", [[0], [1], [2], [3], [4], [5], [6], [7]])).toEqual([
    1, 1, 1, 3, 12, 60, 360, 2520,
  ]);
});
test("LehmerCodes / SubexcedantSeqs count = n! (A000142)", () => {
  const ps = [[0], [1], [2], [3], [4], [5], [6]];
  expect(countsOf("LehmerCodes", ps)).toEqual([1, 1, 2, 6, 24, 120, 720]);
  expect(countsOf("SubexcedantSeqs", ps)).toEqual([1, 1, 2, 6, 24, 120, 720]);
});
test("AlternatingPermutations count = Euler zigzag numbers (A000111)", () => {
  expect(
    countsOf("AlternatingPermutations", [[0], [1], [2], [3], [4], [5], [6], [7], [8]]),
  ).toEqual([1, 1, 1, 2, 5, 16, 61, 272, 1385]);
});
test("ConnectedPermutations count = indecomposable permutations (A003319)", () => {
  expect(countsOf("ConnectedPermutations", [[1], [2], [3], [4], [5], [6], [7]])).toEqual([
    1, 1, 3, 13, 71, 461, 3447,
  ]);
});
test("PermutationsAvoiding* count = Catalan numbers (A000108), all six patterns", () => {
  const ps = [[0], [1], [2], [3], [4], [5], [6], [7]];
  const catalan = [1, 1, 2, 5, 14, 42, 132, 429];
  for (const pattern of ["123", "132", "213", "231", "312", "321"]) {
    expect(countsOf(`PermutationsAvoiding${pattern}`, ps)).toEqual(catalan);
  }
});
test("KCyclePermutations row n=4 = unsigned Stirling first-kind (A132393)", () => {
  expect(
    countsOf("KCyclePermutations", [
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4],
    ]),
  ).toEqual([6, 11, 6, 1]);
});
test("KDescentPermutations row n=4 = Eulerian triangle (A008292)", () => {
  expect(
    countsOf("KDescentPermutations", [
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
    ]),
  ).toEqual([1, 11, 11, 1]);
});
test("KInversionPermutations row n=4 = Mahonian triangle (A008302)", () => {
  expect(
    countsOf("KInversionPermutations", [
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4],
      [4, 5],
      [4, 6],
    ]),
  ).toEqual([1, 3, 5, 6, 5, 3, 1]);
});

// Golden JSON (AGENTS.md); regenerate with `UPDATE_PERMUTATIONS_GOLDEN=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./permutations.golden.json", import.meta.url));
const updating = process.env.UPDATE_PERMUTATIONS_GOLDEN === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const GOLDEN_CASES: Record<string, number[][]> = {
  EvenPermutations: [[4]],
  Arrangements: [[4, 2]],
  LehmerCodes: [[4]],
  SubexcedantSeqs: [[4]],
  AlternatingPermutations: [[4], [5]],
  ConnectedPermutations: [[4]],
  KCyclePermutations: [[4, 2]],
  KDescentPermutations: [[4, 1]],
  KInversionPermutations: [[4, 3]],
  PermutationsAvoiding123: [[4]],
  PermutationsAvoiding132: [[4]],
  PermutationsAvoiding213: [[4]],
  PermutationsAvoiding231: [[4]],
  PermutationsAvoiding312: [[4]],
  PermutationsAvoiding321: [[4]],
};

for (const [head, paramsList] of Object.entries(GOLDEN_CASES)) {
  for (const p of paramsList) {
    const key = `${head}(${p.join(",")})`;
    test(`golden: ${key}`, () => {
      const entry = byHead[head];
      const total = entry.count(p);
      const elements = Array.from({ length: total }, (_, r) => entry.unrank(p, r));
      if (updating) {
        fresh[key] = elements;
        return;
      }
      expect(elements).toEqual(golden[key]);
    });
  }
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});
