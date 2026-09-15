// What our libraries are allowed to put in the global namespace.
//
// Declaring a library should add HEADS and nothing else. It is easy to add more by
// accident: `ce.box(["Add", "x", "y"])` — the way a wrapper captures a built-in's native
// definition before replacing it — DECLARES `x` and `y`, and they stay bound for the rest
// of the session. Three libraries did that, so `x`, `y` and `q` were global symbols a user
// could collide with. Probes now box inside a pushed scope; this is the net.

import { DOMAINS } from "@enumeratio/domains/src";
import { expect, test } from "vite-plus/test";
import { declaredNames } from "../src/engine.ts";

/** Free symbols we declare on purpose, with the reason. */
const DELIBERATE: Record<string, string> = {
  q: "the Hecke deformation parameter — every coefficient is a polynomial in it",
};

/** The carrier TYPES. compute-engine keeps types and symbols in one table, and the engine's
 *  own convention spells a type lowercase (`integer`, `indexed_collection`), so these are
 *  the one legitimate class of lowercase name — see domains/src/types.ts. */
const CARRIER_TYPES = new Set(DOMAINS.map((domain) => domain.type));

const added = declaredNames();

test("declaring our libraries adds heads, not stray symbols", () => {
  const stray = added
    .filter((name) => !/^[A-Z]/.test(name))
    .filter((name) => DELIBERATE[name] === undefined && !CARRIER_TYPES.has(name));
  expect(stray).toEqual([]);
});

test("the census sees every library, not just the first few", () => {
  // Guards the guard: a bindings() that silently returned nothing would pass the test above,
  // and so would an engine that failed to declare half of what it was given.
  expect(added.length).toBeGreaterThan(400);
  expect(added).toContain("TorusKnot"); // braid
  expect(added).toContain("DyckPaths"); // collections
  expect(added).toContain("MajorIndex"); // statistics
  expect(added).toContain("Resource"); // catalog
});
