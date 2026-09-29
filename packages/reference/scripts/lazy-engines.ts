// A `setup` module for `@enumeratio/evaluation/node` that declares only the packages its URL
// names (`lazy-engines.ts?packages=analytic,boxes`), and what they require, in the order
// LIBRARIES lists them: the resolver's engine, for checking it means what the full one does.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { plan } from "@enumeratio/manifest";
import { LIBRARIES } from "./engines.ts";

export function configure(ce: ComputeEngine): void {
  const asked = new URL(import.meta.url).searchParams.get("packages") ?? "";
  for (const library of plan(asked.split(",").filter(Boolean), LIBRARIES).libraries) void library.declare(ce);
}
