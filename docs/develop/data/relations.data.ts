// Build-time data loader for the general references table — the whole `base_reference` registry, subject-indexed
// (one row per subject, one column per system), replacing both the old libraries.data.ts (fixed system list) and
// external.data.ts (fixed system list, grouped by system instead of subject). Systems and subject kinds are read
// live from the table, not hardcoded, so a new system/kind shows up here automatically.
import { sharedCore } from '@enumeratio/data/node'

export interface ReferenceCell {
  identity: string
  url: string | null
  delta: string
  relation: string
}

export interface ReferenceRow {
  subjectKind: string
  subject: string
  cells: Record<string, ReferenceCell | null> // keyed by system
}

export interface ReferencesData {
  systems: string[]
  kinds: string[]
  counts: Record<string, number> // per system
  rows: ReferenceRow[]
}

export default {
  watch: ['../packages/data/sqlsrc/*.sql'],
  async load(): Promise<ReferencesData> {
    const pg = await sharedCore()

    const systemsRes = await pg.query(`SELECT DISTINCT system FROM base_reference ORDER BY system`)
    const systems = (systemsRes.rows as any[]).map((r) => r.system as string)

    const kindsRes = await pg.query(`SELECT DISTINCT subject_kind FROM base_reference ORDER BY subject_kind`)
    const kinds = (kindsRes.rows as any[]).map((r) => r.subject_kind as string)

    const raw = await pg.query(
      `SELECT subject_kind, subject, system, identity, url, delta, relation FROM base_reference
        ORDER BY subject_kind, subject, system`,
    )

    const bySubject = new Map<string, ReferenceRow>()
    const counts: Record<string, number> = Object.fromEntries(systems.map((s) => [s, 0]))
    for (const r of raw.rows as any[]) {
      const key = `${r.subject_kind}::${r.subject}`
      let row = bySubject.get(key)
      if (!row) {
        row = { subjectKind: r.subject_kind, subject: r.subject, cells: {} }
        bySubject.set(key, row)
      }
      row.cells[r.system] = { identity: r.identity, url: r.url, delta: r.delta, relation: r.relation }
      counts[r.system] = (counts[r.system] ?? 0) + 1
    }

    // pg is shared across data loaders (sharedCore) — never closed here
    return {
      systems,
      kinds,
      counts,
      rows: [...bySubject.values()].sort((a, b) => a.subject.localeCompare(b.subject)),
    }
  },
}
