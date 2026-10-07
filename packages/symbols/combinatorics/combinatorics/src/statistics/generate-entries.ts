// The generic half of an area's generated statistics entries — one per declared statistic,
// plus one per frontier signature. The definitions already carry a head, a carrier and a
// summary; what they cannot carry is a worked example, so this evaluates each definition
// against a couple of fixed inputs and pins the results.
//
// Generated rather than derived at import time because the `expected` values have to be
// committed data a test can re-derive and compare — the golden rule this repo runs on.
//
// One generator PER AREA (step 6b): each area's own `scripts/entries.ts` calls this with its
// own carrier, definitions and samples; the driver itself has no per-area data. A head with a
// hand-written record already in `reference/` (11 of them, at the permutations move) is named
// in `curatedHeads` — its curated `domain`, `signature`, `summary` and everything else
// hand-written (`signatures`, `seeAlso`, `references`, `catalog`, `statOn`) win, and this
// generator only ever merges in `details` and `examples`, the two fields it can derive from a
// `Definition` alone (see `CURATED_FIELDS`/`STANDARD_FIELDS`).

import type { ReferenceEntry, ReferenceExample } from "@enumeratio/entry";
import { headExists, readEntry } from "@enumeratio/entry/node";
import type { GeneratedEntries } from "@enumeratio/entry/node";
import { captionId, dedupeId } from "@enumeratio/entry";
import { type Engine, isNativeHead } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { readFileSync } from "node:fs";
import { findstat } from "../../findstat/src/findstat-data.ts";
import { readObject } from "../../findstat/src/objects.ts";
import { bySignature, type Definition, type FrontierEntry } from "./types.ts";

/** FindStat's statistics: each id's few smallest (object, value) rows (`collect-findstat-data.ts`). */
const FINDSTAT = (
  JSON.parse(readFileSync(new URL("../../findstat/data/statistics.json", import.meta.url), "utf8")) as {
    items: Record<string, { sample: [string, number][] }>;
  }
).items;
/** How many of FindStat's rows a head's page holds as examples. */
const FINDSTAT_ROWS = 3;

/**
 * FindStat's own values for a statistic of ours it has matched by value, as examples held to
 * them: `expected` and `known` are FindStat's, so `tests/entries.test.ts` fails when ours differs.
 * Written as `CombinatorialStat(x, "Name")`, which dispatches by carrier where a bare head is
 * typed for one.
 */
function findstatExamples(definition: Definition): ReferenceExample[] {
  const match = findstat.find((m) => m.head === definition.head && m.on === definition.on);
  const id = match?.findstat[0];
  const sample = id === undefined ? undefined : FINDSTAT[id]?.sample;
  if (sample === undefined || id === undefined) return [];
  const rows: ReferenceExample[] = [];
  for (const [object, value] of sample) {
    if (/^(\[\]|\{\})$/.test(object)) continue;
    const subject = readObject(definition.on, object);
    if (subject === undefined || rows.length === FINDSTAT_ROWS) continue;
    rows.push({
      id: `findstat-${id.toLowerCase()}-${rows.length + 1}`,
      expr: ["CombinatorialStat", subject, `'${definition.head}'`],
      expected: value,
      known: value,
      source: `FindStat ${id}`,
      caption: `FindStat's value for ${object}`,
      category: "Properties",
    });
  }
  return rows;
}

type MathJSONIn = string | number | readonly MathJSONIn[];

export interface Sample {
  readonly list: number[] | number[][];
  readonly caption: string;
}

export interface AreaEntriesOptions {
  /** What to call the subject in a signature — `Descents(p)`, not `Descents(_)`. */
  readonly subjectName: string;
  /** The human name of the carrier, as a reference `domain` reads. */
  readonly domain: string;
  /** This area's definitions (one `on: carrier` kernel's worth). */
  readonly definitions: readonly Definition[];
  /** This area's frontier signatures, if any. */
  readonly frontier?: readonly FrontierEntry[];
  /** A couple of fixed subjects to evaluate every definition at. */
  readonly samples: readonly Sample[];
  /** Declares this area's own carriers and families on a fresh engine, before its statistics —
   *  the same order `declareCombinatorics` uses in production. */
  readonly declareArea: (ce: Engine) => void;
  /**
   * Heads that already have a hand-written record at `dir` (from `@enumeratio/combinatorics`'s
   * own reference, predating this generator's move there, step 6b) — the curated `domain`,
   * `signature`, `summary` and everything else hand-written (`signatures`, `seeAlso`,
   * `references`, `catalog`, `statOn`) win; this generator only ever contributes `details` and
   * `examples` for these, MERGED into the curated record rather than replacing it (the
   * generated notes appended if the curated body lacks them, examples unioned by id).
   */
  readonly curatedHeads?: readonly string[];
  /** Where the entries already live, read-only, to merge `curatedHeads` against. Required
   *  when `curatedHeads` is non-empty. */
  readonly dir?: string;
  /**
   * Heads this area also defines but does NOT own the reference entry for — another area's
   * statistic of the same name got there first (`MajorIndex`, `Peaks`, `Valleys`: permutations
   * and lattice-paths both define them; permutations owns the entry, with a footnote). Excluded
   * from `entries` AND `owned`, so this area's generator never touches that folder; still
   * declared on `ce` (for evaluating this area's OWN examples), just not written here.
   */
  readonly omitHeads?: readonly string[];
  /**
   * The flip side of `omitHeads`: another area's definitions of a head THIS area owns
   * (`MajorIndex`, `Peaks`, `Valleys` on `DyckPath`, owned here on `Permutation`) — appended
   * as a footnote on the owning entry, same text `declareStatistics`' one-head-one-owner rule
   * always produced.
   */
  readonly shadowedBy?: readonly Definition[];
}

/** `existing`'s items, plus any of `generated`'s not already present (by exact text). */
const mergeDetails = (existing: readonly string[], generated: readonly string[]): string[] => {
  const have = new Set(existing);
  return [...existing, ...generated.filter((d) => !have.has(d))];
};

/** `existing`'s examples, plus any of `generated`'s whose id isn't already there — a union,
 *  never a replacement, so a curated example is never dropped for a generated one sharing its
 *  id (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §3: ids are stable per caption). */
const mergeExamples = (
  existing: readonly ReferenceExample[],
  generated: readonly ReferenceExample[],
): ReferenceExample[] => {
  const byId = new Map(existing.map((e) => [e.id, e] as const));
  for (const example of generated) if (!byId.has(example.id)) byId.set(example.id, example);
  return [...byId.values()];
};

/** `full`'s generated entries, split into the ones a hand-written record already curates
 *  (merged with it) and the rest (generated outright) — two `GeneratedEntries`, each with its
 *  own owned-fields set, since `writeEntries` applies one `fields` set to every entry it's
 *  given. */
function splitCurated(
  full: readonly ReferenceEntry[],
  curatedHeads: ReadonlySet<string>,
  dir: string | undefined,
): { standard: readonly ReferenceEntry[]; curated: readonly ReferenceEntry[] } {
  const standard: ReferenceEntry[] = [];
  const curated: ReferenceEntry[] = [];
  for (const entry of full) {
    if (!curatedHeads.has(entry.name)) {
      standard.push(entry);
      continue;
    }
    if (dir === undefined) throw new Error(`areaStatisticsEntries: curatedHeads given without dir`);
    if (!headExists(dir, entry.name)) {
      curated.push(entry);
      continue;
    }
    const existing = readEntry(dir, entry.name);
    curated.push({
      ...entry,
      details: mergeDetails(existing.details ?? [], entry.details ?? []),
      examples: mergeExamples(existing.examples, entry.examples),
    });
  }
  return { standard, curated };
}

const listOf = (value: number | number[] | number[][]): MathJSONIn =>
  Array.isArray(value) ? ["List", ...value.map(listOf)] : value;

interface Example {
  expr: unknown;
  expected: unknown;
  caption?: string;
  role?: "aspirational";
}

/** Ids for a head's examples, from their captions (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §3). */
const withIds = (examples: readonly Example[]): ReferenceExample[] => {
  const taken = new Set<string>();
  return examples.map((e) => ({
    id: dedupeId(captionId(e.caption ?? "") || "example", taken),
    ...e,
  })) as ReferenceExample[];
};

/** Every field this driver can derive from a `Definition` when there is no hand-written
 *  record to defer to — the ordinary case. */
export const STANDARD_FIELDS = new Set(["name", "domain", "signature", "summary", "details", "examples"]);
/** For a `curatedHeads` entry: only what this generator can add to an existing hand-written
 *  record without overwriting its curated fields. */
export const CURATED_FIELDS = new Set(["name", "details", "examples"]);

/** One area's generated statistics entries, ready for `writeEntries` — `standard` for heads
 *  with no hand-written record, `curated` for the ones `curatedHeads` named (merged with their
 *  existing record; see `AreaEntriesOptions.curatedHeads`). Call `writeEntries` with EACH, since
 *  it applies one `fields` set to everything it's given. */
export function areaStatisticsEntries(options: AreaEntriesOptions): {
  standard: GeneratedEntries;
  curated: GeneratedEntries;
} {
  const { subjectName, domain, definitions, samples } = options;
  const frontier = options.frontier ?? [];

  // A head compute-engine itself already owns (`Sign`) is documented by the core reference,
  // not here — probe a BARE engine, the same check `declareStatistics` itself has to make.
  const bare = bareEngine();
  const coreOwned = new Set(definitions.filter((d) => isNativeHead(bare, d.head)).map((d) => d.head));

  // `declareArea` is this area's own real `declare<Area>`, which already calls
  // `declareStatistics(ce, definitions)` itself (step 6b: each area declares its own, after its
  // own carriers and families) — the same engine production builds, not a second one this
  // driver declares statistics into itself, which would double-declare.
  const ce = bareEngine();
  options.declareArea(ce);
  const owner = bySignature(definitions.filter((d) => !coreOwned.has(d.head)));

  /** Every subject a head accepts for one sample: the carrier, and — for a definition also
   *  meaningful on a bare list (`alsoOnList`) — the bare list too. */
  function subjectsFor(definition: Definition, sample: Sample): unknown[] {
    const value = listOf(sample.list);
    const carrierValue = [definition.on, value];
    return definition.alsoOnList === true ? [carrierValue, value] : [carrierValue];
  }

  function examplesFor(definition: Definition): Example[] {
    const out: Example[] = [];
    for (const sample of samples) {
      for (const subject of subjectsFor(definition, sample)) {
        const bare = !Array.isArray(subject) || subject[0] !== definition.on;
        // One carrier example per sample, and a single bare-list example overall — enough to
        // show the reading stands on its own without doubling every row.
        if (bare && out.some((e) => e.caption?.endsWith("as a plain list"))) continue;
        const expr = [definition.head, subject];
        const result = ce.box(expr as never).evaluate();
        if (result.json === undefined || JSON.stringify(result.json).includes("Error")) continue;
        out.push({
          expr,
          expected: result.json,
          caption: bare ? `${sample.caption}, as a plain list` : sample.caption,
        });
      }
    }
    return out;
  }

  const shadowedByHead = new Map<string, Definition[]>();
  for (const shadowed of options.shadowedBy ?? [])
    shadowedByHead.set(shadowed.head, [...(shadowedByHead.get(shadowed.head) ?? []), shadowed]);

  const entryFor = (definition: Definition): ReferenceEntry => {
    const details = [
      `Defined over \`${definition.on}\` as an expression in \`_x\`, evaluated by compute-engine — the definition IS the implementation.`,
      definition.alsoOnList === true
        ? `Takes a \`${definition.on}\`, and also a bare list of integers: this reading compares entries with each other rather than with their positions, so it stands on any sequence.`
        : `Takes a \`${definition.on}\` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.`,
      ...(definition.note === undefined ? [] : [definition.note]),
      ...(shadowedByHead.get(definition.head) ?? []).map(
        (d) =>
          `A separate definition exists for \`${d.on}\` (${d.summary}) but is not the one declared: one head, one owner.`,
      ),
    ];
    return {
      name: definition.head,
      domain,
      signature: `${definition.head}(${subjectName})`,
      summary: definition.summary,
      details,
      examples: [...withIds(examplesFor(definition)), ...findstatExamples(definition)],
    };
  };

  const frontierEntryFor = (entry: FrontierEntry): ReferenceEntry => {
    const sample = samples[0];
    const examples: Example[] =
      sample === undefined
        ? []
        : [
            {
              expr: [entry.head, [entry.on, listOf(sample.list)]],
              // Aspirational: the head is NOT declared, so this is a claim about what it would
              // answer, and the test asserts the gap is still open.
              expected: 0,
              caption: `${sample.caption} — once there is a definition to evaluate`,
              role: "aspirational",
            },
          ];
    return {
      name: entry.head,
      domain,
      signature: `${entry.head}(${subjectName})`,
      summary: `${entry.why} Not yet defined.`,
      details: [
        `On the primitive frontier for \`${entry.on}\`: ${entry.why}`,
        `Classified \`${entry.reason}\`. Being on this list is a claim to be justified, not a place to put anything inconvenient — see this area's own \`FRONTIER\`.`,
      ],
      examples: withIds(examples),
    };
  };

  const omitHeads = new Set(options.omitHeads ?? []);
  const full = [...[...owner.values()].map(entryFor), ...frontier.map(frontierEntryFor)].filter(
    (e) => !omitHeads.has(e.name),
  );
  const curatedHeads = new Set(options.curatedHeads ?? []);
  const { standard, curated } = splitCurated(full, curatedHeads, options.dir);

  // Every head this area is responsible for — even one just removed from `owner` (now
  // core-owned) — stays owned by its group, so `writeEntries` cleans up its stale folder. A
  // head another area owns (`omitHeads`) is excluded entirely: this generator never touches it.
  const allHeads = [...definitions.map((d) => d.head), ...frontier.map((f) => f.head)].filter((h) => !omitHeads.has(h));
  const standardOwned = new Set(allHeads.filter((h) => !curatedHeads.has(h)));
  const curatedOwned = new Set(allHeads.filter((h) => curatedHeads.has(h)));

  return {
    standard: { entries: standard, owned: standardOwned, fields: STANDARD_FIELDS },
    curated: { entries: curated, owned: curatedOwned, fields: CURATED_FIELDS },
  };
}
