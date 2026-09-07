// engine-util — the sliver of ts-engine's can()/basket logic every OTHER registry-driven engine needs too
// (ce-engine today; a future wasm engine tomorrow). Extracted here rather than re-derived per engine, so widening
// the roster of non-pg engines is additive data (a grant row, a CE_OPERATORS entry) plus one new file, never a
// second hand-copy of "which column-group basket does this tree fall in".
import { irToSpec, type SelectExpr } from './ir'
import type { Registry } from './registry'

/** Which column-group basket a SELECT column falls in. A FROM-less `apply` is the pseudo-kind `apply`; everything
 *  else is a real SelectKind, and irToSpec is what names it. */
export function basketOf(reg: Registry, e: SelectExpr): string | undefined {
  let kind: string
  try { kind = irToSpec(e).kind === 'name' ? 'stat' : specKind(e) } catch { kind = 'apply' }
  return reg.base.columnGroups.find((g) => g.kinds.includes(kind))?.id
}
/** the SelectKind a column tree denotes, in the column half's own vocabulary */
export function specKind(e: SelectExpr): string {
  const spec = irToSpec(e)
  return spec.kind === 'position' ? spec.position : spec.kind === 'element' ? 'element' : spec.kind
}
/** a short label for a why()/error message naming a column tree's shape */
export const describeExpr = (e: SelectExpr): string => (e.kind === 'apply' ? `${e.fn}(…)` : e.kind)
/** the column id an engine's evaluate() prints a select column under */
export const labelOfExpr = (e: SelectExpr, i: number): string =>
  e.kind === 'apply' ? String(e.fn) : e.kind === 'op' ? e.op : `column${i + 1}`
