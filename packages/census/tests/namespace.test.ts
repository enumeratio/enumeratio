// What our libraries are allowed to put in the global namespace.
//
// Declaring a library should add HEADS and nothing else. It is easy to add more by
// accident: `ce.box(["Add", "x", "y"])` — the way a wrapper captures a built-in's native
// definition before replacing it — DECLARES `x` and `y`, and they stay bound for the rest
// of the session. Three libraries did that, so `x`, `y` and `q` were global symbols a user
// could collide with. Probes now box inside a pushed scope; this is the net.

import { expect, test } from "vite-plus/test";
import { declaredNames } from "../src/engine.ts";

// Types are a namespace of their own, disjoint from symbols: their snake_case names
// (`permutation`, `hecke_algebra`) follow compute-engine's type convention and stay. Every
// `declareType` of ours passes `mint: false`, because compute-engine's default also binds a
// value-level constructor under the type's name, and that binding is a symbol a user's
// variable of the same name would collide with. A lowercase name here is a leak.

const added = declaredNames();

test("declaring our libraries adds capitalised heads and no types", () => {
  expect(added.filter((name) => !/^[A-Z]/.test(name))).toEqual([]);
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
