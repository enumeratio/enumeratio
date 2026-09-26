// Collect the provenance data the library ships, and rewrite `src/provenance-data.ts`.
//
// The classification logic lives in `provenance.ts` next door; this is the runner. Nothing
// here is exported by the package — the package exports the DATA, and a test re-derives it
// to make sure the committed copy has not gone stale.
//
// Everything collected here is offline: two compute-engine instances, plus a reflection of
// the head map in `@enumeratio/wolfram`. No external kernel, so it can run in CI. The
// oracle lanes that DO need a kernel (wolframscript, mpmath, sympy, sage) report separately
// and are never a gate.
//
//   vp node packages/reference/scripts/collect-provenance.ts

import { ComputeEngine } from "@cortex-js/compute-engine";
import { writeFormatted } from "@enumeratio/entry/node";
import { HEADS } from "@enumeratio/wolfram/src";
import { referenceEntries } from "../src/node.ts";
import { declaredEngine } from "./engines.ts";
import { type HeadRecord, collect, renderProvenance } from "./provenance.ts";

const entries = referenceEntries();

// Coverage answers come from an external kernel (collect-coverage.ts); this pass is
// offline, so carry whatever the last run found rather than blanking it.
let previous: readonly HeadRecord[] = [];
try {
  previous = ((await import("../src/provenance-data.ts")) as { provenance: HeadRecord[] }).provenance;
} catch {
  previous = [];
}
const records = collect(new ComputeEngine(), declaredEngine(), entries, HEADS, previous);

await writeFormatted(new URL("../src/provenance-data.ts", import.meta.url), renderProvenance(records));

const counts = new Map<string, number>();
for (const record of records) {
  counts.set(record.provenance, (counts.get(record.provenance) ?? 0) + 1);
}
const mapped = records.filter((record) => record.elsewhere.length > 0).length;
process.stdout.write(
  `${records.length} heads — ${[...counts].map(([kind, n]) => `${kind} ${n}`).join(", ")}; ${mapped} known elsewhere\n`,
);
