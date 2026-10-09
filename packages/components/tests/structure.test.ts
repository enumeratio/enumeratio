// What a body's loose text is: prose, unless it is a `$…$` island. Node has no DOM, so this holds
// the line `adoptStructure` draws (`proseRuns`); the pages check the rest.

import { expect, test } from "vite-plus/test";
import { DRAWING_SYMBOLS } from "@enumeratio/frontend";
import { proseRuns } from "../src/structure.ts";

test("prose between controls stays prose", () => {
  expect(proseRuns("\n  Choose a value:\n")).toEqual([{ island: false, text: "\n  Choose a value:\n" }]);
  expect(proseRuns(" so ")).toEqual([{ island: false, text: " so " }]);
});

test("an inline expression island is an expression", () => {
  expect(proseRuns("so $_k^2$ is its square.")).toEqual([
    { island: false, text: "so " },
    { island: true, text: "$_k^2$" },
    { island: false, text: " is its square." },
  ]);
});

test("whitespace-only text is ignored", () => {
  expect(proseRuns(" \n\t ")).toEqual([]);
  expect(proseRuns("")).toEqual([]);
});

test("dollar signs in prose are not islands", () => {
  expect(proseRuns("costs $5 and $10")).toEqual([{ island: false, text: "costs $5 and $10" }]);
  expect(proseRuns("a $ b $")).toEqual([{ island: false, text: "a $ b $" }]);
});

test("an escaped dollar sign is not an island delimiter", () => {
  expect(proseRuns("\\$x\\$")).toEqual([{ island: false, text: "\\$x\\$" }]);
});

test("an island is found beside dollar signs in prose", () => {
  expect(proseRuns("$x^2$")).toEqual([{ island: true, text: "$x^2$" }]);
  expect(proseRuns("costs $5, so $x^2$ more")).toEqual([
    { island: false, text: "costs $5, so " },
    { island: true, text: "$x^2$" },
    { island: false, text: " more" },
  ]);
});

test("only the heads whose body is prose are marked prose; layouts keep atoms as leaves", () => {
  const prose = DRAWING_SYMBOLS.filter((s) => s.prose).map((s) => s.head);
  expect(prose.toSorted()).toEqual(["DynamicModule", "Manipulate", "Notebook"]);
  for (const head of ["Row", "Column", "Grid", "Labeled"]) {
    expect(DRAWING_SYMBOLS.find((s) => s.head === head)?.prose).toBeUndefined();
  }
});
