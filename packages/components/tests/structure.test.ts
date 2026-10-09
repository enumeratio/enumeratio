// What a body's loose text is: prose, unless it is a `$…$` island. Node has no DOM, so this holds
// the line `adoptStructure` draws (`proseRuns`); the pages check the rest.

import { expect, test } from "vite-plus/test";
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
