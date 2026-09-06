// Build-time data loader for the maps reference — every registered `base_map` row (bijection/morphism), flat.
// Boots the pure-SQL core in PGlite and reads the registry directly; a curated `findstat` code becomes a link the
// same way the identity strip and the Relations table build one (see findstat-refs.maps.sql for the URL convention).
import { sharedCore } from '@enumeratio/data/node'

export interface MapRow {
  collection: string
  collectionTitle: string
  mapId: string
  mappingFn: string
  codomain: string
  title: string | null
  scope: string
  inverse: string | null
  isBijection: boolean
  isOrderIso: boolean
  findstat: string | null
}

export interface MapsData {
  count: number
  bijectionCount: number
  rows: MapRow[]
}

export default {
  watch: ['../packages/data/sqlsrc/*.sql'],
  async load(): Promise<MapsData> {
    const pg = await sharedCore()
    const rows = (
      await pg.query(`
        SELECT m.collection, coalesce(c.title, m.collection) AS collection_title, m.map_id, m.mapping_fn,
               m.codomain, m.title, m.scope, m.inverse, m.is_bijection, m.is_order_iso, m.findstat
          FROM base_map m
          LEFT JOIN base_collection_meta c ON c.collection = m.collection
         ORDER BY m.collection, m.map_id
      `)
    ).rows as any[]
    // pg is shared across data loaders (sharedCore) — never closed here
    return {
      count: rows.length,
      bijectionCount: rows.filter((r) => r.is_bijection).length,
      rows: rows.map((r) => ({
        collection: r.collection,
        collectionTitle: r.collection_title,
        mapId: r.map_id,
        mappingFn: r.mapping_fn,
        codomain: r.codomain,
        title: r.title ?? null,
        scope: r.scope,
        inverse: r.inverse ?? null,
        isBijection: r.is_bijection,
        isOrderIso: r.is_order_iso,
        findstat: r.findstat ?? null,
      })),
    }
  },
}
