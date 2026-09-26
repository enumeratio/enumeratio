// Move `to-wolfram.ts`'s `HEADS` (compute-engine head -> Wolfram spelling) onto each head's
// <Head>.yaml `names:` map -- symbol-metadata step 4 (design/speculative/symbol-metadata.md,
// lanes/handoff-M.md item 2.4).
//
//   vp node packages/reference/scripts/migrate/wolfram-heads-to-yaml.ts [--write]
//
// Without --write, only reports what would change. `HEADS` is left alone here -- a follow-up
// commit deletes it once `to-wolfram.ts` reads the generated table instead (this script stays
// under scripts/migrate/ until the last symbol-metadata step, per M's plan).
//
// An identity entry (`Refine: "Refine"`) carries no useful `names.wolfram` string -- the field
// exists to record a DIFFERENT spelling -- so it is marked `names.wolframIdentity: true`
// instead. Losing that fact would silently break `isWolframHead`: a head with neither field
// set is not vouched for at all, which is right for a head that merely falls through to
// Wolfram by coincidence of name, but wrong for one of these ~480 the transpiler deliberately
// lists. See design/speculative/symbol-metadata.md step 4 and to-wolfram.ts's own comment on
// `HEADS` ("identity entries are listed on purpose").
//
// Idempotent: a name already agreeing with HEADS is not rewritten.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReferenceEntry, ReferenceNames } from "@enumeratio/entry";
import { readEntry, writeEntry } from "@enumeratio/entry/node";
import { GRAPHICS_HEADS } from "../../../formats/src/graphics.ts";
import { HEADS } from "../../../wolfram/src/to-wolfram.ts";
import { engineSymbols } from "../../src/engine-symbols-data.ts";
import { canonicalHeads, loadReferenceData, PACKAGES } from "../../src/node.ts";

const write = process.argv.includes("--write");

const { heads } = loadReferenceData(PACKAGES);
// Same reasoning as curated-to-yaml.ts: land on the canonical copy, or the write is invisible
// to `referenceData()` and everything that reads through it.
const byName = canonicalHeads(heads);
const engineByName = new Map(engineSymbols.map((s) => [s.name, s]));
const graphicsHeads = new Set(GRAPHICS_HEADS);

const entriesDir = fileURLToPath(new URL("../../entries/", import.meta.url));

function namesFor(name: string, wolframName: string): ReferenceNames {
  return wolframName === name ? { wolframIdentity: true } : { wolfram: wolframName };
}

let updated = 0;
let created = 0;
const skippedIdentical: string[] = [];

for (const name of Object.keys(HEADS).sort()) {
  const wolframName = HEADS[name];
  const names = namesFor(name, wolframName);

  const existing = byName.get(name);
  if (existing) {
    const dir = dirname(existing.entryPath);
    const entry = readEntry(dir, name);
    if (entry.names?.wolfram === names.wolfram && entry.names?.wolframIdentity === names.wolframIdentity) {
      skippedIdentical.push(name);
      continue;
    }
    const merged: ReferenceEntry = { ...entry, names: { ...entry.names, ...names } };
    if (write) await writeEntry(dir, merged);
    updated++;
    continue;
  }

  // No entry anywhere: a metadata-only record (design doc "Records for heads we don't
  // document"). A bare engine symbol gets its own description; one of notatio's graphics/
  // control heads (held inert, no evaluate -- @enumeratio/formats/src/graphics.ts) gets a
  // short generic summary naming that; anything else (genuinely rare -- HEADS's remaining
  // record-less names are one or the other) falls back to a plain "Wolfram's own" sentence.
  const symbol = engineByName.get(name);
  const isGraphics = graphicsHeads.has(name);
  const summary = symbol?.description
    ? symbol.description
    : isGraphics
      ? `Wolfram's own ${wolframName}, held inert -- the expression is what a worksheet or REPL draws, not something this library computes (see @enumeratio/formats/src/graphics.ts).`
      : `Wolfram's own ${wolframName}, mapped through for the transpiler and the oracle but not yet written up here.`;

  const entry: ReferenceEntry = {
    name,
    domain: symbol ? "Compute engine" : isGraphics ? "Graphics" : "Wolfram",
    signature: symbol ? (symbol.kind === "operator" ? `${name}${symbol.signature ?? ""}` : name) : `${name}(...)`,
    summary,
    examples: [],
    ...(symbol?.signature
      ? {
          signatures: [
            {
              call: symbol.kind === "operator" ? `${name}${symbol.signature}` : `${name}: ${symbol.signature}`,
              description:
                symbol.kind === "operator"
                  ? "as compute-engine declares it"
                  : "a constant, as compute-engine declares it",
            },
          ],
        }
      : {}),
    names,
    stub: symbol ? "engine" : "carrier",
  };
  if (write) await writeEntry(entriesDir, entry);
  created++;
}

console.log(
  `${updated} existing records updated, ${created} metadata-only records created, ` +
    `${skippedIdentical.length} already current` +
    `${write ? "" : " (dry run; pass --write)"}`,
);
