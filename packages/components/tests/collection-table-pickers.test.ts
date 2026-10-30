// @vitest-environment happy-dom
// The collection table's pickers, scripted the way a reader uses them: the statistic menu, the
// size stepper, the free-text column editor, and the `Automatic` / `Size` options a notebook
// writes. What the chrome draws and the columns and collection that result are golden data
// (`UPDATE_COLLECTION_PICKERS=1 vp test` regenerates it).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import type { NotatioCollectionTable } from "../src/notatio-collection-table.ts";

const GOLDEN = join(import.meta.dirname, "collection-table-pickers.golden.json");
const updating = process.env.UPDATE_COLLECTION_PICKERS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

const STATISTICS = ["Descents", "Excedances", "Inversions", "MajorIndex", "Peaks", "Valleys"];

beforeAll(async () => {
  await import("../src/notatio-collection-table.ts");
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

function check(id: string, actual: unknown): void {
  if (updating) fresh[id] = actual;
  else expect(actual).toEqual(golden[id]);
}

async function table(props: Partial<Record<keyof NotatioCollectionTable, unknown>>): Promise<NotatioCollectionTable> {
  const el = document.createElement("notatio-collection-table") as NotatioCollectionTable;
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const inputs = (el: Element, selector: string): HTMLInputElement[] => [
  ...el.querySelectorAll<HTMLInputElement>(selector),
];

/** What the chrome offers and what the table is told to show. */
function drawn(el: NotatioCollectionTable): unknown {
  const view = el.querySelector("table-view-box")!;
  const source = JSON.parse(view.getAttribute("source") ?? "null") as unknown[];
  const stepper = el.querySelector<HTMLInputElement>(".nct-size");
  return {
    title: el.querySelector(".nct-title")?.textContent,
    menu: inputs(el, ".nct-menu input[type=checkbox]").map((box) => ({
      name: box.parentElement?.textContent,
      checked: box.checked,
    })),
    stepper:
      stepper === null
        ? null
        : { min: stepper.getAttribute("min"), max: stepper.getAttribute("max"), value: stepper.value },
    columns: el.columns,
    headers: JSON.parse(view.getAttribute("headers") ?? "[]") as string[],
    collection: JSON.stringify(source[1]),
  };
}

async function toggle(el: NotatioCollectionTable, name: string, on: boolean): Promise<void> {
  const box = inputs(el, ".nct-menu input[type=checkbox]").find((b) => b.parentElement?.textContent === name)!;
  box.checked = on;
  box.dispatchEvent(new Event("change"));
  await el.updateComplete;
}

async function step(el: NotatioCollectionTable, value: string): Promise<void> {
  const stepper = el.querySelector<HTMLInputElement>(".nct-size")!;
  stepper.value = value;
  stepper.dispatchEvent(new Event("change"));
  await el.updateComplete;
}

test("a derived table: the menu adds and removes columns, the stepper moves the size", async () => {
  const el = await table({
    expr: "Derangements(4)",
    template: "Derangements({size})",
    size: 4,
    sizeMin: 1,
    sizeMax: 6,
    columns: "Descents, Inversions",
    statistics: STATISTICS,
  });
  const steps: Record<string, unknown> = { opened: drawn(el) };
  await toggle(el, "Excedances", true);
  steps.added = drawn(el);
  await toggle(el, "Descents", false);
  steps.removed = drawn(el);
  await step(el, "5");
  steps.stepped = drawn(el);
  await step(el, "99");
  steps.clamped = drawn(el);
  await step(el, "0");
  steps.floored = drawn(el);
  check("derived", steps);
  el.remove();
});

test("the free-text editor and the menu agree", async () => {
  const el = await table({ expr: "Derangements(4)", columns: "Descents", statistics: STATISTICS });
  const add = el.querySelector<HTMLInputElement>(".nct-add")!;
  const type = async (text: string): Promise<void> => {
    add.value = text;
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await el.updateComplete;
  };
  const steps: Record<string, unknown> = { opened: drawn(el) };
  await type("Peaks");
  steps.typedAStatistic = drawn(el);
  await type("Max(_) - Min(_)");
  steps.typedAnExpression = drawn(el);
  await toggle(el, "Peaks", false);
  steps.uncheckedIt = drawn(el);
  check("round-trip", steps);
  el.remove();
});

test("an explicit collection stays fixed: no stepper", async () => {
  const el = await table({ expr: "SymmetricGroup(5)", columns: "Descents", statistics: STATISTICS });
  expect(el.querySelector(".nct-size")).toBeNull();
  const typed = el.querySelector<HTMLInputElement>(".nct-expr")!;
  check("explicit", drawn(el));
  typed.value = "Subsets(3)";
  typed.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  await el.updateComplete;
  expect(el.querySelector(".nct-size")).toBeNull();
  el.remove();
});

test("retyping the collection of a derived table drops its stepper", async () => {
  const el = await table({ expr: "Derangements(4)", template: "Derangements({size})", size: 4 });
  expect(el.querySelector(".nct-size")).not.toBeNull();
  const typed = el.querySelector<HTMLInputElement>(".nct-expr")!;
  typed.value = "Subsets(3)";
  typed.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
  await el.updateComplete;
  expect(el.querySelector(".nct-size")).toBeNull();
  expect(drawn(el)).toMatchObject({ title: "Subsets(3)" });
  el.remove();
});

test("what a notebook's options say: Columns, Glyph and Size", async () => {
  const automatic = await table({
    expr: "Permutations(3)",
    columns: "Automatic",
    glyph: "Automatic",
    size: 5,
    statistics: STATISTICS,
  });
  const steps: Record<string, unknown> = { options: drawn(automatic) };
  await toggle(automatic, "Inversions", false);
  steps.afterEditing = drawn(automatic);
  automatic.remove();
  const unknown = await table({ expr: "NonNegativeIntegers", glyph: "Automatic", size: 3 });
  steps.notSteppable = drawn(unknown);
  unknown.remove();
  check("options", steps);
});
