// @vitest-environment happy-dom
// `Columns -> Automatic` in a notebook: the page hands the element no `statistics`, and the
// columns still come from the carrier of the collection (the build's carrier-statistics table).

import { beforeAll, expect, test } from "vite-plus/test";
import type { NotatioCollectionTable } from "../src/notatio-collection-table.ts";

beforeAll(async () => {
  await import("../src/notatio-collection-table.ts");
}, 60_000);

async function table(props: Partial<Record<keyof NotatioCollectionTable, unknown>>): Promise<NotatioCollectionTable> {
  const el = document.createElement("notatio-collection-table") as NotatioCollectionTable;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const headers = (el: Element): string[] =>
  JSON.parse(el.querySelector("table-view-box")!.getAttribute("headers") ?? "[]") as string[];

test("Automatic derives statistic columns from the collection's carrier without a statistics property", async () => {
  const el = await table({ expr: "Permutations(4)", columns: "Automatic" });
  expect(el.statistics).toEqual([]);
  expect(headers(el).length).toBeGreaterThan(2);
  el.remove();
});

test("a carrier named directly gives the same columns as its collection", async () => {
  const byHead = await table({ expr: "Permutations(4)", columns: "Automatic" });
  const byCarrier = await table({ expr: "Permutations(4)", carrier: "Permutation", columns: "Automatic" });
  expect(headers(byCarrier)).toEqual(headers(byHead));
  byHead.remove();
  byCarrier.remove();
});

test("a collection with no carrier statistics gets no columns", async () => {
  const el = await table({ expr: "NonNegativeIntegers", columns: "Automatic" });
  expect(headers(el)).toEqual(["element"]);
  el.remove();
});

test("an explicit statistics property wins", async () => {
  const el = await table({ expr: "Permutations(4)", columns: "Automatic", statistics: ["Peaks"] });
  expect(headers(el)).toEqual(["element", "Peaks"]);
  el.remove();
});
