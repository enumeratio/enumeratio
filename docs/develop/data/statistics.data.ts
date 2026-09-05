// Build-time data loader for the statistics reference (issue #133). Boots the pure-SQL core in PGlite (same
// pattern as docs/api-reference.data.ts) and introspects `base_stat` — the FindStat-style per-element statistic
// registry — plus a couple of live example values per stat, pulled straight off the collection's own elements.
// The description text comes from `pg_description` (issue #147's `COMMENT ON FUNCTION` pass over value_fn,
// sourced from base_stat.title), so a stat with no title still lists — it just has no description or examples.
import { bootCore } from '@enumeratio/data/node'

export interface StatEntry {
  collection: string
  collectionTitle: string
  carrier: string
  statId: string
  title: string | null
  codomain: string | null
  description: string | null // sourced from pg_description on value_fn (COMMENT ON, issue #147)
  valueFn: string
  examples: { element: string; value: string }[] // rendered element ↔ its stat value, off the collection's own elements
}

export interface StatisticsData {
  counts: { stats: number; collections: number }
  stats: StatEntry[]
}

export default {
  watch: ['../packages/data/sqlsrc/*.sql'],
  async load(): Promise<StatisticsData> {
    const pg = await bootCore()
    const q = async (sql: string) => (await pg.query(sql)).rows as any[]

    const rows = await q(`
      SELECT s.collection, s.stat_id, s.value_fn, s.title, s.codomain, c.carrier,
             coalesce(m.title, s.collection) AS collection_title,
             coalesce((SELECT count(*) FROM base_grade g WHERE g.collection = s.collection), 0) AS grade_count,
             obj_description(p.oid, 'pg_proc') AS description
        FROM base_stat s
        JOIN base_collection c ON c.id = s.collection
        LEFT JOIN base_collection_meta m ON m.collection = s.collection
        LEFT JOIN LATERAL (
          SELECT p.oid FROM pg_proc p
           WHERE p.proname = s.value_fn AND p.pronargs > 0
             AND p.proargtypes[0] = to_regtype(format('%I', c.carrier)) LIMIT 1
        ) p ON true
       ORDER BY s.collection, s.stat_id
    `)

    // Grade-tuple candidates to try when sampling elements: `<coll>()` (every grade NULL, "the whole collection")
    // is empty for families with no natural whole enumeration (e.g. integer_compositions — an unbounded per-fiber
    // family), so we probe small concrete grade bindings until one yields elements. Two-axis families are usually
    // (size, k-ish) — try k from 0 up through size, which covers the common "k ≤ n" constraint.
    const candidatesFor = (gradeCount: number): number[][] => {
      if (gradeCount === 0) return [[]]
      if (gradeCount === 1) return Array.from({ length: 12 }, (_, i) => [i + 1])
      const out: number[][] = []
      for (const g1 of [2, 3, 4, 5, 6, 8, 10]) for (const g2 of [0, 1, 2, 3, g1]) out.push([g1, g2])
      return out
    }
    const sampleCache = new Map<string, { el: string; v: string }[]>() // key: `${collection}(${args})::${valueFn}`

    const stats: StatEntry[] = []
    for (const r of rows) {
      const key = `${r.collection}::${r.value_fn}`
      let ex = sampleCache.get(key)
      if (ex === undefined) {
        ex = []
        for (const args of candidatesFor(Number(r.grade_count))) {
          try {
            const found = await q(
              `SELECT render(e) el, ${r.value_fn}((e).value)::text v
                 FROM elements(${r.collection}(${args.join(',')}), 20) e ORDER BY (e).rank LIMIT 2`,
            )
            if (found.length) {
              ex = found.map((x: any) => ({ el: x.el, v: x.v }))
              break
            }
          } catch {
            // invalid grade combo for this collection (e.g. k > n) or the fn doesn't apply here — try the next candidate
          }
        }
        sampleCache.set(key, ex)
      }
      stats.push({
        collection: r.collection,
        collectionTitle: r.collection_title,
        carrier: r.carrier,
        statId: r.stat_id,
        title: r.title,
        codomain: r.codomain,
        description: r.description,
        valueFn: r.value_fn,
        examples: ex.map((x) => ({ element: x.el, value: x.v })),
      })
    }

    const counts = {
      stats: await pg.query('SELECT count(DISTINCT stat_id) c FROM base_stat').then((x) => Number((x.rows[0] as any).c)),
      collections: await pg
        .query('SELECT count(DISTINCT collection) c FROM base_stat')
        .then((x) => Number((x.rows[0] as any).c)),
    }

    await pg.close()
    return { counts, stats }
  },
}
