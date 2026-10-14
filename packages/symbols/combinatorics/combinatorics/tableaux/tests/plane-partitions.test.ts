// PlanePartitions walks a table of counts by shape, then enumerates the one shape: against the order the
// whole-list kernel gave (a frozen record, dumped from it as of 509777fe9, the commit before it was
// replaced), against a brute-force enumeration written here, and round-trips at sizes the whole list
// would be slow to build.

import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import {
  IsPlanePartitionOf,
  PlanePartitionsCount,
  PlanePartitionsRank,
  PlanePartitionsUnrank,
  planePartitionsWork,
} from "../src/families/plane-partitions.ts";

// n = 0..12, each partition's rows as comma lists joined by /, in order. Not regenerated: the kernel must list them so.
const OLD = JSON.parse(readFileSync(new URL("./golden/old-plane-partitions.json", import.meta.url), "utf8")) as Record<
  string,
  string[]
>;
const parse = (text: string): number[][] =>
  text === "" ? [] : text.split("/").map((row) => row.split(",").map(Number));
const written = (rows: number[][]): string => rows.map((row) => row.join(",")).join("/");

test("every n lists its plane partitions in the order the whole-list kernel did, and rank and unrank invert", () => {
  expect(Object.keys(OLD).length).toBe(13);
  for (const [key, list] of Object.entries(OLD)) {
    const n = Number(key);
    expect([n, PlanePartitionsCount(n)]).toEqual([n, list.length]);
    list.forEach((text, r) => {
      expect([n, r, written(PlanePartitionsUnrank(n, r))]).toEqual([n, r, text]);
      expect([n, text, PlanePartitionsRank(parse(text), n)]).toEqual([n, text, r]);
      expect(IsPlanePartitionOf(parse(text), n)).toBe(true);
    });
  }
});

const cmp = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
};

/** Every plane partition of n, written independently of the kernel: a row at a time, each row weakly
 *  falling, no longer than the row above and under it entry by entry; sorted by row lengths, then entries. */
function brute(n: number): number[][][] {
  const all: number[][][] = [];
  const rows: number[][] = [];
  const rowsUnder = (above: readonly number[] | undefined, budget: number, row: number[], out: number[][]): void => {
    if (row.length > 0) out.push(row);
    const at = row.length;
    if (above !== undefined && at >= above.length) return;
    const top = Math.min(at > 0 ? row[at - 1] : budget, above?.[at] ?? budget, budget);
    for (let v = 1; v <= top; v++) rowsUnder(above, budget - v, [...row, v], out);
  };
  const place = (above: readonly number[] | undefined, left: number): void => {
    if (left === 0) {
      all.push(rows.map((r) => r.slice()));
      return;
    }
    const options: number[][] = [];
    rowsUnder(above, left, [], options);
    for (const row of options) {
      rows.push(row);
      place(row, left - row.reduce((a, b) => a + b, 0));
      rows.pop();
    }
  };
  place(undefined, n);
  return all.toSorted(
    (a, b) =>
      cmp(
        a.map((row) => row.length),
        b.map((row) => row.length),
      ) || cmp(a.flat(), b.flat()),
  );
}

test("every n up to 18 is the whole list a brute-force enumeration sorts to, member by member", () => {
  for (let n = 0; n <= 18; n++) {
    const expected = brute(n);
    expect([n, PlanePartitionsCount(n)]).toEqual([n, expected.length]);
    expected.forEach((e, r) => {
      expect([n, r, PlanePartitionsUnrank(n, r)]).toEqual([n, r, e]);
      expect([n, r, PlanePartitionsRank(e, n)]).toEqual([n, r, r]);
    });
  }
});

test("rank and unrank round-trip at larger n, at the ends and across shapes", () => {
  for (const n of [22, 30, 36, 44]) {
    const total = PlanePartitionsCount(n);
    const ranks = [
      0,
      1,
      2,
      total - 2,
      total - 1,
      ...Array.from({ length: 40 }, (_, i) => Math.floor(((i + 0.5) * total) / 40)),
    ];
    for (const r of ranks) {
      const e = PlanePartitionsUnrank(n, r);
      expect([n, r, IsPlanePartitionOf(e, n)]).toEqual([n, r, true]);
      expect([n, r, PlanePartitionsRank(e, n)]).toEqual([n, r, r]);
    }
    // A negative or past-the-end rank wraps.
    expect(PlanePartitionsUnrank(n, -1)).toEqual(PlanePartitionsUnrank(n, total - 1));
    expect(PlanePartitionsUnrank(n, total)).toEqual(PlanePartitionsUnrank(n, 0));
  }
});

test("rank is -1 for what is no plane partition of n", () => {
  expect(PlanePartitionsRank([[2, 1]], 4)).toBe(-1); // sums to 3
  expect(PlanePartitionsRank([[1, 2]], 3)).toBe(-1); // rises along the row
  expect(PlanePartitionsRank([[1], [2]], 3)).toBe(-1); // rises down the column
  expect(PlanePartitionsRank([], 3)).toBe(-1);
  expect(PlanePartitionsRank([[]], 0)).toBe(-1);
  expect(PlanePartitionsRank([], 0)).toBe(0);
});

test("the work bound is half a step a table entry, past the engine's limit from n = 47", () => {
  expect(planePartitionsWork(0)).toBe(0n);
  expect(planePartitionsWork(28)).toBe(43_148n); // 86,296 entries, a small table
  expect(planePartitionsWork(46)).toBe(1_883_096n);
  expect(planePartitionsWork(47)).toBe(2_268_569n);
  expect(planePartitionsWork(10_000)).toBeGreaterThan(2_000_000n);
});

test("past 2^53 the kernel declines before building a table", () => {
  const declined = (call: () => unknown): boolean => {
    try {
      call();
    } catch (error) {
      return error instanceof RangeError && error.message.includes("not bigint yet");
    }
    return false;
  };
  // A000219(100) is past 2^53, and a table at n = 100 would not finish.
  expect(declined(() => PlanePartitionsUnrank(100, 5))).toBe(true);
  expect(declined(() => PlanePartitionsRank([[100]], 100))).toBe(true);
  expect(declined(() => PlanePartitionsUnrank(1_000_000, 5))).toBe(true);
});
