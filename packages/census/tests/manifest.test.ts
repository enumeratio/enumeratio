import { SYMBOLS } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { contributions, ENGINE } from "../src/contributions.ts";
import { fullEngine } from "../src/engine.ts";

// Nothing widens a head in code alone (https://github.com/enumeratio/enumeratio/wiki/Manifest): whatever a package does to a
// head -- adds it, re-signs it, replaces its handler -- the head's record says so, with the
// type the engine ends up printing. The manifest is built from the records, so it knows
// every head's every overload before any code is loaded.

const found = contributions();
const ce = fullEngine();

/** A record's type as the engine prints it, so a hand-written spelling compares fairly. */
const printed = (type: string): string => {
  try {
    return ce.type(type).toString();
  } catch {
    return type;
  }
};

const libraryPackage = (library: string | undefined): string | undefined =>
  library?.replace(/^@enumeratio\//, "").replace(/^enumeratio-/, "");

test("every head a package adds, re-signs or takes over has a typed row for that package", () => {
  const missing: string[] = [];
  const wrong: string[] = [];
  for (const [head, list] of found) {
    for (const c of list) {
      const overload = SYMBOLS[head]?.overloads.find((o) => o.package === c.pkg);
      if (overload?.type === undefined) missing.push(`${head} (${c.pkg})`);
      else if (printed(overload.type) !== c.type)
        wrong.push(`${head} (${c.pkg}): record ${overload.type}, engine ${c.type}`);
    }
  }
  expect(missing).toEqual([]);
  expect(wrong).toEqual([]);
});

test("a row overrides whoever had the head before its package", () => {
  const wrong: string[] = [];
  for (const [head, list] of found) {
    for (const c of list) {
      const overload = SYMBOLS[head]?.overloads.find((o) => o.package === c.pkg);
      if (overload !== undefined && libraryPackage(overload.overrides) !== c.previous)
        wrong.push(
          `${head} (${c.pkg}): overrides ${overload.overrides ?? "nothing"}, before it ${c.previous ?? "nothing"}`,
        );
    }
  }
  expect(wrong).toEqual([]);
});

test("HoldAll on a record is the engine's lazy, for every head a package touches", () => {
  const wrong: string[] = [];
  for (const [head, list] of found) {
    const lazy = list[list.length - 1].lazy;
    if ((SYMBOLS[head]?.attributes?.includes("HoldAll") ?? false) !== lazy) wrong.push(`${head}: lazy ${lazy}`);
  }
  expect(wrong).toEqual([]);
});

test("the check is looking at something", () => {
  expect(found.size).toBeGreaterThan(1000);
  expect(found.get("Fibonacci")?.map((c) => [c.pkg, c.previous])).toEqual([
    ["adeles", ENGINE],
    ["number-theory", "adeles"],
  ]);
});
