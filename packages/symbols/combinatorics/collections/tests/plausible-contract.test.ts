// The Plausible contract (design/plausible.md §6): every family declares what it is — carrier,
// params, the cost of each operation, and a work bound wherever it enumerates — so the sampler
// derives everything from the declaration and keeps no lists of its own. Families not yet
// declared sit on a ratchet (plausible-undeclared.json) that only ever shrinks: after declaring,
// run this test with UPDATE_PLAUSIBLE_RATCHET=1.

import { readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { needsBigint, sampleable } from "../scripts/sampleable.ts";
import { allEntries } from "../src/families/index.ts";
import type { FamilyKernel } from "../src/families/types.ts";

const RATCHET = new URL("./plausible-undeclared.json", import.meta.url);
const listed = JSON.parse(readFileSync(RATCHET, "utf8")) as string[];
const heads = new Set(allEntries.map((f) => f.head));

// UPDATE_PLAUSIBLE_RATCHET=1 rewrites the ratchet after families declare (or when two
// branches' removals meet in a merge). It only ever removes: a listed family that now
// declares, or no longer exists. A new undeclared family still fails below.
if (process.env["UPDATE_PLAUSIBLE_RATCHET"]) {
  const still = listed.filter(
    (head) => heads.has(head) && allEntries.find((f) => f.head === head)?.declared === undefined,
  );
  writeFileSync(RATCHET, `${JSON.stringify(still.sort(), null, 2)}\n`);
}
const undeclared = new Set<string>(JSON.parse(readFileSync(RATCHET, "utf8")) as string[]);

test("the ratchet names exactly the undeclared families", () => {
  const stale = [...undeclared].filter((head) => !heads.has(head));
  expect(stale, "on the ratchet but not a family").toEqual([]);
  const declaredButListed = allEntries.filter((f) => f.declared !== undefined && undeclared.has(f.head));
  expect(
    declaredButListed.map((f) => f.head),
    "declared now — remove from plausible-undeclared.json",
  ).toEqual([]);
  const newAndUndeclared = allEntries.filter((f) => f.declared === undefined && !undeclared.has(f.head));
  expect(
    newAndUndeclared.map((f) => f.head),
    "a new family must declare itself (FamilyKernel.declared)",
  ).toEqual([]);
});

/** Cheap enough to enumerate in a unit test. */
const CHEAP = 20_000n;

const countOf = (f: FamilyKernel, p: number[]): bigint | number | undefined => {
  try {
    return f.count(p);
  } catch (error) {
    if (needsBigint(error)) return undefined;
    throw error;
  }
};

/** Params from the minimums upward along the diagonal, a few steps. */
const ladder = (f: FamilyKernel): number[][] => {
  const mins = f.declared?.params.map((p) => p.min) ?? [];
  return Array.from({ length: 6 }, (_, step) => mins.map((m) => m + step));
};

for (const family of allEntries.filter((f) => f.declared !== undefined)) {
  const declared = family.declared as NonNullable<FamilyKernel["declared"]>;

  test(`${family.head} meets the Plausible contract`, () => {
    const instance = sampleable(family);
    expect("untestable" in instance ? instance.untestable : "").toBe("");
    expect(declared.carrier).not.toBe("");

    const enumerative = Object.values(declared.cost).includes("enumerative");
    let element = false;
    for (const p of ladder(family)) {
      const count = countOf(family, p);
      if (count === undefined) continue;
      if (typeof count === "number") {
        // ∞ can't be enumerated, and an open problem must say how far it can go.
        if (count === Number.POSITIVE_INFINITY) expect(enumerative, "infinite but enumerative").toBe(false);
        // An open problem is either scanned (as far as asked) or a table with a known end.
        else
          expect(
            declared.known !== undefined || declared.cost.unrank === "scan",
            "count NaN needs `known` or a scan",
          ).toBe(true);
      } else if (enumerative) {
        const work = (declared.work as (p: number[]) => bigint)(p);
        // The bound has to cover what's enumerated; check it wherever the count is cheap.
        if (work > CHEAP) continue;
        expect(work >= count, `work(${p}) = ${work} < count ${count}`).toBe(true);
      }
      // Sage's an_element: the first element of the smallest nonempty fiber is a member and
      // round-trips.
      if (!element && (typeof count !== "bigint" || count > 0n)) {
        const first = family.unrank(p, 0n);
        expect(family.valid(first, p), `valid(unrank(${p}, 0))`).toBe(true);
        expect(family.rank(first, p)).toBe(0n);
        element = true;
      }
    }
    expect(element, "no nonempty fiber near the minimum params").toBe(true);
  });
}
