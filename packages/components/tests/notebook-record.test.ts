import { expect, test } from "vite-plus/test";
import { isSeed, notebookKey, openingCells } from "../src/notebook-record.ts";

test("a notebook is keyed by its page and its id, or its place on the page", () => {
  expect(notebookKey("/docs/guide/", "sums", 2)).toBe("/docs/guide/#sums");
  expect(notebookKey("/docs/guide/", "", 2)).toBe("/docs/guide/#notebook-2");
});

test("a notebook opens with the reader's cells, and the seed's without them", () => {
  const seeded = ["a := 5", "a + 1"];
  expect(openingCells(undefined, seeded)).toEqual([
    { id: 1, value: "a := 5" },
    { id: 2, value: "a + 1" },
  ]);
  const record = { key: "k", seed: "", cells: [{ id: 7, value: "a := 6" }] };
  expect(openingCells(record, seeded)).toEqual([{ id: 7, value: "a := 6" }]);
  // An author's changed seed doesn't replace what the reader has: Reset does.
  expect(openingCells({ ...record, seed: '["b := 1"]' }, ["b := 1"])).toEqual([{ id: 7, value: "a := 6" }]);
});

test("cells match the seed whatever their ids, with or without the trailing blank", () => {
  const seeded = ["a := 5", "a + 1"];
  const cells = [
    { id: 4, value: "a := 5" },
    { id: 9, value: "a + 1" },
  ];
  expect(isSeed(cells, seeded)).toBe(true);
  expect(isSeed([...cells, { id: 10, value: "" }], seeded)).toBe(true);
  expect(isSeed([...cells, { id: 10, value: "a" }], seeded)).toBe(false);
  expect(isSeed([{ id: 4, value: "a := 6" }, cells[1]!], seeded)).toBe(false);
});
