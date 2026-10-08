// The engine's half of a lazy table: a REAL engine, declared as the page declares it, answering
// rows by range as bigints. Counts are exact, a lower bound or infinite; a source with `At`
// reaches any row (SymmetricGroup(25)'s last is past 2^53); one without it is walked.

import { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import type { Box } from "@enumeratio/boxes";
import { toText } from "@enumeratio/boxes/render";
import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import {
  bigintOf,
  createRowsHost,
  openRowSource,
  rowSourceExpression,
  rowSourceSpec,
  staticTable,
} from "../src/row-source.ts";

function engine(): ComputeEngine {
  const ce = new ComputeEngine();
  declareCombinatorics(ce);
  declareCarrierPlurals(ce, CARRIERS);
  declareCarrierElement(ce, CARRIERS);
  declareStructures(ce);
  return ce;
}

const ce = engine();
const json = (x: unknown): MathJsonExpression => x as MathJsonExpression;
const open = (collection: unknown, rest: Record<string, unknown> = {}) => {
  const opened = openRowSource(ce, { collection: json(collection), columns: [], ...rest });
  if (!opened.ok) throw new Error(opened.error);
  return opened.source;
};
const textOf = (cell: Box | undefined): string => (cell === undefined ? "" : toText(cell));

test("a finite source with At is exact and answers any range", async () => {
  const source = open(["SymmetricGroup", 4]);
  expect(source.random).toBe(true);
  expect(source.count()).toEqual({ kind: "exact", n: 24n });
  const batch = await source.rows([1n, 4n], [0, source.columns.length]);
  expect(batch.start).toBe(1n);
  expect(batch.rows.map((r) => textOf(r[0]))).toEqual([
    "Permutation([1, 2, 3, 4])",
    "Permutation([1, 2, 4, 3])",
    "Permutation([1, 3, 2, 4])",
  ]);
  const tail = await source.rows([23n, 30n], [0, 1]);
  expect(tail.rows).toHaveLength(2);
  expect(tail.end).toBe(true);
});

test("SymmetricGroup(25) is counted exactly and jumps to its last row", async () => {
  const source = open(["SymmetricGroup", 25]);
  const total = 15511210043330985984000000n;
  expect(source.count()).toEqual({ kind: "exact", n: total });
  const last = await source.rows([total, total + 1n], [0, 1]);
  expect(textOf(last.rows[0]?.[0])).toBe(`Permutation([${Array.from({ length: 25 }, (_, i) => 25 - i).join(", ")}])`);
  const first = await source.rows([1n, 2n], [0, 1]);
  expect(textOf(first.rows[0]?.[0])).toContain("Permutation([1, 2, 3");
  // Past the end there is nothing, and the batch says so.
  const past = await source.rows([total + 1n, total + 3n], [0, 1]);
  expect(past.rows).toEqual([]);
  expect(past.end).toBe(true);
});

test("an infinite set with no At is walked, and its count is infinite", async () => {
  const source = open("NonNegativeIntegers");
  expect(source.random).toBe(false);
  expect(source.count()).toEqual({ kind: "infinite" });
  const batch = await source.rows([1n, 6n], [0, 1]);
  expect(batch.rows.map((r) => textOf(r[0]))).toEqual(["0", "1", "2", "3", "4"]);
  // Scrolling on continues the walk; scrolling back within the window is served from it.
  const later = await source.rows([100n, 103n], [0, 1]);
  expect(later.rows.map((r) => textOf(r[0]))).toEqual(["99", "100", "101"]);
  const back = await source.rows([3n, 5n], [0, 1]);
  expect(back.rows.map((r) => textOf(r[0]))).toEqual(["2", "3"]);
});

test("a finite collection with no stable order declines", () => {
  const opened = openRowSource(ce, { collection: json(["Set", 3, 1, 2]), columns: [] });
  expect(opened).toMatchObject({ ok: false });
  expect((opened as { error: string }).error).toMatch(/no row order/);
});

test("a filter is a lower bound until the scan covers the source, then exact", async () => {
  const source = open(["SymmetricGroup", 4], { columns: ["Descents"], filter: "Descents(_) == 0" });
  expect(source.count()).toMatchObject({ kind: "atLeast", n: 0n, growing: true });
  const batch = await source.rows([1n, 5n], [0, source.columns.length]);
  // Only the identity has no descents.
  expect(batch.rows).toHaveLength(1);
  expect(batch.end).toBe(true);
  expect(source.count()).toEqual({ kind: "exact", n: 1n });
});

test("a filter over an infinite source scans in budgeted slices and stalls honestly", async () => {
  const source = open("NonNegativeIntegers", { filter: "_ == 5000000", scanBudget: 300 });
  const batch = await source.rows([1n, 2n], [0, 1]);
  expect(batch.rows).toEqual([]);
  expect(batch.stalled?.scanned).toBe(300n);
  expect(source.count()).toMatchObject({ kind: "atLeast", n: 0n, growing: true });
  // No upper bound is claimed for an infinite source.
  expect((source.count() as { upper?: bigint }).upper).toBeUndefined();
});

test("sorting a finite source is a scan, labeled until it completes; an infinite one declines", async () => {
  const source = open(["SymmetricGroup", 4], { columns: ["Descents"], sort: "Descents", descending: true });
  const batch = await source.rows([1n, 3n], [0, source.columns.length]);
  expect(batch.stalled).toBeUndefined();
  expect(source.count()).toEqual({ kind: "exact", n: 24n });
  expect(batch.rows.map((r) => textOf(r[1]))).toEqual(["3", "2"]);
  const infinite = open("NonNegativeIntegers", { columns: ["Sqrt"], sort: "Sqrt" });
  expect(infinite.sortDeclined).toMatch(/infinite/);
});

test("the spec round-trips through the held RowSource expression", () => {
  const spec = {
    collection: json(["Subsets", 4]),
    columns: ["Length", "Max(_) - Min(_)"],
    filter: "Length(_) == 2",
    sort: "Length",
    descending: true,
    glyph: "subset",
  };
  expect(rowSourceSpec(rowSourceExpression(spec))).toEqual(spec);
  expect(rowSourceSpec(json(["Add", 1, 2]))).toBeUndefined();
});

test("a kernel host registers a source by handle and answers batched ranges", async () => {
  const read = async ({ text }: { text: string }): Promise<unknown> => {
    expect(text).toBe("SymmetricGroup(5)");
    return ["SymmetricGroup", 5];
  };
  const host = createRowsHost(ce, read);
  const signal = new AbortController().signal;
  const source = rowSourceExpression({ collection: { str: "SymmetricGroup(5)" } as never, columns: [] });
  const registered = await host({ op: "register", handle: "h1", source }, signal);
  expect(registered).toMatchObject({ ok: true, random: true, count: { kind: "exact", n: 120n } });
  const answer = await host(
    {
      op: "range",
      handle: "h1",
      ranges: [
        [1n, 3n],
        [119n, 121n],
      ],
      columns: [0, 1],
    },
    signal,
  );
  expect(answer).toMatchObject({ ok: true });
  if (!answer.ok) return;
  expect(answer.batches?.map((b) => [b.start, b.rows.length])).toEqual([
    [1n, 2],
    [119n, 2],
  ]);
  expect(await host({ op: "range", handle: "nope", ranges: [], columns: [0, 1] }, signal)).toMatchObject({ ok: false });
  await host({ op: "release", handle: "h1" }, signal);
  expect(await host({ op: "range", handle: "h1", ranges: [], columns: [0, 1] }, signal)).toMatchObject({ ok: false });
});

test("an aborted call rejects instead of finishing its scan", async () => {
  const source = open("NonNegativeIntegers", { filter: "_ == 5000000", scanBudget: 1_000_000 });
  const controller = new AbortController();
  const pending = source.rows([1n, 2n], [0, 1], controller.signal);
  controller.abort();
  await expect(pending).rejects.toBeDefined();
});

test("a static environment draws the first page and one Skeleton row for the rest", async () => {
  const source = open(["SymmetricGroup", 6], { columns: ["Descents"] });
  const grid = await staticTable(source, { maxItems: 3 });
  expect(toText(grid)).toContain("… 717 more");
  const infinite = await staticTable(open("NonNegativeIntegers"), { maxItems: 2 });
  expect(toText(infinite)).toContain("…");
});

test("exact integers read from the engine's digit forms", () => {
  expect(bigintOf({ num: "15511210043330985984e+6" })).toBe(15511210043330985984000000n);
  expect(bigintOf(720)).toBe(720n);
  expect(bigintOf({ num: "1.5" })).toBeUndefined();
});
