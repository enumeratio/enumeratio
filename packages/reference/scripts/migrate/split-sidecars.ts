// Step 6 of design/examples-as-data.md §8, first half: the oracle sidecars become the
// implementations records, one `<Head>.implementations.yaml` beside each `<Head>.yaml`, keyed
// by example id. An example's `divergence` prose moves into its system's `note`. Kernel
// versions go to packages/oracle/kernels.json.
//
//   node packages/reference/scripts/migrate/split-sidecars.ts

import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OtherSystemRun, ReferenceEntry, SystemImplementation } from "@enumeratio/entry";
import { writeYaml } from "@enumeratio/entry/node";
import { emit } from "@enumeratio/oracle/src";
import { loadReferenceData, PACKAGES } from "../../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SIDECARS = `${ROOT}packages/reference/src/entries`;

type Rows = Record<string, Record<string, OtherSystemRun>>;
const rowsOf = new Map<string, Rows>();
const kernels: Record<string, string> = {};
for (const file of readdirSync(SIDECARS)
  .filter((f) => f.endsWith(".oracle.json"))
  .sort()) {
  const sidecar = JSON.parse(readFileSync(join(SIDECARS, file), "utf8")) as {
    kernels?: Record<string, string>;
    examples?: Record<string, Rows>;
  };
  Object.assign(kernels, sidecar.kernels);
  for (const [head, rows] of Object.entries(sidecar.examples ?? {})) {
    if (rowsOf.has(head)) throw new Error(`${head}: rows in two sidecars`);
    rowsOf.set(head, rows);
  }
}

/** The one note a row carries: the authored prose, which the page showed, else the scan's. */
const noteOf = (prose: string | undefined, note: string | undefined): string | undefined =>
  prose?.trim() || note?.trim() || undefined;

const { heads, issues } = loadReferenceData(PACKAGES);
if (issues.length > 0) throw new Error(JSON.stringify(issues));
// A head two packages document keeps its rows with the copy the site shows.
const chosen = new Map<string, (typeof heads)[number]>();
for (const h of [...heads].sort((a, b) =>
  `${a.package === "reference" ? 0 : 1}${a.entryPath}`.localeCompare(
    `${b.package === "reference" ? 0 : 1}${b.entryPath}`,
  ),
))
  if (!chosen.has(h.head)) chosen.set(h.head, h);

let records = 0;
let prosed = 0;
for (const h of heads) {
  const isChosen = chosen.get(h.head) === h;
  const rows = isChosen ? (rowsOf.get(h.head) ?? {}) : {};
  const record: Record<string, Record<string, SystemImplementation>> = {};
  const examples = h.entry.examples.map((example) => {
    const byId: Record<string, SystemImplementation> = {};
    const prose = example.divergence as Record<string, string> | undefined;
    for (const [system, run] of Object.entries(rows[example.id] ?? {})) {
      const note = noteOf(prose?.[system], run.note);
      byId[system] = {
        in: run.input,
        out: run.output,
        ...(run.shown !== undefined ? { shown: run.shown } : {}),
        ...(run.tex ? { tex: { in: run.tex.input, out: run.tex.output } } : {}),
        ...(run.verdict === "agree" ? {} : { verdict: run.verdict }),
        ...(run.kind ? { kind: run.kind } : {}),
        ...(note ? { note } : {}),
        ...(run.issue !== undefined ? { issue: run.issue } : {}),
        ...(run.tolerance !== undefined ? { tolerance: run.tolerance } : {}),
      };
    }
    // Prose with no scanned row: the row is what we'd send, and the note.
    for (const [system, note] of Object.entries(prose ?? {})) {
      if (byId[system] !== undefined) continue;
      const out = emit(example.expr as never, system as never);
      byId[system] = { in: out.ok ? out.source : "", note };
    }
    if (prose) prosed++;
    if (Object.keys(byId).length > 0) record[example.id] = byId;
    const { divergence: _moved, ...rest } = example;
    return rest;
  });
  if (examples.some((e, i) => e !== h.entry.examples[i]) || h.entry.examples.some((e) => e.divergence))
    await writeYaml(h.entryPath, { ...h.entry, examples } satisfies ReferenceEntry);
  if (Object.keys(record).length > 0) {
    await writeYaml(join(dirname(h.entryPath), `${h.head}.implementations.yaml`), record);
    records++;
  }
}

writeFileSync(
  `${ROOT}packages/oracle/kernels.json`,
  `${JSON.stringify(Object.fromEntries(Object.entries(kernels).sort()), null, 2)}\n`,
);
for (const file of readdirSync(SIDECARS)) rmSync(join(SIDECARS, file));
rmSync(SIDECARS, { recursive: true, force: true });
console.log(`${records} implementations records; ${prosed} examples' divergence prose moved into notes`);
