// The crosswalk, assembled. A head's references come from several places that know
// different things, and the point of putting them together is to see them side by side:
//
//   entry      what the entry's author wrote down, on the entry or on one signature
//   curated    the hand-kept encyclopaedia rows on the head's own record (`references:`/
//              `names:` in `<Head>.yaml`; rebuilt into `curated-data.ts`)
//   catalog    the enumeratio database's own crosswalk, rekeyed to our names
//   engine     the Wikidata id compute-engine's definition carries
//   wikidata   what that item (or the item behind a Wikipedia title we name) points at:
//              its Wikipedia page, MathWorld, OEIS, nLab, Encyclopedia of Mathematics
//   dlmf       the handbook's defining equation, found by the names the head already has
//   findstat   the statistics FindStat's finder says agree with ours on every value tried
//   oeis       the sequences whose terms a family's counts agree with
//   fungrim    the Fungrim symbol page, and every Fungrim identity the engine compiled
//              whose rule mentions the head -- with how those identities came out when
//              evaluated (scripts/verify-fungrim.ts)
//   wolfram    the Wolfram symbol the transpiler vouches for
//   oracle     the equivalent call in each oracle kernel, per arity -- and, where a scan
//              has run, how the head's own examples came out in that kernel
//
// Each resolved reference says which of these it came from, so a page can show a Wikidata
// id next to a FindStat number without pretending they were found the same way.

import { COLLECTIONS, REFERENCES } from "@enumeratio/catalog/src";
import { crosswalk as derived } from "../crosswalk-data.ts";
import { engineSymbols } from "../engine-symbols-data.ts";
import { findstat } from "../findstat-data.ts";
import { oeis } from "../oeis-data.ts";
import { fungrimSymbols } from "../fungrim-symbols-data.ts";
import type { ReferenceEntry } from "../types.ts";
import { CATALOG_ALIASES, CURATED, DLMF_NAMES, FUNGRIM_NAMES, WIKIDATA_FIXES } from "./curated-data.ts";
import { dlmfNotations } from "./dlmf.ts";
import { fungrimEntryVerdict, fungrimScore, KNOWN_CAUSES } from "./fungrim.ts";
import { inventoryEntry } from "./inventory.ts";
import { oracleAgreements } from "./oracle.ts";
import { referencesOf, wikidataItem } from "./wikidata.ts";
import { type CrosswalkSystem, isCrosswalkSystem, SOURCES, SYSTEM_ORDER } from "./sources.ts";
import type { Reference, ReferenceOrigin, ResolvedReference } from "./types.ts";

const byName = <T extends { name: string }>(rows: readonly T[]): ReadonlyMap<string, T> =>
  new Map(rows.map((row) => [row.name, row]));

const DERIVED = byName(derived);
const ENGINE = byName(engineSymbols);

/**
 * Build the link for a reference: the system's documentation index when it has the object
 * (an anchored page, better than a recorded module URL), else the reference's own URL, else
 * the system's URL scheme, else none. A recorded URL on a different page than the index
 * gives is kept -- the check script is where that disagreement surfaces.
 */
export function hrefOf(reference: Reference): string | undefined {
  const indexed = inventoryEntry(reference.system, reference.identity)?.url;
  if (indexed && (!reference.url || indexed.startsWith(reference.url))) return indexed;
  return reference.url ?? SOURCES[reference.system].href?.(reference.identity);
}

const resolve = (reference: Reference, origin: ReferenceOrigin, via?: string): ResolvedReference => ({
  ...reference,
  label: SOURCES[reference.system].label,
  ...(hrefOf(reference) === undefined ? {} : { href: hrefOf(reference) }),
  origin,
  ...(via === undefined ? {} : { via }),
});

/** The catalog's rows about `subject`, as references -- any kind, any carrier. */
function catalogRows(subject: string, on?: string): ResolvedReference[] {
  return REFERENCES.filter(
    (row) => row.subject === subject && (on === undefined || row.on === on) && isCrosswalkSystem(row.system),
  ).map((row) =>
    resolve(
      {
        system: row.system as CrosswalkSystem,
        identity: row.identity,
        ...(row.url ? { url: row.url } : {}),
        ...(row.note ? { note: row.note } : {}),
        ...(row.relation ? { relation: row.relation } : {}),
      },
      "catalog",
      // A stat or map row is recorded against a carrier; say which when the caller did not.
      on === undefined && row.on ? row.on : undefined,
    ),
  );
}

/**
 * Two references are the same pointer when system and identity agree at the same arity.
 * A module path in front of a call is spelling, not identity: the catalog has both
 * `OrderedSetPartitions(n)` and `sage.combinat.set_partition_ordered.OrderedSetPartitions(n)`.
 */
const key = (reference: Reference): string =>
  `${reference.system} ${reference.identity.replace(/^[\w.]+\.(?=\w+\()/, "")} ${reference.arity ?? ""}`;

/** Merge in display order, first source wins for a duplicate pointer. */
function merge(groups: readonly (readonly ResolvedReference[])[]): ResolvedReference[] {
  const out: ResolvedReference[] = [];
  const at = new Map<string, number>();
  for (const group of groups) {
    for (const reference of group) {
      const k = key(reference);
      const index = at.get(k);
      if (index !== undefined) {
        // The same pointer again, this time established by computation: keep the first
        // row's provenance and carry the verification onto it.
        if (reference.verified && !out[index]!.verified) {
          out[index] = {
            ...out[index]!,
            verified: reference.verified,
            ...(out[index]!.note || !reference.note ? {} : { note: reference.note }),
          };
        }
        continue;
      }
      at.set(k, out.length);
      out.push(reference);
    }
  }
  // A pointer known at a specific arity is the same pointer known head-wide, said better;
  // and a DLMF section is the equation inside it, said worse.
  const specific = new Set(out.filter((r) => r.arity !== undefined).map((r) => `${r.system} ${r.identity}`));
  const equations = out.filter((r) => r.system === "dlmf" && r.identity.includes("#"));
  const coarser = (r: ResolvedReference): boolean =>
    (r.arity === undefined && specific.has(`${r.system} ${r.identity}`)) ||
    (r.system === "dlmf" &&
      !r.identity.includes("#") &&
      equations.some(
        (e) =>
          (e.arity === undefined || e.arity === r.arity) &&
          /^[\d.]+$/.test(r.identity) &&
          (e.identity.startsWith(`${r.identity}#`) || e.identity.startsWith(`${r.identity}.`)),
      ));
  const kept = out.filter((r) => !coarser(r));

  const rank = (system: CrosswalkSystem): number => SYSTEM_ORDER.indexOf(system);
  // Stable: within a system the sources' own order stands, arity-specific rows after
  // the head-wide ones.
  return kept
    .map((reference, index) => ({ reference, index }))
    .sort(
      (a, b) =>
        rank(a.reference.system) - rank(b.reference.system) ||
        (a.reference.arity ?? 0) - (b.reference.arity ?? 0) ||
        a.index - b.index,
    )
    .map(({ reference }) => reference);
}

/**
 * Everything known about where head `name` lives elsewhere. Pass the entry when there is
 * one so its own `references` (and its signatures') are included; a head with no entry --
 * one of the engine's own, or a carrier -- still gets the derived and curated rows.
 */
export function crosswalkFor(name: string, entry?: ReferenceEntry): ResolvedReference[] {
  const own = [
    ...(entry?.references ?? []).map((reference) => resolve(reference, "entry")),
    ...(entry?.signatures ?? []).flatMap((signature) =>
      (signature.references ?? []).map((reference) =>
        resolve({ ...reference, ...(signature.arity === undefined ? {} : { arity: signature.arity }) }, "entry"),
      ),
    ),
  ];
  const curated = (CURATED[name] ?? []).map((reference) => resolve(reference, "curated"));

  const engine = ENGINE.get(name);
  const engineId = WIKIDATA_FIXES[name] ?? engine?.wikidata;
  const wikidata = engineId ? [resolve({ system: "wikidata", identity: engineId }, "engine")] : [];

  // The Wikidata item, from the engine's id or from the first Wikipedia title anyone named,
  // and everything it points at.
  const item =
    (engineId ? wikidataItem(engineId) : undefined) ??
    [...own, ...curated, ...catalogRows(name)]
      .map((reference) => wikidataItem(reference))
      .find((found) => found !== undefined);
  const hub = item ? referencesOf(item).map((reference) => resolve(reference, "wikidata")) : [];

  // The DLMF's index is by name; the head's Wikipedia titles are names, and so is the
  // wording DLMF_NAMES gives. A title tied to one arity ties the equation to it too.
  const named = [
    ...(DLMF_NAMES[name] ? [{ title: DLMF_NAMES[name], arity: undefined }] : []),
    ...[...own, ...curated, ...catalogRows(name), ...hub]
      .filter((reference) => reference.system === "wikipedia")
      .map((reference) => ({ title: reference.identity, arity: reference.arity })),
  ];
  const handbook = named.flatMap(({ title, arity }) =>
    dlmfNotations(title).map((notation) =>
      resolve(
        {
          system: "dlmf",
          identity: notation.ref,
          note: `${notation.name}: ${notation.notation.replace(/\\NVar\{/g, "{")}`,
          ...(arity === undefined ? {} : { arity }),
        },
        "dlmf",
      ),
    ),
  );

  const record = DERIVED.get(name);
  const fungrimName = FUNGRIM_NAMES[name] ?? (fungrimSymbols.has(name) ? name : undefined);
  const score = fungrimScore(name);
  const fungrim = [
    ...(fungrimName
      ? [
          {
            ...resolve({ system: "fungrim", identity: fungrimName }, "fungrim"),
            ...(score
              ? {
                  verified: {
                    by: "identities" as const,
                    count: score.agree,
                    ...(score.disagree ? { disagree: score.disagree } : {}),
                    note: `of this head's Fungrim identities, evaluated`,
                  },
                }
              : {}),
          },
        ]
      : []),
    ...(record?.fungrimEntries ?? []).map((id) => {
      const checked = fungrimEntryVerdict(id);
      return {
        ...resolve(
          {
            system: "fungrimEntry",
            identity: id,
            ...(checked?.verdict === "disagree" && checked.detail
              ? {
                  note: [`disagrees when evaluated — ${checked.detail}`, KNOWN_CAUSES[id]].filter(Boolean).join(" · "),
                }
              : {}),
          },
          "fungrim",
        ),
        ...(checked
          ? {
              verified: {
                by: "identities" as const,
                count: checked.verdict === "agree" ? (checked.samples ?? 1) : 0,
                ...(checked.verdict === "disagree" ? { disagree: 1 } : {}),
              },
            }
          : {}),
      };
    }),
  ];
  const wolfram = record?.wolfram ? [resolve({ system: "wolfram", identity: record.wolfram }, "wolfram")] : [];
  // A scan has run these examples in that kernel; the chip carries the score.
  const scored = new Map(oracleAgreements(name).map((row) => [row.system, row]));
  const oracle = (record?.oracle ?? [])
    .filter((row) => isCrosswalkSystem(row.system))
    .map((row) =>
      resolve(
        {
          system: row.system as CrosswalkSystem,
          identity: row.call,
          ...(row.arity === undefined ? {} : { arity: row.arity }),
        },
        "oracle",
      ),
    );

  // A carrier IS its plain collection now, so this needs no separate lookup -- what the
  // finder established for this head on each carrier, said against the carrier.
  const byValue = findstat
    .filter((m) => m.head === name)
    .flatMap((m) => foundByValue(m.head, m.on).map((row) => ({ ...row, via: m.on })));

  const alias = CATALOG_ALIASES[name];
  const aliased = alias ? catalogRows(alias).map((row) => ({ ...row, via: alias })) : [];

  // The plain family (now the same head as the carrier itself) speaks first; the refined
  // ones (`Permutahedron`, carried by `Permutations`) add what it did not say.
  const carried = COLLECTIONS.filter((collection) => collection.carrier === name)
    .sort((a, b) => Number(b.name === name) - Number(a.name === name))
    .flatMap((collection) => catalogRows(collection.name).map((row) => ({ ...row, via: collection.name })));

  // Derived rows outrank the catalog's for the same pointer: the engine's Wikidata id and
  // the transpiler's Wolfram symbol are claims we execute against, not notes.
  return merge([
    own,
    curated,
    wikidata,
    wolfram,
    fungrim,
    catalogRowsChecked(name),
    byValue,
    foundByCount(name),
    aliased,
    carried,
    hub,
    handbook,
    oracle,
  ]).map((reference) => {
    const score = scored.get(reference.system);
    if (!score || reference.verified) return reference;
    return {
      ...reference,
      verified: {
        by: "examples" as const,
        count: score.agree,
        ...(score.disagree ? { disagree: score.disagree } : {}),
        note: `run in ${score.kernel}`,
      },
    };
  });
}

/** What FindStat's finder said our statistic is, by value; several means undecided this small. */
function foundByValue(head: string, carrier: string): ResolvedReference[] {
  const match = findstat.find((m) => m.head === head && m.on === carrier);
  if (!match) return [];
  const several = match.findstat.length > 1;
  return match.findstat.map((id) => ({
    ...resolve(
      {
        system: "findstat",
        identity: id,
        note: `agrees on all ${match.values} values tried${several ? ", as do the others listed" : ""}`,
        ...(several ? { relation: "partial" as const } : {}),
      },
      "findstat",
    ),
    verified: { by: "values" as const, count: match.values },
  }));
}

/**
 * What the OEIS said a family counts, by its terms. The recorded A-number leads when the
 * terms bear it out, then the best-aligned; every other agreeing sequence is shown as a
 * count that coincides rather than the family's own.
 */
function foundByCount(head: string): ResolvedReference[] {
  const found = oeis.filter((m) => m.head === head);
  if (!found.length) return [];
  const recorded = new Set(REFERENCES.filter((r) => r.subject === head && r.system === "oeis").map((r) => r.identity));
  const rank = (m: (typeof found)[number]): number =>
    (recorded.has(m.oeis) ? 0 : 100) + Math.abs(m.shift) * 2 + (m.atZero ? 1 : 0);
  const sorted = [...found].sort((a, b) => rank(a) - rank(b));
  return sorted.map((m, i) => ({
    ...resolve(
      {
        system: "oeis",
        identity: m.oeis,
        note: [
          m.name,
          m.triangle
            ? `our triangle read by rows agrees on ${m.terms} terms${
                m.triangle.skipRows || m.triangle.skipColumns
                  ? ` (theirs starts at row ${m.triangle.skipRows}, column ${m.triangle.skipColumns} of ours)`
                  : ""
              }`
            : `agrees on ${m.terms} terms${m.shift ? ` (their index is ours ${m.shift > 0 ? "+" : "-"} ${Math.abs(m.shift)})` : ""}`,
          m.atZero ? `except the empty object: ${m.atZero.ours} here, ${m.atZero.theirs} there` : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
        ...(i > 0 ? { relation: "aggregate" as const } : {}),
      },
      "oeis",
    ),
    verified: { by: "terms" as const, count: m.terms },
  }));
}

/**
 * Catalog rows for `subject`, minus OEIS ids the family's own counts do not bear out.
 *
 * Only a SEQUENCE match can contradict a recorded id, and only because both are answers to
 * the same question: what does this family count. A triangle has more true answers than one
 * -- the row sums are a sequence of their own, and the same triangle is in the OEIS at
 * several offsets -- so a triangle match adds a row and never removes one.
 */
function catalogRowsChecked(subject: string): ResolvedReference[] {
  const byCount = foundByCount(subject);
  const decisive = byCount.length > 0 && oeis.every((m) => m.head !== subject || !m.triangle);
  return catalogRows(subject).filter(
    (row) => row.system !== "oeis" || !decisive || byCount.some((found) => found.identity === row.identity),
  );
}

/**
 * The references recorded for one statistic -- `head` on `carrier` -- the FindStat
 * statistics found to agree with it by value, and the head's own.
 */
export function crosswalkForStatistic(head: string, carrier: string): ResolvedReference[] {
  const byValue = foundByValue(head, carrier);
  // Where the finder has spoken, a FindStat id the catalog recorded but the values do not
  // bear out is wrong for our definition and is not shown; the test pins each such case
  // until the catalog's row is fixed (`@enumeratio/catalog` reference-fixes.ts).
  const recorded = catalogRows(head, carrier).filter(
    (row) => row.system !== "findstat" || !byValue.length || byValue.some((found) => found.identity === row.identity),
  );
  return merge([recorded, byValue, (CURATED[head] ?? []).map((reference) => resolve(reference, "curated"))]);
}

/** The references recorded for one map -- `name` from `carrier` -- plus the map's own. */
export const crosswalkForMap = crosswalkForStatistic;

/** The references recorded for one collection family, by its head name. */
export function crosswalkForCollection(name: string): ResolvedReference[] {
  return merge([
    catalogRowsChecked(name),
    foundByCount(name),
    (CURATED[name] ?? []).map((reference) => resolve(reference, "curated")),
  ]);
}

/** Resolved references grouped by system, in display order. */
export function groupBySystem(
  references: readonly ResolvedReference[],
): { system: CrosswalkSystem; label: string; references: ResolvedReference[] }[] {
  const groups = new Map<CrosswalkSystem, ResolvedReference[]>();
  for (const reference of references) {
    const group = groups.get(reference.system) ?? [];
    group.push(reference);
    groups.set(reference.system, group);
  }
  return SYSTEM_ORDER.filter((system) => groups.has(system)).map((system) => ({
    system,
    label: SOURCES[system].label,
    references: groups.get(system)!,
  }));
}
