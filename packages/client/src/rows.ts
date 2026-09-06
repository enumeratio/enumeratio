// The ROW half of a collection statement — FROM · WHERE · GROUP BY · HAVING · ORDER BY — as one query object with
// three faces: the QUERY STRING (one parameter per SQL segment, each holding that segment's text), the LOGICAL SQL (a
// real, evaluable statement over the element relation — the naive oracle), and a PLAN of accelerated requests composed
// client-side, one per grouping-set level. The SELECT list (which stats to show) is the other half and stays with the
// collection explorer. Design: wiki Query-Model + the query-view proposal.
//
// The element relation R(C) every clause reads — one row per element of the handle, every grade AXIS a column:
//   SELECT size(e) AS size, rank(e) AS rank, render(e) AS element, perm_descents((e).value) AS descents, …
//   FROM elements(permutations()) e
// `rank` = the within-fiber canonical position (what element_at inverts); `ordinality` = the 1-based position in THIS
// result (pg WITH ORDINALITY), computed per query. Predicates classify by what they REFERENCE, not the keyword: an
// axis predicate is a BINDING (selects fibers, ranks intact — it belongs in the handle: `permutations(size=4)`), an
// element predicate is a RESTRICTION (WHERE; drops rows inside fibers), a fiber-measure predicate is a LENS (HAVING;
// hides fiber rows, the whole stays the whole — under ROLLUP the footer keeps the handle's cardinality).
import { Handle, catalogMap, collectionParams, renderExprFor, runSql, familyPoints, type ParamValue, type Row, type Cell } from './core'
import { sizeWindow } from './window-sizer'
import { parsePreds, predsToSql, type Pred } from './preds'
import { parseSelect, resolveSelect, type Environment, type SelectColumn, type SelectKind, type SelectSpec } from './select'

/** The row half. Each field is the TEXT of that SQL segment (as typed / as in the URL). */
export type RowQuery = {
  /** the handle: `permutations` · `permutations(size=4)` · `k_subsets(n=2..4, k=2)` · positional `k_subsets(4, 2)` */
  from: string
  /** element predicate over R(C)'s columns (axes, rank, element, stats) — a restriction */
  where?: string
  /** `size` · `size, descents` · `ROLLUP (n, k)` · `GROUPING SETS ((n, k, rank), (n))` */
  groupBy?: string
  /** fiber-level predicate: measures (`count > 5`) or keys (`k = 2`) — a lens */
  having?: string
  /** sort keys over the result's columns; empty = canonical (axes…, rank) */
  orderBy?: string
}

export type Archetype = 'elements' | 'fibers' | 'distribution' | 'rollup' | 'rowgroup'
/** every source of the column half (select.ts) */
export type ColumnKind = SelectKind
export type RowColumn = { id: string; kind: ColumnKind }
export type RowTable = {
  archetype: Archetype
  columns: RowColumn[]
  rows: Row[]
  /** grouped archetypes: the grouping keys in order (axes and/or a stat); elements: [] */
  keys: string[]
  /** rowgroup: one row per fiber group (keys + count) — the subheaders; else undefined */
  subtotals?: Row[]
  /** |result| when known: the handle's cardinality for an unfiltered element view (null = ∞ / unknown), the row
   *  count for a materialized one */
  total: number | null
  /** the handle is OPEN and the rows are a frontier — more exist past what was fetched */
  frontier: boolean
  /** columns the plan DEFERRED — projected by `planDeferred` for the rows actually in view, not for the window
   *  blindly (`glyph` is ~0.5 KB of SVG per row). Empty in eager mode. */
  deferred: string[]
  /** the logical SQL this table is the result of — evaluable on a bounded handle; the naive oracle for the plan */
  sql: string
  /** every column of the element relation R(C) a clause may name — axes, rank, element, the stats — for editors */
  available: string[]
}
export type RowWindow = { first?: number; count?: number; fiberLimit?: number }
/** The COLUMN half — the SELECT list, passed alongside the row query (select.ts holds its grammar).
 *  `select`: the column specs, as the `select=` text or an already-split list. Element-level specs ride the slice
 *  query; fiber-level ones (count / min|max|sum|avg / dist / symbol) land on grouped rows. Empty resolves the
 *  archetype's default list from the policy registry (policy_resolve, #244) instead of a hardcoded fallback.
 *  `repr`: the named representation the default `element` column renders under — a page-wide medium switch, kept
 *  alongside the literal `repr:<name>` spec (fork 8e: both coexist).
 *  `eager`: the whole table is fetched at once, so nothing is worth deferring (fork 8c).
 *  `environment`: which policy applies when `select` is empty (default 'web') — the smaller diff over a module-level
 *  setter (#244 chunk 2's A-fork); threaded like `repr`/`eager`, not global state. */
export type RowSelect = { select?: string[] | string; repr?: string; eager?: boolean; environment?: Environment }

/** The collection's opening statement (base_policy_resolved, #245) — one row per (collection, environment). The
 *  explorer fetches this ONCE per collection navigation and caches it alongside the rest of the collection's shape
 *  (CollectionView.loadDerived), driving the eager / binding / group_by / window defaults without a query per clause. */
export type PolicyResolved = {
  archetype: Archetype
  selectList: string | null
  binding: string | null
  groupBy: string | null
  where: string | null
  having: string | null
  orderBy: string | null
  windowSize: number | null
  /** 'always', or a cardinality threshold as text — the caller compares it against the handle's own cardinality */
  eager: string | null
}

export async function policyResolved(coll: string, environment: Environment = 'web'): Promise<PolicyResolved | null> {
  const [row] = await runSql<{
    archetype: Archetype; select_list: string | null; binding: string | null; group_by: string | null
    where_clause: string | null; having_clause: string | null; order_by: string | null
    window_size: string | null; eager: string | null
  }>(
    `SELECT archetype, select_list, binding, group_by, where_clause, having_clause, order_by, window_size, eager
       FROM base_policy_resolved WHERE collection = $1 AND environment = $2`, [coll, environment])
  if (!row) return null
  return {
    archetype: row.archetype, selectList: row.select_list, binding: row.binding, groupBy: row.group_by,
    where: row.where_clause, having: row.having_clause, orderBy: row.order_by,
    windowSize: row.window_size == null ? null : Number(row.window_size), eager: row.eager,
  }
}

/** The resolved SELECT list for `coll` × `environment`, forced to the ELEMENTS archetype (#246) — the CLI/terminal's
 *  projection when the user names no columns: a bare `enumeratio permutations 4` always enumerates elements (never a
 *  grouped level, whatever the collection's OWN derived group_by resolves for the explorer), so this reads
 *  policy_resolve directly instead of base_policy_resolved's per-collection archetype. Empty only when unseeded. */
export async function terminalSelect(coll: string, environment: Environment = 'terminal'): Promise<string[]> {
  const [row] = await runSql<{ resolved: string | null }>(
    `SELECT policy_resolve($1, $2, 'select', 'elements') AS resolved`, [coll, environment])
  return row?.resolved ? row.resolved.split(',').map((s) => s.trim()).filter(Boolean) : []
}

// ── the query string: one parameter per SQL segment, the SELECT list among them ───────────────────────────────────
/** The whole statement as the URL carries it: the row half's clauses plus `select=`, the column half's list. */
export type RowStatement = RowQuery & { select?: string }
const PARAM: Record<keyof RowStatement, string> = { from: 'from', select: 'select', where: 'where', groupBy: 'group_by', having: 'having', orderBy: 'order_by' }
const SEGMENTS = ['from', 'select', 'where', 'groupBy', 'having', 'orderBy'] as const

/** `columns=` is #174's stat/map list — read as a legacy alias of `select=`, never written again (fork 8c). */
export function rowQueryFromSearch(search: string): RowStatement {
  const p = new URLSearchParams(search)
  const q: RowStatement = { from: p.get('from') ?? '' }
  for (const k of SEGMENTS) { const v = p.get(PARAM[k]); if (v) q[k] = v }
  if (!q.select) { const legacy = p.get('columns'); if (legacy) q.select = legacy }
  return q
}
export function searchFromRowQuery(q: RowStatement): string {
  const p = new URLSearchParams()
  for (const k of SEGMENTS) { const v = q[k]?.trim(); if (v) p.set(PARAM[k], v) }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ── the FROM: the handle's own text form ──────────────────────────────────────────────────────────────────────────
export type ParsedHandle = { coll: string; named: Record<string, ParamValue>; positional: ParamValue[] }

/** The grammar inside a handle's parens — `4` · `4, 2` · `size=4` · `n=2..4, k=2` — factored out of parseHandle so
 *  resolveFrom's family-point matching (below) can parse a POINT's or a FAMILY's own arg list without a throwaway
 *  collection name in front. An open range `axis=0..` is the unbound axis (dropped); a lower-bounded open range
 *  past 0 is not representable and throws. */
function parseBindingArgs(inner: string): { named: Record<string, ParamValue>; positional: ParamValue[] } {
  const out = { named: {} as Record<string, ParamValue>, positional: [] as ParamValue[] }
  const text = inner.trim()
  if (!text) return out
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const kv = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    const [name, val] = kv ? [kv[1], kv[2].trim()] : [null, part]
    const r = val.match(/^(-?\d+)?\s*\.\.\s*(-?\d+)?$/)
    let v: ParamValue | undefined
    if (r) {
      const lo = r[1] != null ? Number(r[1]) : 0
      if (r[2] == null) { if (lo === 0) v = undefined; else throw new Error(`FROM: ${name ?? 'axis'}=${val} — an open range must start at 0 (leave the axis unbound instead)`) }
      else v = [lo, Number(r[2])]
    } else if (/^-?\d+$/.test(val)) v = Number(val)
    else throw new Error(`FROM: "${part}" is not a binding — use axis=4 or axis=2..4`)
    if (v === undefined) continue
    if (name) out.named[name] = v
    else out.positional.push(v)
  }
  return out
}
/** `coll` · `coll(4)` · `coll(4, 2)` · `coll(size=4)` · `coll(n=2..4, k=2)`. */
export function parseHandle(text: string): ParsedHandle {
  const m = text.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\((.*)\))?$/s)
  if (!m) throw new Error(`FROM: expected a collection, optionally with bindings — e.g. k_subsets(n=2..4, k=2); got "${text}"`)
  const { named, positional } = parseBindingArgs(m[2] ?? '')
  return { coll: m[1], named, positional }
}
/** Bind a parsed arg list (positional + named) onto a grade CHAIN, by position / by name — the same mapping
 *  toHandle itself uses, factored out for resolveFrom's family-point matching (which binds against a POINT's or a
 *  FAMILY's own chain, not a live Handle). Unknown names / out-of-range positions are silently dropped: this is a
 *  best-effort rewrite, never a hard parse — an ill-formed FROM still reaches toHandle's own, better error. */
function bindArgsToChain(args: { named: Record<string, ParamValue>; positional: ParamValue[] }, chain: string[]): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  args.positional.forEach((v, i) => { if (chain[i]) out[chain[i]] = v })
  for (const [k, v] of Object.entries(args.named)) if (chain.includes(k)) out[k] = v
  return out
}

/** The canonical text of a handle: the core's own `coll(axis=v, axis=lo..hi)` spelling (unbound axes omitted). */
export function handleText(coll: string, args: Record<string, ParamValue>, chain: string[]): string {
  const parts = chain.filter((a) => args[a] !== undefined).map((a) => {
    const v = args[a]!
    return `${a}=${Array.isArray(v) ? `${v[0]}..${v[1]}` : v}`
  })
  return parts.length ? `${coll}(${parts.join(', ')})` : coll
}

// ── construction-FROM: a FROM may name a CONSTRUCTION and bind its type parameters, resolving to a realized
// collection (O.1 — sugar only, no on-the-fly realization). `finsets_of(natural_number)` → finsets;
// `finsets_of(fin(4))` → subsets(n=4); `maps_of(fin(n), fin(n))` → endofunctions (the diagonal); `maps_of(fin(3), fin(2))`
// → binary_words(n=3). O.2 model (i): the α-binding picks the GROUND, so among instances sharing the construction we
// resolve to the COARSEST (fewest grade axes) — finer fibrations (k_subsets) are reached by grading, not by α. O.6: the
// construction FROM-name is plural + `_of`, read from base_construction.from_name; the per-position bindings come from
// base_alpha — nothing about a particular construction lives in this file.

/** A type-parameter value in a FROM, spelled with the handle grammar `name` / `name(args)`: a bare domain
 *  (`natural_number` = ℕ, arity 0), a former application (`fin(n)` / `fin(4)` = Fin, arity 1), or a COLLECTION as a
 *  type (`permutations(n)`, `words(n, 2)` — a collection-former, arity = its grade count). Each arg is a constant or a
 *  symbol; two args spelling the SAME symbol ask for the diagonal (β = α, or one axis shared across factors). */
type TypeArg = { former: string; args: { text: string; constant: boolean; symbol: string | null }[] }
type Former = { id: string; arity: number; collection: boolean }
let _formers: Promise<Map<string, Former>> | null = null
async function formers(): Promise<Map<string, Former>> {
  return (_formers ??= runSql<{ id: string; arity: number; collection: boolean }>(
    `SELECT tf.id, tf.arity, coalesce(e.enumeration = tf.id, false) AS collection FROM base_type_former tf LEFT JOIN base_type_former_enumeration e ON e.type_former = tf.id`)
    .then((rs) => new Map(rs.map((r) => [r.id, { id: r.id, arity: Number(r.arity), collection: r.collection }]))))
}
async function parseTypeArg(t: string): Promise<TypeArg> {
  const s = t.trim()
  if (s === 'natural_number' || s === 'ℕ') return { former: 'ℕ', args: [] }
  const m = s.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*(.*?)\s*\))?$/s)
  if (!m) throw new Error(`FROM: "${t}" is not a type — use natural_number, fin(n) / fin(4), or a collection such as permutations(n)`)
  const fs = await formers()
  const former = m[1].toLowerCase() === 'fin' ? 'Fin' : m[1]
  const f = fs.get(former)
  if (!f) throw new Error(`FROM: "${m[1]}" is not a type-former (Fin, ℕ, or a collection registered as one: ${[...fs.values()].filter((x) => x.collection).map((x) => x.id).join(', ')})`)
  const args = m[2] ? splitArgs(m[2]).map((x) => ({ text: x, constant: /^\d+$/.test(x), symbol: /^\d+$/.test(x) ? null : x })) : []
  if (args.length !== f.arity) throw new Error(`FROM: ${former} takes ${f.arity} argument${f.arity === 1 ? '' : 's'}; got ${args.length}`)
  return { former, args }
}
/** split `a, b(c, d), e` at top-level commas */
function splitArgs(inner: string): string[] {
  const out: string[] = []; let depth = 0, cur = ''
  for (const ch of inner) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

let _fromNames: Promise<Map<string, string>> | null = null
/** from_name → construction id, from base_construction (memoized). */
async function constructionFromNames(): Promise<Map<string, string>> {
  return (_fromNames ??= runSql<{ id: string; from_name: string }>(`SELECT id, from_name FROM base_construction WHERE from_name IS NOT NULL`)
    .then((rs) => new Map(rs.map((r) => [r.from_name, r.id]))))
}
/** The FROM-able construction names (for a picker / datalist). */
export async function constructionNames(): Promise<string[]> {
  return [...(await constructionFromNames()).keys()].sort()
}

type Binding = { collection: string; pos: number; type_former: string; param: string | null; generic: boolean; alpha_axis: string | null; grades: number }

/** `resolveFrom`'s family-point half (#67 B5, base_family_point). Two directions, and which one a point takes turns
 *  on whether it owns a realized SQL tower:
 *
 *  A PURE POINTER (cube_free_numbers — base_alias skips base_realize, so `alias_of` is set and it has NO constructor
 *  of its own) MUST rewrite forward to `family(bindings ⊕ args)` — `cube_free_numbers` → `k_free_integers(k=3)` —
 *  or it would fail to build at all.
 *
 *  A REALIZED point (binary_words, twin_primes — owns its own tower: carrier, engines, its own axis names, `alias_of`
 *  NULL) is left ALONE: it is its own canonical, directly-buildable collection (`binary_words` / `binary_words(4)`),
 *  and the reverse fold below already turns `words(base=2)` back INTO `binary_words`, so rewriting it the other way
 *  would be anti-canonical. It would also break the ones whose bound family PARAM sits behind an unbound family AXIS:
 *  `binary_words` binds words' `base` (grade 2) but leaves `size` (grade 1) free, and `words(base=2)` cannot be built
 *  positionally (the pg ctor's trailing-unbound convention) — whereas `binary_words()` builds fine as an open handle
 *  over its own `n`. Building it directly also keeps the resolved-per-collection select_list aligned with the handle.
 *
 *  The reverse — a family bound to EXACTLY a registered point's own `bindings`, no OTHER axis also given — folds
 *  forward to that point's id: `prime_pairs(gap=2)` → `twin_primes`, `words(base=2)` → `binary_words`. Narrower than
 *  "every family axis bound": `words(size=4, base=2)` ALSO binds `size` (an ordinary grade axis, real query intent —
 *  its own registered stats/element-relations may differ from binary_words'), so it stays `words` rather than
 *  silently detouring through a differently-registered collection. This direction ALSO skips a pure-pointer point
 *  (cube_free_numbers) — resolveFrom runs exactly ONCE per toHandle call, so folding forward onto an id with no
 *  constructor of its own would just build broken SQL; a pure pointer only ever reads the OTHER way. `words(base=2)`
 *  → `binary_words` is safe because binary_words owns its own realized tower.
 *
 *  Either way, the two collections' own remaining axes line up POSITIONALLY, not by name (a realized point mints
 *  its own axis names — binary_words' `n` vs words' `size`). Returns null when `name` is neither — a safe no-op,
 *  same contract as resolveCollectionAlias, when base_family_point is empty or nothing matches. */
async function resolveFamilyPointFrom(name: string, argsInner: string | undefined): Promise<string | null> {
  const points = await familyPoints()
  const cat = await catalogMap()
  const point = points[name]
  // only a PURE POINTER (no tower of its own, so `alias_of` is set) forward-rewrites; a realized point builds directly
  if (point && cat.get(name)?.aliasOf) {
    const pointChain = cat.get(name)?.grades ?? []
    const familyChain = cat.get(point.family)?.grades ?? []
    const remaining = familyChain.filter((g) => !(g in point.bindings))
    const pointArgs = bindArgsToChain(parseBindingArgs(argsInner ?? ''), pointChain)
    const familyArgs: Record<string, ParamValue> = { ...point.bindings }
    pointChain.forEach((ax, i) => { if (pointArgs[ax] !== undefined && remaining[i]) familyArgs[remaining[i]] = pointArgs[ax] })
    return handleText(point.family, familyArgs, familyChain)
  }
  if (argsInner === undefined) return null   // direction B needs an explicit binding — a bare family name isn't one
  const familyChain = cat.get(name)?.grades ?? []
  if (!familyChain.length) return null
  const args = bindArgsToChain(parseBindingArgs(argsInner), familyChain)
  const boundKeys = Object.keys(args)
  for (const p of Object.values(points)) {
    if (p.family !== name || cat.get(p.collection)?.aliasOf) continue   // a pure pointer has no constructor to fold onto
    const paramKeys = Object.keys(p.bindings)
    if (boundKeys.length !== paramKeys.length) continue                                              // an extra bound axis stays the family
    if (!paramKeys.every((k) => typeof args[k] === 'number' && args[k] === p.bindings[k])) continue
    return p.collection   // no remaining args to carry: boundKeys == paramKeys exactly, so the point's own axes stay unbound
  }
  return null
}

/** Rewrite a construction-FROM (`finsets_of(fin(4))`, `maps_of(fin(n), fin(n))`, `products_of(permutations(n), words(n, 2))`)
 *  to a realized collection handle text (`subsets(n=4)`, `endofunctions`, `signed_permutations`), OR a family-point
 *  spelling (`twin_primes` ⇄ `prime_pairs(gap=2)`, #67 B5) to its other side; returns the text unchanged when it is
 *  an ordinary collection handle. Async — it reads base_construction / base_alpha / base_family_point. */
export async function resolveFrom(text: string): Promise<string> {
  const trimmed = text.trim()
  const g = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(\s*(.*?)\s*\))?$/s)
  if (g) {
    try {
      const fp = await resolveFamilyPointFrom(g[1], g[2])
      if (fp) return fp
    } catch { /* an ill-formed binding falls through — toHandle's own parseHandle raises the same error properly */ }
  }
  const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*(.*?)\s*\)$/s)
  if (!m) return text
  const construction = (await constructionFromNames()).get(m[1])
  if (!construction) return text
  const args = await Promise.all(splitArgs(m[2]).map(parseTypeArg))
  const rows = await runSql<Binding>(
    `SELECT a.collection, a.pos, a.type_former, a.param, a.generic, a.alpha_axis,
            (SELECT count(*)::int FROM base_grade g WHERE g.collection = a.collection) AS grades
       FROM base_alpha a WHERE a.construction = $1 AND a.restricted IS NULL ORDER BY a.collection, a.pos`, [construction])   // a bare application never resolves to a restricted sub-family
  if (!rows.length) throw new Error(`FROM: ${m[1]} has no realized instance to resolve to`)
  const byColl = new Map<string, Binding[]>()
  for (const r of rows) byColl.set(r.collection, [...(byColl.get(r.collection) ?? []), r])
  const arity = Math.max(...rows.map((r) => r.pos))
  if (args.length !== arity) throw new Error(`FROM: ${m[1]} takes ${arity} type parameter${arity === 1 ? '' : 's'}; got ${args.length}`)
  const fs = await formers()
  // A candidate instance must match every position: the former; then, token by token, a constant either pinned at
  // that value or bindable through an axis; a symbol needs an axis-bound token and the SAME symbol must land on the
  // same token everywhere (the diagonal; a shared axis across factors), distinct symbols on distinct tokens.
  // A Fin position's registered token is the Nat SYMBOL (words' `b`) with alpha_axis naming the axis; a
  // collection-former position's tokens are this collection's axis names directly (`size, colors`).
  type Cand = { collection: string; bs: Binding[]; pinned: number; grades: number; bind: Record<string, ParamValue> }
  const cands: Cand[] = []
  for (const [collection, bs] of byColl) {
    if (bs.length !== arity) continue
    let ok = true, pinned = 0
    const symbolToken = new Map<string, string>()
    const bind: Record<string, ParamValue> = {}
    for (let i = 0; i < args.length && ok; i++) {
      const arg = args[i], b = bs[i]
      if (b.type_former !== arg.former) { ok = false; break }
      const tokens = (b.param ?? '').split(',').map((x) => x.trim()).filter(Boolean)
      if (tokens.length !== arg.args.length) { ok = false; break }
      for (let j = 0; j < arg.args.length; j++) {
        const a = arg.args[j], tok = tokens[j]
        const tokConst = /^\d+$/.test(tok)
        const axis = fs.get(b.type_former)?.collection ? (tokConst ? null : tok) : b.alpha_axis   // where a constant would bind
        if (a.constant) {
          if (tokConst && tok === a.text) pinned++
          else if (axis) bind[axis] = Number(a.text)
          else { ok = false; break }
        } else if (a.symbol) {
          if (tokConst || !axis) { ok = false; break }                               // a symbol needs a position that RANGES
          const prev = symbolToken.get(a.symbol)
          if (prev != null ? prev !== tok : [...symbolToken.values()].includes(tok)) { ok = false; break }
          symbolToken.set(a.symbol, tok)
        }
      }
    }
    if (ok) cands.push({ collection, bs, pinned, grades: bs[0].grades, bind })
  }
  if (!cands.length) throw new Error(`FROM: no realized ${m[1]}(${args.map((a) => (a.args.length ? `${a.former === 'Fin' ? 'fin' : a.former}(${a.args.map((x) => x.text).join(', ')})` : a.former === 'ℕ' ? 'natural_number' : a.former)).join(', ')})`)
  cands.sort((x, y) => y.pinned - x.pinned || x.grades - y.grades)   // prefer pinned aliases, then O.2 model (i): coarsest
  const pick = cands[0]
  const chain = (await catalogMap()).get(pick.collection)?.grades ?? []
  return handleText(pick.collection, pick.bind, chain)
}

/** Resolve a FROM text to a Handle: a construction-FROM resolves to its realized collection first; then positional
 *  bindings fill the grade chain in order, named ones by axis. */
export async function toHandle(text: string): Promise<Handle> {
  const p = parseHandle(await resolveFrom(text))
  const cat = (await catalogMap()).get(p.coll)
  if (!cat) throw new Error(`FROM: unknown collection "${p.coll}"`)
  const args: Record<string, ParamValue> = {}
  p.positional.forEach((v, i) => {
    const axis = cat.grades[i]
    if (!axis) throw new Error(`FROM: ${p.coll} has ${cat.grades.length} axis(es) (${cat.grades.join(', ') || 'none'}); binding #${i + 1} has nothing to bind`)
    args[axis] = v
  })
  for (const [k, v] of Object.entries(p.named)) {
    const axis = k === 'size' && !cat.grades.includes('size') ? cat.grades[0] : k
    if (!axis || !cat.grades.includes(axis)) throw new Error(`FROM: ${p.coll} has no axis "${k}" (axes: ${cat.grades.join(', ') || 'none'})`)
    args[axis] = v
  }
  // a bound axis behind an unbound one can't be built positionally (the pg ctor's trailing-unbound convention)
  const idx = cat.grades.map((a) => args[a] !== undefined)
  const firstUnbound = idx.indexOf(false)
  if (firstUnbound >= 0 && idx.slice(firstUnbound).some(Boolean)) {
    throw new Error(`FROM: bind ${cat.grades[firstUnbound]} before ${cat.grades.slice(firstUnbound + 1).filter((_, j) => idx[firstUnbound + 1 + j]).join(', ')} — an axis can only be bound behind bound ones`)
  }
  return new Handle(p.coll, args)
}

// ── the GROUP BY segment ──────────────────────────────────────────────────────────────────────────────────────────
export type Grouping = { sets: string[][]; rollup: boolean }

export function parseGroupBy(text: string): Grouping {
  const t = text.trim()
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
  let m = t.match(/^rollup\s*\((.*)\)$/is)
  if (m) { const keys = list(m[1]); return { rollup: true, sets: keys.map((_, i) => keys.slice(0, keys.length - i)).concat([[]]) } }
  m = t.match(/^grouping\s+sets\s*\((.*)\)$/is)
  if (m) {
    const sets: string[][] = []
    let depth = 0, cur = ''
    for (const ch of m[1]) {
      if (ch === '(') { depth++; if (depth === 1) { cur = ''; continue } }
      if (ch === ')') { depth--; if (depth === 0) { sets.push(list(cur)); cur = ''; continue } }
      if (depth === 0) { if (ch === ',') { const one = cur.trim(); if (one) sets.push([one]); cur = '' } else cur += ch }
      else cur += ch
    }
    const tail = cur.trim(); if (tail) sets.push([tail])
    return { rollup: false, sets }
  }
  return { rollup: false, sets: [list(t)] }
}

// ── the plan ──────────────────────────────────────────────────────────────────────────────────────────────────────
const ident = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`)

/** Replace kernel TOKENS (`orbit:rotation`, `map:inverse`) with the alias of the column R(C) projects for them,
 *  in a clause that could not be parsed into terms and so must be spliced verbatim.
 *
 *  Scanning, not a regex, because a regex cannot tell a column reference from the inside of a string: a plain
 *  global replace turned `element LIKE '%map:inverse%'` into `element LIKE '%"map:inverse"%'`, silently changing
 *  what the user searched for. Quoted strings ('' escapes included) and quoted identifiers are copied through
 *  untouched; only bare text is rewritten, and only on a whole-token boundary. */
function rewriteTokens(text: string, kernels: Map<string, Kernel>): string {
  if (!kernels.size) return text
  const boundary = (ch: string | undefined) => ch === undefined || !/[A-Za-z0-9_:]/.test(ch)
  let out = '', i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === "'" || ch === '"') {                       // a string literal or a quoted identifier: copy verbatim
      const q = ch
      out += ch; i++
      while (i < text.length) {
        out += text[i]
        if (text[i] === q) { if (text[i + 1] === q) { out += text[++i]; i++; continue } i++; break }
        i++
      }
      continue
    }
    const hit = boundary(text[i - 1])
      ? [...kernels.values()].find((k) => text.startsWith(k.token, i) && boundary(text[i + k.token.length]))
      : undefined
    if (hit) { out += ident(hit.alias); i += hit.token.length; continue }
    out += ch; i++
  }
  return out
}
/** a cardinality as the core spells it — numeric text, 'Infinity' for ∞ — never a JS number (171! already overflows) */
const cardText = (v: Cell): string => (v == null ? 'Infinity' : String(v))
const addCards = (a: string, b: string): string => (a === 'Infinity' || b === 'Infinity' ? 'Infinity' : (BigInt(a) + BigInt(b)).toString())
/** A sibling triangle has one fiber per (n, k), and a row's cells grow with the row (the Eulerian row at n = 199 is
 *  200 numbers of ~300 digits each). Cap the read by CELLS, not by parent fibers: past the cap the level's remaining
 *  rows are a frontier, exactly as a truncated fiber stream already is. */
const SIBLING_CELL_CAP = 2000
const sqlNum = (v: Cell): string => (v == null ? 'NULL::numeric' : String(v) === 'Infinity' ? `'infinity'::numeric` : `${String(v)}::numeric`)

type Shape = {
  h: Handle; built: string; coll: string; carrier: string; axes: string[]; open: boolean; card: number | null
  stats: { statId: string; raw: string; valueFunc: string }[]
  /** the `element` column's render expression over alias `e` — canonical, or the named repr's render_fn */
  render: string
  /** the SELECT half's columns, resolved against this collection (empty = the archetype's defaults) */
  sel: SelectColumn[]
  /** the columns too heavy to ride a streamed window — projected per rows-in-view instead (§4) */
  deferred: Set<string>
  /** KERNEL group keys a GROUP BY / ORDER BY names — `orbit:<rel>` (an equivalence relation's canonical_fn) and
   *  `map:<map>` (a base_map image), keyed by their token. Each projects a rendered class-representative column into
   *  R(C); `GROUP BY orbit:<rel>` = `GROUP BY map:<canonical_fn>` (element-relations doc, crux b — #203's map kernel). */
  kernels: Map<string, Kernel>
  /** ORDER BY <rel> over a graded cover relation — the token → its derived rank plan (a value→rank CTE and the
   *  ordering it induces). Empty unless ORDER BY names a graded cover; a non-graded / non-cover relation throws at
   *  resolve time (disable-with-reason). */
  orderRels: Map<string, OrderRel>
}
/** a kernel group key: `render_value(<fn>((e).value))` printed as the class representative in the codomain's repr */
type Kernel = { token: string; alias: string; expr: string; kind: ColumnKind }
/** a graded cover relation an ORDER BY names: the CTE deriving each element's rank (chain length from a minimum) and
 *  the ORDER BY expression it desugars to (`ORDER BY rank(<rel>)`, then the collection's native rank as the tiebreak) */
type OrderRel = { token: string; alias: string; cte: string }
async function shape(from: string, select: RowSelect = {}, groupBy?: string, clauses?: string): Promise<Shape> {
  const h = await toHandle(from)
  const [built, card, stats] = await Promise.all([h.built(), h.card(), h.stats()])
  const cat = (await catalogMap()).get(h.coll)!
  // a stat whose id collides with a structural column (subsets' `rank` = its lattice rank) keeps its function, suffixed
  const reserved = new Set([...cat.grades, 'rank', 'element', 'value', 'ordinality', 'count', 'level'])
  const s: Shape = {
    h, built, coll: h.coll, carrier: cat.carrier ?? 'text', axes: cat.grades, open: card === null, card,
    stats: stats.map((st) => ({ statId: reserved.has(st.statId) ? `${st.statId}_stat` : st.statId, raw: st.statId, valueFunc: st.valueFunc })),
    render: await renderExprFor(h.coll, select.repr),
    sel: [], deferred: new Set(), kernels: new Map(), orderRels: new Map(),
  }
  const g = groupBy?.trim() ? parseGroupBy(groupBy) : null
  const specs: SelectSpec[] = parseSelect(await selectTextFor(s, select, archetypeOf(s, g), g, clauses))
  s.sel = specs.length ? await resolveSelect({ coll: s.coll, carrier: s.carrier, axes: s.axes, stats: s.stats, handle: h }, specs) : []
  // a glyph is ~0.5 KB of SVG per row: eager mode takes it with the table, a streamed window fetches it for the
  // rows in view (planDeferred) rather than for a hundred rows blindly
  if (!select.eager) for (const c of s.sel) if (c.kind === 'glyph') s.deferred.add(c.id)
  for (const c of s.sel) if (c.kind === 'pivot') c.values = await pivotValues(s, c)
  // an open handle whose OUTERMOST UNFOLD axis is bound (k_subsets(n=0..4), k free) is finite: the fibers stream to an
  // end, so sum their cardinalities — cardinality(h) alone reports ∞ for any open range. Family PARAMETERS (role=param,
  // #67) never unfold a fiber range and are always pinned, so they don't gate this: hyperbinary_representations =
  // hypernumerary(2,1) pins the params b,k, but its true axis n is unbounded — an open collection. Testing axes[0]=b
  // (a param) would wrongly run the probe and enumerate 100000 fibers only to rediscover it's open (#254 tail).
  const params = new Set((await collectionParams())[s.coll] ?? [])
  const unfoldAxes = s.axes.filter((a) => !params.has(a))
  if (s.open && unfoldAxes.length && h.args[unfoldAxes[0]] !== undefined) {
    const cap = 100000
    const fs = await runSql<{ count: string }>(`SELECT cardinality(f)::text AS count FROM fibers(${built}, ${cap}) f`)
    if (fs.length < cap && fs.every((r) => r.count !== 'Infinity')) {
      s.open = false
      s.card = Number(fs.reduce((a, r) => a + BigInt(r.count), 0n))
    }
  }
  return s
}

// ── element relations: orbit:/map: kernels and ORDER BY <rel> (element-relations doc, crux b) ──────────────────────
const KERNEL_TOKEN = /(orbit|map):[A-Za-z_][A-Za-z0-9_]*/g
/** every distinct `orbit:<rel>` / `map:<map>` token a clause names */
const kernelTokens = (q: RowQuery): string[] =>
  [...new Set(([q.where, q.groupBy, q.having, q.orderBy].filter(Boolean).join(' ').match(KERNEL_TOKEN) ?? []))]
/** a bare ORDER BY term's column id, DESC/ASC and NULLS … stripped (`weak_order DESC` → `weak_order`) */
const orderColumns = (orderBy: string): string[] =>
  orderBy.split(',').map((t) => t.trim().replace(/\s+(asc|desc)\b/i, '').replace(/\s+nulls\s+(first|last)\b/i, '').trim())
    .map((t) => t.replace(/^"(.*)"$/, '$1')).filter((t) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(t))

/** Resolve the element-relation sugar a statement names — the async step between shape() and building SQL. Fills
 *  `s.kernels` (a group/sort key that applies a representative map to each element) and `s.orderRels` (a graded cover
 *  relation ORDER BY desugars onto its rank). Both throw disable-with-reason on an ill-typed reference. */
async function resolveRelations(s: Shape, q: RowQuery): Promise<void> {
  for (const token of kernelTokens(q)) s.kernels.set(token, await resolveKernel(s, token))
  if (q.orderBy?.trim()) {
    const cols = new Set([...s.axes, 'rank', 'address', 'omega', 'element', 'ordinality', 'count', 'level', ...s.stats.map((x) => x.statId), ...s.kernels.keys()])
    for (const col of orderColumns(q.orderBy)) {
      if (cols.has(col)) continue                            // an ordinary result column, not a relation
      const rel = await resolveOrderRel(s, col, !!q.groupBy?.trim())   // a relation id (or an unknown column — resolveOrderRel throws either way)
      if (rel) s.orderRels.set(col, rel)
    }
  }
}

/** `orbit:<rel>` → the equivalence's canonical_fn (declared, or derived as the rank-least member of forward_fn);
 *  `map:<map>` → a base_map image. Both project `render_value(<fn>((e).value))` — the representative in its own repr. */
async function resolveKernel(s: Shape, token: string): Promise<Kernel> {
  const [kind, id] = token.split(':')
  if (kind === 'map') {
    const [m] = await runSql<{ fn: string }>(`SELECT mapping_fn AS fn FROM base_map_resolved WHERE collection = $1 AND map_id = $2`, [s.coll, id])
    if (!m) throw new Error(`GROUP BY map:${id} — ${s.coll} has no map "${id}"`)
    return { token, alias: token, expr: `render_value(${m.fn}((e).value))`, kind: 'map' }
  }
  const [rel] = await runSql<{ kind: string; forward_fn: string | null; canonical_fn: string | null }>(
    `SELECT kind, forward_fn, canonical_fn FROM base_element_relation WHERE collection = $1 AND rel_id = $2`, [s.coll, id])
  if (!rel) throw new Error(`GROUP BY orbit:${id} — ${s.coll} has no element relation "${id}"`)
  if (rel.kind !== 'equivalence') throw new Error(`GROUP BY orbit:${id} — "${id}" is a ${rel.kind} relation, not an equivalence; only an equivalence has orbits`)
  // the class representative: the declared canonical_fn, or — absent — the rank-least member of forward_fn(x) (the doc's
  // derived rep; the two agree, asserted in the element_relations suite)
  const rep = rel.canonical_fn ? `${rel.canonical_fn}((e).value)`
    : rel.forward_fn ? `(SELECT o FROM ${rel.forward_fn}((e).value) o ORDER BY o LIMIT 1)`
    : null
  if (!rep) throw new Error(`GROUP BY orbit:${id} — "${id}" has neither canonical_fn nor forward_fn to form a representative`)
  return { token, alias: token, expr: `render_value(${rep})`, kind: 'map' }
}

/** ORDER BY <rel> over a GRADED cover relation → order by rank (chain length from a minimum), the collection's native
 *  rank as the tiebreak. Returns null for a bare identifier that is neither a column nor a relation only via throw;
 *  throws disable-with-reason for a non-cover / successor-less / non-graded relation (no fabricated total order). */
async function resolveOrderRel(s: Shape, id: string, grouped: boolean): Promise<OrderRel | null> {
  const [rel] = await runSql<{ kind: string; forward_fn: string | null }>(
    `SELECT kind, forward_fn FROM base_element_relation WHERE collection = $1 AND rel_id = $2`, [s.coll, id])
  if (!rel) throw new Error(`ORDER BY: "${id}" is not a column of ${s.coll} or a relation on it`)
  if (grouped) throw new Error(`ORDER BY ${id} — a cover relation orders ELEMENT rows by their poset rank; it doesn't apply to a grouped result. Drop the GROUP BY, or order by a key/count.`)
  if (rel.kind === 'equivalence') throw new Error(`ORDER BY ${id} — an equivalence has no order; GROUP BY orbit:${id} to fibre by its classes instead`)
  if (!rel.forward_fn) throw new Error(`ORDER BY ${id} — "${id}" has no cover successor (related_fn only), so a rank cannot be derived`)
  if (s.open) throw new Error(`ORDER BY ${id} needs a bounded handle — ${s.coll} is open here; bind an axis in FROM (e.g. ${s.coll}(${s.axes[0] ?? ''}=4))`)
  // derive the rank by chain length from the poset's minima over the elements IN this handle (covers that cross to a
  // fiber the handle doesn't hold are dropped — the relation restricted to what's shown); UNION dedupes, so a graded
  // poset terminates with one rank per element
  const alias = `rank:${id}`
  const cte = `elts AS (SELECT (e).value AS v FROM elements(${s.built}, 2147483647) e),\n`
    + `  cover AS (SELECT e.v AS x, c AS y FROM elts e, LATERAL ${rel.forward_fn}(e.v) c WHERE c IN (SELECT v FROM elts)),\n`
    + `  chain AS (SELECT v, 0 AS r FROM elts WHERE v NOT IN (SELECT y FROM cover)\n`
    + `            UNION SELECT cover.y, chain.r + 1 FROM chain JOIN cover ON cover.x = chain.v),\n`
    + `  ${ident(alias)} AS (SELECT v, max(r) AS r FROM chain GROUP BY v)`
  // graded ⇔ every cover raises the rank by exactly one; a non-graded cover order is partial, so refuse it
  const [g] = await runSql<{ graded: boolean }>(
    `WITH RECURSIVE ${cte} SELECT coalesce(bool_and(ry.r = rx.r + 1), true) AS graded
       FROM cover JOIN ${ident(alias)} rx ON rx.v = cover.x JOIN ${ident(alias)} ry ON ry.v = cover.y`)
  if (!g?.graded) throw new Error(`ORDER BY ${id} — the ${s.coll} ${id} order is not graded on ${s.coll}(${Object.values(s.h.args).join(', ')}); a total row order would be fabricated. Order the elements by a statistic instead.`)
  return { token: id, alias, cte }
}

/** The URL's own `select=` text (when given), or — when absent — the policy default for this archetype
 *  (policy_resolve, #244): `<keys>` expanded to the statement's own GROUP BY keys. `listed()`'s dflt arrays (below)
 *  stay the LAST-resort fallback for the rare case this resolves NULL — it never does after seeding. */
async function selectTextFor(s: Shape, select: RowSelect, arch: Archetype, g: Grouping | null, clauses?: string): Promise<string | string[] | undefined> {
  const given = Array.isArray(select.select) ? select.select.length > 0 : !!select.select?.trim()
  if (given) return select.select
  // a kernel grouping key (orbit:/map:) has no select= spelling — the plan's own default columns carry it (listed())
  if (g?.sets.flat().some((k) => KERNEL_SHAPE.test(k))) return undefined
  const [row] = await runSql<{ resolved: string | null }>(
    `SELECT policy_resolve($1, $2, 'select', $3) AS resolved`, [s.coll, select.environment ?? 'web', arch])
  if (!row?.resolved) return select.select   // no policy row (shouldn't happen after seeding) — fall to listed()'s dflt
  let text = row.resolved.includes('<keys>') ? row.resolved.replace('<keys>', keysTemplate(g).join(', ')) : row.resolved
  // a column a clause references joins the default projection (the old `shown`/`positional` behavior): the stat that
  // filtered / sorted the rows stays visible. Element-level rows only — a grouped row shows its keys and aggregates.
  if (clauses?.trim() && (arch === 'elements' || arch === 'rowgroup')) {
    const word = (id: string) => new RegExp(`(?<![A-Za-z0-9_"])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_"])`)
    const have = new Set(text.split(',').map((t) => t.trim()))
    for (const id of [...s.axes, 'rank', 'omega', ...s.stats.map((x) => x.statId)]) {
      if (!have.has(id) && word(id).test(clauses)) text += `, ${id}`
    }
  }
  return text
}
/** The statement's own GROUP BY keys, for the `<keys>` template — every key across EVERY grouping set (first
 *  appearance order, deduplicated), minus `rank`/`element` (those belong to the element rows, not a fiber's
 *  identity) — a multi-set GROUPING SETS statement's outer levels must contribute their keys too. */
function keysTemplate(g: Grouping | null): string[] {
  if (!g) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const k of g.sets.flat()) {
    if (k === 'rank' || k === 'element' || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}
/** The VALUES a `pivot:` spreads across columns — the statistic's support on this handle. Off the registered
 *  refinement sibling when there is one (its fibers are the level sets, so a non-empty fiber is a value that
 *  occurs); otherwise the relation itself, which means enumerating, which means a bounded handle. */
async function pivotValues(s: Shape, c: SelectColumn): Promise<string[]> {
  const stat = c.stat!.id
  const [reg] = await runSql<{ triangle: string; col_axis: string }>(
    `SELECT r.triangle, t.col_axis FROM base_triangle_refines r JOIN base_triangle t ON t.collection = r.triangle
      WHERE r.parent = $1 AND r.stat_id = $2 ORDER BY r.triangle LIMIT 1`, [s.coll, stat])
  if (reg && s.axes.length === 1) {
    const a = s.axes[0], bound = s.h.args[a]
    const [row] = await runSql<{ row_axis: string }>(`SELECT row_axis FROM base_triangle WHERE collection = $1`, [reg.triangle])
    if (bound !== undefined) {
      const tri = new Handle(reg.triangle, { [row.row_axis]: bound })
      const vs = await runSql<{ k: string }>(
        `SELECT DISTINCT (f).${ident(reg.col_axis)}::text AS k FROM fibers(${await tri.built()}, ${SIBLING_CELL_CAP}) f
          WHERE cardinality(f) > 0 ORDER BY 1`)
      return vs.map((v) => v.k).sort((x, y) => Number(x) - Number(y))
    }
  }
  if (s.open) throw new Error(`SELECT: pivot:${c.stat!.id} needs to know the statistic's range — bind an axis in FROM (e.g. ${s.coll}(${s.axes[0] ?? ''}=4))`)
  const vs = await runSql<{ k: string }>(
    `SELECT DISTINCT ${c.stat!.valueFunc}((e).value)::text AS k FROM elements(${s.built}, 2147483647) e ORDER BY 1`)
  return vs.map((v) => v.k).sort((x, y) => Number(x) - Number(y))
}

/** one column per value of a `pivot:` spec — `descents=0`, `descents=1`, … */
const pivotCols = (c: SelectColumn): { id: string; value: string }[] =>
  (c.values ?? []).map((v) => ({ id: `${c.stat!.id}=${v}`, value: v }))

/** the projection of R(C) over an element alias `e`: the ADDRESS (every axis, then the within-fiber rank) and the
 *  REPR (`element`) — plus only what the clauses ask for: a stat named in WHERE / GROUP BY / HAVING / ORDER BY, and
 *  `value` (the carrier itself) when a predicate says `fn(value)`. The SELECT list proper is the collection explorer's
 *  half; the row half keeps its statement readable. `wanted` = null projects every stat (the related-collection probe). */
function relation(s: Shape, wanted: Set<string> | null = null, withValue = false, withSelect = false): string {
  return [
    ...s.axes.map((a) => `${ident(a)}(e) AS ${ident(a)}`),
    `rank(e) AS rank`, `array_to_string(address(e), '.') AS address`, `notation(omega_ordinality(e)) AS omega`, `${s.render} AS element`,
    ...(withValue || wanted === null ? [`(e).value AS value`] : []),
    ...s.stats.filter((st) => wanted === null || wanted.has(st.statId)).map((st) => `${st.valueFunc}((e).value) AS ${ident(st.statId)}`),
    ...[...s.kernels.values()].map((k) => `${k.expr} AS ${ident(k.alias)}`),   // a kernel group key: the representative, rendered
    ...(withSelect ? selected(s, wanted) : []).map((c) => `${c.expr} AS ${ident(c.id)}`),
  ].join(', ')
}
/** the element-level selected columns the relation hasn't already projected — the structural columns are always
 *  there (axes, rank, address, omega, element) and a stat a clause names is projected once */
function selected(s: Shape, wanted: Set<string> | null): SelectColumn[] {
  const structural = new Set([...s.axes, 'rank', 'address', 'omega', 'element'])
  return s.sel.filter((c) => (c.level === 'element' || c.level === 'axis') && c.kind !== 'over' && !structural.has(c.id) && !s.deferred.has(c.id)
    && !(c.kind === 'stat' && (wanted === null || wanted.has(c.id))))
}
/** the stats R(C) must project: those a clause names, plus the ones a fiber aggregate or a lift reads */
const wantedStats = (s: Shape, named: Set<string>): Set<string> =>
  new Set([...named, ...[...fiberSelected(s), ...overSelected(s)].map((c) => c.stat?.id).filter((x): x is string => !!x)])
/** the fiber columns LIFTED onto element rows — computed per fiber, never windowed over a slice */
const overSelected = (s: Shape): SelectColumn[] => s.sel.filter((c) => c.kind === 'over')
/** the fiber-level selected columns beyond `count`, which every grouped level already carries */
const fiberSelected = (s: Shape): SelectColumn[] => s.sel.filter((c) => c.level === 'fiber' && c.kind !== 'count')
/** the fiber columns the PLAN must compute; `level` is the plan's own level marker, already on every rollup row */
const fiberComputed = (s: Shape): SelectColumn[] => fiberSelected(s).filter((c) => c.kind !== 'level')
/** the stats a query's clauses mention, and whether any clause reaches for `value` */
function referenced(s: Shape, q: RowQuery): { stats: Set<string>; value: boolean } {
  const text = [q.where, q.groupBy, q.having, q.orderBy].filter(Boolean).join(' ')
  const word = (id: string) => new RegExp(`(?<![A-Za-z0-9_"])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_"])`)
  return { stats: new Set(s.stats.filter((st) => word(st.statId).test(text)).map((st) => st.statId)), value: /(?<![A-Za-z0-9_])value(?![A-Za-z0-9_])/.test(text) }
}
/** a kernel-shaped token, recognizable BEFORE resolveRelations fills s.kernels — shape() computes the archetype
 *  (for the policy select) ahead of resolution, and an unresolvable token still throws there, with its real error */
const KERNEL_SHAPE = /^(orbit|map):[A-Za-z_][A-Za-z0-9_]*$/
function kindOf(s: Shape, col: string): ColumnKind {
  const k = s.kernels.get(col); if (k) return k.kind
  if (KERNEL_SHAPE.test(col)) return 'map'
  if (s.axes.includes(col)) return 'axis'
  if (col === 'rank') return 'rank'
  if (col === 'address') return 'address'
  if (col === 'omega') return 'omega'
  if (col === 'element') return 'element'
  if (col === 'count') return 'count'
  if (s.stats.some((st) => st.statId === col)) return 'stat'
  throw new Error(`GROUP BY: "${col}" is not a column of ${s.coll} (axes: ${s.axes.join(', ') || 'none'}; rank, element; stats: ${s.stats.map((x) => x.statId).join(', ') || 'none'})`)
}
function archetypeOf(s: Shape, g: Grouping | null): Archetype {
  if (!g) return 'elements'
  const cols = g.sets.flat()
  cols.forEach((c) => kindOf(s, c))
  if (cols.some((c) => s.kernels.has(c) || KERNEL_SHAPE.test(c))) return 'distribution'   // GROUP BY orbit:/map: — one group per class, bounded/naive
  if (cols.some((c) => kindOf(s, c) === 'stat')) return 'distribution'
  if (cols.some((c) => c === 'rank' || c === 'element')) return 'rowgroup'
  return g.sets.length > 1 ? 'rollup' : 'fibers'
}
const measureLens = (having: string) => having.replace(/count\s*\(\s*\*\s*\)/gi, 'count')

/** Fill in the element-page `count` a caller left unspecified with the #273 adaptive sizer's OPENING window —
 *  `sizeWindow(prior, null)`, i.e. the declared-growth prior's w_0, derived from the collection's accelerator
 *  presence (no random access ⇒ superexp ⇒ 1, count-only ⇒ exp ⇒ 8, cheap random access ⇒ poly ⇒ 64). This
 *  replaces the blind fixed 100 the row half used to open with, so an EXPENSIVE collection opens SMALL (never a
 *  100-element naive-enumeration hang on the first page) and a cheap one opens wide, per phase 1.5 of #273.
 *
 *  Scope + determinism, both load-bearing:
 *   - Only the PLAIN CANONICAL element page is sized. A WHERE / ORDER BY / GROUP BY view keeps the unbounded
 *     logical statement (it materializes or composes its whole relation; paging a filtered/grouped view is a
 *     separate concern), so those clauses opt out and behave exactly as before.
 *   - An explicit `count` (the explorer resolves one from base_policy_resolved; selfcert-rows' policy walk passes
 *     window_size) is honored VERBATIM — the default only fills a genuinely absent count.
 *   - PRIOR-ONLY (tbar = null): no EWMA / recentPerf() is consulted, so the row-half SQL generators stay a pure
 *     function of their inputs. rowSql() and planRows() thread the SAME resolved window, so the accelerated slice
 *     and the naive oracle page to the identical count and the plan==oracle differential holds byte-for-byte; the
 *     golden corpus stays stable (a plain canonical case simply gains a deterministic `LIMIT w_0`). */
async function windowWithDefault(s: Shape, q: RowQuery, w: RowWindow): Promise<RowWindow> {
  if (w.count != null || q.where?.trim() || q.orderBy?.trim() || q.groupBy?.trim()) return w
  return { ...w, count: sizeWindow(await s.h.windowPrior(), null) }
}

/** The LOGICAL statement — R(C) as a CTE, then the clauses verbatim. Evaluable as-is on a bounded handle; on an open
 *  one the relation is cut at `frontier` elements (the naive form can't enumerate ℵ₀ — the plan streams instead). */
export async function rowSql(q: RowQuery, w: RowWindow = {}, select: RowSelect = {}): Promise<string> {
  const s = await shape(q.from, select, q.groupBy, [q.where, q.having, q.orderBy].filter(Boolean).join(' '))
  await resolveRelations(s, q)
  const g = q.groupBy?.trim() ? parseGroupBy(q.groupBy) : null
  return rowSqlFor(s, q, await windowWithDefault(s, q, w), archetypeOf(s, g))
}
/** `arch` decides whether the SELECT half's columns are in scope: only element and rowgroup rows have an element to
 *  project them from — a grouped level's rows are keys and a count. */
function rowSqlFor(s: Shape, q: RowQuery, w: RowWindow, arch: Archetype): string {
  const src = s.open ? `elements(${s.built}, ${(w.first ?? 0) + (w.count ?? 100)})` : `elements(${s.built}, 2147483647)`
  const ref = referenced(s, q)
  const elementLevel = arch === 'elements' || arch === 'rowgroup'
  // a fiber aggregate reads its statistic off the relation, so R(C) projects it even when no clause names it
  const wanted = wantedStats(s, ref.stats)
  // A kernel token (`orbit:rotation`, `map:inverse`) a clause names is the alias of a projected column. Two ways
  // to put it there, and the structured one is preferred wherever the clause parses:
  //   * `clause()` composes the SQL from the clause's own PARSED TERMS, so a token is swapped at the column it
  //     actually is, and a token that merely appears inside a string literal is untouched by construction;
  //   * `rwK()` is the fallback for a clause too rich to parse (an OR, a subquery, arithmetic), which still has
  //     to be spliced verbatim. It rewrites by scanning, skipping over quoted strings — see rewriteTokens.
  const rwK = (t: string): string => rewriteTokens(t, s.kernels)
  /** A clause as SQL: composed from its terms when it parses, spliced verbatim (token-rewritten) when it does not. */
  const clause = (text: string | undefined): string => {
    const t = text?.trim()
    if (!t) return ''
    const preds = parsePreds(t)
    if (!preds) return rwK(t)
    // only a COLUMN can be a kernel token: `fn(value)` names the carrier, and a facet names a membership field
    const alias = (p: Pred): Pred =>
      p.op === 'fn' || p.op === 'facet' || !s.kernels.has(p.col) ? p : { ...p, col: s.kernels.get(p.col)!.alias }
    return predsToSql(preds.map(alias))
  }
  const canonical = [...s.axes.map(ident), 'rank'].join(', ')
  // ORDER BY <graded cover relation>: join each element to its derived rank and order by it, native rank the tiebreak
  if (!q.groupBy?.trim() && q.orderBy?.trim() && s.orderRels.size) return relationOrderSql(s, q, wanted, canonical)
  const base = `WITH r AS (\n  SELECT ${relation(s, wanted, ref.value, elementLevel)}\n  FROM ${src} e)`
  const whereSql = clause(q.where)
  const where = whereSql ? `\nWHERE ${whereSql}` : ''
  if (!q.groupBy?.trim()) {
    const order = q.orderBy?.trim() ? rwK(q.orderBy.trim()) : canonical
    const win = w.count != null ? `\nOFFSET ${w.first ?? 0} LIMIT ${w.count}` : ''
    const over = overSelected(s).map((c) => `, ${c.window!(s.axes)} AS ${ident(c.id)}`).join('')
    return `${base}\nSELECT row_number() OVER (ORDER BY ${order}) AS ordinality, *${over}\nFROM r${where}\nORDER BY ${order}${win}`
  }
  const g = parseGroupBy(q.groupBy)
  const keys = [...new Set(g.sets.flat())]
  const havingSql = clause(q.having)
  const having = havingSql ? `\nHAVING ${havingSql}` : ''
  const order = q.orderBy?.trim() ? rwK(q.orderBy.trim()) : keys.map((k) => `${ident(k)} NULLS LAST`).join(', ')
  const level = keys.length && (g.rollup || g.sets.length > 1) ? `, grouping(${keys.map(ident).join(', ')}) AS level` : ''
  // the fiber-level SELECT list, spelled literally: each aggregate over the group's own rows of R(C)
  const fiber = fiberSelected(s).filter((c) => !(c.kind === 'level' && level)).map((c) =>
    c.kind === 'pivot' ? pivotCols(c).map((p) => `, ${c.cell!(p.value)} AS ${ident(p.id)}`).join('')
                       : `, ${c.agg!({ keys, where: q.where, levels: g.sets.length })} AS ${ident(c.id)}`).join('')
  return `${base}\nSELECT ${keys.map(ident).join(', ')}, count(*) AS count${level}${fiber}\nFROM r${where}\nGROUP BY ${rwK(q.groupBy.trim())}${having}\nORDER BY ${order}`
}

/** ORDER BY a graded cover relation: R(C) with the element value, each derived-rank CTE, then a LEFT JOIN to the rank
 *  and `ORDER BY rank(<rel>) <dir>, <native rank>` (the collection's own order as the intra-rank tiebreak — a cover
 *  order is partial). One relation at a time (the CTEs share `elts`/`cover`/`chain` names). */
function relationOrderSql(s: Shape, q: RowQuery, wanted: Set<string>, canonical: string): string {
  const rel = [...s.orderRels.values()][0]
  const term = q.orderBy!.split(',').map((t) => t.trim()).find((t) =>
    t.replace(/\s+(asc|desc)\b/i, '').replace(/\s+nulls\s+(first|last)\b/i, '').replace(/^"(.*)"$/, '$1').trim() === rel.token) ?? ''
  const dir = /\bdesc\b/i.test(term) ? 'DESC' : 'ASC'
  const src = `elements(${s.built}, 2147483647)`
  const ord = `k.r ${dir} NULLS LAST, ${canonical}`
  return `WITH RECURSIVE r AS (\n  SELECT ${relation(s, wanted, true, true)}\n  FROM ${src} e),\n  ${rel.cte}\n`
    + `SELECT row_number() OVER (ORDER BY ${ord}) AS ordinality, r.*, k.r AS ${ident(rel.alias)}\n`
    + `FROM r LEFT JOIN ${ident(rel.alias)} k ON k.v = r.value\nORDER BY ${ord}`
}

/** The family PARAMETERS a handle leaves unbound (base_grade.role='param', #67). A non-empty result means the handle
 *  is a family SKELETON — nothing to enumerate; a value for these SELECTS which concrete collection (base b widened by
 *  k, words over base b), it is not a fiber range to unfold. Mirrors the explorer's `isFamilySkeleton` guard so every
 *  planning path refuses a skeleton the same way, and treats the position-0 `size` alias as binding (as `built` does). */
export async function unboundFamilyParams(h: Handle): Promise<string[]> {
  const params = (await collectionParams())[h.coll] ?? []
  if (!params.length) return []
  const axes = (await catalogMap()).get(h.coll)?.grades ?? []
  return params.filter((p) => h.args[p] === undefined && !(axes.indexOf(p) === 0 && h.args.size !== undefined))
}

/** Evaluate a RowQuery by the fastest honest route per archetype, composing accelerated requests — the table the
 *  query view renders. `sql` on the result is the logical statement it should equal (the self-cert oracle). */
export async function planRows(q: RowQuery, w: RowWindow = {}, select: RowSelect = {}): Promise<RowTable> {
  const s = await shape(q.from, select, q.groupBy, [q.where, q.having, q.orderBy].filter(Boolean).join(' '))
  // a family SKELETON (an unbound family parameter, #67 D3/D4) has nothing to enumerate — refuse gracefully rather
  // than walking degenerate parameter=0 fibers (which, e.g. for hypernumerary's base-b arithmetic, divides by zero)
  const skeleton = await unboundFamilyParams(s.h)
  if (skeleton.length) throw new Error(`FROM: ${s.coll} is a family — bind ${skeleton.join(', ')} to view a collection (an unbound family parameter is a skeleton, with nothing to enumerate)`)
  await resolveRelations(s, q)
  const g = q.groupBy?.trim() ? parseGroupBy(q.groupBy) : null
  const arch = archetypeOf(s, g)
  // Size the default element page ONCE (when the caller named no count) and thread the SAME resolved window into
  // BOTH the accelerated slice below and the naive oracle `sql` — so the two page to the identical count and the
  // self-cert differential stays byte-for-byte (see windowWithDefault). A grouped/filtered view opts out there.
  const w2 = await windowWithDefault(s, q, w)
  const sql = rowSqlFor(s, q, w2, arch)
  const first = Math.max(0, w2.first ?? 0), count = Math.max(1, w2.count ?? 100), fiberLimit = Math.max(1, w2.fiberLimit ?? 200)
  // HAVING / ORDER BY over a composed level: the same clause text applied as SQL over VALUES of the level's rows
  const applyLensOver = async (rows: Row[], keys: string[], order: string[] = keys): Promise<Row[]> => {
    if (!q.having?.trim() && !q.orderBy?.trim()) return rows
    if (!rows.length) return rows
    const cols = [...keys, 'count']
    const vals = rows.map((r) => `(${cols.map((c) => sqlNum(r[c])).join(', ')})`).join(',\n')
    const where = q.having?.trim() ? `WHERE ${measureLens(q.having.trim())}` : ''
    const ord = q.orderBy?.trim() || order.map((k) => `${ident(k)} NULLS LAST`).join(', ')
    return runSql<Row>(`SELECT * FROM (VALUES ${vals}) AS t(${cols.map(ident).join(', ')}) ${where} ORDER BY ${ord}`)
  }
  const requireBounded = (what: string) => {
    if (s.open) throw new Error(`${what} needs a bounded handle — ${s.coll} is open here; bind an axis in FROM (e.g. ${s.coll}(${s.axes[0] ?? ''}=4))`)
  }
  const colsOf = (ids: string[]): RowColumn[] => ids.map((id) => ({ id, kind: id === 'ordinality' ? 'ordinality' : id === 'level' ? 'level' : kindOf(s, id) }))

  const ref = referenced(s, q)
  // the SELECT list is the column list, literally and in its own order; an empty one falls back to the archetype's
  // default (§3, fork 8b). The ROWS still carry R(C)'s structural columns either way — a clause and the element
  // pane read them whether or not a column shows them.
  const fiberCols = fiberComputed(s)
  const fiberColsOf = (): RowColumn[] => fiberSelected(s).flatMap((c) =>
    c.kind === 'pivot' ? pivotCols(c).map((p) => ({ id: p.id, kind: c.kind })) : [{ id: c.id, kind: c.kind }])
  const listed = (dflt: RowColumn[]): RowColumn[] => (s.sel.length
    ? s.sel.flatMap((c) => (c.kind === 'pivot' ? pivotCols(c).map((p) => ({ id: p.id, kind: c.kind })) : [{ id: c.id, kind: c.kind }]))
    : dflt)
  const overCols = overSelected(s)
  if (overCols.length && arch !== 'elements') {
    throw new Error(`SELECT: ${overCols.map((c) => c.id).join(', ')} lifts a fiber column onto ELEMENT rows — drop the GROUP BY, or select ${overCols[0].inner!.id} itself`)
  }
  /** The fiber values an `over:` column lifts, keyed by the row's axis tuple. The partition IS the fiber, so the
   *  plan reads it off the fiber — windowing a slice of elements would count the slice, not the fiber. Null when a
   *  lifted aggregate has no registered refinement to read: the naive statement materializes instead. */
  const overCells = async (rows: Row[]): Promise<Map<string, Row> | null> => {
    const out = new Map<string, Row>()
    if (!overCols.length) return out
    const key = (r: Row) => s.axes.map((a) => String(r[a])).join('\u0000')
    const merge = (k: string, cells: Row) => out.set(k, { ...(out.get(k) ?? {}), ...cells })
    const direct = overCols.filter((c) => c.inner!.kind !== 'agg')
    if (direct.length) {
      const proj = [...s.axes.map((a) => `(f).${ident(a)} AS ${ident(a)}`),
        ...direct.map((c) => `${c.inner!.kind === 'count' ? 'cardinality(f)::text' : 'fiber_symbol(f)::text'} AS ${ident(c.id)}`)]
      for (const f of await runSql<Row>(`SELECT ${proj.join(', ')} FROM fibers(${s.built}, ${fiberLimit}) f`)) {
        merge(key(f), Object.fromEntries(direct.map((c) => [c.id, f[c.id]])))
      }
    }
    const aggs = overCols.filter((c) => c.inner!.kind === 'agg')
    if (aggs.length) {
      if (s.axes.length !== 1) return null
      const a = s.axes[0]
      const ns = [...new Set(rows.map((r) => Number(r[a])).filter((n) => Number.isFinite(n)))]
      if (!ns.length) return out
      for (const stat of [...new Set(aggs.map((c) => c.stat!.id))]) {
        const [reg] = await runSql<{ triangle: string; row_axis: string; col_axis: string }>(
          `SELECT r.triangle, t.row_axis, t.col_axis FROM base_triangle_refines r JOIN base_triangle t ON t.collection = r.triangle
            WHERE r.parent = $1 AND r.stat_id = $2 ORDER BY r.triangle LIMIT 1`, [s.coll, stat])
        if (!reg) return null
        const mine = aggs.filter((c) => c.stat!.id === stat)
        const tri = new Handle(reg.triangle, { [reg.row_axis]: [Math.min(...ns), Math.max(...ns)] as ParamValue })
        const proj = mine.map((c) => `, ${accelFiberExpr(c.inner!, `(f).${ident(reg.col_axis)}`, 'cardinality(f)')} AS ${ident(c.id)}`).join('')
        const rs = await runSql<Row>(
          `SELECT (f).${ident(reg.row_axis)} AS ${ident(a)}${proj}
             FROM fibers(${await tri.built()}, ${SIBLING_CELL_CAP}) f GROUP BY 1 ORDER BY 1`)
        for (const r of rs) merge(String(r[a]), Object.fromEntries(mine.map((c) => [c.id, r[c.id]])))
      }
    }
    return out
  }

  if (fiberCols.length && arch === 'elements') {
    throw new Error(`SELECT: ${fiberCols.map((c) => c.id).join(', ')} ${fiberCols.length > 1 ? 'are fiber columns' : 'is a fiber column'} — group the rows first (GROUP BY an axis)`)
  }
  const shown = s.stats.filter((x) => ref.stats.has(x.statId)).map((x) => x.statId)
  const available = [...s.axes, 'rank', 'address', 'omega', 'element', ...s.stats.map((x) => x.statId)]
  const deferred = [...s.deferred]
  // the default element view: the RESULT position, the compound ADDRESS, the REPR — the axes and the within-fiber rank
  // are the address decomposed and join the table when a clause names them (like a stat); omega on request
  const text = [q.where, q.groupBy, q.having, q.orderBy].filter(Boolean).join(' ')
  const named = (c: string) => new RegExp(`(?<![A-Za-z0-9_"])${c}(?![A-Za-z0-9_"])`).test(text)
  const positional = [...s.axes.filter(named), ...(named('rank') ? ['rank'] : []), 'address', ...(named('omega') ? ['omega'] : [])]
  if (arch === 'elements') {
    const cols = listed(colsOf(['ordinality', ...positional, 'element', ...shown]))
    /** merge each row's own fiber values in; a lift with no accelerated route falls back to the naive statement,
     *  which windows the whole materialized relation (bounded, as the fiber's own enumeration would be) */
    const withOver = async (rows: Row[]): Promise<Row[]> => {
      if (!overCols.length) return rows
      const cells = await overCells(rows)
      if (!cells) { requireBounded('a lifted fiber column with no registered refinement (over: enumerates the fiber)'); return runSql<Row>(sql) }
      return rows.map((r) => ({ ...r, ...(cells.get(s.axes.map((a) => String(r[a])).join('\u0000')) ?? {}) }))
    }
    if (q.where?.trim() || q.orderBy?.trim()) {
      requireBounded('WHERE / ORDER BY (a restriction or a stat sort materializes the relation)')
      const rows = await runSql<Row>(sql)
      const [c] = await runSql<{ n: number }>(`SELECT count(*)::int AS n FROM (${rowSqlFor(s, { ...q, orderBy: undefined }, {}, arch)}) t`)
      return { archetype: arch, columns: cols, rows, keys: [], total: Number(c?.n ?? rows.length), frontier: false, deferred, sql, available }
    }
    // canonical order, no restriction: a SLICE of the handle's global index — element_at jumps where indexable
    const rows = await runSql<Row>(
      `SELECT ${first} + row_number() OVER (ORDER BY ${[...s.axes.map((a) => `${ident(a)}(e)`), 'rank(e)'].join(', ')}) AS ordinality, ${relation(s, wantedStats(s, ref.stats), ref.value, true)}
         FROM elements(${s.built}, rank_index_range(${first}, ${first + count}, '[)')) e
        ORDER BY ${[...s.axes.map((a) => `${ident(a)}(e)`), 'rank(e)'].join(', ')}`,
    )
    return { archetype: arch, columns: cols, rows: await withOver(rows), keys: [], total: s.card, frontier: s.open && rows.length === count, deferred, sql, available }
  }

  // a fiber column on a COMPOSED result (distribution / rollup / rowgroup) carries per-level semantics — chunk 5's
  // menus; until then the naive statement computes it, which means enumerating, which means a bounded handle
  // a ROLLUP carries the columns of each LEVEL: `symbol` names a whole fiber, so it lands on the level whose keys
  // are the axes and is NULL elsewhere (C10). The measures that need the sibling stay on the naive path there.
  // rowgroup is EXCLUDED here (#214): its naive statement is a plain GROUPING SETS result (keys + count, no
  // `__group`/`subtotals`), which is the wrong shape for rowgroup's element/subheader split — RowTable would dump
  // every row into one undefined group. It gets its own accelerated route below, subtotal-only (C10).
  const rollupOk = arch === 'rollup' && fiberCols.every((c) => c.kind === 'symbol')
  if (fiberCols.length && arch !== 'fibers' && arch !== 'rowgroup' && !rollupOk) {
    requireBounded('a fiber column on a composed level (it enumerates the fiber)')
    const keys = [...new Set(g!.sets.flat())]
    const rows = await runSql<Row>(sql)
    const cols = listed([...colsOf([...keys, 'count', ...(g!.sets.length > 1 ? ['level'] : [])]), ...fiberColsOf()])
    return { archetype: arch, columns: cols, rows, keys, total: rows.length, frontier: false, deferred, sql, available }
  }

  // fibers / rollup / rowgroup: the fiber levels come from fibers(h, n) + cardinality(f) — no element materialized.
  // One request per grouping-set level; a level over a PREFIX of the axis chain sums the finer fibers' cardinalities.
  const fiberRows = await runSql<Row>(
    `SELECT ${[...s.axes.map((a) => `(f).${ident(a)} AS ${ident(a)}`), 'cardinality(f)::text AS count'].join(', ')}
       FROM fibers(${s.built}, ${fiberLimit}) f ORDER BY fiber_address(f)`,
  )
  const frontier = s.open && fiberRows.length === fiberLimit
  const level = (prefix: string[]): Row[] => {
    if (prefix.length === s.axes.length) return fiberRows.map((r) => ({ ...r, count: cardText(r.count) }))
    const acc = new Map<string, Row>()
    for (const r of fiberRows) {
      const k = prefix.map((a) => String(r[a])).join('\u0000')
      const cur = acc.get(k)
      if (!cur) acc.set(k, { ...Object.fromEntries(prefix.map((a) => [a, r[a]])), count: cardText(r.count) })
      else cur.count = addCards(String(cur.count), cardText(r.count))
    }
    const out = [...acc.values()]
    if (frontier && prefix.length && out.length > 1) out.pop()   // the last outer group is cut by the fiber limit (a lone group is kept: better a partial row than none)
    return out
  }
  const applyLens = async (rows: Row[], keys: string[]): Promise<Row[]> => {
    if (!q.having?.trim() && !q.orderBy?.trim()) return rows
    if (!rows.length) return rows
    const cols = [...keys, 'count']
    const vals = rows.map((r) => `(${cols.map((c) => sqlNum(r[c])).join(', ')})`).join(',\n')
    const where = q.having?.trim() ? `WHERE ${measureLens(q.having.trim())}` : ''
    const order = q.orderBy?.trim() || keys.map((k) => `${ident(k)} NULLS LAST`).join(', ')
    return runSql<Row>(`SELECT * FROM (VALUES ${vals}) AS t(${cols.map(ident).join(', ')}) ${where} ORDER BY ${order}`)
  }

  const groupKey = (r: Row, keys: string[]) => keys.map((k) => String(r[k])).join('\u0000')
  /** a level that cannot carry a fiber column still has the column — holding NULL (C10) */
  const blankFiberCells: Row = Object.fromEntries(fiberCols.flatMap((c) =>
    c.kind === 'pivot' ? pivotCols(c).map((p) => [p.id, null] as [string, Cell]) : [[c.id, null] as [string, Cell]]))
  /** `level` is GROUPING(): 0 on a single-level result, and the plan's own marker on a composed one */
  const wantsLevel = s.sel.some((c) => c.kind === 'level')
  /** The fiber-level SELECT columns beyond `count`, computed WITHOUT enumerating: `symbol` off the fiber itself, and
   *  dist / min|max|sum|avg off the registered refinement sibling whose fibers ARE the statistic's level sets
   *  (base_triangle_refines — C7/C8 spelled as one grouped read of its closed-form cardinalities). Null when any
   *  requested column has no accelerated route — the caller then falls back to the naive statement. */
  const fiberExtras = async (keys: string[], levelRows: Row[]): Promise<{ cells: Map<string, Row>; covered: Set<string> | null } | null> => {
    const out = new Map<string, Row>()
    let covered: Set<string> | null = null
    if (!fiberCols.length) return { cells: out, covered }
    const put = (k: string, cells: Row) => out.set(k, { ...(out.get(k) ?? {}), ...cells })
    const symbols = fiberCols.filter((c) => c.kind === 'symbol')
    if (symbols.length) {
      if (keys.length !== s.axes.length || keys.some((k, i) => k !== s.axes[i])) return null   // a symbol names a WHOLE fiber
      const rs = await runSql<Row>(
        `SELECT ${[...s.axes.map((a) => `(f).${ident(a)} AS ${ident(a)}`), 'fiber_symbol(f)::text AS symbol'].join(', ')}
           FROM fibers(${s.built}, ${fiberLimit}) f ORDER BY fiber_address(f)`)
      for (const r of rs) put(groupKey(r, keys), Object.fromEntries(symbols.map((c) => [c.id, r.symbol])))
    }
    const byStat = [...new Set(fiberCols.filter((c) => c.stat).map((c) => c.stat!.id))]
    if (byStat.length) {
      // the sibling's rows are indexed by ONE axis: a registered refinement adds the statistic to a one-axis parent
      if (q.where?.trim() || s.axes.length !== 1 || keys.length !== 1 || keys[0] !== s.axes[0]) return null
      const a = s.axes[0]
      for (const stat of byStat) {
        const [reg] = await runSql<{ triangle: string; row_axis: string; col_axis: string }>(
          `SELECT r.triangle, t.row_axis, t.col_axis FROM base_triangle_refines r JOIN base_triangle t ON t.collection = r.triangle
            WHERE r.parent = $1 AND r.stat_id = $2 ORDER BY r.triangle LIMIT 1`, [s.coll, stat])
        if (!reg) return null
        const mine = fiberCols.filter((c) => c.stat?.id === stat)
        // bind the sibling to exactly the rows the level shows: it has one fiber per (n, k), so sharing the parent's
        // fiber limit would truncate it mid-row and report a short distribution
        const ns = levelRows.map((r) => Number(r[a])).filter((n) => Number.isFinite(n))
        if (!ns.length) return { cells: out, covered }
        const tri = new Handle(reg.triangle, { [reg.row_axis]: [Math.min(...ns), Math.max(...ns)] as ParamValue })
        const k = `(f).${ident(reg.col_axis)}`, card = 'cardinality(f)'
        const proj = mine.map((c) => c.kind === 'pivot'
          ? pivotCols(c).map((p) => `, coalesce(sum(${card}) FILTER (WHERE ${k} = ${Number(p.value)}), 0)::text AS ${ident(p.id)}`).join('')
          : `, ${accelFiberExpr(c, k, card)} AS ${ident(c.id)}`).join('')
        const rs = await runSql<Row>(
          `SELECT (f).${ident(reg.row_axis)} AS ${ident(a)}, count(*)::int AS __fibers${proj}
             FROM fibers(${await tri.built()}, ${SIBLING_CELL_CAP}) f GROUP BY 1 ORDER BY 1`)
        // the cap cut the stream mid-row: that row's distribution is partial, so it and everything past it are frontier
        if (rs.reduce((n, r) => n + Number(r.__fibers), 0) >= SIBLING_CELL_CAP) rs.pop()
        const reach = new Set(rs.map((r) => String(r[a])))
        covered = covered ? new Set([...covered].filter((x: string) => reach.has(x))) : reach
        for (const r of rs) put(String(r[a]), Object.fromEntries(
          mine.flatMap((c) => (c.kind === 'pivot' ? pivotCols(c).map((p) => [p.id, r[p.id]] as [string, Cell]) : [[c.id, r[c.id]] as [string, Cell]]))))
      }
    }
    return { cells: out, covered }
  }

  if (arch === 'distribution') {
    const keys = [...new Set(g!.sets.flat())]
    // GROUP BY orbit:<rel> / map:<map> — the map kernel: one group per class, keyed by the class representative. No
    // registered sibling to read closed-form counts from, so it enumerates: `count(DISTINCT canonical(e))` as a plain
    // grouped query (the doc's Pólya orbit count), which needs a bounded handle.
    if (keys.some((k) => s.kernels.has(k))) {
      requireBounded('GROUP BY orbit:/map: (the kernel enumerates the collection)')
      const rows = await runSql<Row>(sql)
      return { archetype: arch, columns: listed(colsOf([...keys, 'count', ...(g!.sets.length > 1 ? ['level'] : [])])), rows, keys, total: rows.length, frontier: false, deferred, sql, available }
    }
    // a REGISTERED refinement — GROUP BY <the one axis>, <stat> where base_triangle_refines names the (n,k) sibling whose
    // fibers are exactly these groups — is read off that sibling's closed-form cardinalities: no elements enumerated,
    // and an OPEN parent streams its triangle rows (the Eulerian numbers of permutations, row after row)
    const stat = keys.find((k) => s.stats.some((st) => st.statId === k))
    // flat GROUP BY axis, stat only: a ROLLUP / GROUPING SETS over a stat would need the sibling's coarser levels too
    // (its (n) level IS the parent's fiber count) — a later refinement; today that shape takes the naive path
    // every grouping set a prefix of (axis, stat) — flat, ROLLUP, or GROUPING SETS ((axis, stat), (axis), ()) — with a
    // custom ORDER BY left to the naive statement (a composed multi-level result is ordered by its keys)
    const prefixChain = keys.length === 2 && keys[0] === s.axes[0] && keys[1] === stat && g!.sets.every((st) => st.every((c, i) => c === keys[i]))
    if (stat && s.axes.length === 1 && prefixChain && !q.where?.trim() && (g!.sets.length === 1 || !q.orderBy?.trim())) {
      const [reg] = await runSql<{ triangle: string; row_axis: string; col_axis: string }>(
        `SELECT r.triangle, t.row_axis, t.col_axis FROM base_triangle_refines r JOIN base_triangle t ON t.collection = r.triangle
          WHERE r.parent = $1 AND r.stat_id = $2 ORDER BY r.triangle LIMIT 1`, [s.coll, stat!])
      if (reg) {
        const a = s.axes[0]
        const tri = new Handle(reg.triangle, s.h.args[a] === undefined ? {} : { [reg.row_axis]: s.h.args[a] })
        const triRows = await runSql<Row>(
          `SELECT (f).${ident(reg.row_axis)} AS ${ident(a)}, (f).${ident(reg.col_axis)} AS ${ident(stat!)}, cardinality(f)::text AS count
             FROM fibers(${await tri.built()}, ${fiberLimit}) f ORDER BY fiber_address(f)`)
        const frontierT = s.open && triRows.length === fiberLimit
        // a sibling fiber with no elements is not a group of the parent (the naive GROUP BY never sees it) — drop it before the lens
        const cells = triRows.filter((r) => cardText(r.count) !== '0')
        const multi = g!.sets.length > 1
        const out: Row[] = []
        for (const set of g!.sets) {
          // (axis, stat) ← the sibling's fibers · (axis) ← the parent's own fibers · () ← cardinality(handle); the lens applies to every level
          const raw = set.length === 2 ? cells : set.length === 1 ? level([a]) : [{ [a]: null, [stat!]: null, count: s.card == null ? 'Infinity' : String(s.card) }]
          const lensed = await applyLensOver(raw, keys)
          for (const r of lensed) out.push({ ...Object.fromEntries(keys.map((k) => [k, r[k] ?? null])), count: cardText(r.count), ...(multi || wantsLevel ? { level: groupingMask(keys, set) } : {}) })
        }
        const rows = q.orderBy?.trim() ? out : out.sort((x, y) => cmpKeys(x, y, keys))   // the GROUP BY's key order, as the statement reads (NULLs last)
        return { archetype: multi ? 'rollup' : arch, columns: listed(colsOf([...keys, 'count', ...(multi ? ['level'] : [])])), rows, keys, total: frontierT ? null : rows.length, frontier: frontierT || (multi && frontier), deferred, sql, available }
      }
    }
    requireBounded('GROUP BY a statistic (the distribution enumerates the fiber)')
    const rows = await runSql<Row>(sql)
    return { archetype: arch, columns: listed(colsOf([...keys, 'count', ...(g!.sets.length > 1 ? ['level'] : [])])), rows, keys, total: rows.length, frontier: false, deferred, sql, available }
  }

  if (arch === 'fibers') {
    const keys = g!.sets[0]
    const cols = listed([...colsOf([...keys, 'count']), ...fiberColsOf()])
    const lensed = await applyLens(level(keys), keys)
    const extras = await fiberExtras(keys, lensed)
    if (!extras) {
      requireBounded('a fiber column with no registered refinement (min/max/sum/avg/dist enumerate the fiber)')
      const rows = await runSql<Row>(sql)
      return { archetype: arch, columns: cols, rows, keys, total: rows.length, frontier: false, deferred, sql, available }
    }
    // a level row past the sibling's cell cap has no fiber cells to show — it is the frontier, not a blank row
    const shownRows = extras.covered ? lensed.filter((r) => extras.covered!.has(String(r[keys[0]]))) : lensed
    const cut = frontier || shownRows.length < lensed.length
    const rows = shownRows.map((r) => ({ ...r, count: cardText(r.count), ...blankFiberCells, ...(wantsLevel ? { level: 0 } : {}), ...(extras.cells.get(groupKey(r, keys)) ?? {}) }))
    return { archetype: arch, columns: cols, rows, keys, total: cut ? null : rows.length, frontier: cut, deferred, sql, available }
  }

  if (arch === 'rollup') {
    const keys = [...new Set(g!.sets.flat())]
    const out: Row[] = []
    for (const set of g!.sets) {
      // every level is lensed with EVERY key in scope (NULL where the level dropped it) — literal GROUPING SETS: a key
      // predicate `k = 2` fails on the (n) level and the () footer, a measure predicate sees each level's count
      const raw = set.length ? level(set) : [{ count: s.card == null ? 'Infinity' : String(s.card) }]   // the () footer = cardinality(handle)
      const extras = set.length ? await fiberExtras(set, raw) : null
      const cellsOf = (r: Row) => ({ ...blankFiberCells, ...(extras?.cells.get(groupKey(r, set)) ?? {}) })
      const byKey = new Map(raw.map((r) => [keys.map((k) => String(r[k] ?? null)).join('\u0000'), cellsOf(r)]))
      const rows = await applyLensOver(raw.map((r) => ({ ...Object.fromEntries(keys.map((k) => [k, r[k] ?? null])), count: r.count })), keys)
      for (const r of rows) out.push({ ...Object.fromEntries(keys.map((k) => [k, r[k] ?? null])), count: cardText(r.count),
                                       ...(byKey.get(keys.map((k) => String(r[k] ?? null)).join('\u0000')) ?? blankFiberCells),
                                       level: groupingMask(keys, set) })
    }
    out.sort((a, b) => cmpKeys(a, b, keys))
    return { archetype: arch, columns: listed([...colsOf([...keys, 'count']), ...fiberColsOf(), ...colsOf(['level'])]), rows: out, keys, total: frontier ? null : out.length, frontier, deferred, sql, available }
  }

  // rowgroup: the element rows (a slice, or the restricted relation) under the fiber subtotals of the coarser set
  const keySet = g!.sets.find((st) => st.includes('rank') || st.includes('element'))!
  const groupKeys = g!.sets.find((st) => st !== keySet) ?? keySet.filter((k) => s.axes.includes(k))
  const cols = listed([...colsOf(['ordinality', ...positional, 'element', ...shown]), ...fiberColsOf()])
  let rows: Row[]
  if (q.where?.trim()) {
    requireBounded('WHERE (a restriction materializes the relation)')
    rows = await runSql<Row>(rowSqlFor(s, { ...q, groupBy: undefined, having: undefined }, {}, arch))
  } else {
    rows = await runSql<Row>(
      `SELECT ${first} + row_number() OVER (ORDER BY ${[...s.axes.map((a) => `${ident(a)}(e)`), 'rank(e)'].join(', ')}) AS ordinality, ${relation(s, wantedStats(s, ref.stats), ref.value, true)}
         FROM elements(${s.built}, rank_index_range(${first}, ${first + count}, '[)')) e
        ORDER BY ${[...s.axes.map((a) => `${ident(a)}(e)`), 'rank(e)'].join(', ')}`,
    )
  }
  // subtotals for exactly the groups the ELEMENT window shows (the fiber frontier and the element frontier are different
  // slices — a group beyond the fiber frontier is counted directly rather than dropping its elements); a HAVING lens
  // then hides whole groups
  const gkey = (r: Row) => groupKeys.map((k) => String(r[k])).join('.')
  const present = new Map<string, Row>()
  for (const r of rows) if (!present.has(gkey(r))) present.set(gkey(r), Object.fromEntries(groupKeys.map((k) => [k, r[k]])))
  const known = new Map(level(groupKeys).map((r) => [gkey(r), r]))
  const subs: Row[] = []
  for (const [k, keyVals] of present) {
    const hit = known.get(k)
    if (hit) { subs.push(hit); continue }
    const h = new Handle(s.coll, Object.fromEntries(groupKeys.map((a) => [a, Number(keyVals[a])])))
    const [c] = await runSql<{ c: string }>(`SELECT cardinality(${await h.built()})::text AS c`)
    subs.push({ ...keyVals, count: cardText(c?.c ?? null) })
  }
  // a fiber column (symbol / a sibling-backed aggregate) names the WHOLE fiber, not an individual element — so it
  // lands on the subtotal subheader (C10), never an element row. Computed WITHOUT enumerating, the same route as
  // fibers/rollup (fiberExtras); reject the combination with a typed error when no accelerated route covers this
  // key shape, rather than falling through to the naive GROUPING SETS statement (rowgroup's own #214 fix).
  const rowExtras = fiberCols.length ? await fiberExtras(groupKeys, subs) : null
  if (fiberCols.length && !rowExtras) {
    throw new Error(`SELECT: ${fiberCols.map((c) => c.id).join(', ')} ${fiberCols.length > 1 ? 'are fiber columns' : 'is a fiber column'} — no accelerated route covers ${groupKeys.join(', ')} here; group by the whole fiber (an axis prefix with a registered sibling) or drop it from SELECT`)
  }
  const cellsOf = (r: Row) => ({ ...blankFiberCells, ...(rowExtras?.cells.get(groupKey(r, groupKeys)) ?? {}) })
  const subtotals = (await applyLens(subs, groupKeys)).map((r) => ({ ...r, ...cellsOf(r) }))
  // literal GROUPING SETS semantics: the HAVING filters EVERY level, so an element row (count = 1) passes or fails with
  // one representative per group evaluated at count 1 — a key lens (n >= 2) keeps a group's elements with its subheader,
  // a measure lens (count(*) > 1) keeps the subheaders only
  const reps: Row[] = [...present.values()].map((kv) => ({ ...kv, count: '1' }))
  const keep = new Set((await applyLens(reps, groupKeys)).map(gkey))
  // an element row has no fiber of its own to report — the fiber columns stay NULL here (C10); real values are on
  // the subtotal subheader above
  const grouped = rows.map((r) => ({ ...r, ...blankFiberCells, __group: gkey(r) })).filter((r) => keep.has(String(r.__group)))
  return { archetype: arch, columns: cols, rows: grouped, keys: groupKeys, subtotals, total: s.card, frontier: s.open && rows.length === count, deferred, sql, available }
}

/** the sibling-fiber form of a fiber column: the statistic is the sibling's second axis `k`, its level-set sizes are
 *  the sibling's cardinalities — so the distribution is an array_agg of them and every aggregate a closed-form sum.
 *  Cast to text throughout: a fiber count can exceed a JS number, and it keeps the naive differential byte-exact. */
function accelFiberExpr(c: SelectColumn, k: string, card: string): string {
  const nonEmpty = `FILTER (WHERE ${card} > 0)`
  if (c.kind === 'dist') return `array_agg(${card} ORDER BY ${k}) ${nonEmpty}::text`
  const fn = (c.spec as { fn: string }).fn
  if (fn === 'min' || fn === 'max') return `${fn}(${k}) ${nonEmpty}::text`
  const total = `sum(${k} * ${card})`
  if (fn === 'sum') return `trim_scale(${total})::text`
  return `trim_scale(round((${total} / nullif(sum(${card}), 0))::numeric, 6))::text`
}

/** The DEFERRED columns for the rows actually in view, keyed by `address` — the second, keyed fetch of §4. `addresses`
 *  are the plan's OWN rows' addresses (`table.rows.map(r => r.address)`), not re-derived from the window: under a
 *  WHERE / ORDER BY the plan's element window is a restricted/sorted slice of the WHOLE fiber, so its addresses don't
 *  coincide with the canonical `[first, first+count)` range (#214 — matching on the canonical slice silently left
 *  every row outside it blank). Matching on the addresses the caller already has is correct in every case: canonical,
 *  restricted, or sorted. `w` only bounds an OPEN handle's enumeration (a bounded handle enumerates in full, same cap
 *  the naive WHERE/ORDER BY path uses elsewhere) — an open handle never carries a WHERE/ORDER BY (requireBounded
 *  forbids it), so the very window that produced `addresses` is still a safe, sufficient enumeration bound. */
export async function planDeferred(q: RowQuery, addresses: string[], w: RowWindow = {}, select: RowSelect = {}): Promise<Row[]> {
  const s = await shape(q.from, select, q.groupBy, [q.where, q.having, q.orderBy].filter(Boolean).join(' '))
  const cols = s.sel.filter((c) => s.deferred.has(c.id))
  if (!cols.length || !addresses.length) return []
  const first = Math.max(0, w.first ?? 0), count = Math.max(1, w.count ?? 100)
  const src = s.open ? `elements(${s.built}, ${first + count})` : `elements(${s.built}, 2147483647)`
  return runSql<Row>(
    `SELECT array_to_string(address(e), '.') AS address, ${cols.map((c) => `${c.expr} AS ${ident(c.id)}`).join(', ')}
       FROM ${src} e WHERE array_to_string(address(e), '.') = ANY($1)`,
    [addresses])
}

/** `grouping(k1, …, kn)` — a BITMASK, high bit for the first key: a key the level dropped contributes its bit.
 *  (Not the count of dropped keys: over two axes the footer is 3, not 2.) */
function groupingMask(keys: string[], set: string[]): number {
  return keys.reduce((m, k, i) => m | (set.includes(k) ? 0 : 1 << (keys.length - 1 - i)), 0)
}

function cmpKeys(a: Row, b: Row, keys: string[]): number {
  for (const k of keys) {
    const x = a[k], y = b[k]
    if (x == null && y == null) continue
    if (x == null) return 1
    if (y == null) return -1
    const d = Number(x) - Number(y)
    if (d) return d
  }
  return 0
}

// ── naming: the statement as the registry rows it would become ──────────────────────────────────────────────────────
export type Related = {
  collection: string
  /** how the named collection relates to THIS statement's rows */
  relation: 'equals' | 'refines' | 'coarsens' | 'child' | 'parent' | 'triangle' | 'row-sums' | 'construction' | 'sibling'
  via: string
}
export type Naming = { kind: 'none' | 'binding' | 'restriction' | 'sibling' | 'lens'; sql: string; note: string; related: Related[] }

/** Named collections structurally near this statement — found by DATA, not by name: the restriction ancestry
 *  (parents coarsen, registered children refine), a WHERE compared element-for-element against every descendant on a
 *  probe fiber (equal / ⊂ / ⊃), and a GROUP BY axis + statistic compared cell-for-cell against every registered
 *  triangle. "The connections are the point": the answer to "name this" is often "it has a name". */
async function relatedTo(s: Shape, q: RowQuery, g: Grouping | null): Promise<Related[]> {
  const out: Related[] = []
  const seen = new Set<string>()
  const push = (r: Related) => { if ((r.collection !== s.coll || r.relation === 'construction') && !seen.has(r.collection + r.relation)) { seen.add(r.collection + r.relation); out.push(r) } }
  const parents = await runSql<{ ancestor: string; depth: number }>(`SELECT ancestor, depth FROM base_collection_ancestry WHERE collection = $1 ORDER BY depth`, [s.coll])
  for (const p of parents) push({ collection: p.ancestor, relation: 'parent', via: p.depth === 1 ? `${s.coll} is a restriction of it` : `${s.coll} restricts it through ${p.depth} steps` })
  const kids = await runSql<{ collection: string; predicate: string; depth: number }>(
    `SELECT a.collection, cp.predicate, a.depth FROM base_collection_ancestry a JOIN base_collection_parent cp ON cp.collection = a.collection
      WHERE a.ancestor = $1 ORDER BY a.depth, a.collection`, [s.coll])
  const w = q.where?.trim()
  if (w && kids.length) {
    // a probe fiber the comparison can afford: the handle itself when small, else the first axis bound to 4
    let args = s.h.args, probeText = q.from
    if (s.open || (s.card ?? Infinity) > 5000) { args = s.axes.length ? { [s.axes[0]]: 4 } : {}; probeText = handleText(s.coll, args, s.axes) }
    const probe = await new Handle(s.coll, args).built()
    let mine: Set<string> | null = null
    try {
      mine = new Set((await runSql<{ element: string }>(`WITH r AS (SELECT ${relation(s)} FROM elements(${probe}, 2147483647) e) SELECT element FROM r WHERE ${w}`)).map((r) => r.element))
    } catch { mine = null }
    for (const k of kids) {
      if (!mine) { push({ collection: k.collection, relation: 'child', via: `restricts ${s.coll} by ${k.predicate}` }); continue }
      const theirs = new Set((await runSql<{ element: string }>(`SELECT render(e) AS element FROM elements(${await new Handle(k.collection, args).built()}, 2147483647) e`)).map((r) => r.element))
      const sub = [...mine].every((x) => theirs.has(x)), sup = [...theirs].every((x) => mine!.has(x))
      if (sub && sup) push({ collection: k.collection, relation: 'equals', via: `the same elements on ${probeText}` })
      else if (sub) push({ collection: k.collection, relation: 'coarsens', via: `contains these rows on ${probeText}` })
      else if (sup) push({ collection: k.collection, relation: 'refines', via: `is contained in these rows on ${probeText}` })
      else push({ collection: k.collection, relation: 'child', via: `restricts ${s.coll} by ${k.predicate}; overlaps` })
    }
  } else {
    for (const k of kids) push({ collection: k.collection, relation: 'child', via: `restricts ${s.coll} by ${k.predicate}` })
  }
  // triangles: one registered ON this collection, those whose row-sums ARE this collection, and — for a GROUP BY
  // axis + statistic — every registered triangle whose cells equal this grouping's counts on a probe band
  const tris = await runSql<{ collection: string; row_axis: string; col_axis: string; sequence: string | null; probeable: boolean }>(
    // probeable = affordable AND aligned with a 0-based grouping: a fiber_count accel (so triangle_cells is O(1), not an
    // enumeration) and a row axis starting at 0 (else triangle_cells' generate_series(0, …) builds a degenerate fiber range).
    `SELECT t.collection, t.row_axis, t.col_axis, t.sequence,
            to_regprocedure(format('fiber_count(%I)', t.collection || '_fiber')) IS NOT NULL
            AND coalesce(g.lo_expr, '0') = '0' AS probeable
       FROM base_triangle t LEFT JOIN base_grade g ON g.collection = t.collection AND g.name = t.row_axis
      ORDER BY t.collection`)
  for (const t of tris) {
    if (t.collection === s.coll) push({ collection: s.coll, relation: 'triangle', via: `registered as a triangle: GROUP BY ${t.row_axis}, ${t.col_axis}` })
    if (t.sequence === s.coll) push({ collection: t.collection, relation: 'refines', via: `its row-sums are ${s.coll}'s counting sequence` })
  }
  // the construction this collection instantiates ("this IS finsets_of(fin(n))") and its sibling instances — the
  // same functor at another type argument (subsets ~ finsets ~ k_subsets under finset; words ~ binary_words ~
  // endofunctions under maps). One data source, base_collection_construction; the FROM spelling from from_name.
  const mine = await runSql<{ construction: string; signature: string | null; from_name: string | null; generic: boolean; restricted: string | null }>(
    `SELECT c.construction, c.signature, k.from_name, c.generic, c.restricted FROM base_collection_construction c JOIN base_construction k ON k.id = c.construction WHERE c.collection = $1`, [s.coll])
  if (mine.length) {
    const c = mine[0]
    push({ collection: s.coll, relation: 'construction', via: `${c.from_name ?? c.construction}: ${c.signature ?? c.construction}${c.restricted ? ` — the ${c.restricted} sub-family` : ''}${c.generic ? ' (a hole left to range)' : ''}` })
    const sibs = await runSql<{ collection: string; signature: string | null; generic: boolean; restricted: string | null }>(
      `SELECT collection, signature, generic, restricted FROM base_collection_construction WHERE construction = $1 AND collection <> $2 ORDER BY collection`, [c.construction, s.coll])
    for (const sb of sibs) push({ collection: sb.collection, relation: sb.restricted && !c.restricted ? 'refines' : 'sibling', via: `${sb.restricted ? `the ${sb.restricted} sub-family of` : 'the same'} ${c.from_name ?? c.construction} at ${sb.signature ?? '?'}${sb.generic ? ' (generic)' : ''}` })
  }
  const cols = g?.sets.flat() ?? []
  const stat = cols.map((c) => s.stats.find((st) => st.statId === c)).find(Boolean)
  // registered refinements of THIS collection — the named GROUP BYs, and the equidistributed stats behind each
  const regs = await runSql<{ triangle: string; stat_id: string }>(`SELECT triangle, stat_id FROM base_triangle_refines WHERE parent = $1 ORDER BY triangle, stat_id`, [s.coll])
  for (const r of regs) {
    if (stat && r.stat_id === stat.statId) push({ collection: r.triangle, relation: 'equals', via: `registered: the distribution of ${stat.statId} on ${s.coll}` })
    else push({ collection: r.triangle, relation: 'refines', via: `${s.coll} GROUP BY ${s.axes[0] ?? 'n'}, ${r.stat_id}` })
  }
  const registered = new Set(regs.map((r) => r.triangle))
  if (g && stat && s.axes.length === 1 && cols.length === 2 && cols.includes(s.axes[0]) && !w) {
    const a = s.axes[0]
    const [lim] = await runSql<{ n: number | null }>(`SELECT max(n)::int AS n FROM generate_series(0, 6) n WHERE cardinality(${s.coll}(0, n)) <= 5000`)
    const nmax = lim?.n ?? null
    if (nmax != null && nmax >= 2) {
      const mine = await runSql<{ n: string; k: string; c: string }>(
        `SELECT ${ident(a)}(e)::text AS n, ${stat.valueFunc}((e).value)::text AS k, count(*)::text AS c FROM elements(${s.coll}(0, ${nmax}), 2147483647) e GROUP BY 1, 2`)
      const key = (r: { n: string; k: string; c: string }) => `${r.n},${r.k}=${r.c}`
      const mineSet = new Set(mine.map(key))
      for (const t of tris) {
        if (registered.has(t.collection)) continue   // already reported from the registry
        if (t.collection === s.coll || !t.probeable) continue
        let cells: { n: string; k: string; c: string }[]
        try { cells = await runSql(`SELECT row_index::text AS n, col_index::text AS k, value::text AS c FROM triangle_cells($1, $2) WHERE value > 0`, [t.collection, nmax]) } catch { continue }
        const theirs = new Set(cells.map(key))
        if (theirs.size === mineSet.size && [...mineSet].every((x) => theirs.has(x))) push({ collection: t.collection, relation: 'equals', via: `the same T(${a}, ${stat.statId}) cells for ${a} ≤ ${nmax}` })
      }
    }
  }
  return out
}

/** What "name this" would insert for the current statement — the row half's clauses mapped to the registries that
 *  already hold named instances of each: a WHERE restriction → base_restrict (a predicate on the carrier), a GROUP BY
 *  over an axis + a statistic → the (axes, k)-graded sibling whose fibers are those groups (+ base_triangle), a bare
 *  binding → a handle (an alias row once the family tier lands, #67), a HAVING lens → nothing (it hides fiber rows;
 *  the collection is unchanged). Display only — copy into a sqlsrc file. */
export async function nameStatement(q: RowQuery, name: string): Promise<Naming> {
  const s = await shape(q.from, {}, q.groupBy)
  const g0 = q.groupBy?.trim() ? parseGroupBy(q.groupBy) : null
  const related = await relatedTo(s, q, g0)
  const id = name.trim()
  const okId = /^[a-z_][a-z0-9_]*$/.test(id)
  const nm = okId ? id : `<name>`
  const g = q.groupBy?.trim() ? parseGroupBy(q.groupBy) : null
  const bound = Object.keys(s.h.args).length > 0
  if (q.having?.trim()) {
    return { kind: 'lens', sql: '', note: `HAVING is a lens: it chooses which fiber rows to show and leaves the collection unchanged (the footer stays ${s.coll}'s cardinality). Nothing to name — to re-scope, bind the fibers in FROM instead.`, related }
  }
  // a predicate over R(C)'s columns → a predicate over the carrier value `v`
  const toCarrier = (expr: string): string => {
    let out = expr
    for (const st of [...s.stats].sort((a, b) => b.statId.length - a.statId.length)) {
      out = out.replace(new RegExp(`(?<![A-Za-z0-9_"])${st.statId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_"])`, 'g'), `${st.valueFunc}(v)`)
    }
    return out.replace(/(?<![A-Za-z0-9_])value(?![A-Za-z0-9_])/g, 'v')
  }
  if (g) {
    const cols = g.sets.flat()
    const stat = cols.map((c) => s.stats.find((st) => st.statId === c)).find(Boolean)
    if (stat && s.axes.length === 1 && cols.length === 2 && cols.includes(s.axes[0])) {
      const a = s.axes[0]
      const sql = `-- ${nm}: ${s.coll} refined by ${stat.statId} as a second axis — the (${a}, k)-graded sibling whose fibers are this GROUP BY's rows
CREATE TYPE ${nm}_fiber AS (${a} natural_number, k natural_number);
INSERT INTO base_collection VALUES ('${nm}', '${s.carrier}', false);
INSERT INTO base_grade VALUES ('${nm}', 1, '${a}', NULL, NULL), ('${nm}', 2, 'k', '0', NULL);   -- k = ${stat.statId}; give it a hi_expr if one is known
CREATE FUNCTION fiber_elements(f ${nm}_fiber, element_limit int) RETURNS SETOF ${s.carrier} LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).${a})::${s.coll}_fiber, 2147483647) v WHERE ${stat.valueFunc}(v) = (f).k LIMIT element_limit $$;
SELECT base_realize('${nm}');
INSERT INTO base_triangle VALUES ('${nm}', '${a}', 'k', '${s.coll} by ${stat.statId}', '${s.coll}');   -- its row-sums recover ${s.coll}'s counts`
      return { kind: 'sibling', sql, note: `A statistic promoted to an axis is a named sibling collection (as k_descent_permutations is to permutations); base_triangle records that its row-sums are ${s.coll}'s counting sequence. A closed-form fiber_count(${nm}_fiber) would make the fibration face free.`, related }
    }
    if (stat) return { kind: 'sibling', sql: '', note: `GROUP BY ${cols.join(', ')} would name a sibling graded by ${stat.statId}; the skeleton is written for one axis + one statistic — for ${s.axes.length} axes and ${cols.length} keys, author the fiber type by hand.`, related }
    if (!q.where?.trim()) return { kind: bound ? 'binding' : 'none', sql: '', note: `GROUP BY ${cols.join(', ')} is ${s.coll}'s own grading — its fibers are already the collection's; there is nothing new to name${bound ? ` (the binding ${q.from} is a handle, not a collection)` : ''}.`, related }
  }
  if (q.where?.trim()) {
    const w = q.where.trim()
    const direct = w.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*value\s*\)$/)
    const pred = direct ? direct[1] : `is_${nm}`
    const fn = direct ? '' : `CREATE FUNCTION is_${nm}(v ${s.carrier}) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT ${toCarrier(w)} $$;\n`
    const sql = `-- ${nm} ⊂ ${s.coll}: the elements WHERE ${w}
${fn}SELECT base_restrict('${nm}', '${s.coll}', '${pred}');${bound ? `\n-- the binding ${q.from} stays a handle: ${nm} inherits ${s.coll}'s axes, so this slice is ${nm}(${Object.entries(s.h.args).map(([k, v]) => `${k}=${Array.isArray(v) ? `${v[0]}..${v[1]}` : v}`).join(', ')})` : ''}`
    return { kind: 'restriction', sql, note: `A WHERE that drops elements inside fibers is a restriction: the named collection re-ranks the survivors and gets its own count/unrank engine (add count_fn / unrank_fn to base_restrict when a closed form exists).`, related }
  }
  if (bound) {
    // #67 B5: this binding may already BE a registered family point (twin_primes = prime_pairs(gap=2)) — resolveFrom
    // has already folded any bare point-id FROM into its family form by the time shape() runs, so the only way to
    // recognize it here is the reverse match: does s.h.args, restricted to a point's own bindings, equal it exactly?
    const pt = await pointFor(s.coll, s.h.args)
    if (pt) {
      return { kind: 'binding', sql: '', note: `${pt.id} already names exactly this binding (base_family_point, #67) — ${pt.pointer ? `a pure alias, no tower of its own; it resolves through ${s.coll}` : `it owns its own realized tower, kept in step by a self-cert differential against ${s.coll}`}.`, related }
    }
    return { kind: 'binding', sql: `-- ${q.from} is a handle of ${s.coll}: every rank intact, cardinality = Σ of the bound fibers.\n-- A named point of a family (e.g. twin_primes = prime_pairs(gap=2)) is a base_family_point row (#67) — 'name this' says so when the binding matches one.`, note: `A binding selects fibers; it is the collection itself, addressed. Nothing to realize.`, related }
  }
  return { kind: 'none', sql: '', note: `${s.coll} as it is — already named.`, related }
}

/** Does `coll` bound to `args` INCLUDE a registered family point's own `bindings` (base_family_point, #67) — e.g.
 *  prime_pairs bound to {gap:2} (or {gap:2, size:4}) IS/CONTAINS twin_primes? Used by nameStatement to phrase a
 *  binding as "point of <family>" rather than a generic fiber address — a SUBSET match, deliberately looser than
 *  resolveFamilyPointFrom's direction B (which requires an EXACT match, since it actually swaps which collection
 *  gets queried). Naming is only commentary — words(size=4, base=2) staying `words` for real query purposes
 *  doesn't stop 'name this' from also mentioning binary_words. `pointer` = true for a pure-pointer point
 *  (base_collection.alias_of set, no realized tower of its own — cube_free_numbers), false for one that owns its
 *  own tower (twin_primes). */
async function pointFor(coll: string, args: Record<string, ParamValue>): Promise<{ id: string; pointer: boolean } | null> {
  const points = await familyPoints()
  const cat = await catalogMap()
  for (const p of Object.values(points)) {
    if (p.family !== coll) continue
    if (Object.entries(p.bindings).every(([k, v]) => args[k] === Number(v))) {
      return { id: p.collection, pointer: !!cat.get(p.collection)?.aliasOf }
    }
  }
  return null
}
