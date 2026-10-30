// @vitest-environment happy-dom
// Automatic output presentation through the elements: a cell with it on shows a collection value
// as a collection table; with it off (the default) the output is the typeset form it always was.

import { CARRIERS, declareCombinatorics } from "@enumeratio/combinatorics";
import { configureEngine } from "@enumeratio/frontend/core";
import { declareCarrierElement, declareCarrierPlurals, declareStructures } from "@enumeratio/structures";
import { beforeAll, expect, test } from "vite-plus/test";

// Cold import of the element graph can outlast the 10 s hook default on a loaded CI runner.
beforeAll(async () => {
  configureEngine((ce) => {
    declareCombinatorics(ce);
    declareCarrierPlurals(ce, CARRIERS);
    declareCarrierElement(ce, CARRIERS);
    declareStructures(ce);
  });
  await import("../src/notatio-cell.ts");
  await import("../src/notatio-notebook.ts");
}, 60_000);

/** Wait until `done()` holds; the elements fill in as the engine loads. */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !done(); i++) await new Promise((r) => setTimeout(r, 25));
  expect(done()).toBe(true);
}

async function cellOf(source: string, settled: string, attributes: Record<string, string> = {}): Promise<HTMLElement> {
  const cell = document.createElement("notatio-cell");
  cell.setAttribute("value", source);
  for (const [name, value] of Object.entries(attributes)) cell.setAttribute(name, value);
  document.body.append(cell);
  const out = (): Element | null => cell.querySelector("notatio-out");
  // The cell's Out answers more than once as its input settles, so wait for what the test is about.
  await until(() => out()?.hasAttribute("busy") === false && out()?.querySelector(settled) != null);
  await new Promise((r) => setTimeout(r, 200));
  return cell;
}

test("a collection value opens as a collection table when the cell asks", async () => {
  const cell = await cellOf("SymmetricGroup(3)", "notatio-collection-table", { "automatic-presentation": "" });
  const table = cell.querySelector("notatio-out notatio-collection-table");
  expect(table?.getAttribute("expr")).toBe("SymmetricGroup(3)");
  expect(table?.getAttribute("glyph")).toBe("Automatic");
  expect(table?.getAttribute("columns")).toBe("Automatic");
});

test("off, the same value is the typeset output it always was", async () => {
  const cell = await cellOf("SymmetricGroup(3)", ".katex");
  expect(cell.querySelector("notatio-out notatio-collection-table")).toBeNull();
  expect(cell.querySelector("notatio-out .katex")).not.toBeNull();
});

test('a cell can say "false" and stay typeset', async () => {
  const cell = await cellOf("SymmetricGroup(3)", ".katex", { "automatic-presentation": "false" });
  expect(cell.querySelector("notatio-out notatio-collection-table")).toBeNull();
});

test("a list of numbers plots when the cell asks", async () => {
  const cell = await cellOf("[1, 4, 9, 16]", "graphics-box", { "automatic-presentation": "" });
  const plot = cell.querySelector("notatio-out graphics-box");
  expect(plot).not.toBeNull();
  expect(plot?.outerHTML).toContain("[1, 4, 9, 16]");
});

test("off, a list of numbers is typeset", async () => {
  const cell = await cellOf("[1, 4, 9, 16]", ".katex");
  expect(cell.querySelector("notatio-out graphics-box")).toBeNull();
});

test("a value that is not a collection stays typeset even when asked", async () => {
  const cell = await cellOf("1 + 2", ".katex", { "automatic-presentation": "" });
  expect(cell.querySelector("notatio-out notatio-collection-table")).toBeNull();
  expect(cell.querySelector("notatio-out .katex")).not.toBeNull();
});
