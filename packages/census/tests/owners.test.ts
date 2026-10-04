// Heads are declared once, and packages contribute signatures to them
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos §2.3): the rule
// that has to hold once the packages are repos of their own, where nothing can say "declare me
// last". See src/owners.ts.

import { recordsRoot, referenceData } from "@enumeratio/reference/node";
import { expect, test } from "vite-plus/test";
import { ENGINE } from "../src/contributions.ts";
import { fullEngine } from "../src/engine.ts";
import { contributionsBelowTheirDeclarer, declarations, duplicateRows } from "../src/owners.ts";

const declared = declarations();
// Loaded once at collection, like `declared`: reading every record is the slow part.
const heads = referenceData(recordsRoot(import.meta.dirname)).heads;

/** Heads a package still redeclares, with the reason. The list only shrinks. */
const REDECLARED: Record<string, Record<string, string>> = {};

test("no package redeclares a head that is already declared", () => {
  const stray: string[] = [];
  for (const [head, { redeclaredBy }] of declared)
    for (const pkg of redeclaredBy)
      if (REDECLARED[head]?.[pkg] === undefined) stray.push(`${head}: ${pkg} redeclares it`);
  expect(stray).toEqual([]);
});

test("no two packages contribute the same signature to a head", () => {
  expect(duplicateRows()).toEqual([]);
});

test("a package contributes only to heads declared at or below it in the hierarchy", () => {
  expect(contributionsBelowTheirDeclarer()).toEqual([]);
});

test("no two records of one head document the same signature", () => {
  const rows = new Map<string, string>();
  const twice: string[] = [];
  for (const { head, package: pkg, entry } of heads)
    for (const row of entry.signatures ?? []) {
      // The engine's own row is each record's way of saying where the head comes from.
      if (row.library === undefined || row.library.endsWith("compute-engine")) continue;
      const conditions = JSON.stringify([row.on, row.symbols, row.types]);
      for (const key of [
        `${row.library}|${row.call}|${conditions}`,
        row.type && `${row.library}|${row.type}|${conditions}`,
      ]) {
        if (!key) continue;
        const where = rows.get(`${head}|${key}`);
        if (where !== undefined && where !== pkg) twice.push(`${head}: ${where} and ${pkg} both document ${key}`);
        else rows.set(`${head}|${key}`, pkg);
      }
    }
  expect(twice).toEqual([]);
});

test("an exception leaves the list once it no longer applies", () => {
  const stale: string[] = [];
  for (const [head, byPackage] of Object.entries(REDECLARED))
    for (const pkg of Object.keys(byPackage))
      if (!declared.get(head)?.redeclaredBy.includes(pkg)) stale.push(`${head}: ${pkg}`);
  expect(stale).toEqual([]);
});

test("the check is looking at something", () => {
  expect(declared.size).toBeGreaterThan(1000);
  expect(declared.get("Add")).toMatchObject({ declarer: ENGINE, redeclaredBy: [] });
  expect(declared.get("IntegerDigits")).toMatchObject({ declarer: ENGINE, redeclaredBy: [] });
  expect(declared.get("Cycles")).toMatchObject({ declarer: "groupalgebra", contributors: ["combinatorics"] });
});

test("compute-engine's `Primes` is still its constant set: our indexed collection is `PrimeNumbers`", () => {
  const ce = fullEngine();
  expect(declared.get("Primes")?.redeclaredBy ?? []).toEqual([]);
  expect(ce.box("Primes").type.toString()).toBe("set<integer>");
  expect(ce.box("PrimeNumbers").type.toString()).toBe("indexed_collection<integer>");
});

test("no two records' heads differ only by case, which a case-insensitive filesystem can't hold", () => {
  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const { head } of heads) {
    const other = seen.get(head.toLowerCase());
    if (other !== undefined && other !== head) clashes.push(`${other} and ${head}`);
    else seen.set(head.toLowerCase(), head);
  }
  expect(clashes).toEqual([]);
});
