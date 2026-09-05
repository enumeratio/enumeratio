// A DISTRIBUTION archetype read as a histogram (#81): GROUP BY a stat within a fiber IS the counting sequence
// (Mahonian, Eulerian, …); grouping by an axis as well rows it into a triangle — its q-analog. One facet per bound
// axis value, one bar per stat value. Pure over the planner's table, so the query view and the collection explorer
// draw the same chart from the same rows.
import type { RowTable } from '@enumeratio/client'

export type Facet = { label: string; byValue: Map<string, number>; total: number }
export type Distribution = { statId: string; facets: Facet[]; values: string[]; max: number }

const fmt = (v: unknown): string => (v == null ? '' : typeof v === 'number' && Number.isInteger(v) ? v.toLocaleString() : String(v))

export function distributionOf(t: RowTable | null): Distribution | null {
  if (!t || t.archetype !== 'distribution') return null
  const statCol = t.columns.find((c) => c.kind === 'stat')
  if (!statCol) return null
  const facetCols = t.columns.filter((c) => c.kind === 'axis')
  const valueSet = new Set<string>()
  const byLabel = new Map<string, Facet>()
  let max = 1
  for (const r of t.rows) {
    const label = facetCols.map((c) => `${c.id} = ${fmt(r[c.id])}`).join(', ')
    const v = String(r[statCol.id])
    const n = Number(r.count)
    valueSet.add(v)
    let f = byLabel.get(label)
    if (!f) { f = { label, byValue: new Map(), total: 0 }; byLabel.set(label, f) }
    f.byValue.set(v, n)
    f.total += n
    if (n > max) max = n
  }
  const values = [...valueSet].sort((a, b) => Number(a) - Number(b))
  return { statId: statCol.id, facets: [...byLabel.values()], values, max }
}
