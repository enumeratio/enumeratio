// The SELECT-list model behind the Properties inspector — one row per COLUMN of the statement, in the statement's
// order. A row is (spec, printer config): the spec is what `select=` carries (a column of the column half, #205 —
// a position, the element, a repr, an axis, a statistic, a map image, a chain, the glyph, the data cast, a title, or
// a fiber-level count / aggregate / distribution / symbol); the printer config (format · header · width · link) is
// presentation and stays local (fork 8a). The visible rows, in order, ARE `select=`.
import { parseSelect, printersFor, type Environment, type MapInfo, type Printer, type SelectKind, type SelectSpec, type Stat } from '@enumeratio/client'

/** the level a column lives on — the "+ add" menu offers the ones this archetype has rows for */
export type PropLevel = 'result' | 'element' | 'fiber'

// A configured row: the source of truth for its table column (when visible) and its inspector value.
export interface PropRow {
  uid: number          // session-local id (Vue :key + emitted mutations)
  propId: string       // the column spec, as `select=` spells it
  format?: string      // the chosen printer; absent = the column kind's default under the environment's grants
  visible: boolean     // is a column of the statement
  name?: string        // column-header override (absent = the def's label)
  width?: number       // column min-width in px (absent = auto)
  showLink?: boolean   // link the value to its related element (default: true)
}

// A column available to list.
export interface PropDef {
  id: string           // === PropRow.propId — the spec text
  label: string
  kind: SelectKind
  level: PropLevel
  /** the printers this environment grants the column, most preferred first (the first is the default) */
  formats: Printer[]
  desc: string
  /** the menu group the "+ add" list files it under */
  group: string
  findstatId?: string | null
  codomain?: string | null
  mapId?: string        // maps only: the short id (label carries the full title — #187 P6)
}

let _uid = 0
export const nextPropRowUid = (): number => _uid++

/** the printers granted for a spec — resolved through the client's environment grants (§9) */
const formatsFor = (id: string, kind: SelectKind, environment: Environment): Printer[] =>
  printersFor(kind, { latex: id.endsWith('@latex'), environment })

type DefSpec = { id: string; label: string; kind: SelectKind; level: PropLevel; group: string; desc: string; codomain?: string | null; findstatId?: string | null; mapId?: string }
const def = (d: DefSpec, env: Environment): PropDef => ({ ...d, formats: formatsFor(d.id, d.kind, env) })

export type PropSources = {
  stats: Stat[]
  maps: MapInfo[]
  /** the collection's named representations (base_repr) — `element` is the canonical one, always offered */
  reprs?: string[]
  /** the axes of the grade chain — columns on element rows, keys on fiber rows */
  axes?: string[]
  /** the carrier draws a glyph (carrier_renders_svg) */
  glyph?: boolean
  /** a meta collection: its elements have a registered `title` (fork 8e) */
  meta?: boolean
  environment?: Environment
  /** the row half's already-resolved `select=` text (policy or URL, #244) — seedRows() builds the visible rows from
   *  it when given; absent = today's habit (positions + every stat), unchanged until the caller threads it through */
  selectText?: string
}

/** Every column this collection can project, grouped for the "+ add" menu. The caller filters by level. */
export function buildPropDefs(src: PropSources): PropDef[] {
  const env = src.environment ?? 'web'
  const defs: PropDef[] = [
    def({ id: 'ordinality', label: 'ordinality', kind: 'ordinality', level: 'result', group: 'Position', desc: "the row's position in this result" }, env),
    def({ id: 'address', label: 'address', kind: 'address', level: 'element', group: 'Position', desc: 'the compound address: every axis, then the within-fiber rank' }, env),
    def({ id: 'rank', label: 'rank', kind: 'rank', level: 'element', group: 'Position', desc: 'the canonical position within the fiber' }, env),
    def({ id: 'omega', label: 'omega', kind: 'omega', level: 'element', group: 'Position', desc: 'the ordinal address ω·n + k' }, env),
    ...(src.axes ?? []).map((a) => def({ id: a, label: a, kind: 'axis', level: 'element', group: 'Position', desc: `the ${a} axis` }, env)),
    def({ id: 'element', label: 'element', kind: 'element', level: 'element', group: 'Element', desc: 'the canonical representation' }, env),
    ...(src.reprs ?? []).filter((r) => r !== 'canonical').map((r) =>
      def({ id: `repr:${r}`, label: `repr:${r}`, kind: 'repr', level: 'element', group: 'Element', desc: `the element under the ${r} representation` }, env)),
    ...(src.glyph ? [def({ id: 'glyph', label: 'glyph', kind: 'glyph', level: 'element', group: 'Element', desc: 'the figure the core draws for this element' }, env)] : []),
    def({ id: 'data', label: 'data', kind: 'data', level: 'element', group: 'Element', desc: 'the carrier as JSON — the element as data' }, env),
    ...(src.meta ? [def({ id: 'title', label: 'title', kind: 'title', level: 'element', group: 'Element', desc: 'the registry title of this element' }, env)] : []),
  ]
  for (const s of src.stats) {
    defs.push(def({ id: s.statId, label: s.statId, kind: 'stat', level: 'element', group: 'Statistic',
                    desc: s.inherited ? 'inherited statistic' : 'statistic', findstatId: s.findstatId, codomain: s.codomain }, env))
  }
  for (const m of src.maps) {
    defs.push(def({ id: 'map:' + m.id, label: m.title || m.id, kind: 'map', level: 'element', group: 'Map',
                    desc: `map → ${m.codomain}`, findstatId: m.findstatId, codomain: m.codomain, mapId: m.id }, env))
  }
  // the fiber level: what a grouped row can hold beyond its keys
  defs.push(def({ id: 'count', label: 'count', kind: 'count', level: 'fiber', group: 'Fiber', desc: 'the size of the fiber' }, env))
  defs.push(def({ id: 'symbol', label: 'symbol', kind: 'symbol', level: 'fiber', group: 'Fiber', desc: "the fiber's symbol (S₄, C(5,3), 2^[3])" }, env))
  defs.push(def({ id: 'level', label: 'level', kind: 'level', level: 'fiber', group: 'Fiber', desc: 'GROUPING() — which level of a multi-level result the row is' }, env))
  // a fiber column can also be LIFTED onto element rows: the partition is the fiber (§10)
  defs.push(def({ id: 'over:count', label: 'over:count', kind: 'over', level: 'element', group: 'Over the fiber', desc: "the size of the element's own fiber" }, env))
  defs.push(def({ id: 'over:symbol', label: 'over:symbol', kind: 'over', level: 'element', group: 'Over the fiber', desc: "the symbol of the element's own fiber" }, env))
  for (const s of src.stats) {
    defs.push(def({ id: `dist:${s.statId}`, label: `dist:${s.statId}`, kind: 'dist', level: 'fiber', group: 'Fiber',
                    desc: `the distribution of ${s.statId} over the fiber, as one cell` }, env))
    defs.push(def({ id: `pivot:${s.statId}`, label: `pivot:${s.statId}`, kind: 'pivot', level: 'fiber', group: 'Fiber',
                    desc: `the same distribution drawn wide — one column per value of ${s.statId}` }, env))
    for (const fn of ['min', 'max', 'sum', 'avg'] as const) {
      defs.push(def({ id: `${fn}:${s.statId}`, label: `${fn}:${s.statId}`, kind: 'agg', level: 'fiber', group: 'Fiber',
                      desc: `${fn} of ${s.statId} over the fiber` }, env))
      defs.push(def({ id: `over:${fn}:${s.statId}`, label: `over:${fn}:${s.statId}`, kind: 'over', level: 'element', group: 'Over the fiber',
                      desc: `${fn} of ${s.statId} over the element's own fiber` }, env))
    }
  }
  return defs
}

// a bare stat name colliding with a structural column or one of the collection's own axes gets suffixed `_stat` by
// rows.ts's shape() (its SQL alias can't double up with the axis/structural one it shares a name with) — a seeded
// row must use that SAME id or it never matches the table's real column. Axes always win a bare name over a
// same-named stat (rows.ts checks axis before stat), so an axis token is never suffixed here either.
const RESERVED_STAT_NAMES = new Set(['rank', 'element', 'value', 'ordinality', 'count', 'level'])
function statColumnId(name: string, src: PropSources): string {
  if ((src.axes ?? []).includes(name)) return name
  if (!src.stats.some((s) => s.statId === name)) return name   // not a stat this collection has — pass through
  return RESERVED_STAT_NAMES.has(name) ? `${name}_stat` : name
}

/** The default SELECT list for a fresh collection: `src.selectText` (the row half's resolved policy list, #244) when
 *  given, else today's habit (positions + every stat) as the last resort — chunk 3 wires CollectionView to always
 *  pass it. The maps wait in the "+ add" menu either way. */
export function seedRows(src: PropSources): PropRow[] {
  const row = (propId: string, visible: boolean): PropRow => ({ uid: nextPropRowUid(), propId, visible })
  const propIdFor = (s: SelectSpec): string => (s.kind === 'name' ? statColumnId(s.name, src) : s.text)
  const visible = src.selectText
    ? parseSelect(src.selectText).map((s) => row(propIdFor(s), true))
    : [row('ordinality', true), row('address', true), row('element', true), ...src.stats.map((s) => row(s.statId, true))]
  return [...visible, ...src.maps.map((m) => row('map:' + m.id, false))]
}
