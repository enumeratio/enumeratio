// Collect the provenance data the library ships, and rewrite `src/provenance-data.ts`
// (gitignored; the package's `build` runs this).
//
// The classification logic lives in `provenance.ts` next door; this is the runner. Nothing
// here is exported by the package — the package exports the DATA, and a test re-derives it
// to make sure the built copy ran against these records.
//
// Everything collected here is offline: two compute-engine instances, plus a reflection of
// the head map in `@enumeratio/wolfram`. No external kernel, so it can run in CI. The one
// column a kernel answers, `elsewhere`, is the committed `coverage-data.ts`
// (collect-coverage.ts), folded in here.
//
//   vp node packages/reference/scripts/collect-provenance.ts

import { ComputeEngine } from "@cortex-js/compute-engine";
import { writeFormatted } from "@enumeratio/entry/node";
import { HEADS } from "@enumeratio/wolfram";
import { referenceEntries } from "../src/node.ts";
import { declaredEngine } from "./engines.ts";
import { coverage } from "../src/coverage-data.ts";
import { collect, renderProvenance } from "./provenance.ts";

const entries = referenceEntries();

const records = collect(new ComputeEngine(), declaredEngine(), entries, HEADS, coverage);

await writeFormatted(new URL("../src/provenance-data.ts", import.meta.url), renderProvenance(records));

const counts = new Map<string, number>();
for (const record of records) {
  counts.set(record.provenance, (counts.get(record.provenance) ?? 0) + 1);
}
const mapped = records.filter((record) => record.elsewhere.length > 0).length;
process.stdout.write(
  `${records.length} heads — ${[...counts].map(([kind, n]) => `${kind} ${n}`).join(", ")}; ${mapped} known elsewhere\n`,
);
