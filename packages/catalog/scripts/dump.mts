// Dump the enumeratio catalog to JSON for `extract.ts`. Runs against an enumeratio checkout,
// which owns the database, so it has to be launched from THAT repo's data package (for its
// pglite and tsx):
//
//   cd /path/to/enumeratio/packages/data
//   node --import tsx /path/to/notatio/packages/catalog/scripts/dump.mts . /tmp/catalog-dump.json
//
// The references block is the crosswalk: `base_reference`, which already subsumes the
// `findstat` column on `base_map` and the OEIS table. `extract.ts` rekeys it by our names.

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , dataDir, outPath] = process.argv;
if (!dataDir || !outPath) throw new Error("usage: dump.mts <enumeratio/packages/data> <out.json>");

const { bootCore } = (await import(pathToFileURL(resolve(dataDir, "node.ts")).href)) as {
  bootCore: () => Promise<{
    query: (sql: string) => Promise<{ rows: unknown[] }>;
    close: () => Promise<void>;
  }>;
};
const pg = await bootCore();
const q = async <T,>(sql: string): Promise<T[]> => (await pg.query(sql)).rows as T[];

const collections = await q(`
  SELECT c.id, c.carrier, c.unbounded, c.alias_of AS "aliasOf", c.pack, m.title, m.description,
         coalesce((SELECT jsonb_agg(jsonb_build_object('name', g.name, 'role', g.role) ORDER BY g.pos)
                   FROM base_grade g WHERE g.collection = c.id), '[]'::jsonb) AS grades
  FROM base_collection c LEFT JOIN base_collection_meta m ON m.collection = c.id ORDER BY c.id`);
const stats = await q(
  `SELECT collection, stat_id AS "statId", title, codomain FROM base_stat ORDER BY 1,2`,
);
const maps = await q(
  `SELECT collection, map_id AS "mapId", codomain, title, scope, kind FROM base_map ORDER BY 1,2`,
);
const carriers = await q<{ carrier: string }>(
  `SELECT DISTINCT carrier FROM base_collection WHERE carrier IS NOT NULL ORDER BY 1`,
);
const references = await q(`
  SELECT subject_kind AS "subjectKind", subject, system, identity, url, delta, relation
  FROM base_reference ORDER BY 1,2,3,4`);
await pg.close();

await writeFile(
  outPath,
  JSON.stringify({
    collections,
    carriers: carriers.map((r) => r.carrier),
    stats,
    maps,
    references,
  }),
);
console.log(
  `collections ${collections.length} · stats ${stats.length} · maps ${maps.length} · ` +
    `references ${references.length}`,
);
