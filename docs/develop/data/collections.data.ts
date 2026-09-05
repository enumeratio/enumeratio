// Build-time data loader for the collections reference — the flat index half of the design in collections.md.
// Boots the pure-SQL core in PGlite and reads `base_catalog` (the same client-facing view the TS client itself
// reads), so this table can never drift from what the registry actually contains.
import { bootCore } from '@enumeratio/data/node'

export interface CollectionRow {
  id: string
  title: string | null
  carrier: string
  grades: string[]
  unbounded: boolean
  aliasOf: string | null
}

export interface CollectionsData {
  count: number
  rows: CollectionRow[]
}

export default {
  watch: ['../packages/data/sqlsrc/*.sql'],
  async load(): Promise<CollectionsData> {
    const pg = await bootCore()
    const rows = (
      await pg.query(`
        SELECT id, carrier, unbounded, grades, title, alias_of
          FROM base_catalog
         ORDER BY id
      `)
    ).rows as any[]
    await pg.close()
    return {
      count: rows.length,
      rows: rows.map((r) => ({
        id: r.id,
        title: r.title ?? null,
        carrier: r.carrier,
        grades: r.grades ?? [],
        unbounded: r.unbounded,
        aliasOf: r.alias_of ?? null,
      })),
    }
  },
}
