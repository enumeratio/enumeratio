// @vitest-environment happy-dom
// The collection table's distribution pane and the filter on its statistic menu, scripted as a
// reader uses them. The tally is a stub (the engine's own answers are `distribution.test.ts`'s).

import { beforeAll, expect, test } from "vite-plus/test";
import type { NotatioCollectionTable } from "../src/notatio-collection-table.ts";

const STATISTICS = ["Descents", "Excedances", "Inversions", "MajorIndex", "Peaks", "Valleys"];
const TALLY = ["Tuple", ["List", 0, 1, 2], ["List", 1, 4, 1]];

// Cold import of the element graph can outlast the 10 s hook default on a loaded CI runner.
beforeAll(async () => {
  await import("../src/notatio-collection-table.ts");
}, 60_000);

/** A table whose kernel is `asked`'s log; its rows report `count` once, as a kernel would. */
async function table(
  props: Partial<Record<keyof NotatioCollectionTable, unknown>>,
  asked: string[],
  count = 6n,
): Promise<NotatioCollectionTable> {
  const el = document.createElement("notatio-collection-table") as NotatioCollectionTable;
  Object.assign(el, {
    expr: "Permutations(3)",
    columns: "Descents, Inversions",
    statistics: STATISTICS,
    evaluate: async (text: string) => (asked.push(text), TALLY),
    ...props,
  });
  document.body.append(el);
  await el.updateComplete;
  el.querySelector("table-view-box")!.dispatchEvent(
    new CustomEvent("table-status", { detail: { count: { kind: "exact", n: count } } }),
  );
  await el.updateComplete;
  return el;
}

const settle = async (el: NotatioCollectionTable): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
};

const toggles = (el: Element): HTMLButtonElement[] => [...el.querySelectorAll<HTMLButtonElement>(".nct-dist-toggle")];

test("the pane is off by default; a column's toggle opens it, and again closes it", async () => {
  const asked: string[] = [];
  const el = await table({}, asked);
  expect(el.querySelector(".nct-dist")).toBeNull();
  expect(toggles(el)).toHaveLength(2);
  toggles(el)[1]!.click();
  await settle(el);
  expect(el.distribution).toBe(true);
  expect(el.querySelector(".nct-dist-head")?.textContent).toContain("Inversions");
  expect(el.querySelector(".nct-dist svg")).not.toBeNull();
  expect(el.querySelector(".nct-dist-poly")?.textContent).toBe("1 + 4q + q^2");
  expect(asked).toEqual(['Tally(CombinatorialStat(Permutations(3), "Inversions"))']);
  toggles(el)[1]!.click();
  await settle(el);
  expect(el.querySelector(".nct-dist")).toBeNull();
  el.remove();
});

test("a column's toggle and remove buttons have accessible names", async () => {
  const el = await table({}, []);
  const names = [...el.querySelectorAll("button.nct-dist-toggle")].map((b) => [
    b.getAttribute("aria-label"),
    b.getAttribute("title"),
  ]);
  expect(names).toEqual([
    ["Show distribution of Descents", "Show distribution of Descents"],
    ["Show distribution of Inversions", "Show distribution of Inversions"],
  ]);
  const removes = [...el.querySelectorAll("button")]
    .filter((b) => b.textContent?.trim() === "×")
    .map((b) => [b.getAttribute("aria-label"), b.getAttribute("title")]);
  expect(removes).toEqual([
    ["Remove column Descents", "Remove column Descents"],
    ["Remove column Inversions", "Remove column Inversions"],
  ]);
  el.remove();
});

test("`distribution` opens the pane on the first statistic column", async () => {
  const asked: string[] = [];
  const el = await table({ distribution: true }, asked);
  await settle(el);
  expect(el.querySelector(".nct-dist-head")?.textContent).toContain("Descents");
  expect(asked).toHaveLength(1);
  el.remove();
});

test("a collection past size-max declines with a reason and asks nothing", async () => {
  const asked: string[] = [];
  const el = await table({ distribution: true, template: "Permutations({size})", size: 9, sizeMax: 6 }, asked, 362880n);
  await settle(el);
  expect(el.querySelector(".nct-dist-reason")?.textContent).toBe(
    "a distribution is computed up to size 6; this is size 9",
  );
  expect(asked).toEqual([]);
  el.remove();
});

test("an expression column has no distribution to open", async () => {
  const el = await table({ distribution: true, columns: "Max(_) - Min(_)" }, []);
  await settle(el);
  expect(el.querySelector(".nct-dist-reason")?.textContent).toContain("statistic column");
  expect(toggles(el)).toHaveLength(0);
  el.remove();
});

test("the statistic menu's filter narrows the list", async () => {
  const el = await table({}, []);
  const names = (): (string | null | undefined)[] =>
    [...el.querySelectorAll(".nct-menu-list label")].map((l) => l.textContent);
  expect(names()).toHaveLength(STATISTICS.length);
  const filter = el.querySelector<HTMLInputElement>(".nct-menu-filter")!;
  filter.value = "  DESC";
  filter.dispatchEvent(new Event("input"));
  await el.updateComplete;
  expect(names()).toEqual(["Descents"]);
  filter.value = "";
  filter.dispatchEvent(new Event("input"));
  await el.updateComplete;
  expect(names()).toHaveLength(STATISTICS.length);
  el.remove();
});
