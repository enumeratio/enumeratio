// The typed relational IR — the ONE form of a statement; text is a codec at the edges (#278, D1).
//
// Everything the client evaluates is `SELECT <select-expr>… [FROM <rel>]`, the same two halves the query view
// already has: the row half (rows.ts — FROM · WHERE · GROUP BY · HAVING · ORDER BY) and the column half
// (select.ts — the projection list). This file is those two halves as a TREE rather than as clause text, plus the
// codecs between the tree and every text surface (the URL's query string, SQL, a CLI argument).
//
// FROM absent  ⇒ the select-expr is evaluated ONCE — a scalar (`binomial(5, 2)`), closed of `subject`.
// FROM present ⇒ it is evaluated per element of the relation — a stream of rows.
// That boundary is also the capability seam: an engine can be strong at FROM-less scalars and know nothing about
// enumeration (wiki: Async-Calc-Engines).
//
// FAITHFUL OR NOTHING, inherited from preds.ts: a clause the codec cannot represent as a tree is kept verbatim as
// `{ raw }` and printed back byte-identically. What the codec CAN represent round-trips to its CANONICAL spelling —
// `descents>=2` prints back as `descents >= 2`, a lowercase `rollup (n, k)` as `ROLLUP (n, k)` — the same fixed
// point predsToSql/parsePreds already establishes for chips. Canonicalization is the documented behaviour, never a
// silent rewrite of something the tree failed to capture.
//
// Naming: HandleExpr, never Handle — core.ts exports a `Handle` CLASS through the same barrel.
import type { ParamValue } from './core'
import { parsePreds, predsToSql, type Pred } from './preds'
import { parseGroupBy, parseHandle, type Grouping, type RowQuery, type RowStatement } from './rows'
import { parseSelect, selectText, type AggFn, type SelectSpec } from './select'

// ── the column half ───────────────────────────────────────────────────────────────────────────────────────────────

/** A function id the tree may apply. Minted by `fnRef`; the registry's own `fn()` (#278 increment 4) mints the same
 *  brand but additionally checks the id against the catalog, so an unknown function fails at build time, not at
 *  evaluation time. */
export type FnRef = string & { readonly __fnRef: unique symbol }
export type Scalar = string | number | bigint
export type LitValue = Scalar | readonly Scalar[]

const FN_ID = /^[A-Za-z_][A-Za-z0-9_]*$/
/** Mint a FnRef. Shape-checked only — see the registry for the catalog-checked mint. */
export function fnRef(id: string): FnRef {
  if (!FN_ID.test(id)) throw new Error(`IR: "${id}" is not a function id`)
  return id as FnRef
}

export type SelectExpr =
  /** a constant — an argument to an apply, or a whole FROM-less scalar. An ARRAY constant is a literal too: a
   *  composite carrier's field is often `int[]` (a permutation's image, a multicomplex's coefficients), and
   *  building one needs the array to be expressible without a node kind of its own. `type` is present when this
   *  literal carries a NAMED pg type — a typed constant (`5::numeric`) or a value re-embedded from another
   *  evaluation (a `<coll>_element` row handed back in) — and absent for a bare untyped constant. */
  | { kind: 'lit'; value: LitValue; type?: string }
  /** the element under FROM; a select closed of `subject` is FROM-less-legal */
  | { kind: 'subject' }
  /** a value_fn / mapping_fn / render_fn, or one of the printer-only pseudo-functions below */
  | { kind: 'apply'; fn: FnRef; args: SelectExpr[] }
  /** a fiber-level fold over the group's rows */
  | { kind: 'aggregate'; fn: FnRef; over: SelectExpr }
  /** an ALGEBRA operator (`base_operation.id` — `add`, `neg`, `le`, …) over a NAMED pg type, the front end's own
   *  choice: `op('add', 'rational_number', [a, b])` is `a + b` in the field the front end decided `a`/`b` live in.
   *  `type` is never inferred from the args — an engine looks it up via `base_type_operation` (curated impl, or a
   *  pg-builtin native op) and rejects if that type has no such operation, rather than guessing one. */
  | { kind: 'op'; op: string; type: string; args: SelectExpr[] }
  /** a collection HANDLE used as a VALUE, not a FROM — e.g. `cardinality(handle(permutations(4)))`, where the
   *  handle itself is an argument rather than the thing being enumerated. */
  | { kind: 'handle'; handle: HandleExpr }
  /** a coercion: an element row down to its carrier VALUE (`(e).value`, when the source resolves to a
   *  `<coll>_element`), or a plain numeric-to-domain cast (`::rational_number`) otherwise. */
  | { kind: 'cast'; expr: SelectExpr; to: string }
  /** the escape hatch: SQL the tree could not capture. pg-only by construction. */
  | { kind: 'raw'; sql: string }

/** The pseudo-functions the column half applies. These are PRINTER-ONLY — deliberately NOT base_function rows: the
 *  registry curates named mathematical identities, while these name a column's SOURCE (its position, its render, its
 *  map image). An engine claims them through a column-group grant, not through an impl row. */
export const PSEUDO_FNS = [
  'ordinality', 'rank', 'address', 'omega',   // positions
  'render', 'repr', 'title',                  // renders
  'glyph_svg', 'data',                        // glyphs
  'map',                                      // a map image; nested = a `through:` chain
  'column',                                   // a bare id — an AXIS or a STATISTIC; only the catalog knows which
  'over',                                     // a fiber column lifted onto element rows
  'count', 'dist', 'pivot', 'symbol', 'level', // aggregates
  'min', 'max', 'sum', 'avg',
] as const

const AGGS: string[] = ['min', 'max', 'sum', 'avg']
const SUBJECT: SelectExpr = { kind: 'subject' }
const lit = (value: LitValue): SelectExpr => ({ kind: 'lit', value })
const apply = (fn: string, ...args: SelectExpr[]): SelectExpr => ({ kind: 'apply', fn: fnRef(fn), args })
const aggregate = (fn: string, over: SelectExpr): SelectExpr => ({ kind: 'aggregate', fn: fnRef(fn), over })

// `op`/`handle`/`cast` never appear below: the column half (specToIr/irToSpec) and the calc grammar (parseCalc)
// predate them and denote only what select.ts's SelectSpec / the FROM-less calculator can already say — they are
// SCALAR-SURFACE-ONLY kinds, built directly by an engine's own front end, never by parsing `select=` or `--calc`
// text. A tree containing one that reaches irToSpec throws the same as any other node outside its vocabulary.

/** One parsed column spec → its tree. Pure: a bare id stays the ambiguous `column(subject, 'id')` until a registry
 *  resolves it to an axis or a statistic (select.ts's resolveSelect does that against a live collection). */
export function specToIr(spec: SelectSpec): SelectExpr {
  switch (spec.kind) {
    case 'ordinality': return apply('ordinality')
    case 'position':   return apply(spec.position, SUBJECT)
    case 'element':    return apply('render', SUBJECT)
    case 'repr':       return spec.medium ? apply('repr', SUBJECT, lit(spec.repr), lit(spec.medium))
                                          : apply('repr', SUBJECT, lit(spec.repr))
    case 'name':       return apply('column', SUBJECT, lit(spec.name))
    case 'map':        return apply('map', SUBJECT, lit(spec.map))
    // a chain is the same node nested — each map's codomain feeding the next. Depth alone tells `map:` (1) from
    // `through:` (>= 2), so the two specs never collide on the way back.
    case 'through':    return spec.chain.reduce<SelectExpr>((acc, id) => apply('map', acc, lit(id)), SUBJECT)
    case 'glyph':      return apply('glyph_svg', SUBJECT)
    case 'data':       return apply('data', SUBJECT)
    case 'title':      return apply('title', SUBJECT)
    case 'count':      return aggregate('count', SUBJECT)
    case 'agg':        return aggregate(spec.fn, apply('column', SUBJECT, lit(spec.stat)))
    case 'dist':       return aggregate('dist', apply('column', SUBJECT, lit(spec.stat)))
    case 'pivot':      return aggregate('pivot', apply('column', SUBJECT, lit(spec.stat)))
    case 'symbol':     return aggregate('symbol', SUBJECT)
    case 'level':      return aggregate('level', SUBJECT)
    case 'over':       return apply('over', specToIr(spec.inner))
  }
}

const litText = (e: SelectExpr | undefined): string => {
  if (e?.kind !== 'lit') throw new Error('IR: expected a literal argument')
  return String(e.value)
}
/** unwind nested `map(map(subject, a), b)` to [a, b] — the inverse of the `through:` fold above */
function unwindMap(e: SelectExpr): string[] {
  const chain: string[] = []
  let at: SelectExpr = e
  while (at.kind === 'apply' && at.fn === 'map') { chain.unshift(litText(at.args[1])); at = at.args[0] }
  if (at.kind !== 'subject') throw new Error('IR: a map chain must bottom out at the subject')
  return chain
}

/** The inverse of specToIr: a column tree → its spec, canonical `text` included. Throws on a tree that is not a
 *  column of the column half (a bare scalar `apply`, a `raw`) — the caller decides what that means. */
export function irToSpec(e: SelectExpr): SelectSpec {
  if (e.kind === 'aggregate') {
    const fn = String(e.fn)
    if (fn === 'count')  return { kind: 'count', text: 'count' }
    if (fn === 'symbol') return { kind: 'symbol', text: 'symbol' }
    if (fn === 'level')  return { kind: 'level', text: 'level' }
    const over = e.over
    if (over.kind !== 'apply' || String(over.fn) !== 'column') throw new Error(`IR: ${fn}(…) folds a statistic column`)
    const stat = litText(over.args[1])
    if (fn === 'dist' || fn === 'pivot') return { kind: fn, stat, text: `${fn}:${stat}` }
    if (AGGS.includes(fn)) return { kind: 'agg', fn: fn as AggFn, stat, text: `${fn}:${stat}` }
    throw new Error(`IR: no column spec for the aggregate ${fn}`)
  }
  if (e.kind !== 'apply') throw new Error(`IR: a ${e.kind} node is not a column of the column half`)
  const fn = String(e.fn)
  switch (fn) {
    case 'ordinality': return { kind: 'ordinality', text: 'ordinality' }
    case 'rank': case 'address': case 'omega': return { kind: 'position', position: fn, text: fn }
    case 'render': return { kind: 'element', text: 'element' }
    case 'repr': {
      const repr = litText(e.args[1])
      const medium = e.args[2] ? litText(e.args[2]) : undefined
      return { kind: 'repr', repr, medium, text: medium ? `repr:${repr}@${medium}` : `repr:${repr}` }
    }
    case 'column': { const name = litText(e.args[1]); return { kind: 'name', name, text: name } }
    case 'map': {
      const chain = unwindMap(e)
      return chain.length === 1
        ? { kind: 'map', map: chain[0], text: `map:${chain[0]}` }
        : { kind: 'through', chain, text: `through:${chain.join('.')}` }
    }
    case 'glyph_svg': return { kind: 'glyph', text: 'glyph' }
    case 'data':  return { kind: 'data', text: 'data' }
    case 'title': return { kind: 'title', text: 'title' }
    case 'over':  { const inner = irToSpec(e.args[0]); return { kind: 'over', inner, text: `over:${inner.text}` } }
  }
  throw new Error(`IR: no column spec for ${fn}(…)`)
}

/** `select=` text → the column trees. */
export const selectFromText = (text: string | string[] | undefined): SelectExpr[] => parseSelect(text).map(specToIr)
/** the column trees → canonical `select=` text (the inverse, up to canonical spelling). */
export const textFromSelect = (select: SelectExpr[]): string => selectText(select.map(irToSpec))

// ── the row half ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The FROM: a collection and its bindings, keeping positional-vs-named so the print is the caller's own spelling.
 *
 *  A CONSTRUCTION-FROM (`finsets_of(natural_number)`, `maps_of(fin(3), fin(2))`) has no such structure — its
 *  arguments are TYPES, not axis bindings, and resolving it to a realized collection is an async catalog read
 *  (`resolveFrom`), not a parse. So it stays `{ raw }`, the same faithful-or-nothing escape WHERE and ORDER BY
 *  already use, and the engines hand it to the row half as text exactly as they always did. Without this an
 *  `Expr` simply could not denote a construction, and `evaluate()` threw on one. */
export type HandleExpr = { coll: string; named: Record<string, ParamValue>; positional: ParamValue[] } | { raw: string }

/** The collection a FROM names, or null when it is an unresolved construction (only the catalog knows). */
export const handleColl = (h: HandleExpr): string | null => ('raw' in h ? null : h.coll)
export type OrderKey = { col: string; dir?: 'asc' | 'desc'; nulls?: 'first' | 'last' }
/** a conjunction of chip terms, or the clause text the codec declined to reinterpret */
export type Where = Pred[] | { raw: string }
export type OrderBy = OrderKey[] | { raw: string }
export type Rel = {
  from: HandleExpr
  where?: Where
  groupBy?: Grouping
  having?: Where
  orderBy?: OrderBy
}

/** FROM-absent ⇒ scalar (the select must be closed of `subject`); FROM-present ⇒ one row per element. */
export type Expr = { select: SelectExpr[]; from?: Rel }

const isRaw = (c: { raw: string } | unknown[]): c is { raw: string } => !Array.isArray(c)
const ident = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`)
const paramText = (v: ParamValue) => (Array.isArray(v) ? `${v[0]}..${v[1]}` : String(v))

/** The canonical text of a FROM: positional bindings first, then named, `coll(a, k=2)`. Unbound axes are absent —
 *  parseHandle drops `axis=0..`, so it never round-trips back into the text. */
export function handleExprText(h: HandleExpr): string {
  if ('raw' in h) return h.raw
  const parts = [...h.positional.map(paramText), ...Object.entries(h.named).map(([k, v]) => `${k}=${paramText(v)}`)]
  return parts.length ? `${h.coll}(${parts.join(', ')})` : h.coll
}

/** The canonical text of a GROUP BY — the spelling parseGroupBy reads back to the same Grouping. */
export function groupingText(g: Grouping): string {
  if (g.rollup) return `ROLLUP (${(g.sets[0] ?? []).join(', ')})`
  if (g.sets.length === 1) return g.sets[0].join(', ')
  return `GROUPING SETS (${g.sets.map((s) => `(${s.join(', ')})`).join(', ')})`
}

// split on top-level commas, ignoring commas inside quotes or parentheses
function splitTopComma(s: string): string[] | null {
  const out: string[] = []
  let depth = 0, quote = false, cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) { cur += ch; if (ch === "'") { if (s[i + 1] === "'") cur += s[++i]; else quote = false } continue }
    if (ch === "'") { quote = true; cur += ch; continue }
    if (ch === '(') { depth++; cur += ch; continue }
    if (ch === ')') { depth--; cur += ch; continue }
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (quote || depth !== 0) return null
  out.push(cur)
  return out
}

const ORDER_TERM = new RegExp(
  `^([A-Za-z_][A-Za-z0-9_]*|"(?:[^"]|"")+")(?:\\s+(asc|desc))?(?:\\s+nulls\\s+(first|last))?$`, 'i')

/** An ORDER BY as sort keys, or null when a term is anything richer than `col [ASC|DESC] [NULLS FIRST|LAST]` — an
 *  expression, a function call, or a kernel token (`orbit:<rel>`, `map:<id>`, which the row half rewrites to a
 *  projected alias). Those stay raw and print back untouched. */
export function parseOrderBy(text: string): OrderKey[] | null {
  const terms = splitTopComma(text)
  if (!terms) return null
  const out: OrderKey[] = []
  for (const raw of terms) {
    const m = raw.trim().match(ORDER_TERM)
    if (!m) return null
    const col = m[1].startsWith('"') ? m[1].slice(1, -1).replace(/""/g, '"') : m[1]
    const k: OrderKey = { col }
    if (m[2]) k.dir = m[2].toLowerCase() as 'asc' | 'desc'
    if (m[3]) k.nulls = m[3].toLowerCase() as 'first' | 'last'
    out.push(k)
  }
  return out.length ? out : null
}
export const orderByText = (keys: OrderKey[]): string =>
  keys.map((k) => `${ident(k.col)}${k.dir ? ` ${k.dir.toUpperCase()}` : ''}${k.nulls ? ` NULLS ${k.nulls.toUpperCase()}` : ''}`).join(', ')

/** The FROM as a tree, or `{ raw }` when it is not an axis-bound handle — a construction-FROM, whose arguments
 *  are types rather than bindings and which only the catalog can resolve. */
export function parseFrom(text: string): HandleExpr {
  try {
    return parseHandle(text)
  } catch {
    return { raw: text.trim() }
  }
}

/** A RowQuery → the row half of the tree. Every clause it cannot represent is kept verbatim as `{ raw }`. */
export function relFromRowQuery(q: RowQuery): Rel {
  const r: Rel = { from: parseFrom(q.from) }
  const w = q.where?.trim(); if (w) r.where = parsePreds(w) ?? { raw: w }
  const g = q.groupBy?.trim(); if (g) r.groupBy = parseGroupBy(g)
  const h = q.having?.trim(); if (h) r.having = parsePreds(h) ?? { raw: h }
  const o = q.orderBy?.trim(); if (o) r.orderBy = parseOrderBy(o) ?? { raw: o }
  return r
}

/** The row half of the tree → a RowQuery, in canonical spelling. The inverse of relFromRowQuery up to that
 *  canonicalization; a `{ raw }` clause is byte-identical. */
export function rowQueryFromRel(r: Rel): RowQuery {
  const q: RowQuery = { from: handleExprText(r.from) }
  if (r.where) { const t = isRaw(r.where) ? r.where.raw : predsToSql(r.where); if (t) q.where = t }
  if (r.groupBy) { const t = groupingText(r.groupBy); if (t) q.groupBy = t }
  if (r.having) { const t = isRaw(r.having) ? r.having.raw : predsToSql(r.having); if (t) q.having = t }
  if (r.orderBy) { const t = isRaw(r.orderBy) ? r.orderBy.raw : orderByText(r.orderBy); if (t) q.orderBy = t }
  return q
}

// ── the whole statement ───────────────────────────────────────────────────────────────────────────────────────────

/** A RowStatement (the row half plus `select=`, as the URL carries it) → the Expr it denotes. */
export function exprFromStatement(s: RowStatement): Expr {
  const e: Expr = { select: selectFromText(s.select) }
  if (s.from?.trim()) e.from = relFromRowQuery(s)
  return e
}

/** The inverse: an Expr → the statement text. A FROM-less Expr has no `from`, so it is not a RowQuery — callers
 *  that need one (the URL, the query view) only ever hold FROM-present exprs. */
export function statementFromExpr(e: Expr): RowStatement {
  const s: RowStatement = e.from ? rowQueryFromRel(e.from) : { from: '' }
  const sel = textFromSelect(e.select)
  if (sel) s.select = sel
  return s
}

/** Does this tree reference the element under FROM? A select closed of `subject` is a legal FROM-less scalar. */
export function isClosed(e: SelectExpr): boolean {
  switch (e.kind) {
    case 'subject': return false
    case 'apply': return e.args.every(isClosed)
    case 'aggregate': return isClosed(e.over)
    case 'op': return e.args.every(isClosed)
    case 'cast': return isClosed(e.expr)
    case 'handle': return true   // a handle names a collection by its own bindings, never the element under FROM
    default: return true
  }
}

/** Every `apply`/`aggregate` function id in a tree, leaves first — what `can()` walks to decide capability. An
 *  `op` node contributes no FnRef of its own (it names a `base_operation` id, not a `base_function` one — a
 *  different registry, resolved through `Registry.typeOperation`), but its args still need walking. */
export function functionsIn(e: SelectExpr, out: FnRef[] = []): FnRef[] {
  if (e.kind === 'apply') { for (const a of e.args) functionsIn(a, out); out.push(e.fn) }
  else if (e.kind === 'aggregate') { functionsIn(e.over, out); out.push(e.fn) }
  else if (e.kind === 'op') { for (const a of e.args) functionsIn(a, out) }
  else if (e.kind === 'cast') { functionsIn(e.expr, out) }
  return out
}

// ── the scalar surface: `fn(args)` text ⇄ a FROM-less Expr ────────────────────────────────────────────────────────
// The smallest possible calculator grammar, and deliberately not a general expression language: a call, its
// arguments, and nesting. No operators — the ring evaluator (core.ts's evaluateExpression) owns infix arithmetic
// over the algebra registry, and its grammar is not Apply-shaped. This is the surface `enumeratio calc` parses and
// the shape an engine's `can()` walks.
//
//   binomial(5, 2)                    → apply(binomial, [5, 2])
//   cardinality(permutations(4))      → apply(cardinality, [apply(permutations, [4])])
//   gaussian_add(gaussian_integer(2, 3), gaussian_integer(1, -4))
//                                     → a CARRIER CONSTRUCTION nested inside an apply; each engine builds the
//                                       composite its own way (pg `ROW(2,3)::gaussian_integer`, ts `{re,im}`)
//   multicomplex([2, 3], 97)          → an array literal as a carrier field
//   pi                                → apply(pi, [])

const CALC_TOKEN = /\s*(?:([A-Za-z_][A-Za-z0-9_]*)|(-?\d+)|'((?:[^']|'')*)'|(.))/y

/** Parse `fn(args)` text into a FROM-less Expr. Throws with the offending position on anything richer. */
export function parseCalc(text: string): Expr {
  let at = 0
  const fail = (msg: string): never => { throw new Error(`calc: ${msg} at position ${at} of "${text}"`) }
  type Tok = { kind: 'id' | 'int' | 'str' | 'punct'; text: string }
  const peekTok = (): Tok | null => {
    CALC_TOKEN.lastIndex = at
    const m = CALC_TOKEN.exec(text)
    if (!m) return null
    if (m[1] !== undefined) return { kind: 'id', text: m[1] }
    if (m[2] !== undefined) return { kind: 'int', text: m[2] }
    if (m[3] !== undefined) return { kind: 'str', text: m[3].replace(/''/g, "'") }
    return { kind: 'punct', text: m[4] }
  }
  const take = (): Tok => { const t = peekTok() ?? fail('unexpected end'); at = CALC_TOKEN.lastIndex; return t }
  const eat = (p: string): boolean => { const t = peekTok(); if (t?.kind === 'punct' && t.text === p) { at = CALC_TOKEN.lastIndex; return true } return false }

  function parseOne(): SelectExpr {
    if (eat('[')) {
      const items: Scalar[] = []
      if (!eat(']')) {
        for (;;) {
          const e = parseOne()
          if (e.kind !== 'lit' || Array.isArray(e.value)) return fail('an array literal holds constants, not nested arrays or calls')
          items.push(e.value as Scalar)
          if (eat(']')) break
          if (!eat(',')) return fail('expected "," or "]" in an array literal')
        }
      }
      return { kind: 'lit', value: items }
    }
    const t = take()
    if (t.kind === 'int') return { kind: 'lit', value: Number(t.text) }
    if (t.kind === 'str') return { kind: 'lit', value: t.text }
    if (t.kind !== 'id') return fail(`expected a function, a number, a quoted string or an array, got "${t.text}"`)
    const fn = fnRef(t.text)
    if (!eat('(')) return { kind: 'apply', fn, args: [] }
    const args: SelectExpr[] = []
    if (!eat(')')) {
      for (;;) {
        args.push(parseOne())
        if (eat(')')) break
        if (!eat(',')) return fail(`expected "," or ")" in the arguments of ${t.text}`)
      }
    }
    return { kind: 'apply', fn, args }
  }

  const e = parseOne()
  if (peekTok()) fail('trailing input')
  return { select: [e] }
}

const constText = (v: LitValue): string =>
  Array.isArray(v) ? `[${v.map(constText).join(', ')}]` : typeof v === 'string' ? `'${String(v).replace(/'/g, "''")}'` : String(v)

/** `base_operation` ids that print infix/prefix, for `calcText`'s `op` case — a display convenience only (the
 *  engines resolve the SAME op id through the catalog, never through this table). Absent from here, an op still
 *  prints — just as `id[type](args)`, the `[type]` suffix carrying what would otherwise be lost. */
const OP_GLYPHS: Record<string, string> = {
  add: '+', sub: '-', mul: '*', div: '/', pow: '^',
  le: '<=', lt: '<', ge: '>=', gt: '>', eq: '=', ne: '<>',
  neg: '-', recip: '⁻¹', inverse: '⁻¹', join: '∪', meet: '∩', complement: 'ᶜ',
}
const UNARY_OPS = new Set(['neg', 'recip', 'inverse', 'complement'])

/** The canonical text of a scalar tree — the inverse of parseCalc, and what `--explain` echoes back. */
export function calcText(e: SelectExpr): string {
  switch (e.kind) {
    case 'lit': return e.type ? `${constText(e.value)}::${e.type}` : constText(e.value)
    case 'apply': return e.args.length ? `${e.fn}(${e.args.map(calcText).join(', ')})` : String(e.fn)
    case 'aggregate': return `${e.fn}(${calcText(e.over)})`
    case 'subject': return 'element'
    case 'raw': return e.sql
    case 'op': {
      const g = OP_GLYPHS[e.op]
      const args = e.args.map(calcText)
      if (g && UNARY_OPS.has(e.op) && args.length === 1) return `(${g}${args[0]})`
      if (g && args.length === 2) return `(${args[0]} ${g} ${args[1]})`
      return `${e.op}[${e.type}](${args.join(', ')})`
    }
    case 'handle': return handleExprText(e.handle)
    case 'cast': return `(${calcText(e.expr)})::${e.to}`
  }
}
