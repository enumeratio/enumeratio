// Move `@enumeratio/oracle`'s `MAPPINGS` onto each head's <Head>.yaml `bindings:` list --
// symbol-metadata step 5 (design/speculative/symbol-metadata.md, lanes/handoff-M.md item 2.5).
//
//   vp node packages/reference/scripts/migrate/mappings-to-yaml.ts [--write]
//
// Without --write, only reports what would change. `MAPPINGS` is left alone here -- a
// follow-up commit deletes it once the oracle emitters read the generated table instead (this
// script stays under scripts/migrate/ until the last symbol-metadata step, per M's plan).
//
// One `Mapping` row (a head, an optional arity, and a `Partial<Record<System, string>>` of
// per-system templates) becomes one `bindings:` row PER SYSTEM in `emit` -- `origin: mapped`,
// `form: <system>`, `template: <that system's emit string>` -- carrying the row's `arity`,
// `threadArg` and `note` onto every one of its systems' rows. A head with two `MAPPINGS` rows
// (Zeta: arity 1 vouches for Riemann, arity 2 for Hurwitz) keeps both groups distinguishable
// by `arity` alone -- `mappingFor` already prefers the arity-specific row over an arity-less
// one, and a binding's `arity` is exactly that same disambiguator.
//
// Idempotent: a (origin, form, arity, template) row already present is not duplicated.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReferenceBinding, ReferenceEntry } from "@enumeratio/entry";
import { readEntry, writeEntry } from "@enumeratio/entry/node";
import { MAPPINGS } from "../../../oracle/src/mappings.ts";
import { SYSTEMS } from "../../../oracle/src/systems.ts";
import { engineSymbols } from "../../src/engine-symbols-data.ts";
import { canonicalHeads, loadReferenceData, PACKAGES } from "../../src/node.ts";

const write = process.argv.includes("--write");

const { heads } = loadReferenceData(PACKAGES);
// Same reasoning as curated-to-yaml.ts / wolfram-heads-to-yaml.ts: the oracle's own consumers
// (oracle-scan.ts, emit.ts by way of the reference site) read through `referenceData()`, which
// resolves a shared head to its CANONICAL copy -- write there or the row is invisible to them.
const byName = canonicalHeads(heads);
const engineByName = new Map(engineSymbols.map((s) => [s.name, s]));

const entriesDir = fileURLToPath(new URL("../../entries/", import.meta.url));

// Fixed order so regeneration is deterministic regardless of a row's own key order.
const SYSTEM_ORDER = SYSTEMS.map((s) => s.name);

function bindingsFor(mapping: (typeof MAPPINGS)[number]): ReferenceBinding[] {
  const systems = Object.keys(mapping.emit).sort(
    (a, b) => SYSTEM_ORDER.indexOf(a as never) - SYSTEM_ORDER.indexOf(b as never),
  );
  return systems.map((system) => ({
    origin: "mapped",
    form: system,
    template: mapping.emit[system as keyof typeof mapping.emit]!,
    ...(mapping.arity !== undefined ? { arity: mapping.arity } : {}),
    ...(mapping.threadArg !== undefined ? { threadArg: mapping.threadArg } : {}),
    ...(mapping.note !== undefined ? { note: mapping.note } : {}),
  }));
}

const bindingKey = (b: ReferenceBinding): string => `${b.origin} ${b.form} ${b.arity ?? ""} ${b.template ?? ""}`;

function mergedBindings(
  existing: readonly ReferenceBinding[] | undefined,
  added: readonly ReferenceBinding[],
): ReferenceBinding[] {
  const seen = new Set((existing ?? []).map(bindingKey));
  const extra = added.filter((b) => !seen.has(bindingKey(b)));
  return [...(existing ?? []), ...extra];
}

// Grouped by head, in MAPPINGS' own row order (a head's several rows -- different arities --
// contribute their bindings in that same order).
const byHead = new Map<string, ReferenceBinding[]>();
for (const mapping of MAPPINGS) {
  const rows = byHead.get(mapping.head) ?? [];
  rows.push(...bindingsFor(mapping));
  byHead.set(mapping.head, rows);
}

let updated = 0;
let created = 0;

for (const name of [...byHead.keys()].sort()) {
  const added = byHead.get(name)!;

  const existing = byName.get(name);
  if (existing) {
    const dir = dirname(existing.entryPath);
    const entry = readEntry(dir, name);
    const merged = mergedBindings(entry.bindings, added);
    if (merged.length === (entry.bindings?.length ?? 0)) continue; // already there
    if (write) await writeEntry(dir, { ...entry, bindings: merged });
    updated++;
    continue;
  }

  // No entry anywhere: a metadata-only record, same story as curated-to-yaml.ts /
  // wolfram-heads-to-yaml.ts -- a bare engine symbol's own description where one exists,
  // else a short generic summary naming the systems it maps to.
  const symbol = engineByName.get(name);
  const systems = [...new Set(added.map((b) => b.form))].sort(
    (a, b) => SYSTEM_ORDER.indexOf(a as never) - SYSTEM_ORDER.indexOf(b as never),
  );
  const summary =
    symbol?.description ?? `Mapped through to ${systems.join(", ")} for the oracle; not yet written up here.`;

  const entry: ReferenceEntry = {
    name,
    domain: symbol ? "Compute engine" : "Oracle",
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
    bindings: added,
    stub: symbol ? "engine" : "carrier",
  };
  if (write) await writeEntry(entriesDir, entry);
  created++;
}

console.log(
  `${updated} existing records updated, ${created} metadata-only records created` +
    `${write ? "" : " (dry run; pass --write)"}`,
);
