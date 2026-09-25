// Turn an enumeratio catalog dump into `src/catalog-data.ts`.
//
// The dump is produced against an enumeratio checkout, which owns the database — this
// package holds only the extracted result, so nothing here needs pglite. From
// `packages/data` in the enumeratio repo:
//
//   node --import tsx - <<'EOF' /path/to/catalog-dump.json
//   import { writeFile } from 'node:fs/promises'
//   import { bootCore } from './node.ts'
//   const pg = await bootCore()
//   const q = async <T,>(sql: string): Promise<T[]> => (await pg.query(sql)).rows as T[]
//   const collections = await q(`
//     SELECT c.id, c.carrier, c.unbounded, c.alias_of AS "aliasOf", c.pack, m.title, m.description,
//            coalesce((SELECT jsonb_agg(jsonb_build_object('name', g.name, 'role', g.role) ORDER BY g.pos)
//                      FROM base_grade g WHERE g.collection = c.id), '[]'::jsonb) AS grades
//     FROM base_collection c LEFT JOIN base_collection_meta m ON m.collection = c.id ORDER BY c.id`)
//   const stats = await q(`SELECT collection, stat_id AS "statId", title, codomain FROM base_stat ORDER BY 1,2`)
//   const maps = await q(`SELECT collection, map_id AS "mapId", codomain, title, scope, kind FROM base_map ORDER BY 1,2`)
//   const carriers = await q(`SELECT DISTINCT carrier FROM base_collection WHERE carrier IS NOT NULL ORDER BY 1`)
//   const references = await q(`SELECT subject_kind AS "subjectKind", subject, system, identity, url, delta, relation FROM base_reference ORDER BY 1,2,3,4`)
//   await pg.close()
//   await writeFile(process.argv[2], JSON.stringify({ collections, carriers: carriers.map(r => r.carrier), stats, maps, references }))
//   EOF
//
// Or run `scripts/dump.mts` from there, which is the same query as a file. Then, from this
// package: node scripts/extract.ts catalog-dump.json

import { readFileSync, writeFileSync } from "node:fs";
import { pascal } from "../src/spelling.ts";

interface DumpCollection {
  id: string;
  carrier: string | null;
  unbounded: boolean;
  aliasOf: string | null;
  pack: string;
  title: string | null;
  description: string | null;
  grades: { name: string; role: "axis" | "param" }[];
}
interface DumpStat {
  collection: string;
  statId: string;
  title: string | null;
  codomain: string | null;
}
interface DumpMap {
  collection: string;
  mapId: string;
  codomain: string;
  title: string | null;
  scope: string;
  kind: string;
}
interface DumpReference {
  subjectKind: string;
  subject: string;
  system: string;
  identity: string;
  url: string | null;
  delta: string;
  relation: string;
}
interface Dump {
  collections: DumpCollection[];
  carriers: string[];
  stats: DumpStat[];
  maps: DumpMap[];
  references: DumpReference[];
}

const [, , dumpPath] = process.argv;
if (!dumpPath) throw new Error("usage: extract.ts <catalog-dump.json>");
const dump: Dump = JSON.parse(readFileSync(dumpPath, "utf8"));

// Collections are one row each. Stats and maps are NOT: the dump has one row per
// (collection, stat), but a stat is a single name defined on several carriers. Fold the
// rows into names carrying their overload set — 1051 stat rows become 242 stat names.
const carrierOf = new Map(dump.collections.map((c) => [c.id, c.carrier ? pascal(c.carrier) : null]));

const fold = <T extends { collection: string }>(
  rows: T[],
  key: (row: T) => string,
  title: (row: T) => string | null,
): { name: string; on: string[]; title?: string }[] => {
  const byName = new Map<string, { title: string | null; carriers: Set<string> }>();
  for (const row of rows) {
    const k = key(row);
    let e = byName.get(k);
    if (!e) byName.set(k, (e = { title: title(row), carriers: new Set() }));
    const carrier = carrierOf.get(row.collection);
    if (carrier) e.carriers.add(carrier);
  }
  return [...byName]
    .map(([name, e]) => ({
      name,
      on: [...e.carriers].sort(),
      ...(e.title ? { title: e.title } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const collections = dump.collections.map((c) => ({
  name: pascal(c.id),
  id: c.id,
  ...(c.carrier ? { carrier: pascal(c.carrier) } : {}),
  grades: c.grades,
  ...(c.title ? { title: c.title } : {}),
  ...(c.description ? { description: c.description } : {}),
  ...(c.unbounded ? { unbounded: true } : {}),
  ...(c.aliasOf ? { aliasOf: pascal(c.aliasOf) } : {}),
}));
const carriers = dump.carriers.map((c) => ({ name: pascal(c), id: c }));
const stats = fold(
  dump.stats,
  (r) => pascal(r.statId),
  (r) => r.title,
);
const maps = fold(
  dump.maps,
  (r) => pascal(r.mapId),
  (r) => r.title,
);

// A reference row names its subject the database's way — `set_partitions`, or
// `permutations.descents` for a stat or map on a collection. Rekey to our spelling: the
// collection's PascalCase name, or the head plus the carrier it is on (`Descents` on
// `Permutation`), which is how the statistics and maps libraries address the same thing.
const references = dump.references
  .map((r) => {
    const dot = r.subject.indexOf(".");
    const onCollection = dot >= 0 && (r.subjectKind === "stat" || r.subjectKind === "map");
    const subject = pascal(onCollection ? r.subject.slice(dot + 1) : r.subject);
    const carrier = onCollection ? carrierOf.get(r.subject.slice(0, dot)) : undefined;
    return {
      kind: r.subjectKind,
      subject,
      ...(carrier ? { on: carrier } : {}),
      system: r.system,
      identity: r.identity,
      ...(r.url ? { url: r.url } : {}),
      ...(r.delta ? { note: r.delta } : {}),
      ...(r.relation !== "isomorphic" ? { relation: r.relation } : {}),
    };
  })
  .sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.subject.localeCompare(b.subject) ||
      (a.on ?? "").localeCompare(b.on ?? "") ||
      a.system.localeCompare(b.system) ||
      a.identity.localeCompare(b.identity),
  );

const body = `// GENERATED by scripts/extract.ts from an enumeratio catalog dump. Do not edit.
//
// collections ${collections.length} · carriers ${carriers.length} · stats ${stats.length} · maps ${maps.length} · references ${references.length}
//
// Stats and maps are folded to NAMES with their overload sets (\`on\`), not the
// (collection, stat) rows the database stores — see design/namespaces.md §1.
//
// References are the database's crosswalk (\`base_reference\`): where the same object lives
// in another system, rekeyed to our names. A stat or map row carries the carrier it is on.

import type { Grade } from "./types.ts";

export interface CatalogCollection {
  readonly name: string;
  readonly id: string;
  readonly carrier?: string;
  readonly grades: readonly Grade[];
  readonly title?: string;
  readonly description?: string;
  readonly unbounded?: boolean;
  readonly aliasOf?: string;
}
export interface CatalogCarrier { readonly name: string; readonly id: string }
export interface CatalogOverload {
  readonly name: string;
  readonly on: readonly string[];
  readonly title?: string;
}
/** How a reference's \`identity\` relates to its subject — isomorphic unless said otherwise. */
export type CatalogRelation = "partial" | "aggregate" | "conceptual";
export interface CatalogReference {
  /** What is being referenced: collection, stat, map, carrier, function, construction, operation. */
  readonly kind: string;
  /** Our spelling of the subject — a collection or head name. */
  readonly subject: string;
  /** The carrier a stat or map row is on. */
  readonly on?: string;
  /** The system the reference lives in: sage, mathlib4, wikipedia, wolfram, sympy, findstat, oeis, … */
  readonly system: string;
  /** The resolvable name over there — a class, a function, an id, a page title. */
  readonly identity: string;
  readonly url?: string;
  /** What differs, when the match is not exact. */
  readonly note?: string;
  readonly relation?: CatalogRelation;
}

export const COLLECTIONS: readonly CatalogCollection[] = ${JSON.stringify(collections, null, 2)};

export const CARRIERS: readonly CatalogCarrier[] = ${JSON.stringify(carriers, null, 2)};

export const STATS: readonly CatalogOverload[] = ${JSON.stringify(stats, null, 2)};

export const MAPS: readonly CatalogOverload[] = ${JSON.stringify(maps, null, 2)};

export const REFERENCES: readonly CatalogReference[] = ${JSON.stringify(references, null, 2)};
`;

writeFileSync(new URL("../src/catalog-data.ts", import.meta.url), body);
console.log(
  `catalog-data.ts — collections ${collections.length} · carriers ${carriers.length} · ` +
    `stats ${stats.length} (from ${dump.stats.length} rows) · maps ${maps.length} (from ${dump.maps.length} rows) · ` +
    `references ${references.length}`,
);
