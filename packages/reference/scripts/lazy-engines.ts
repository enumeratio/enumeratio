// A `setup` module for `@enumeratio/evaluation/node` that declares only the packages its URL
// names (`lazy-engines.ts?packages=analytic,boxes`), and what they require, in the order
// LIBRARIES lists them: the resolver's engine, for checking it means what the full one does.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { plan } from "@enumeratio/manifest";
import { EXTRAS, LIBRARIES } from "./engines.ts";

export function configure(ce: ComputeEngine): void {
  const asked = new URL(import.meta.url).searchParams.get("packages") ?? "";
  const declared = new Set<string>();
  for (const library of plan(asked.split(",").filter(Boolean), LIBRARIES).libraries) {
    void library.declare(ce);
    declared.add(library.name);
  }
  // The host's own libraries (Restricted, Compose, Histogram) come with whatever they build on;
  // no package names them, so the resolver can't bring them.
  for (const extra of EXTRAS) {
    if (!(extra.requires ?? []).every((name) => declared.has(name))) continue;
    void extra.declare(ce);
    declared.add(extra.name);
  }
}
