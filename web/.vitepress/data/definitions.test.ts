// Every statistic and Epsil family shows a definition on its page, and what the page prints is
// Epsil you can type back: it reads as the very expression the implementation runs.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { ALL_STATISTICS } from "@enumeratio/combinatorics";
import { allFamilies } from "@enumeratio/combinatorics/collections";
import { parseExpression } from "@enumeratio/formats";
import { expect, test } from "vite-plus/test";
import { applied, definitionsOf, isEpsilFamily } from "./definitions.ts";

const ce = new ComputeEngine();
// Definitions are full Epsil, so the statement heads (`If`, `Function`, …) are allowed.
const allow = ["Assign", "Block", "Declare", "Do", "Function", "If", "Loop", "Which", "While"];
const canonical = (json: unknown): unknown => ce.box(json as Parameters<ComputeEngine["box"]>[0]).json;

test("every statistic prints a non-empty definition that reads back as its expression", () => {
  for (const { head, on, expr } of ALL_STATISTICS) {
    const shown = definitionsOf(head).find((d) => d.label.startsWith(`on ${on},`));
    expect(shown?.source.length, `${head} on ${on}`).toBeGreaterThan(0);
    const { json, errors } = parseExpression(shown!.source, { ce, allow });
    expect(errors, `${head} on ${on}: ${shown!.source}`).toEqual([]);
    expect(canonical(json), `${head} on ${on}`).toEqual(canonical(applied(expr)));
  }
}, 30_000); // grows with the statistic count

test("every Epsil family prints each of its definitions", () => {
  for (const family of allFamilies.filter(isEpsilFamily)) {
    const defined = Object.values(family.epsil).filter((e) => e !== undefined).length;
    const shown = definitionsOf(family.head).filter((d) => /^(count|unrank|rank|valid|tables)\(/.test(d.label));
    expect(shown.length, family.head).toBeGreaterThanOrEqual(defined);
    for (const { source } of shown) {
      expect(source.length, family.head).toBeGreaterThan(0);
      expect(parseExpression(source, { ce, allow }).errors, `${family.head}: ${source}`).toEqual([]);
    }
  }
});
