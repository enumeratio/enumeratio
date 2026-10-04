// Heads are declared once, and packages contribute signatures to them
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos §2.3): the rule
// that has to hold once the packages are repos of their own, where nothing can say "declare me
// last". See src/owners.ts.

import { recordsRoot, referenceData } from "@enumeratio/reference/node";
import { expect, test } from "vite-plus/test";
import { ENGINE } from "../src/contributions.ts";
import { declarations, duplicateRows } from "../src/owners.ts";

const declared = declarations();

/** Heads a package still redeclares, with the reason. The list only shrinks. */
const REDECLARED: Record<string, Record<string, string>> = {
  Primes: {
    combinatorics:
      "the engine's `Primes` is a constant of type set<integer>; ours is an indexed collection of the same name. A value can't be extended, so it shadows the engine's, and the two want one name or two",
  },
};

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

test("no two records of one head document the same signature", () => {
  const rows = new Map<string, string>();
  const twice: string[] = [];
  for (const { head, package: pkg, entry } of referenceData(recordsRoot(import.meta.dirname)).heads)
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
  expect(declared.get("Primes")?.redeclaredBy).toEqual(["combinatorics"]);
});
