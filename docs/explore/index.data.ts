// Build-time data loader for the collection atlas's family tables (issue #117). Same pattern as
// docs/statistics.data.ts / docs/api-reference.data.ts: boot the pure-SQL core in PGlite and read the registry
// directly, so the family/collection listing can't drift from what's actually realized. The tag vocabulary +
// collection→tag assignments live in `base_tag` / `base_collection_tag_manual` (tags.sql) — the same editorial
// layer the explorer's filter chips read. A collection with no manual tag row still needs to be accounted for
// (so the counts stay honest), so those land in a separate `uncategorized` bucket rather than being dropped.
//
// The rest of collection-atlas.md (organizing ideas, dualities, connective-tissue theorems) stays hand-written —
// that's mathematical narrative the registry doesn't encode, not something to generate.
import { sharedCore } from '@enumeratio/data/node'

export interface CollectionEntry {
  id: string
  title: string
  carrier: string
  unbounded: boolean
  gradeCount: number
}

export interface FamilyGroup {
  tag: string
  title: string
  description: string | null
  collections: CollectionEntry[]
}

export interface AtlasData {
  counts: { collections: number; families: number }
  families: FamilyGroup[]
  uncategorized: CollectionEntry[]
}

export default {
  watch: ['../packages/data/sqlsrc/*.sql'],
  async load(): Promise<AtlasData> {
    const pg = await sharedCore()
    const q = async (sql: string) => (await pg.query(sql)).rows as any[]

    const entryRows = await q(`
      SELECT c.id, coalesce(m.title, c.id) AS title, c.carrier, c.unbounded,
             coalesce((SELECT count(*) FROM base_grade g WHERE g.collection = c.id), 0) AS grade_count
        FROM base_collection c
        LEFT JOIN base_collection_meta m ON m.collection = c.id
       WHERE c.alias_of IS NULL
    `)
    const entries = new Map<string, CollectionEntry>(
      entryRows.map((r: any) => [
        r.id,
        { id: r.id, title: r.title, carrier: r.carrier, unbounded: r.unbounded, gradeCount: Number(r.grade_count) },
      ]),
    )

    const tagRows = await q(`
      SELECT t.id AS tag, t.title, t.description, m.collection
        FROM base_collection_tag_manual m
        JOIN base_tag t ON t.id = m.tag
       ORDER BY t.title, m.collection
    `)

    const groups = new Map<string, FamilyGroup>()
    const tagged = new Set<string>()
    for (const r of tagRows) {
      const entry = entries.get(r.collection)
      if (!entry) continue // shouldn't happen (FK-backed), but don't let a stale row crash the build
      tagged.add(r.collection)
      let g = groups.get(r.tag)
      if (!g) {
        g = { tag: r.tag, title: r.title, description: r.description, collections: [] }
        groups.set(r.tag, g)
      }
      g.collections.push(entry)
    }
    for (const g of groups.values()) g.collections.sort((a, b) => a.title.localeCompare(b.title))
    const families = [...groups.values()].sort((a, b) => a.title.localeCompare(b.title))

    const uncategorized = [...entries.values()]
      .filter((e) => !tagged.has(e.id))
      .sort((a, b) => a.title.localeCompare(b.title))

    // pg is shared across data loaders (sharedCore) — never closed here
    return {
      counts: { collections: entries.size, families: families.length },
      families,
      uncategorized,
    }
  },
}
