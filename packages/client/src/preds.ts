// Structured predicates for the row half — the chip face of a WHERE / HAVING segment. A Pred list is a CONJUNCTION of
// simple terms over the relation's columns; predsToSql() is the raw face, parsePreds() the way back. The way back is
// FAITHFUL OR NOTHING (Dean 2026-09-02): a raw clause that says more than a conjunction of these terms (an OR, a nested
// expression, a subquery, arithmetic) parses to null and stays raw — chips never lie about what the SQL does.
//
// Terms:  col op literal        (= <> < <= > >=)      col between a and b      col [not] in (a, b, …)
//         col [not] [i]like 's'                       fn(value)                (a named predicate on the carrier)
//         facet:<field> = <value>                     (a membership FACET over the `collections` meta-collection)
// `col` is a column of R(C) — an axis, rank, element, a stat — or, in a HAVING, a key or `count(*)`.
export type PredOp = '=' | '<>' | '<' | '<=' | '>' | '>=' | 'between' | 'in' | 'not in' | 'like' | 'not like' | 'ilike' | 'not ilike' | 'fn' | 'facet'
export type Literal = string | number
/** the facet fields of the `collections` meta-collection: three membership tables plus the carrier column */
export type FacetField = 'tag' | 'trait' | 'category' | 'carrier'
export const FACET_FIELDS: FacetField[] = ['tag', 'trait', 'category', 'carrier']
export type Pred =
  | { op: Exclude<PredOp, 'between' | 'in' | 'not in' | 'fn' | 'facet'>; col: string; value: Literal }
  | { op: 'between'; col: string; value: [number, number] }
  | { op: 'in' | 'not in'; col: string; value: Literal[] }
  | { op: 'fn'; col: 'value'; fn: string }
  | { op: 'facet'; field: FacetField; value: string; negate?: boolean }

export const PRED_OPS: PredOp[] = ['=', '<>', '<', '<=', '>', '>=', 'between', 'in', 'not in', 'like', 'not like', 'ilike', 'not ilike', 'fn', 'facet']

const IDENT = `(?:[A-Za-z_][A-Za-z0-9_]*|"(?:[^"]|"")+"|count\\(\\*\\))`
const NUM = `-?\\d+(?:\\.\\d+)?`
const STR = `'(?:[^']|'')*'`
const ident = (s: string) => (/^[a-z_][a-z0-9_]*$/.test(s) || s === 'count(*)' ? s : `"${s.replace(/"/g, '""')}"`)
const unident = (s: string) => (s.startsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s)
const str = (v: Literal) => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const unstr = (s: string) => s.slice(1, -1).replace(/''/g, "'")
const literal = (raw: string): Literal | null =>
  new RegExp(`^${NUM}$`).test(raw) ? Number(raw) : new RegExp(`^${STR}$`).test(raw) ? unstr(raw) : null

/** The raw face: the terms AND-joined (empty list → ''). */
export function predsToSql(preds: Pred[]): string {
  return preds.map(predToSql).join(' AND ')
}
export function predToSql(p: Pred): string {
  switch (p.op) {
    case 'fn': return `${p.fn}(value)`
    case 'facet': return facetSql(p)
    case 'between': return `${ident(p.col)} BETWEEN ${p.value[0]} AND ${p.value[1]}`
    case 'in': case 'not in': return `${ident(p.col)} ${p.op.toUpperCase()} (${p.value.map(str).join(', ')})`
    default: return `${ident(p.col)} ${p.op.toUpperCase()} ${str(p.value)}`
  }
}

// ── facets: a membership question over the `collections` meta-collection ──────────────────────────────────────
// `tag` / `trait` / `category` are membership tables keyed by collection, so the term is an IN over the base table;
// `carrier` is a column of the relation itself, so it is a plain equality. Written and read back by EXACTLY this
// shape — a hand-typed variant that means the same thing stays raw rather than being silently re-spelled.
function facetSql(p: { field: FacetField; value: string; negate?: boolean }): string {
  if (p.field === 'carrier') return `carrier ${p.negate ? '<>' : '='} ${str(p.value)}`
  return `element ${p.negate ? 'NOT IN' : 'IN'} (SELECT collection FROM base_collection_${p.field} WHERE ${p.field} = ${str(p.value)})`
}
const FACET_RE = new RegExp(`^element\\s+(not\\s+)?in\\s*\\(\\s*select\\s+collection\\s+from\\s+base_collection_(tag|trait|category)\\s+where\\s+\\2\\s*=\\s*(${STR})\\s*\\)$`, 'i')
/** `negate` is omitted when false, so parse(sql(p)) is a fixed point on the minimal chip shape. */
const facet = (field: FacetField, value: string, negate: boolean): Pred =>
  (negate ? { op: 'facet', field, value, negate } : { op: 'facet', field, value })
function parseFacet(t: string, known: (c: string) => boolean): Pred | null {
  const m = t.match(FACET_RE)
  if (m) return known('element') ? facet(m[2].toLowerCase() as FacetField, unstr(m[3]), !!m[1]) : null
  const c = t.match(new RegExp(`^carrier\\s*(=|<>)\\s*(${STR})$`, 'i'))
  return c && known('carrier') ? facet('carrier', unstr(c[2]), c[1] === '<>') : null
}

// split on top-level ` AND `, keeping the AND that closes a BETWEEN glued to its term
function splitTopAnd(s: string): string[] | null {
  const out: string[] = []; let depth = 0, quote = false, cur = '', betweenPending = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) { cur += ch; if (ch === "'") { if (s[i + 1] === "'") cur += s[++i]; else quote = false } continue }
    if (ch === "'") { quote = true; cur += ch; continue }
    if (ch === '(') { depth++; cur += ch; continue }
    if (ch === ')') { depth--; cur += ch; continue }
    if (depth === 0) {
      const bm = s.slice(i).match(/^\s+between\s+/i)
      if (bm) { betweenPending = true; cur += bm[0]; i += bm[0].length - 1; continue }
      const m = s.slice(i).match(/^\s+and\s+/i)
      if (m) {
        if (betweenPending) { cur += m[0]; betweenPending = false; i += m[0].length - 1; continue }
        out.push(cur); cur = ''; i += m[0].length - 1; continue
      }
    }
    cur += ch
  }
  if (quote || depth !== 0) return null
  out.push(cur)
  return out
}
function stripOuterParens(s: string): string {
  const t = s.trim()
  if (t[0] !== '(' || t[t.length - 1] !== ')') return t
  let depth = 0, quote = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (quote) { if (ch === "'") { if (t[i + 1] === "'") { i++; continue } quote = false }; continue }
    if (ch === "'") { quote = true; continue }
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth === 0 && i !== t.length - 1) return t }
  }
  return t.slice(1, -1).trim()
}
function splitList(inner: string): string[] {
  const out: string[] = []; let quote = false, cur = ''
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (quote) { cur += ch; if (ch === "'") { if (inner[i + 1] === "'") cur += inner[++i]; else quote = false }; continue }
    if (ch === "'") { quote = true; cur += ch; continue }
    if (ch === ',') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

/** One term → a Pred, or null when it is not one of the chip shapes. */
export function parsePred(term: string, columns?: Set<string>): Pred | null {
  let t = term.trim()
  for (let prev = ''; prev !== t; ) { prev = t; t = stripOuterParens(t) }
  const known = (c: string) => !columns || columns.has(c)
  const f = parseFacet(t, known); if (f) return f
  let m = t.match(new RegExp(`^(${IDENT})\\s*(<=|>=|<>|!=|=|<|>)\\s*(${NUM}|${STR})$`, 'i'))
  if (m) { const col = unident(m[1]), v = literal(m[3]); if (v === null || !known(col)) return null; return { op: (m[2] === '!=' ? '<>' : m[2]) as '=' | '<>' | '<' | '<=' | '>' | '>=', col, value: v } }
  m = t.match(new RegExp(`^(${IDENT})\\s+between\\s+(${NUM})\\s+and\\s+(${NUM})$`, 'i'))
  if (m) { const col = unident(m[1]); if (!known(col)) return null; return { op: 'between', col, value: [Number(m[2]), Number(m[3])] } }
  m = t.match(new RegExp(`^(${IDENT})\\s+(not\\s+)?in\\s*\\(([^()]*)\\)$`, 'i'))
  if (m) {
    const col = unident(m[1]); if (!known(col)) return null
    const vals = splitList(m[3]).map(literal); if (!vals.length || vals.some((v) => v === null)) return null
    return { op: m[2] ? 'not in' : 'in', col, value: vals as Literal[] }
  }
  m = t.match(new RegExp(`^(${IDENT})\\s+(not\\s+)?(i?like)\\s+(${STR})$`, 'i'))
  if (m) { const col = unident(m[1]); if (!known(col)) return null; return { op: `${m[2] ? 'not ' : ''}${m[3].toLowerCase()}` as 'like' | 'not like' | 'ilike' | 'not ilike', col, value: unstr(m[4]) } }
  m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*value\s*\)$/)
  if (m) return { op: 'fn', col: 'value', fn: m[1] }
  return null
}

/** The whole clause as chips — a conjunction of chip-shaped terms over known columns — or null (stay raw). */
export function parsePreds(sql: string, columns?: string[]): Pred[] | null {
  const s = sql.trim()
  if (!s) return []
  const terms = splitTopAnd(s)
  if (!terms) return null
  const cols = columns ? new Set(columns) : undefined
  const out: Pred[] = []
  for (const term of terms) { const p = parsePred(term, cols); if (!p) return null; out.push(p) }
  return out
}
