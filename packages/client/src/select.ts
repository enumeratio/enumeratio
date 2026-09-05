// The COLUMN half of a collection statement — `SELECT <projections>` — as one comma list of column SPECS, the
// mirror of the row half's per-clause text. A column is a (source, printer) pair; this file is the SOURCE half: what
// the cell holds and the SQL that computes it. The printer (plain / grouped / katex / link / svg / bars) is
// presentation, kept per column outside the URL. Design: docs/explorations/query-view/column-half.md.
//
// Specs, spelled as the URL carries them (`select=address, element, repr:cycle, map:inverse, descents`):
//   ordinality                         the result's own position           (result level)
//   rank · address · omega             the element's positions             (element)
//   element                            the canonical representation        (element)
//   repr:<name>[@<medium>]             another representation              (element)
//   <bare id>                          an AXIS or a STATISTIC              (axis / element)
//   map:<id> · through:<a>.<b>         a map image / a composed chain, rendered in the codomain   (element)
//   glyph · data · title               the SVG, the carrier as JSON, the meta title               (element)
//   count · min|max|sum|avg:<stat>     the fiber's size and aggregates     (fiber)
//   dist:<stat> · symbol               the distribution as ONE cell, the fiber's symbol           (fiber)
//   pivot:<stat>                       the same distribution drawn WIDE — one column per value    (fiber)
//   level                              GROUPING() — which level of a multi-level result the row is (fiber)
//   over:<fiber column>                a fiber column LIFTED onto element rows — `agg(…) OVER (PARTITION BY axes)`,
//                                      which is how the two levels meet (element)
//
// Bare ids are axes or statistics (the common case); every other source is prefixed, so a repr named like a stat
// (`cycle` vs `cycles` on permutations) can never collide. An unknown spec is a typed error, never a silent drop.
import { Handle, renderExprFor, runSql } from './core'

export type SelectLevel = 'result' | 'axis' | 'element' | 'fiber'
export type AggFn = 'min' | 'max' | 'sum' | 'avg'

/** A parsed column spec. `text` is its canonical spelling — the id of the column and what `select=` carries. */
export type SelectSpec =
  | { kind: 'ordinality'; text: string }
  | { kind: 'position'; position: 'rank' | 'address' | 'omega'; text: string }
  | { kind: 'element'; text: string }
  | { kind: 'repr'; repr: string; medium?: string; text: string }
  /** a bare id: an axis or a statistic — which one only the catalog knows (resolveSelect decides) */
  | { kind: 'name'; name: string; text: string }
  | { kind: 'map'; map: string; text: string }
  | { kind: 'through'; chain: string[]; text: string }
  | { kind: 'glyph'; text: string }
  | { kind: 'data'; text: string }
  | { kind: 'title'; text: string }
  | { kind: 'count'; text: string }
  | { kind: 'agg'; fn: AggFn; stat: string; text: string }
  | { kind: 'dist'; stat: string; text: string }
  | { kind: 'pivot'; stat: string; text: string }
  | { kind: 'symbol'; text: string }
  | { kind: 'level'; text: string }
  | { kind: 'over'; inner: SelectSpec; text: string }

/** What a resolved column IS, for the table and its printers. */
export type SelectKind =
  | 'ordinality' | 'rank' | 'address' | 'omega' | 'axis' | 'element' | 'repr' | 'stat' | 'map' | 'through'
  | 'glyph' | 'data' | 'title' | 'count' | 'agg' | 'dist' | 'pivot' | 'symbol' | 'level' | 'over'

/** A spec resolved against a collection: the column's id, level, and the SQL that computes it.
 *  `expr` — element/axis level: an expression over the element alias `e`.
 *  `agg`  — fiber level: an aggregate over the element relation `r`, inside the statement's GROUP BY. It is given
 *           the level's keys, the WHERE in force, and how many grouping sets the statement has (a multi-level
 *           result guards the columns that only make sense on their own level — C10).
 *  `stat` — fiber level: the statistic `r` must project for `agg` to read. */
export type SelectColumn = {
  id: string
  spec: SelectSpec
  level: SelectLevel
  kind: SelectKind
  expr?: string
  agg?: (ctx: AggContext) => string
  /** pivot only: one column per VALUE of the statistic — the values, discovered from the handle, and the cell for
   *  one of them. Filled by the row half's `shape`, which knows the handle's range. */
  values?: string[]
  cell?: (value: string) => string
  /** over only: the fiber column being lifted, and the window that computes it over a materialized relation */
  inner?: SelectColumn
  window?: (axes: string[]) => string
  stat?: { id: string; valueFunc: string }
}

/** what a fiber aggregate is spelled against: the grouping keys, the restriction in force, the number of levels */
export type AggContext = { keys: string[]; where?: string; levels: number }

const ident = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`)
const AGGS: AggFn[] = ['min', 'max', 'sum', 'avg']
/** the fiber columns `over:` can lift — one value per fiber; a whole distribution repeated per element is noise */
const OVERABLE = ['count', 'agg', 'symbol']
const ID = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Parse the `select=` text (or an already-split list) into specs. Pure — no catalog, so a bare id stays a `name`. */
export function parseSelect(text: string | string[] | undefined): SelectSpec[] {
  const parts = (Array.isArray(text) ? text : (text ?? '').split(',')).map((s) => s.trim()).filter(Boolean)
  return parts.map(parseSpec)
}

function parseSpec(raw: string): SelectSpec {
  const s = raw.trim()
  const colon = s.indexOf(':')
  if (colon < 0) {
    if (s === 'ordinality') return { kind: 'ordinality', text: s }
    if (s === 'rank' || s === 'address' || s === 'omega') return { kind: 'position', position: s, text: s }
    if (s === 'element') return { kind: 'element', text: s }
    if (s === 'glyph') return { kind: 'glyph', text: s }
    if (s === 'data') return { kind: 'data', text: s }
    if (s === 'title') return { kind: 'title', text: s }
    if (s === 'count') return { kind: 'count', text: s }
    if (s === 'symbol') return { kind: 'symbol', text: s }
    if (s === 'level' || s === 'lvl') return { kind: 'level', text: 'level' }
    if (!ID.test(s)) throw new Error(`SELECT: "${raw}" is not a column — a bare column is an axis or a statistic id`)
    return { kind: 'name', name: s, text: s }
  }
  const prefix = s.slice(0, colon).trim(), rest = s.slice(colon + 1).trim()
  if (!rest) throw new Error(`SELECT: "${raw}" is missing its argument (e.g. ${prefix}:<id>)`)
  if (prefix === 'repr') {
    const [repr, medium] = rest.split('@').map((x) => x.trim())
    if (!ID.test(repr) || (medium !== undefined && !ID.test(medium))) throw new Error(`SELECT: "${raw}" — spell a repr as repr:<name> or repr:<name>@<medium>`)
    return { kind: 'repr', repr, medium: medium || undefined, text: medium ? `repr:${repr}@${medium}` : `repr:${repr}` }
  }
  if (prefix === 'map') {
    if (!ID.test(rest)) throw new Error(`SELECT: "${raw}" — spell a map image as map:<id>`)
    return { kind: 'map', map: rest, text: `map:${rest}` }
  }
  if (prefix === 'through') {
    const chain = rest.split('.').map((x) => x.trim())
    if (chain.length < 2 || chain.some((x) => !ID.test(x))) throw new Error(`SELECT: "${raw}" — spell a map chain as through:<a>.<b>`)
    return { kind: 'through', chain, text: `through:${chain.join('.')}` }
  }
  if ((AGGS as string[]).includes(prefix)) {
    if (!ID.test(rest)) throw new Error(`SELECT: "${raw}" — spell an aggregate as ${prefix}:<statistic>`)
    return { kind: 'agg', fn: prefix as AggFn, stat: rest, text: `${prefix}:${rest}` }
  }
  if (prefix === 'over') {
    const inner = parseSpec(rest)
    if (!OVERABLE.includes(inner.kind)) throw new Error(`SELECT: "${raw}" — over: lifts a fiber column onto element rows; ${inner.text} is not one (${OVERABLE.join(', ')})`)
    return { kind: 'over', inner, text: `over:${inner.text}` }
  }
  if (prefix === 'dist' || prefix === 'pivot') {
    if (!ID.test(rest)) throw new Error(`SELECT: "${raw}" — spell a distribution as ${prefix}:<statistic>`)
    return { kind: prefix, stat: rest, text: `${prefix}:${rest}` }
  }
  throw new Error(`SELECT: "${raw}" — unknown column prefix "${prefix}:" (repr, map, through, dist, pivot, ${AGGS.join(', ')})`)
}

/** The canonical `select=` text of a spec list — the inverse of parseSelect. */
export function selectText(specs: SelectSpec[]): string {
  return specs.map((s) => s.text).join(',')
}

/** What resolveSelect needs to know about the collection — assembled by the row half's `shape`. */
export type SelectContext = {
  coll: string
  carrier: string
  axes: string[]
  /** the collection's statistics, with the `_stat` rename a column collision forced (`raw` = the registry id) */
  stats: { statId: string; raw: string; valueFunc: string }[]
  handle: Handle
}

/** Resolve specs against a collection: each becomes a column with the SQL that computes it. Throws on a spec that
 *  names nothing — an unknown repr / map / statistic is a typed error, not a dropped column. */
export async function resolveSelect(ctx: SelectContext, specs: SelectSpec[]): Promise<SelectColumn[]> {
  const out: SelectColumn[] = []
  for (const spec of specs) out.push(await resolveOne(ctx, spec))
  return out
}

const statOf = (ctx: SelectContext, id: string) => ctx.stats.find((x) => x.statId === id || x.raw === id)
const knownStats = (ctx: SelectContext) => ctx.stats.map((x) => x.statId).join(', ') || 'none'

async function resolveOne(ctx: SelectContext, spec: SelectSpec): Promise<SelectColumn> {
  const col = (o: Omit<SelectColumn, 'id' | 'spec'> & { id?: string }): SelectColumn => ({ id: spec.text, spec, ...o })
  switch (spec.kind) {
    case 'ordinality':
      return col({ level: 'result', kind: 'ordinality' })
    case 'position':
      return col({
        level: 'element', kind: spec.position,
        expr: spec.position === 'rank' ? 'rank(e)' : spec.position === 'address' ? `array_to_string(address(e), '.')` : 'notation(omega_ordinality(e))',
      })
    case 'element':
      return col({ level: 'element', kind: 'element', expr: 'render(e)' })
    case 'repr':
      return col({ level: 'element', kind: 'repr', expr: await renderExprFor(ctx.coll, spec.repr, spec.medium) })
    case 'name': {
      if (ctx.axes.includes(spec.name)) return col({ level: 'axis', kind: 'axis', expr: `${ident(spec.name)}(e)` })
      const st = statOf(ctx, spec.name)
      if (!st) throw new Error(`SELECT: "${spec.name}" is not a column of ${ctx.coll} (axes: ${ctx.axes.join(', ') || 'none'}; statistics: ${knownStats(ctx)})`)
      return col({ id: st.statId, level: 'element', kind: 'stat', expr: `${st.valueFunc}((e).value)`, stat: { id: st.statId, valueFunc: st.valueFunc } })
    }
    case 'map': {
      const m = (await ctx.handle.maps()).find((x) => x.id === spec.map)
      if (!m?.mappingFunc) throw new Error(`SELECT: ${ctx.coll} has no map "${spec.map}" (see: maps ${ctx.coll})`)
      return col({ level: 'element', kind: 'map', expr: `render_value(${m.mappingFunc}((e).value))` })
    }
    case 'through':
      return col({ level: 'element', kind: 'through', expr: `render_value(${(await chainExpr(ctx.coll, spec.chain))('(e).value')})` })
    case 'glyph': {
      if (!(await rendersSvg(ctx.carrier))) throw new Error(`SELECT: the ${ctx.carrier} carrier draws no glyph (it defines no glyph_svg overload)`)
      return col({ level: 'element', kind: 'glyph', expr: `glyph_svg((e).value)` })
    }
    case 'data':
      return col({ level: 'element', kind: 'data', expr: `to_jsonb((e).value)::text` })
    case 'title': {
      // fork 8e: a title is the meta registries' own naming column — a registered `title` statistic
      const st = statOf(ctx, 'title')
      if (!st) throw new Error(`SELECT: ${ctx.coll} has no title column — only the meta collections name their elements (use element)`)
      return col({ level: 'element', kind: 'title', expr: `${st.valueFunc}((e).value)`, stat: { id: st.statId, valueFunc: st.valueFunc } })
    }
    case 'count':
      return col({ level: 'fiber', kind: 'count', agg: () => `count(*)::text` })
    case 'agg': {
      const st = statOf(ctx, spec.stat)
      if (!st) throw new Error(`SELECT: ${ctx.coll} has no statistic "${spec.stat}" (statistics: ${knownStats(ctx)})`)
      const c = ident(st.statId)
      // avg is rounded so the accelerated sum/count and the naive avg() agree to the digit (trim_scale drops 3.000000)
      const agg = spec.fn === 'avg' ? `trim_scale(round(avg(${c})::numeric, 6))::text` : `${spec.fn}(${c})::text`
      return col({ level: 'fiber', kind: 'agg', agg: () => agg, stat: { id: st.statId, valueFunc: st.valueFunc } })
    }
    case 'dist': {
      const st = statOf(ctx, spec.stat)
      if (!st) throw new Error(`SELECT: ${ctx.coll} has no statistic "${spec.stat}" (statistics: ${knownStats(ctx)})`)
      const c = ident(st.statId)
      // the distribution as ONE cell: the per-value counts of this fiber, ordered by the value. Spelled as the
      // correlated subquery the naive statement can evaluate — the group's own rows, re-grouped by the statistic.
      return col({
        level: 'fiber', kind: 'dist', stat: { id: st.statId, valueFunc: st.valueFunc },
        agg: ({ keys, where }) => {
          const corr = keys.map((k) => `r2.${ident(k)} IS NOT DISTINCT FROM r.${ident(k)}`)
          const pred = [...(where?.trim() ? [`(${where.trim()})`] : []), ...corr].join(' AND ')
          return `(SELECT array_agg(c ORDER BY k)::text FROM (SELECT ${c} AS k, count(*) AS c FROM r r2${pred ? ` WHERE ${pred}` : ''} GROUP BY 1) d)`
        },
      })
    }
    case 'pivot': {
      const st = statOf(ctx, spec.stat)
      if (!st) throw new Error(`SELECT: ${ctx.coll} has no statistic "${spec.stat}" (statistics: ${knownStats(ctx)})`)
      // the same numbers `dist:` holds in one cell, spread across columns: `count(*) FILTER (WHERE stat = k)`
      const c = ident(st.statId)
      return col({ level: 'fiber', kind: 'pivot', stat: { id: st.statId, valueFunc: st.valueFunc },
                   cell: (v) => `count(*) FILTER (WHERE ${c} = ${Number(v)})::text` })
    }
    case 'over': {
      // the same source, evaluated over the element's OWN fiber: `count(*) OVER (PARTITION BY axes)`. The partition
      // IS the fiber, so the plan reads it off the fiber rather than windowing a slice of them.
      const inner = await resolveOne(ctx, spec.inner)
      return col({ level: 'element', kind: 'over', stat: inner.stat, inner,
                   window: (axes) => {
                     const part = axes.length ? ` OVER (PARTITION BY ${axes.map(ident).join(', ')})` : ' OVER ()'
                     if (inner.kind === 'symbol') return `fiber_symbol(ROW(${axes.map(ident).join(', ')})::${ctx.coll}_fiber)`
                     if (inner.kind === 'count') return `(count(*)${part})::text`
                     const c = ident(inner.stat!.id), fn = (spec.inner as { fn: AggFn }).fn
                     return fn === 'avg' ? `trim_scale(round((avg(${c})${part})::numeric, 6))::text` : `(${fn}(${c})${part})::text`
                   } })
    }
    case 'symbol':
      // a symbol names a WHOLE fiber, so on a multi-level result it belongs to the level whose keys ARE the fiber's
      // (C10: `S₃` on the (size) row, NULL on the element rows and the footer). A level grouped by a bare PREFIX of
      // the axes (fewer keys than the collection has) names a coarser partial fiber with no registered symbol at
      // all — NULL, same as an off-level row, never a short ROW cast to the full `<coll>_fiber` composite (#255).
      return col({ level: 'fiber', kind: 'symbol', agg: ({ keys, levels }) => {
        if (keys.length < ctx.axes.length) return 'NULL'
        const sym = `fiber_symbol(ROW(${keys.map(ident).join(', ')})::${ctx.coll}_fiber)`
        return levels > 1 ? `CASE WHEN grouping(${keys.map(ident).join(', ')}) = 0 THEN ${sym} END` : sym
      } })
    case 'level':
      // the plan's own level marker, named: multi-level results already carry this column
      return col({ level: 'fiber', kind: 'level', agg: ({ keys }) => `grouping(${keys.map(ident).join(', ')})` })
  }
}

/** `fn_b(fn_a(<inner>))` — each map's codomain feeding the next map's domain (base_map_resolved). */
async function chainExpr(coll: string, chain: string[]): Promise<(inner: string) => string> {
  let at = coll
  const fns: string[] = []
  for (const id of chain) {
    const [m] = await runSql<{ fn: string; codomain: string }>(
      `SELECT mapping_fn AS fn, codomain FROM base_map_resolved WHERE collection = $1 AND map_id = $2`, [at, id])
    if (!m) throw new Error(`SELECT: through:${chain.join('.')} — ${at} has no map "${id}"`)
    fns.push(m.fn)
    at = m.codomain
  }
  return (inner: string) => fns.reduce((acc, fn) => `${fn}(${acc})`, inner)
}

let _svg: Map<string, boolean> | null = null
async function rendersSvg(carrier: string): Promise<boolean> {
  if (!_svg) {
    const rs = await runSql<{ carrier: string; ok: boolean }>(
      `SELECT DISTINCT carrier, carrier_renders_svg(carrier) AS ok FROM base_collection`)
    _svg = new Map(rs.map((r) => [r.carrier, r.ok]))
  }
  return _svg.get(carrier) ?? false
}

// ── printers, and the grants that decide which an environment may draw (#244) ─────────────────────────────────────
// §9's borrowed structure: `GRANT SELECT (col, …) ON table TO role` is the column half per ENVIRONMENT. `select=`
// names the columns; the environment decides which printers may draw them — web draws inline SVG and links, print
// draws neither (a link degrades to spelled text), a terminal draws text only. What was GRANTS × BY_KIND is now
// policy_printers(kind, env) rows (policies.sql) — a per-environment cache, primed once (primePrinters, called from
// core.ts's provideDb — the client's one boot seam), read synchronously thereafter.
export type Printer = 'plain' | 'grouped' | 'katex' | 'link' | 'svg' | 'bars'
export type Environment = 'web' | 'print' | 'terminal'

const PRINTER_KINDS: SelectKind[] = [
  'ordinality', 'rank', 'address', 'omega', 'level', 'axis', 'element', 'repr', 'stat', 'map', 'through',
  'glyph', 'data', 'title', 'count', 'agg', 'dist', 'pivot', 'over', 'symbol',
]
type PrinterCache = { byKind: Map<SelectKind, Printer[]>; katex: boolean }
const _printerCache = new Map<Environment, PrinterCache>()

/** Fill the printer cache for `environment` from the registry — ONE query (every kind, unnested). `katex` isn't a
 *  kind's own preference (it rides `latex`, below) — granted unless the environment's restrictive printer row at
 *  scope `all` revokes it (today only `terminal` does). Re-primeable; printersFor stays synchronous and reads
 *  whatever is cached, so a page never awaits this — it just draws `plain` until the prime lands. */
export async function primePrinters(environment: Environment = 'web'): Promise<void> {
  const kinds = PRINTER_KINDS.map((k) => `'${k}'`).join(',')
  const rows = await runSql<{ kind: SelectKind; printers: Printer[]; katex_ok: boolean }>(`
    SELECT k.kind, policy_printers(k.kind, $1) AS printers, r.katex_ok
      FROM unnest(ARRAY[${kinds}]) AS k(kind)
      CROSS JOIN LATERAL (
        SELECT NOT EXISTS (
          SELECT 1 FROM base_policy_all p, unnest(string_to_array(p.text, ',')) x
           WHERE p.clause = 'printer' AND p.mode = 'restrictive' AND p.scope_kind = 'all'
             AND (p.environment = $1 OR p.environment = '*') AND btrim(x) = 'katex'
        ) AS katex_ok
      ) r`, [environment])
  _printerCache.set(environment, { byKind: new Map(rows.map((r) => [r.kind, r.printers])), katex: rows[0]?.katex_ok ?? true })
}

/** The printers `environment` is granted for a column of this kind, in preference order (the first is its default).
 *  `latex` adds `katex`, when the environment hasn't revoked it (§2). Never empty — `plain` is granted everywhere,
 *  including before the cache is primed (never throw — a page draws plain until then). */
export function printersFor(kind: SelectKind, opts: { latex?: boolean; environment?: Environment } = {}): Printer[] {
  const cache = _printerCache.get(opts.environment ?? 'web')
  if (!cache) return ['plain']
  const base = cache.byKind.get(kind) ?? ['plain']
  return opts.latex && cache.katex ? ['katex', ...base] : base
}
/** the printers granted for a resolved column — its spec decides whether katex is on the list */
export const printersForColumn = (col: Pick<SelectColumn, 'kind' | 'spec'>, environment?: Environment): Printer[] =>
  printersFor(col.kind, { latex: col.spec.kind === 'repr' && col.spec.medium === 'latex', environment })
