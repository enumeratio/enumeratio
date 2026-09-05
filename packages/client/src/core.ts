// The read-through math API over the pure-SQL core (pg-enumeratio), running in PGlite — the math API the CLI and
// explorer consume: collections / construct / describe / summary + a Handle with card / serialize / window, queried
// against the core's surface — base_catalog (collection metadata), the generated cardinality/elements/unrank, and
// render() (the canonical codec). One carrier per collection, a fixed grade CHAIN (size = grade 1, then the rest).

export type Cell = string | number | null
export type Row = Record<string, Cell>
export type Stat = { statId: string; valueFunc: string; findstatId: string | null; codomain: string | null; inherited?: boolean }
/** Render options (repr/format/medium/alphabet). `repr` + `medium` dispatch through base_repr (renderExpr, below —
 *  a repr with no sibling row for the requested medium falls back to its unicode row). `format`/`alphabet` are a
 *  later phase — accepted for API-compatibility and ignored for now. */
export type RenderOpts = { repr?: string; format?: string; medium?: 'ascii' | 'unicode' | 'latex'; alphabet?: string }
/** `where` / `orderBy` are RAW SQL fragments spliced into the elements query (a dev-tool escape hatch over the user's
 *  own local pglite — no injection concern). They reference the projected output columns by their alias: the stat ids
 *  (quote hyphenated ones, `"tag-count"`), `element`, `__rank`, `map:<id>`. Present ⇒ the WHOLE (finite) collection is
 *  materialized + sorted before the window is cut, so they require a bounded handle (window() throws on an infinite one
 *  — the caller must gate the UI to bounded collections). */
export type WindowOpts = RenderOpts & { stats?: string[]; maps?: string[]; through?: string[]; data?: boolean; glyph?: boolean; where?: string; orderBy?: string }
/** A whole-view query config — the clauses of the SELECT a collection page renders (https://github.com/enumeratio/enumeratio/wiki/Query-Model). The
 *  table's columns ARE `select` (the projection: stat ids + map ids; `element` and `__rank` are always present); the
 *  raw-SQL fragments (`where` / `having` / `orderBy`) reference the output aliases; `groupBy` names a projected column
 *  to group by (count per group — the triangle/distribution). Bounded collections only (it materializes the whole
 *  fiber) — the scale guard, same as window(). */
export type ViewQuery = RenderOpts & {
  select?: string[]     // stat ids to project as columns (default: all the collection's stats)
  maps?: string[]       // map ids to project as codomain-image columns
  where?: string        // row predicate (raw SQL over the output aliases)
  groupBy?: string      // a projected column (or expression) to GROUP BY — yields count-per-group rows
  having?: string       // predicate on the groups (raw SQL; only with groupBy)
  orderBy?: string      // sort (raw SQL over the output aliases)
}
/** One grouped-view row: a value of the grouped column and how many elements have it (the triangle/distribution cell). */
export type GroupResult = { __group: Cell; __count: number }
/** A family-parameter value: a point (fix the parameter) or a [lo, hi] tuple (range over it — a union of fibers). */
export type ParamValue = number | readonly [number, number]
/** A row result: `__rank` = the element's CANONICAL 0-based position (ignores any WHERE — the true rank, the address
 *  for unrank/deep-link); `__ordinality` = its 1-based position WITHIN the configured result set (SQL WITH ORDINALITY —
 *  contiguous over the rows a WHERE keeps, i.e. the ordinal measure). They coincide (ord = rank+1) when unfiltered and
 *  in canonical order; they diverge under a filter or a custom sort. */
export type Result = Row & { __rank?: Cell; __ordinality?: Cell; __address?: Cell; element?: string }
/** A window/at result including the structured `__data` cast (the carrier composite as JSON) and/or the db-emitted
 *  page-space SVG (`__svg`, pg's glyph_svg), when requested. */
export type DataResult = Result & { __data?: unknown; __svg?: string | null }
export type MapInfo = { id: string; title: string; codomain: string; findstatId: string | null; mappingFunc: string | null; inherited?: boolean }
/** A verified example from base_example — a living assertion about the collection (its title is the claim, its
 *  expected value the answer). The catalog facet that makes "the math is data" self-documenting. */
export type Example = { title: string; description: string | null; kind: string; expected: string | null }

export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
  close(): Promise<void>
  /** Stop whatever is running, WITHOUT closing the Db — the next query must still work. Only the backends that can
   *  really interrupt a running statement implement it: the node worker (terminate + respawn) and real Postgres
   *  (pg_cancel_backend). An in-process PGlite cannot be interrupted at all, and the SharedWorker session serializes
   *  every query with no cancel message (#279), so both leave this undefined and an AbortSignal only stops the
   *  CALLER waiting. */
  cancel?(): Promise<void>
}

let factory: (() => Db | Promise<Db>) | null = null
let dbP: Promise<Db> | null = null
let closed = false   // close() latches: the floating prime chain below must never boot a FRESH Db past close
let primeP: Promise<unknown> | null = null   // …and close() DRAINS it: an in-flight prime query racing pg.close() can deadlock pglite

/** An environment entry calls this once to wire up its (worker- or main-thread-) backed Db over the pure core. */
export function provideDb(f: () => Db | Promise<Db>): void {
  factory = f
  closed = false
}
function db(): Promise<Db> {
  if (!dbP) {
    if (!factory) throw new Error('@enumeratio/client: no Db provider — an entry must call provideDb() first, e.g. provideDb(() => makeDb())')
    dbP = Promise.resolve(factory())
    // the client's one boot seam: prime the printer cache (#244), once, right after the FIRST real Db resolves —
    // never eagerly from provideDb() itself, which must stay lazy (a caller that never queries must never pay a
    // cold-boot cost just for having called provideDb; see oracle.test.ts's sage-skipped path). Not fatal — a page
    // just draws 'plain' until it lands — but a silent failure isn't diagnosable, so surface it.
    primeP = dbP.then(() => import('./select')).then((m) => (closed ? undefined : m.primePrinters()))
      .catch((e) => console.warn('@enumeratio/client: primePrinters failed — printers stay plain:', e instanceof Error ? e.message : e))
  }
  return dbP
}
// Debug mode: when on, a failed query logs its SQL + params before rethrowing. Off by default (no console noise); enabled
// via setDebug(), a `?debug` query param, or localStorage['enumeratio:debug']='1' — so it's inspectable in a browser too.
let debug = false
try { debug = typeof localStorage !== 'undefined' && localStorage.getItem('enumeratio:debug') === '1' } catch { /* no storage */ }
// Access `location` via globalThis so this stays lib-agnostic — a node consumer (CLI) compiling this file has no DOM lib.
try { const loc = (globalThis as { location?: { search?: string } }).location; debug = debug || (typeof loc?.search === 'string' && /[?&]debug\b/.test(loc.search)) } catch { /* no location */ }
/** Toggle query debug logging (SQL + params on failure). */
export function setDebug(on = true): void { debug = on }
async function rows<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return (await (await db()).query<T>(sql, params)).rows
  } catch (e) {
    if (debug) {
      const pg = e as { message?: string; where?: string; detail?: string; hint?: string }
      console.error('[enumeratio SQL FAIL]', pg.message, '\n context:', pg.where, '\n detail:', pg.detail, pg.hint, '\n SQL:', sql, '\n params:', JSON.stringify(params))
    }
    throw e
  }
}
/** Ask the live Db to interrupt what it is running. Returns false when this backend cannot (see Db.cancel), which
 *  is what an engine reports rather than pretending an AbortSignal did more than it did. Never boots a Db. */
export async function cancelDb(): Promise<boolean> {
  if (!dbP) return false
  const d = await dbP
  if (!d.cancel) return false
  await d.cancel()
  return true
}

export async function close(): Promise<void> {
  closed = true
  if (primeP) { await primeP.catch(() => {}); primeP = null }
  const p = dbP
  dbP = null
  if (p) await (await p).close()
}

/** Is a Db provider wired? The engine seam (engine.ts) asks, so that a consumer which only ever called provideDb()
 *  still gets `evaluate()` — it falls back to a pg engine over this same memoized Db. core.ts must not import
 *  engine.ts (the dependency runs one way), so the question is answered here rather than reaching in. */
export function hasDbProvider(): boolean { return factory !== null }

// A raw `extendDb` can define anything — a function, a glyph overload, a whole table — so nothing built from a
// build-time catalog snapshot can still be trusted afterwards. Listeners registered here are told, and the engine
// registry marks itself dirty, which collapses capability to the one engine that reads the live database (#278 D2).
const extendListeners = new Set<() => void>()
/** Be told when the live database is extended with raw SQL. Returns an unsubscribe. */
export function onDbExtended(cb: () => void): () => void {
  extendListeners.add(cb)
  return () => { extendListeners.delete(cb) }
}

let describing = 0
/** Run extensions that are FULLY DESCRIBED by a structured delta — the registry is told about them by other
 *  means, so they must not trip the raw-SQL alarm. The distinction is the whole point: raw SQL is unknown and
 *  collapses capability, a structured extend is known and does not. */
export async function asDescribedExtension<T>(fn: () => Promise<T>): Promise<T> {
  describing++
  try { return await fn() } finally { describing-- }
}

/** Extend the LIVE database with SQL — the augmentable "representations as data" path (wiki: Render-Assets).
 *  Define a new `glyph_svg` overload, a view, a function, and it is usable IMMEDIATELY on this connection, no
 *  rebuild: e.g. after `extendDb('CREATE FUNCTION glyph_svg(p subset) …')`, `carrier_renders_svg('subset')` flips to
 *  true and `<enumeratio-figure>` renders it. This is the seam a user (or a contributed package) hooks to add a glyph
 *  without touching @enumeratio/data. One statement per call for now (dollar-quoted bodies fine). Returns any rows the
 *  statement produced (empty for pure DDL). It runs raw SQL against your Db — only pass SQL you trust. */
export async function extendDb<T = Row>(sql: string): Promise<T[]> {
  const out = (await (await db()).query<T>(sql)).rows
  if (!describing) for (const cb of extendListeners) try { cb() } catch { /* a listener must never break an extension */ }
  return out
}

const isIdent = (s: string) => /^[a-z_][a-z0-9_]*$/.test(s)

// The element's COMPOUND ADDRESS as `.`-separated text: the fiber's grade coordinates ⊕ the within-fiber ordinality
// (e.g. size-4 permutation #5 → "4.5"; an ungraded element → just its ordinality). Cheaper than the flat global rank
// (no need to sum prior fibers) and it is what the UI shows by default. Assumes the element alias `e`.
const ADDRESS_SQL = `array_to_string(address(e), '.')`   // the compound address: fiber coordinates ⊕ rank, spelled 4.2.1
// The DEFAULT / canonical order is by the compound address (grade coords ⊕ ordinality) — but the *text* `__address`
// sorts wrong lexically ("4.10" < "4.2"), so the real sort key is the numeric `__rank`, which is monotone in the
// address. We let callers name that order `address` (it reads better + is what the UI shows): a bare `address` token in
// an ORDER BY is rewritten to the numeric rank key. Empty ⇒ the canonical order.
const orderExpr = (orderBy?: string): string => (orderBy || '"__rank"').replace(/\baddress\b/gi, '"__rank"')

// base_catalog rows, cached (the client assumes an unchanging DB for the process lifetime).
/** internal = the catalog/config surfaced as a collection (base_internal); everything else is a mathematical object. */
export type CollectionCategory = 'internal' | 'mathematical'
type CatRow = { id: string; carrier: string | null; unbounded: boolean; grades: string[]; title: string | null; description: string | null; aliasOf: string | null; category: CollectionCategory }
let _catalog: Map<string, CatRow> | null = null
async function catalogMap(): Promise<Map<string, CatRow>> {
  if (!_catalog) {
    const raw = await rows<{ id: string; carrier: string | null; unbounded: boolean; grades: string; title: string | null; description: string | null; alias_of: string | null; category: CollectionCategory | null }>(
      `SELECT c.id, c.carrier, c.unbounded, c.grades::text AS grades, c.title, c.description, c.alias_of, cc.category
         FROM base_catalog c LEFT JOIN base_collection_category cc ON cc.collection = c.id ORDER BY c.id`,
    )
    _catalog = new Map(
      raw.map(r => [r.id, { id: r.id, carrier: r.carrier, unbounded: r.unbounded, grades: r.grades.replace(/^\{|\}$/g, '').split(',').filter(Boolean), title: r.title, description: r.description, aliasOf: r.alias_of, category: r.category ?? 'mathematical' }]),
    )
  }
  return _catalog
}

/** Map of alias collection id → its canonical collection id (base_collection.alias_of, #101) — a TRUE alias, sharing
 *  the canonical's whole realized tower rather than minting its own. Entries only for actual aliases; an ordinary
 *  collection is absent, not mapped to itself. The explorer router resolves a navigated collection through this
 *  before ever loading it, so an alias route redirects to its canonical instead of hitting an unrealized surface. */
export async function aliases(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [id, r] of await catalogMap()) if (r.aliasOf) out[id] = r.aliasOf
  return out
}

/** The realized collections, by id. */
export async function collections(): Promise<string[]> {
  return [...(await catalogMap()).keys()]
}

/** A collection's display name + one-line description (base_collection_meta, surfaced through base_catalog). The
 *  title falls back to the id (de-slugged) so a pre-meta DB still yields a readable name. */
export type CollectionMeta = { title: string; description: string | null }
const deslug = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export async function collectionMeta(): Promise<Record<string, CollectionMeta>> {
  const out: Record<string, CollectionMeta> = {}
  for (const [id, r] of await catalogMap()) out[id] = { title: r.title ?? deslug(id), description: r.description }
  return out
}

/** A collection's ordered grade chain (base_catalog.grades, by position): the size/constructor grade first, then any
 *  further grades. The tree view walks this to arbitrary depth — size → grade₂ → … → elements. */
export async function gradeChain(collection: string): Promise<string[]> {
  return (await catalogMap()).get(collection)?.grades ?? []
}

/** Each collection's carrier type — the element's underlying pg composite (integer_partition, dyck_path, …).
 *  A visual "glyph" is a cast of that carrier into a page/scene space, so the carrier keys which glyph applies. */
export async function carriers(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [id, r] of await catalogMap()) if (r.carrier) out[id] = r.carrier
  return out
}

/** The carriers that render a page-space SVG figure — DERIVED from the glyph_svg overloads (carrier_renders_svg), not
 *  a hand-kept registry: define glyph_svg(<carrier>) and the carrier lights up. The page-space sibling of
 *  polytopeCollections (scene) — the set that casts an element into page space, as a db-emitted SVG. */
export async function svgCarriers(): Promise<Set<string>> {
  const rs = await rows<{ carrier: string }>(
    `SELECT t.typname AS carrier FROM pg_proc p JOIN pg_type t ON t.oid = p.proargtypes[0] WHERE p.proname = 'glyph_svg'`,
  )
  return new Set(rs.map((r) => r.carrier))
}

/** A trait — a named capability/category a collection can carry, with a description and `implies` supertraits
 *  (à la Rust supertraits / Sage supercategories). Real rows in base_trait. */
export type Trait = { id: string; title: string; description: string; implies: string[] }
/** The trait vocabulary (base_trait). */
export async function traits(): Promise<Trait[]> {
  return rows<Trait>(`SELECT id, coalesce(title, id) AS title, description, implies FROM base_trait ORDER BY id`)
}
/** Each collection's traits — derived from the registries and closed over `implies` (base_collection_trait). */
export async function collectionTraits(): Promise<Record<string, string[]>> {
  const rs = await rows<{ collection: string; trait: string }>(
    `SELECT collection, trait FROM base_collection_trait ORDER BY collection, trait`,
  )
  const out: Record<string, string[]> = {}
  for (const r of rs) (out[r.collection] ??= []).push(r.trait)
  return out
}

/** A generic CONSTRUCTION a collection is built from — a functor with type-parameter holes (finset α, words α, …),
 *  its notation skeleton and mathlib alignment (base_construction). See wiki: Parameterized-Collections. */
export type Construction = { id: string; title: string; params: string[]; skeleton: string; mathlib: string | null; description: string }
export async function constructions(): Promise<Construction[]> {
  return rows<Construction>(`SELECT id, title, params, skeleton, mathlib, description FROM base_construction ORDER BY id`)
}
/** Each collection's construction + how its element-type α is bound (base_collection_construction). `generic` is true
 *  when a type-parameter is an unfilled HOLE (e.g. words at α = Fin b); such collections carry the `generic` trait. */
export type CollectionConstruction = { collection: string; construction: string; alpha: string; alphaCollection: string | null; alphaAxis: string | null; generic: boolean; note: string | null }
export async function collectionConstructions(): Promise<Record<string, CollectionConstruction>> {
  const rs = await rows<CollectionConstruction>(`SELECT collection, construction, alpha, alpha_collection AS "alphaCollection", alpha_axis AS "alphaAxis", generic, note FROM base_collection_construction ORDER BY collection`)
  return Object.fromEntries(rs.map(r => [r.collection, r]))
}
/** Hard pointers to alternate implementations (mathlib4 / sage / oeis / wolfram / findstat) of one of our objects,
 *  with the delta where it doesn't match exactly (base_reference). The resolvable `identity` is the pointer; `url`
 *  when known. Pass `subject` (a collection id) to filter — this matches both collection-level rows keyed on the
 *  bare id (mathlib4/sage/oeis/wolfram) AND stat/map-level rows keyed `<collection>.<stat_id|map_id>` (findstat's
 *  convention, since a stat/map id is only unique within its collection — see findstat-refs.sql). */
export type Reference = { subjectKind: string; subject: string; system: string; identity: string; url: string | null; delta: string }
export async function references(subject?: string): Promise<Reference[]> {
  return rows<Reference>(
    `SELECT subject_kind AS "subjectKind", subject, system, identity, url, delta FROM base_reference
     ${subject ? "WHERE subject = $1 OR subject LIKE $1 || '.%'" : ''} ORDER BY subject, system`, subject ? [subject] : [])
}

/** A collection's counting identity as a combinatorial species / generating function (base_species): the labelled
 *  families carry an X/E/E+/C/L expression + EGF; the `unlabelled` ones an OGF fixed point Y = F(X,Y) (or a rational
 *  recurrence). `graded` ones carry a secondary parameter. Each is suite-checked against the collection's own count. */
export type Species = { collection: string; expr: string; egf: string | null; note: string | null; graded: boolean; unlabelled: boolean; implicit: boolean }
export async function species(): Promise<Record<string, Species>> {
  const rs = await rows<Species>(`SELECT collection, expr, egf, note, graded, unlabelled, implicit FROM base_species ORDER BY collection`)
  return Object.fromEntries(rs.map(r => [r.collection, r]))
}

/** A tag — an organizational family/kind a collection is-a (figurate, prime_family, path, …), with `implies`
 *  supertags (figurate ⇒ integer_sequence ⇒ number). Real rows in base_tag. Distinct from traits (capabilities);
 *  a collection carries many, and the explorer filters the collection list by them. */
export type Tag = { id: string; title: string; description: string; implies: string[] }
/** The tag vocabulary (base_tag). */
export async function tags(): Promise<Tag[]> {
  return rows<Tag>(`SELECT id, coalesce(title, id) AS title, description, implies FROM base_tag ORDER BY id`)
}
/** Each collection's tags — editorial assignments ∪ the derived (carrier/unbounded) tags, closed over `implies`
 *  (base_collection_tag). */
export async function collectionTags(): Promise<Record<string, string[]>> {
  const rs = await rows<{ collection: string; tag: string }>(
    `SELECT collection, tag FROM base_collection_tag ORDER BY collection, tag`,
  )
  const out: Record<string, string[]> = {}
  for (const r of rs) (out[r.collection] ??= []).push(r.tag)
  return out
}

/** A category — a classification a collection belongs to (hierarchical `parents`; `requires` names the traits it
 *  entails, its axioms). Real rows in base_category. Distinct from traits: a collection has ~one primary category. */
export type Category = { id: string; title: string; description: string; parents: string[]; requires: string[] }
/** The category vocabulary (base_category). */
export async function categories(): Promise<Category[]> {
  return rows<Category>(`SELECT id, coalesce(title, id) AS title, description, parents, requires FROM base_category ORDER BY id`)
}
/** Each collection's primary category (base_collection_category), off the cached catalog. */
export async function collectionCategories(): Promise<Record<string, CollectionCategory>> {
  const out: Record<string, CollectionCategory> = {}
  for (const [id, r] of await catalogMap()) out[id] = r.category
  return out
}

// ── algebra: a per-ring expression evaluator over the operation registry ─────────────────────────────────────
/** An algebraic type the evaluator can compute in: its structure memberships (Field, Well-ordered, …) and the
 *  operations it offers. From base_type_structure / base_type_operation / base_structure. modular_residues is
 *  appended as a parameterised ring (ℤ/mℤ) the evaluator handles specially. */
export type AlgebraType = { type: string; structures: string[]; ops: { op: string; symbol: string }[] }
export async function algebraTypes(): Promise<AlgebraType[]> {
  const structs = await rows<{ type: string; title: string }>(
    `SELECT ts.type, s.title FROM base_type_structure ts JOIN base_structure s ON s.id = ts.structure ORDER BY ts.type, s.title`)
  const opsr = await rows<{ type: string; op: string; symbol: string }>(
    `SELECT type, op, symbol FROM base_type_operation ORDER BY type, op`)
  const by = new Map<string, AlgebraType>()
  const ensure = (t: string) => { let e = by.get(t); if (!e) { e = { type: t, structures: [], ops: [] }; by.set(t, e) } return e }
  for (const r of structs) ensure(r.type).structures.push(r.title)
  for (const r of opsr) ensure(r.type).ops.push({ op: r.op, symbol: r.symbol })
  return [...by.values()]   // modular_residue now appears via base_type_structure like any other registered ring
}

type Emit = {
  atom: (n: string) => string; frac?: (n: string, d: string) => string; imag?: (n: string) => string
  omega?: string; inf?: string
  add: (a: string, b: string) => string; sub?: (a: string, b: string) => string
  mul: (a: string, b: string) => string; negate?: (a: string) => string; render: (e: string) => string
  // lattice/set carriers: a {..} literal atom and a postfix complement (∪/∩ ride on add/mul; see buildExprSql)
  setLit?: (elems: string[]) => string; complement?: (a: string) => string
}
const bin = (op: string) => (a: string, b: string) => `(${a} ${op} ${b})`
function emitterFor(type: string, modulus?: number): Emit {
  switch (type) {
    case 'rational_number': return { atom: (n) => `rational_number(${n},1)`, frac: (n, d) => `rational_number(${n},${d})`,
      add: bin('+'), sub: bin('-'), mul: bin('*'), negate: (a) => `(- ${a})`, render: (e) => `notation(${e})` }
    case 'omega_ordinal': return { atom: (n) => `ARRAY[${n}]::omega_ordinal`, omega: `ARRAY[1,0]::omega_ordinal`,
      add: bin('+'), mul: bin('*'), render: (e) => `notation(${e})` }
    case 'cardinal': return { atom: (n) => `${n}::cardinal`, inf: `'infinity'::cardinal`,
      // ℵ₀ prints as ∞ (prettier than pg's numeric 'Infinity'); finite cardinals are ordinary integers.
      add: bin('+'), mul: bin('*'), render: (e) => `CASE WHEN (${e})::numeric = 'infinity' THEN '∞' ELSE (${e})::text END` }
    case 'natural_number': return { atom: (n) => `${n}::natural_number`, add: bin('+'), mul: bin('*'), render: (e) => `(${e})::text` }
    case 'integer_number': return { atom: (n) => `${n}::integer_number`, add: bin('+'), sub: bin('-'), mul: bin('*'),
      negate: (a) => `(- ${a})`, render: (e) => `(${e})::text` }
    case 'modular_residue': {
      const m = Math.trunc(modulus ?? 0)
      if (!(m > 0)) throw new Error('ℤ/mℤ needs a modulus m > 0')
      const lit = (n: string) => `ROW(((${n}) % ${m} + ${m}) % ${m}, ${m})::modular_residue`
      return { atom: lit, add: bin('+'), sub: bin('-'), mul: bin('*'), negate: (a) => `(- ${a})`,
        render: (e) => `notation(${e})` }
    }
    case 'gaussian_integer': return { atom: (n) => `ROW(${n},0)::gaussian_integer`, imag: (n) => `ROW(0,${n})::gaussian_integer`,
      add: bin('+'), sub: bin('-'), mul: bin('*'), negate: (a) => `(- ${a})`, render: (e) => `notation(${e})` }
    case 'finset': {   // the distributive lattice of subsets of [n]: {..} literals, ∪ (join) / ∩ (meet) / postfix ᶜ or ' (complement)
      const gn = Math.trunc(modulus ?? 0)   // the ground n (needed for complement / the bounded top ⊤); passed like a modulus
      return {
        atom: () => { throw new Error('a finset is a set literal like {1,2}, not a bare number') },
        setLit: (elems) => `ROW(ARRAY[${elems.join(',')}]::int[], ${gn})::finset`,
        add: (a, b) => `finset_join(${a}, ${b})`,        // ∪
        mul: (a, b) => `finset_meet(${a}, ${b})`,        // ∩
        complement: (a) => `finset_complement(${a})`,     // ᶜ (needs the bounded ground n)
        render: (e) => `notation(finset_forget_ground(${e}))`,   // braces {members} — n-agnostic, so ∪/∩ read the same at any n
      }
    }
    default: throw new Error(`no arithmetic for type '${type}'`)
  }
}
// recursive-descent over a tiny grammar; emits SQL from the type's constructors/operators. Only digits + fixed
// constructor text reach SQL, so the input can't inject.
function buildExprSql(expr: string, emit: Emit): string {
  const s = expr; let i = 0
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++ }
  const peek = () => { ws(); return s[i] }
  const atom = (): string => {
    ws()
    if (emit.setLit && s[i] === '{') {                                // a set literal {1,2,3} or {} (empty)
      i++; const elems: string[] = []; ws()
      while (i < s.length && s[i] !== '}') {
        const st = i; while (i < s.length && /[0-9]/.test(s[i])) i++
        if (i === st) throw new Error(`expected a number or } in the set, got '${s[i] ?? 'end of input'}'`)
        elems.push(s.slice(st, i)); ws()
        if (s[i] === ',') { i++; ws() } else break
      }
      ws(); if (s[i] !== '}') throw new Error('expected } to close the set'); i++
      return emit.setLit(elems)
    }
    if (emit.omega && (s[i] === 'w' || s[i] === 'ω')) { i++; return emit.omega }
    if (emit.inf && (s[i] === '∞' || s.startsWith('oo', i))) { i += s[i] === '∞' ? 1 : 2; return emit.inf }
    if (emit.imag && s[i] === 'i') { i++; return emit.imag('1') }                 // bare i = 0+1i
    const start = i; while (i < s.length && /[0-9]/.test(s[i])) i++
    if (i === start) throw new Error(`unexpected '${s[i] ?? 'end of input'}'`)
    const num = s.slice(start, i)
    if (emit.imag && s[i] === 'i') { i++; return emit.imag(num) }                  // <n>i = 0+ni
    if (emit.frac && peek() === '/') { i++; ws(); const ds = i; while (i < s.length && /[0-9]/.test(s[i])) i++; if (i === ds) throw new Error('expected a denominator after /'); return emit.frac(num, s.slice(ds, i)) }
    return emit.atom(num)
  }
  const factor = (): string => {
    const c = peek()
    let v: string
    if (c === '-') { if (!emit.negate) throw new Error('this type has no negation'); i++; v = emit.negate(factor()) }
    else if (c === '(') { i++; v = expression(); if (peek() !== ')') throw new Error('expected )'); i++ }
    else v = atom()
    if (emit.complement) { ws(); while (s[i] === 'ᶜ' || s[i] === "'") { i++; v = emit.complement(v); ws() } }   // postfix complement
    return v
  }
  const term = (): string => { let a = factor(); for (;;) { const c = peek(); if (c === '*' || c === '·' || c === '×' || c === '∩') { i++; a = emit.mul(a, factor()) } else break } return a }
  const expression = (): string => { let a = term(); for (;;) { const c = peek(); if (c === '+' || c === '∪') { i++; a = emit.add(a, term()) } else if (c === '-') { if (!emit.sub) throw new Error('this type has no subtraction'); i++; a = emit.sub(a, term()) } else break } return a }
  const out = expression(); ws(); if (i < s.length) throw new Error(`unexpected '${s[i]}'`)
  return out
}
/** Evaluate an arithmetic expression in a type's algebra (a per-ring calculator): integer literals, a/b (rationals),
 *  w/ω (ordinals), oo/∞ (cardinals), + − · and parentheses. `modulus` is required for ℤ/mℤ. */
export async function evaluateExpression(type: string, expr: string, modulus?: number): Promise<{ result: string | null; error?: string }> {
  try {
    if (!expr.trim()) return { result: null }
    const emit = emitterFor(type, modulus)
    const [r] = await rows<{ v: string | null }>(`SELECT ${emit.render(buildExprSql(expr, emit))} AS v`)
    return { result: r?.v ?? null }
  } catch (e) {
    return { result: null, error: e instanceof Error ? e.message : String(e) }
  }
}

/** A worked expression example for a carrier's algebra: an expression in the evaluator grammar + its expected
 *  rendered value (base_expression_example). Doubles as a unit-test row and the evaluator's sample menu. `tags`
 *  classify it (e.g. `identity`, `edge-case`, `singleton`) so a host can filter which examples it surfaces. */
export type ExpressionExample = { carrier: string; expr: string; expected: string; title: string | null; tags: string[] }
export async function expressionExamples(carrier?: string): Promise<ExpressionExample[]> {
  return rows<ExpressionExample>(
    `SELECT carrier, expr, expected, title, coalesce(tags, '{}') AS tags FROM base_expression_example
       ${carrier ? 'WHERE carrier = $1' : ''} ORDER BY carrier, expr`,
    carrier ? [carrier] : [])
}

/** One directed edge of the map graph: a map out of `source` into `codomain`. */
export type MapEdge = { source: string; mapId: string; title: string; codomain: string; findstatId: string | null }
/** The whole map graph — every registered map as a `source -> codomain` edge, for traversal or visualisation.
 *  The connective tissue of the catalog: how each collection reaches the others. */
export async function mapGraph(): Promise<MapEdge[]> {
  return rows<MapEdge>(
    `SELECT collection AS source, map_id AS "mapId", coalesce(title, map_id) AS title, codomain, findstat AS "findstatId"
       FROM base_map ORDER BY collection, map_id`,
  )
}

/** A polytope ready for the viewer: nD vertex coordinates, wireframe edges (vertex-index pairs), and the full
 *  face poset as `cells` — each face's spanning vertex indices, its dimension, its rank, and a label. */
export type PolytopeData = {
  vertices: number[][]
  edges: [number, number][]
  cells: { rank: number; dim: number; label: string; verts: number[] }[]
}
/** The n! permutation image vectors of [n], in rank order — the raw coordinates for the permutahedron layer of the
 *  shared projective-space view. n is small. */
export async function permutationVectors(n: number): Promise<number[][]> {
  const r = await rows<{ img: number[] }>(`SELECT ((e).value).image AS img FROM elements(permutations(${n})) e ORDER BY rank(e)`)
  return r.map((x) => x.img.map(Number))
}

/** The associahedron on the binary trees with n internal nodes: vertices = the trees' Loday coordinates (in
 *  R^n, on the hyperplane Σ = C(n+1,2)), edges = the single rotations (flips), read from the core. */
export async function associahedron(n: number): Promise<{ vertices: number[][]; edges: [number, number][] }> {
  const vs = await rows<{ pt: number[] }>(
    `SELECT binary_tree_loday_point((e).value) AS pt FROM elements(binary_trees(${n})) e ORDER BY rank(e)`,
  )
  const es = await rows<{ i: number; j: number }>(
    `WITH t AS (SELECT rank(e)::int AS idx, (e).value AS tv, notation((e).value) AS w FROM elements(binary_trees(${n})) e)
     SELECT a.idx AS i, b.idx AS j FROM t a, binary_tree_flips(a.tv) fl JOIN t b ON notation(fl) = b.w WHERE a.idx < b.idx`,
  )
  return { vertices: vs.map((v) => v.pt.map(Number)), edges: es.map((e) => [Number(e.i), Number(e.j)] as [number, number]) }
}

/** The collections that carry a polytope (their elements are its faces): set_compositions → the permutahedron,
 *  signed_subsets → the cross-polytope. Read from base_polytope. */
export async function polytopeCollections(): Promise<{ collection: string; title: string }[]> {
  return rows<{ collection: string; title: string }>(
    `SELECT collection, coalesce(title, collection) AS title FROM base_polytope ORDER BY collection`,
  )
}

/** The order-n polytope carried by `collection`, read generically from the core. Its VERTICES are the collection's
 *  dim-0 faces (at their point_fn coordinate); each face's `verts` are the dim-0 faces it contains (contains_fn);
 *  edges are the dim-1 faces. Works for any collection registered in base_polytope (permutahedron, cross-polytope,
 *  …). Returns null if the collection carries no polytope. n is small in practice. */
export async function polytope(collection: string, n: number): Promise<PolytopeData | null> {
  const [meta] = await rows<{ dimFn: string; pointFn: string; containsFn: string }>(
    `SELECT dim_fn AS "dimFn", point_fn AS "pointFn", contains_fn AS "containsFn" FROM base_polytope WHERE collection = $1`,
    [collection],
  )
  if (!meta || !isIdent(collection)) return null
  // one scan: every face with its dim/label/point; the dim-0 faces (numbered by rank) are the vertices; each
  // face's verts = the dim-0 faces it contains. (Function names come from the trusted base_polytope registry.)
  const rs = await rows<{ rank: number; dim: number; label: string; pt: number[]; verts: number[] | null; vidx: number | null }>(
    `WITH f AS (SELECT rank(e)::int AS rank, (e).value AS fv, ${meta.dimFn}((e).value) AS dim,
                       render(e) AS label, ${meta.pointFn}((e).value) AS pt FROM elements(${collection}(${n})) e),
          v AS (SELECT fv, (row_number() OVER (ORDER BY rank) - 1)::int AS vidx FROM f WHERE dim = 0)
     SELECT f.rank, f.dim, f.label, f.pt, (SELECT vidx FROM v WHERE v.fv = f.fv) AS vidx,
            (SELECT array_agg(v.vidx ORDER BY v.vidx) FROM v WHERE ${meta.containsFn}(f.fv, v.fv)) AS verts
     FROM f ORDER BY f.rank`,
  )
  const vertices = rs.filter((r) => Number(r.dim) === 0).sort((a, b) => Number(a.vidx) - Number(b.vidx)).map((r) => r.pt.map(Number))
  const cells = rs.map((r) => ({ rank: Number(r.rank), dim: Number(r.dim), label: r.label, verts: (r.verts ?? []).map(Number) }))
  const edges = cells.filter((c) => c.dim === 1 && c.verts.length === 2).map((c) => c.verts as [number, number])
  return { vertices, edges, cells }
}

/** A single map's mapping function + codomain, by (collection, map_id) — used to walk a composition chain. */
async function lookupMap(collection: string, mapId: string): Promise<{ mappingFunc: string; codomain: string } | null> {
  const [r] = await rows<{ mappingFunc: string; codomain: string }>(
    `SELECT mapping_fn AS "mappingFunc", codomain FROM base_map_resolved WHERE collection = $1 AND map_id = $2`, [collection, mapId],
  )
  return r ?? null
}

/** Named alphabets for relabelling atoms — none in the pure core yet (the alphabet/spelling phase). */
export async function alphabets(): Promise<{ id: string; title: string; size: number }[]> {
  return []
}

export type CollSummary = {
  id: string; title: string; axes: string[]; fiberCount: number
  statsCount: number; reprsCount: number; mapsCount: number; examplesCount: number; oeis: string | null
}
/** Catalog grid — one row per collection. `axes` is the grade chain beyond size, `fiberCount` its grading depth,
 *  `statsCount`/`examplesCount` etc. from their registries (base_stat / base_example …). */
export async function summary(): Promise<CollSummary[]> {
  const countMap = async (table: string) => new Map(
    (await rows<{ collection: string; n: number }>(`SELECT collection, count(*)::int AS n FROM ${table} WHERE collection IS NOT NULL GROUP BY collection`))
      .map(r => [r.collection, Number(r.n)]),
  )
  const statCounts = await countMap('base_stat_resolved')   // resolved = own + carrier-inherited (what's usable)
  // base_repr's PK is (collection, repr, medium) post-#138 — a katex/latex sibling is another row, so count DISTINCT repr
  const reprCounts = new Map(
    (await rows<{ collection: string; n: number }>(`SELECT collection, count(DISTINCT repr)::int AS n FROM base_repr_resolved WHERE collection IS NOT NULL GROUP BY collection`))
      .map(r => [r.collection, Number(r.n)]),
  )
  const mapCounts = await countMap('base_map_resolved')
  const exampleCounts = await countMap('base_example')
  return [...(await catalogMap()).values()].map(c => ({
    id: c.id, title: c.id, axes: c.grades, fiberCount: c.grades.length,
    statsCount: statCounts.get(c.id) ?? 0, reprsCount: reprCounts.get(c.id) ?? 0, mapsCount: mapCounts.get(c.id) ?? 0,
    examplesCount: exampleCounts.get(c.id) ?? 0, oeis: null,
  }))
}

export type CollInfo = { id: string; axes: string[]; realized: string[][]; stats: Stat[]; reprs: { id: string; title: string; canonical: boolean }[]; examples: Example[]; category: CollectionCategory }
/** Whether the collection has the generic set_notation ("x ∈ <ambient-set symbol>") — present iff it defines fiber_symbol. */
export async function hasSetNotation(coll: string): Promise<boolean> {
  const [r] = await rows<{ x: boolean }>(`SELECT to_regprocedure($1) IS NOT NULL AS x`, [`set_notation(${coll}_element)`])
  return !!r?.x
}
/** The SQL expression that renders element alias `e` under a representation. `render(e)` is the canonical codec;
 *  a named `-R` repr resolves through base_repr to its render_fn applied to the carrier, DISPATCHED by `medium`
 *  (base_repr.medium — default 'unicode') when the repr carries a sibling row for that medium. A repr with no
 *  sibling for the requested medium falls back to its unicode row (most reprs only HAVE a unicode row — nothing to
 *  translate — so an unrecognized/unregistered medium is silently the same as no medium at all; this is what keeps
 *  every existing render byte-identical). (format/alphabet are a later phase — accepted but not yet applied.)
 *  Shared by Handle's projections and the row half's `element`. */
export async function renderExprFor(collection: string, repr?: string, medium?: string): Promise<string> {
  if (!repr || repr === 'canonical') return 'render(e)'
  if (repr === 'ambient') {   // the element in its ambient set: "<element> ∈ <fiber symbol>" — unicode only (#138)
    if (!(await hasSetNotation(collection))) throw new Error(`${collection}: no ambient (set) notation — it defines no fiber_symbol`)
    return 'set_notation(e)'
  }
  const candidates = await rows<{ fn: string; medium: string }>(
    `SELECT render_fn AS fn, medium FROM base_repr_resolved WHERE collection = $1 AND repr = $2`, [collection, repr],
  )
  if (!candidates.length) throw new Error(`${collection}: unknown representation '${repr}' (see: list ${collection})`)
  const want = medium ?? 'unicode'
  const r = candidates.find(c => c.medium === want) ?? candidates.find(c => c.medium === 'unicode') ?? candidates[0]
  return `${r.fn}((e).value)`
}

/** A collection's shape: its grade chain (axes) + registered statistics, representations, and verified examples. */
export async function describe(collection: string): Promise<CollInfo> {
  const c = (await catalogMap()).get(collection)
  const stats = await rows<Stat>(
    `SELECT stat_id AS "statId", value_fn AS "valueFunc", NULL::text AS "findstatId", codomain, NOT own AS inherited
       FROM base_stat_resolved WHERE collection = $1 ORDER BY stat_id`,
    [collection],
  )
  // one row per REPR (not per medium sibling) — base_repr_resolved carries a row per (repr, medium), and this list
  // names representations, not medium variants; DISTINCT ON picks each repr's unicode row (its default medium).
  const reprs = await rows<{ id: string; title: string; canonical: boolean }>(
    `SELECT id, title, canonical FROM (
       SELECT DISTINCT ON (repr) repr AS id, coalesce(title, repr) AS title, canonical
         FROM base_repr_resolved WHERE collection = $1 ORDER BY repr, (medium = 'unicode') DESC
     ) x ORDER BY canonical DESC, id`,
    [collection],
  )
  if (await hasSetNotation(collection)) reprs.push({ id: 'ambient', title: 'In its ambient set (x ∈ S)', canonical: false })
  const examples = await examplesFor(collection)
  return { id: collection, axes: c?.grades ?? [], realized: [], stats, reprs, examples, category: c?.category ?? 'mathematical' }
}

/** The verified examples registered for a collection (base_example, linked by the collection facet). */
export async function examplesFor(collection: string): Promise<Example[]> {
  return rows<Example>(
    `SELECT title, description, kind, expected FROM base_example WHERE collection = $1 ORDER BY title`,
    [collection],
  )
}

/** One fiber of a handle: a single family-parameter address, with the parameters resolved by name, a concrete
 *  sub-collection (a fully-pointed Handle) to enumerate, and its cardinality (null = infinite). */
export type Fiber = { address: number[]; params: Record<string, number>; collection: Handle; card: number | null }

/** One row of a group-by aggregate: a value of the grouped statistic, how many elements have it (the triangle
 *  cell), and the min/max/sum of the other statistics over that group. */
export type GroupRow = { value: number; count: number; stats: Record<string, { min: number; max: number; sum: number }> }

/** One bar of a statistic's distribution: a value and how many elements take it. */
export type DistBin = { value: number; count: number }
/** A statistic's distribution over a finite collection — the histogram `bins` (ascending by value) plus the
 *  usual one-number summaries. `support` is [min, max] value; `mode` is the most frequent value; empty ⇒ nulls. */
export type Distribution = {
  statId: string; total: number; support: [number, number] | null; mode: number | null; mean: number | null; bins: DistBin[]
}
/** One row of a statistic TRIANGLE — the distribution restricted to a single fiber (e.g. permutations of size n),
 *  tagged with that fiber's family parameters. Stacking the rows over a size range gives the Mahonian / Eulerian /
 *  Stirling / Narayana triangle as data. */
export type TriangleRow = { params: Record<string, number>; address: number[]; total: number; bins: DistBin[] }

/** Fold a histogram (ascending by value) into a Distribution with its summary numbers. */
function summarizeDist(statId: string, bins: DistBin[]): Distribution {
  const total = bins.reduce((s, b) => s + b.count, 0)
  if (!total) return { statId, total: 0, support: null, mode: null, mean: null, bins }
  const mode = bins.reduce((m, b) => (b.count > m.count ? b : m)).value
  const mean = bins.reduce((s, b) => s + b.value * b.count, 0) / total
  return { statId, total, support: [bins[0].value, bins[bins.length - 1].value], mode, mean, bins }
}

/** A handle over a pure-core collection. Family parameters are supplied by name (size, or a chain name) and bound
 *  POSITIONALLY (size = parameter 1, then the chain in order). A parameter may be a POINT (a number) or a [lo, hi]
 *  RANGE, which spans a union of fibers. Every method is async (the DB may run in a worker). */
// ── asymptotics-driven pagination (issue #47) ─────────────────────────────────────────────────────────────────────
// Fast-growing sequences (factorial_numbers, primorial, powers_of_two) balloon PER ELEMENT — element 1000 of
// factorial_numbers is ~2500 digits — so a fixed row-count page fetches a monster payload deep in the sequence. Size
// the next page toward a roughly constant PAYLOAD budget (serialized bytes ≈ work) instead of a constant row count.
// The signal is DERIVED (measured from the rows already in hand / a cheap probe), not hand-declared per collection.
/** Serialized-bytes budget per page — the "work" a batch should cost, independent of how many rows that buys. */
export const PAYLOAD_BUDGET = 96 * 1024
/** Never page below this many rows, however heavy each one is — a huge single element still comes back in a usable page. */
export const MIN_PAGE = 4
/** The payload "work" of a fetched row: the serialized byte size of its element string + projected stat/map columns. */
export function rowBytes(row: unknown): number {
  return new TextEncoder().encode(JSON.stringify(row ?? '')).length
}
/** Auto-tuned next page size for a payload budget, DERIVED from the rows just fetched: budget ÷ observed bytes-per-row,
 *  clamped to [MIN_PAGE, max]. `max` is the caller's hard row backstop (the current fixed cap). With nothing measured
 *  yet (empty prevRows) it returns `firstPage` (clamped to [MIN_PAGE, max]) when given — a SMALL first page that just
 *  fills the viewport, so an unknown-cost collection never balloons on batch one — else `max`; every later page then
 *  self-corrects from the measured payload. */
export function budgetedPageSize(prevRows: readonly unknown[], max: number, budget = PAYLOAD_BUDGET, firstPage?: number): number {
  if (!prevRows.length) return firstPage != null ? Math.max(MIN_PAGE, Math.min(max, firstPage)) : max
  const perRow = prevRows.reduce<number>((s, r) => s + rowBytes(r), 0) / prevRows.length
  if (!(perRow > 0)) return max
  return Math.max(MIN_PAGE, Math.min(max, Math.round(budget / perRow)))
}

// ── per-request perf stats (issue #37) ────────────────────────────────────────────────────────────────────────────
// Every element-window request is measured (elapsed ms + payload bytes + column count) — the observability signal that
// tells us when a fetch "goes sideways", and the raw material for per-collection page tuning + columnar profiling
// (which columns are worth DEFERRING). Kept in a small ring; dev logs each one; sinks let a UI stream them live.
const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())
/** One element-window request's measured cost. `bytes` is the serialized payload (the same "work" budgetedPageSize
 *  sizes against); `cols` counts the projected stat/map columns (0 for a bare element page). `at` is Date.now(). */
export type WindowPerf = { coll: string; first: number; count: number; rows: number; bytes: number; ms: number; cols: number; at: number }
const PERF_RING = 200
const perfLog: WindowPerf[] = []
type PerfSink = (p: WindowPerf) => void
const perfSinks = new Set<PerfSink>()
let perfEnabled = debug   // dev logging piggybacks the debug flag by default; setPerf() overrides
/** Toggle per-request perf capture/logging (independent of the SQL debug flag once set). */
export function setPerf(on = true): void { perfEnabled = on }
/** Subscribe to per-request window perf (returns an unsubscribe). A live dev panel / tuner hooks here. */
export function onWindowPerf(sink: PerfSink): () => void { perfSinks.add(sink); return () => { perfSinks.delete(sink) } }
/** The recent window-request perf ring, oldest→newest — for a dev panel or per-collection default tuning. */
export function recentPerf(): readonly WindowPerf[] { return perfLog }
// meta columns aren't stats/maps — excluded from the column-cost count that columnar profiling reasons about.
const META_COLS = new Set(['__rank', '__address', '__ordinality', '__data', '__svg', 'element'])
const colCount = (r: unknown): number => (r && typeof r === 'object' ? Object.keys(r).filter(k => !META_COLS.has(k)).length : 0)
function recordPerf(coll: string, first: number, count: number, out: readonly unknown[], t0: number): void {
  // bytes is a full serialize pass, so only pay it when someone's actually consuming perf (dev or a live sink).
  const watching = perfEnabled || perfSinks.size > 0
  const p: WindowPerf = {
    coll, first, count, rows: out.length,
    bytes: watching ? out.reduce<number>((s, r) => s + rowBytes(r), 0) : 0,
    ms: nowMs() - t0, cols: colCount(out[0]), at: Date.now(),
  }
  perfLog.push(p)
  if (perfLog.length > PERF_RING) perfLog.shift()
  for (const s of perfSinks) try { s(p) } catch { /* a sink must never break a fetch */ }
  if (perfEnabled) console.debug(`[enumeratio perf] ${coll} [${first},${first + count}) ${p.rows}r ${(p.bytes / 1024).toFixed(1)}KB ${p.ms.toFixed(1)}ms ${p.cols}col`)
}

export class Handle {
  readonly coll: string
  readonly args: Record<string, ParamValue>
  private _built?: Promise<string>
  private _card?: number | null
  private _stats?: Stat[]
  private _maps?: MapInfo[]
  private _rendersSvg?: Promise<boolean>

  constructor(coll: string, args: number | Record<string, ParamValue> = {}) {
    if (!isIdent(coll)) throw new Error(`invalid collection name: ${coll}`)
    this.coll = coll
    this.args = typeof args === 'number' ? { size: args } : args   // `new Handle(coll, 4)` = size 4
  }

  /** A sibling handle with one family parameter fixed to a point or a [lo, hi] range (merged into the args). */
  withGrade(axis: string, value: ParamValue): Handle {
    return new Handle(this.coll, { ...this.args, [axis]: value })
  }

  /** A human-readable constructor string for messages (not the bound pg call). */
  get ctor(): string {
    const show = (v: ParamValue) => (Array.isArray(v) ? `${v[0]}..${v[1]}` : String(v))
    const inner = Object.entries(this.args).map(([k, v]) => `${k}=${show(v)}`).join(', ')
    return `${this.coll}(${inner})`
  }

  /** The pg constructor expression, in family-parameter order (size aliases parameter 1). ALL POINTS ⇒ the
   *  positional ctor `<coll>(v1, …)`, where trailing unbound parameters default to their full range. If ANY
   *  parameter is a [lo, hi] RANGE, the handle is built directly from its typed natural_range fields — which requires
   *  every parameter to be given (a trailing default can depend on a ranged one, so it can't be inferred). Memoized. */
  built(): Promise<string> {
    return (this._built ??= (async () => {
      const c = (await catalogMap()).get(this.coll)
      if (!c) throw new Error(`unknown collection: ${this.coll}`)
      const val = (i: number): ParamValue | undefined =>
        i === 0 && this.args[c.grades[i]] === undefined ? this.args.size : this.args[c.grades[i]]
      const ints = (v: ParamValue): [number, number] => {
        const [lo, hi] = Array.isArray(v) ? v : [v as number, v as number]
        if (!Number.isInteger(lo) || !Number.isInteger(hi)) throw new Error(`${this.coll}: family parameter must be integer(s)`)
        return [lo, hi]
      }
      if (!c.grades.some((_, i) => Array.isArray(val(i)))) {
        const vals: number[] = []
        for (let i = 0; i < c.grades.length; i++) {
          const v = val(i)
          if (v === undefined) break // trailing unbound → omit; pg defaults it to the full range
          vals.push(ints(v)[0])
        }
        return `${this.coll}(${vals.join(', ')})`
      }
      // A range on one axis with UNBOUND axes behind it (k_subsets(n=0..4), k free) builds each unbound axis as an
      // OPEN range [0, ∞) — the core's odometer walks (fibers(h, n) / elements(h, slice)) start from the clamped lower
      // corner and carry the inner axes by their own bounds, so the handle unfolds exactly the fibers the constructor
      // would; cardinality(h) reads it as open (∞), which the row-half client refines by summing the fibers.
      let open = false
      const ranges = c.grades.map((g, i) => {
        const v = val(i)
        if (v === undefined) { open = true; return `natural_range(0, NULL, '[]')` }
        if (open) throw new Error(`${this.coll}: '${g}' is bound behind an unbound axis — bind ${c.grades.slice(0, i).filter((_, j) => val(j) === undefined).join(', ')} first`)
        const [lo, hi] = ints(v)
        return `natural_range(${lo}, ${hi}, '[]')`
      })
      return `ROW(${ranges.join(', ')})::${this.coll}`
    })())
  }

  /** |collection| — null means infinite (an unbounded/open handle). */
  async card(): Promise<number | null> {
    if (this._card === undefined) {
      const [r] = await rows<{ c: string }>(`SELECT cardinality(${await this.built()})::text AS c`)
      this._card = !r || r.c === 'Infinity' ? null : Number(r.c)
    }
    return this._card ?? null
  }

  /** A DERIVED per-collection growth hint (issue #47): the mean payload bytes-per-row of a cheap `sample`-row probe at
   *  `offset` — the size/growth signal for asymptotics-driven paging, without any hand-declared field. Probe deeper into
   *  a fast grower (a bigger `offset`) to sense the balloon before committing a first page; `budgetedPageSize` then turns
   *  it into a row count. Returns 0 for an empty/out-of-range probe. */
  async growthHint(offset = 0, sample = 4, opts: WindowOpts = {}): Promise<number> {
    const rowsOut = await this.window(offset, sample, opts)
    return rowsOut.length ? rowsOut.reduce((s, r) => s + rowBytes(r), 0) / rowsOut.length : 0
  }

  /** The collection's statistics, from the base_stat registry (value_fn applied to each element's carrier). */
  async stats(): Promise<Stat[]> {
    if (!this._stats) {
      this._stats = await rows<Stat>(
        `SELECT stat_id AS "statId", value_fn AS "valueFunc", NULL::text AS "findstatId", codomain, NOT own AS inherited
           FROM base_stat_resolved WHERE collection = $1 ORDER BY stat_id`,
        [this.coll],
      )
    }
    return this._stats
  }

  /** The maps out of this collection, from the base_map registry. */
  async maps(): Promise<MapInfo[]> {
    if (!this._maps) {
      this._maps = await rows<MapInfo>(
        `SELECT map_id AS id, coalesce(title, map_id) AS title, codomain AS codomain,
                findstat AS "findstatId", mapping_fn AS "mappingFunc", NOT own AS inherited
           FROM base_map_resolved WHERE collection = $1 ORDER BY map_id`,
        [this.coll],
      )
    }
    return this._maps
  }

  /** The formats of a representation — the pure core flattens repr+format, so there is just the canonical one
   *  (degraded: the format/medium/alphabet spelling axes are a later phase). */
  async formats(_repr?: string): Promise<string[]> {
    return []
  }

  /** The media (unicode/latex spellings) for a (repr, format) — none in the pure core yet (ascii only). */
  async media(_repr: string, _format: string): Promise<string[]> {
    return []
  }

  /** Every element with its stats — for client-side grouping over the whole (finite) fiber. */
  async all(opts: WindowOpts = {}): Promise<Result[]> {
    const total = (await this.card()) ?? 0
    return total > 0 ? this.window(0, total, opts) : []
  }

  /** The cardinalities of the fibers this handle spans, in address order — the |collection(…, k)| row over the
   *  spanned grade axis (Stirling / binomial / … counts). A fully-pointed handle gives a single-entry row. */
  async gradeCounts(): Promise<number[]> {
    return (await this.fibers()).map((f) => f.card ?? 0)
  }

  /** Reduce the grade-count row (sum = |collection|, or the largest / smallest fiber). */
  async aggregate(reduction: 'sum' | 'max' | 'min' = 'sum'): Promise<number> {
    const gc = await this.gradeCounts()
    if (!gc.length) return (await this.card()) ?? 0
    return reduction === 'max' ? Math.max(...gc) : reduction === 'min' ? Math.min(...gc) : gc.reduce((a, b) => a + b, 0)
  }

  private renderExpr(opts: RenderOpts): Promise<string> { return renderExprFor(this.coll, opts.repr, opts.medium) }

  /** Serializations of ranks [first, first+count) in canonical order — one scan over elements() (the new core's
   *  floor is an iterator, so we page the ordered stream rather than unrank per rank), rendered under opts.repr. */
  async serialize(first = 0, count?: number, opts: RenderOpts = {}): Promise<string[]> {
    const n = count ?? Math.max(0, ((await this.card()) ?? 0) - first)
    if (n <= 0) return []
    const expr = await this.renderExpr(opts)
    const rowsOut = await rows<{ el: string }>(
      `SELECT ${expr} AS el FROM elements(${await this.built()}, ${first + n}) e ORDER BY e OFFSET ${Math.max(0, first)} LIMIT ${n}`,
    )
    return rowsOut.map(r => r.el)
  }

  /** Resolve a composition chain of maps starting FROM this collection: walk each map's codomain into the next
   *  map's domain, returning a nester `wrap(inner)` = fnK(…fn2(fn1(inner))…) and the final codomain collection.
   *  Throws on an unknown map, naming the collection it stalled at. */
  private async resolveChain(mapIds: string[]): Promise<{ wrap: (inner: string) => string; codomain: string }> {
    let coll = this.coll
    const fns: string[] = []
    for (const id of mapIds) {
      const m = await lookupMap(coll, id)
      if (!m) throw new Error(`${coll}: unknown map '${id}' (see: maps ${coll})`)
      fns.push(m.mappingFunc)
      coll = m.codomain
    }
    return { wrap: (inner: string) => fns.reduce((acc, fn) => `${fn}(${acc})`, inner), codomain: coll }
  }

  /** The per-element projection over alias `e`: the rendered element + chosen stats + chosen map images + an optional
   *  composed-map image (`opts.through`). Shared by window() and at(); value_fn/mapping_fn come from the trusted
   *  registries and images render in their codomain form. */
  private async projection(opts: WindowOpts): Promise<string> {
    const cols = (await this.stats())
      .filter(s => !opts.stats || opts.stats.includes(s.statId))
      .map(s => `${s.valueFunc}((e).value) AS "${s.statId}"`)
    if (opts.maps?.length) {
      const ms = await this.maps()
      for (const id of opts.maps) {
        const m = ms.find(x => x.id === id)
        if (m?.mappingFunc) cols.push(`render_value(${m.mappingFunc}((e).value)) AS "map:${id}"`)
      }
    }
    if (opts.through?.length) {
      const { wrap } = await this.resolveChain(opts.through)
      cols.push(`render_value(${wrap('(e).value')}) AS "through:${opts.through.join('.')}"`)
    }
    // the structured cast: the carrier composite as JSON — the element AS DATA, which page/scene glyphs draw from
    if (opts.data) cols.push(`to_jsonb((e).value) AS "__data"`)
    // the db-emitted page-space SVG per row — figures as data (pg's glyph_svg), so a whole window comes back with its
    // figures in one query. Gated on carrier_renders_svg (glyph_svg((e).value) only type-checks for carriers with the
    // overload); a glyph-less carrier just omits the column.
    if (opts.glyph && (await this.rendersSvg())) cols.push(`glyph_svg((e).value) AS "__svg"`)
    return `${await this.renderExpr(opts)} AS element${cols.length ? ', ' + cols.join(', ') : ''}`
  }

  /** A window of elements: ranks [first, first+count), each with `__rank` + `element` (under opts.repr) + the
   *  projected statistics (`opts.stats`) and map images (`opts.maps`). */
  async window(first: number, count: number, opts: WindowOpts = {}): Promise<Result[]> {
    const start = Math.max(0, first)
    const proj = await this.projection(opts)
    const built = await this.built()
    // Custom WHERE / ORDER BY: materialize the projected columns over the WHOLE fiber, then filter + sort + window on
    // top (referencing the output aliases). This sorts the entire collection, so it needs a bounded handle — the scale
    // guard. `__rank` stays the CANONICAL rank (row_number over the enumeration-ordered stream), independent of the
    // display sort. Empty ORDER BY falls back to canonical order.
    const t0 = nowMs()
    let out: Result[]
    if (opts.where || opts.orderBy) {
      if ((await this.card()) === null) throw new Error(`${this.ctor} is infinite — custom WHERE/ORDER BY needs a bounded collection`)
      const where = opts.where ? `WHERE ${opts.where}` : ''
      const orderKey = orderExpr(opts.orderBy)
      // `__rank` = CANONICAL position (0-based, ignores the WHERE); `__ordinality` = the 1-based position WITHIN this
      // configured result (WITH ORDINALITY: filter removes rows, so the remaining ones renumber contiguously — the
      // "ordinal measure"). row_number() runs after the WHERE, so it counts only the present (matching) rows.
      out = await rows<Result>(
        `WITH proj AS (
           SELECT (row_number() OVER () - 1)::int AS "__rank", ${ADDRESS_SQL} AS "__address", ${proj}
             FROM (SELECT e FROM elements(${built}) e ORDER BY e) e
         )
         SELECT (row_number() OVER (ORDER BY ${orderKey}))::bigint AS "__ordinality", *
           FROM proj ${where} ORDER BY ${orderKey} OFFSET ${start} LIMIT ${count}`,
      )
    } else {
      out = await rows<Result>(
        `SELECT (${start} + row_number() OVER () - 1)::int AS "__rank", ${ADDRESS_SQL} AS "__address",
                (${start} + row_number() OVER ())::bigint AS "__ordinality", ${proj}
           FROM (SELECT e FROM elements(${built}, ${start + count}) e ORDER BY e OFFSET ${start} LIMIT ${count}) e`,
      )
    }
    recordPerf(this.coll, start, count, out, t0)
    return out
  }

  /** A DEFERRED-COLUMN fill pass (#37): fetch ONLY the named stat columns for canonical ranks [first, first+count),
   *  keyed by `__rank`, skipping the element render + address + map projection a full window() pays. Lets the table
   *  paint cheap columns immediately, show a skeleton for the slow ones, then patch them in for the rows in/near view.
   *  Canonical order only (no where/orderBy) — that's the streaming/lazy path deferral targets. Unknown ids are dropped;
   *  an empty result set means none of `statIds` are stats of this collection. */
  async windowStats(first: number, count: number, statIds: string[], opts: RenderOpts = {}): Promise<Array<{ __rank: number } & Row>> {
    if (!statIds.length || count <= 0) return []
    const start = Math.max(0, first)
    const want = new Set(statIds)
    const cols = (await this.stats()).filter(s => want.has(s.statId)).map(s => `${s.valueFunc}((e).value) AS "${s.statId}"`)
    if (!cols.length) return []
    const built = await this.built()
    const t0 = nowMs()
    const out = await rows<{ __rank: number } & Row>(
      `SELECT (${start} + row_number() OVER () - 1)::int AS "__rank", ${cols.join(', ')}
         FROM (SELECT e FROM elements(${built}, ${start + count}) e ORDER BY e OFFSET ${start} LIMIT ${count}) e`,
    )
    recordPerf(this.coll, start, count, out, t0)
    return out
  }

  /** Columnar cost profile (#37): the mean ms to compute each stat over one `sample`-row probe at `offset`, so the UI
   *  can DEFER the expensive columns. One probe per stat — call it lazily (first paint / on demand), NOT per page.
   *  Sorted most-expensive first. `opts` is unused today (stats read the raw carrier) but kept for parity with window(). */
  async profileStats(offset = 0, sample = 8, opts: RenderOpts = {}): Promise<Array<{ statId: string; ms: number }>> {
    void opts
    const out: Array<{ statId: string; ms: number }> = []
    for (const s of await this.stats()) {
      const t0 = nowMs()
      await this.windowStats(offset, sample, [s.statId])
      out.push({ statId: s.statId, ms: (nowMs() - t0) / Math.max(1, sample) })
    }
    return out.sort((a, b) => b.ms - a.ms)
  }

  // ── the whole-view query (https://github.com/enumeratio/enumeratio/wiki/Query-Model): projection + WHERE + GROUP BY/HAVING + ORDER BY as ONE SELECT.
  //    The table's rows ARE select()'s result; its columns ARE the projection. viewSql() is also the NAIVE reference
  //    the self-cert harness diffs the accelerated path against. Bounded collections only (materializes the fiber). ──
  /** A projected column reference for a WHERE/GROUP BY/ORDER BY: a bare identifier stays as-is, a hyphenated stat id
   *  (or other word) is double-quoted, anything with spaces/parens (an expression) is passed through raw. */
  private static col(s: string): string {
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s
    if (/^[A-Za-z_][\w-]*$/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  /** The naive, definitional SQL for a view config: materialize the projected columns over the WHOLE (bounded) fiber,
   *  then apply the clauses in plain SQL. What select()/group() run, and the reference oracle for self-cert. `window` =
   *  [first, first+count) for the ungrouped form (omit for all rows). */
  async viewSql(config: ViewQuery, window?: { first?: number; count?: number }): Promise<string> {
    if ((await this.card()) === null) throw new Error(`${this.ctor} is infinite — a view query needs a bounded collection`)
    const proj = await this.projection({ ...config, stats: config.select })
    const built = await this.built()
    const base = `WITH proj AS (SELECT (row_number() OVER () - 1)::int AS "__rank", ${ADDRESS_SQL} AS "__address", ${proj}
        FROM (SELECT e FROM elements(${built}) e ORDER BY e) e)`
    const where = config.where ? `WHERE ${config.where}` : ''
    if (config.groupBy) {
      const g = Handle.col(config.groupBy)
      const having = config.having ? `HAVING ${config.having}` : ''
      const order = config.orderBy ? `ORDER BY ${config.orderBy}` : 'ORDER BY 1'
      return `${base} SELECT ${g} AS "__group", count(*)::int AS "__count" FROM proj ${where} GROUP BY ${g} ${having} ${order}`
    }
    const orderKey = orderExpr(config.orderBy)
    const win = window && window.count != null ? `OFFSET ${Math.max(0, window.first ?? 0)} LIMIT ${window.count}` : ''
    // __ordinality = the 1-based WITH-ORDINALITY position within this filtered/sorted result (see window()).
    return `${base} SELECT (row_number() OVER (ORDER BY ${orderKey}))::bigint AS "__ordinality", *
        FROM proj ${where} ORDER BY ${orderKey} ${win}`
  }
  /** Run an UNGROUPED view — the projected, filtered, sorted rows (a window when given). The table's rows ARE this. */
  async select(config: ViewQuery, window?: { first?: number; count?: number }): Promise<Result[]> {
    if (config.groupBy) throw new Error('select() is the ungrouped view — use group() when groupBy is set')
    return rows<Result>(await this.viewSql(config, window))
  }
  /** Run a GROUPED view — one row per value of `config.groupBy` with its element count (the triangle / distribution). */
  async group(config: ViewQuery): Promise<GroupResult[]> {
    if (!config.groupBy) throw new Error('group() needs config.groupBy')
    return rows<GroupResult>(await this.viewSql(config))
  }
  /** How many rows the view returns — |filtered| for an ungrouped view, the number of GROUPS for a grouped one. Lets
   *  the table size itself under a WHERE / GROUP BY without fetching every row. */
  async viewCount(config: ViewQuery): Promise<number> {
    const [r] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM (${await this.viewSql({ ...config, orderBy: undefined })}) v`)
    return r ? Number(r.n) : 0
  }

  /** Whether this collection's carrier declares a `glyph_svg` overload (carrier_renders_svg) — i.e. the db can emit an
   *  SVG figure per element. Memoized; gates the `__svg` window projection and glyphSvg() so we never issue a
   *  glyph_svg((e).value) that wouldn't type-check for the carrier. */
  rendersSvg(): Promise<boolean> {
    return (this._rendersSvg ??= (async () => {
      const carrier = (await catalogMap()).get(this.coll)?.carrier
      if (!carrier) return false
      const [cap] = await rows<{ ok: boolean }>(`SELECT carrier_renders_svg($1) AS ok`, [carrier])
      return !!cap?.ok
    })())
  }

  /** The db-emitted page-space SVG for the element at `rank` — the render payload AS DATA (pg's glyph_svg), which a
   *  generic renderer injects as-is (figures-as-data; see wiki: Render-Assets). null when this collection's
   *  carrier has no glyph_svg overload (carrier_renders_svg = false) — the caller falls back to a `kind`-dispatched
   *  built-in glyph, or to text. Guarded in TS, not SQL: glyph_svg((e).value) only type-checks for carriers that
   *  actually declare the overload, so we must confirm support before issuing that query. */
  async glyphSvg(rank: number): Promise<string | null> {
    if (!(await this.rendersSvg())) return null
    const built = await this.built()
    const [r] = await rows<{ svg: string | null }>(
      `SELECT glyph_svg((e).value) AS svg
         FROM (SELECT e FROM elements(${built}) e ORDER BY e OFFSET ${Math.max(0, rank)} LIMIT 1) e`,
    )
    return r?.svg ?? null
  }

  /** ONE element, value-addressed by a bare RANK (unrank) or by a SERIALIZATION. A bare all-digit address is a rank
   *  (so a permutation's "2413" is rank 2413); prefix with `@` to force value-addressing (`@2413` = the element
   *  serialized as 2413 under opts.repr). Serializations are matched by SCANNING the ordered fiber against the repr's
   *  render() (the pure core has no parse codec), capped at the fiber window. null if the address names no element. */
  async at(address: string, opts: WindowOpts = {}): Promise<Result | null> {
    const forced = address.startsWith('@')
    if (!forced && /^-?\d+$/.test(address)) {                         // bare int → rank
      const [r] = await this.window(Number(address), 1, opts)
      return r ?? null
    }
    const target = forced ? address.slice(1) : address               // '@x' → x ; bare non-int → itself
    const proj = await this.projection(opts)
    const match = await this.renderExpr(opts)                         // address is in the SAME repr you're viewing
    const [r] = await rows<Result>(
      `SELECT ${proj} FROM elements(${await this.built()}) e WHERE ${match} = $1 LIMIT 1`, [target],
    )
    return r ? { ...r, __address: address } : null
  }

  /** Read an element THROUGH a map: apply mapId to the element at `address` (rank or `@serialization`, canonical) and
   *  return the image as a light Result in the map's codomain — `element`/`__address` = the image's canonical
   *  serialization, `__codomain` = the target collection. null if the map is unknown or the address names no element. */
  async imageThrough(address: string, mapId: string): Promise<Result | null> {
    const m = (await this.maps()).find(x => x.id === mapId)
    if (!m?.mappingFunc) return null
    const built = await this.built()
    const image = `render_value(${m.mappingFunc}((e).value)) AS addr`
    const forced = address.startsWith('@')
    const [r] = !forced && /^-?\d+$/.test(address)
      ? await rows<{ addr: string }>(`SELECT ${image} FROM (SELECT e FROM elements(${built}) e ORDER BY e OFFSET ${Number(address)} LIMIT 1) e`)
      : await rows<{ addr: string }>(`SELECT ${image} FROM elements(${built}) e WHERE render(e) = $1 LIMIT 1`, [forced ? address.slice(1) : address])
    return r?.addr == null ? null : { element: r.addr, __address: r.addr, __codomain: m.codomain }
  }

  /** The canonical RANK of a value-addressed element (given by its canonical serialization) — the number of elements
   *  ordered before it in the fiber. null if the serialization names no element. Finite handles only; matches on the
   *  canonical render (not a named -R repr). */
  async rankOf(serialization: string): Promise<number | null> {
    const built = await this.built()
    const [r] = await rows<{ rk: string | null }>(
      `WITH t AS (SELECT e AS v FROM elements(${built}) e WHERE render(e) = $1 LIMIT 1)
       SELECT (SELECT count(*) FROM elements(${built}) e, t WHERE e < t.v)::text AS rk WHERE EXISTS (SELECT 1 FROM t)`,
      [serialization],
    )
    return r?.rk == null ? null : Number(r.rk)
  }

  /** Read an element through a COMPOSITION of maps: apply mapIds left-to-right to the element at `address` (rank or
   *  `@serialization`), each map's codomain feeding the next map's domain. Returns the final image as a light Result
   *  (`element`/`__address` = its serialization, `__codomain` = the final collection, `__through` = the chain).
   *  Empty chain ⇒ the element itself (`at`). Throws on an unknown map in the chain; null if the address is empty. */
  async compose(address: string, mapIds: string[]): Promise<Result | null> {
    if (!mapIds.length) return this.at(address)
    const { wrap, codomain } = await this.resolveChain(mapIds)
    const built = await this.built()
    const image = `render_value(${wrap('(e).value')}) AS addr`
    const forced = address.startsWith('@')
    const [r] = !forced && /^-?\d+$/.test(address)
      ? await rows<{ addr: string }>(`SELECT ${image} FROM (SELECT e FROM elements(${built}) e ORDER BY e OFFSET ${Number(address)} LIMIT 1) e`)
      : await rows<{ addr: string }>(`SELECT ${image} FROM elements(${built}) e WHERE render(e) = $1 LIMIT 1`, [forced ? address.slice(1) : address])
    return r?.addr == null ? null : { element: r.addr, __address: r.addr, __codomain: codomain, __through: mapIds.join(',') }
  }

  // ── fibers vs elements ────────────────────────────────────────────────────────────────────────────────────
  /** The fibers this handle spans — one per family-parameter address. A fully-pointed handle has exactly one; a
   *  range OR an unbound parameter spans many (e.g. finite_sets(6) leaves k ∈ [0,6], so it has 7 fibers). Each fiber
   *  resolves to a concrete sub-collection (a pointed Handle) you can enumerate. */
  async fibers(): Promise<Fiber[]> {
    const built = await this.built()
    const chain = (await catalogMap()).get(this.coll)?.grades ?? []
    const rs = await rows<{ address: string; card: string }>(
      `SELECT fiber_address(f)::text AS address, cardinality(f)::text AS card FROM fibers(${built}) f ORDER BY fiber_address(f)`,
    )
    return rs.map((r) => {
      const address = (r.address.match(/-?\d+/g) ?? []).map(Number)
      const params = Object.fromEntries(chain.map((g, i) => [g, address[i]]))
      return { address, params, collection: new Handle(this.coll, params), card: r.card === 'Infinity' ? null : Number(r.card) }
    })
  }

  /** How many fibers this handle spans — one for a fully-pointed handle, many for a range or an unbound parameter. */
  async fiberCount(): Promise<number> {
    const [r] = await rows<{ n: number }>(`SELECT count(*)::int AS n FROM fibers(${await this.built()}) f`)
    return r ? Number(r.n) : 0
  }

  /** Lazily async-iterate the flattened elements in canonical (global-rank) order, paging the stream — a finite
   *  handle ends on its own; an unbounded one runs until the consumer stops (break out of the for-await). */
  async *elements(opts: WindowOpts & { pageSize?: number } = {}): AsyncGenerator<Result> {
    const page = Math.max(1, opts.pageSize ?? 1000)
    for (let first = 0; ; first += page) {
      const batch = await this.window(first, page, opts)
      yield* batch
      if (batch.length < page) break
    }
  }

  /** The first `n` elements — a convenience over the lazy stream. */
  async take(n: number, opts: WindowOpts = {}): Promise<Result[]> {
    return n > 0 ? this.window(0, n, opts) : []
  }

  /** Group the (finite) collection by a statistic — ONE SQL GROUP BY over every element — returning, per value of
   *  `statId`, the COUNT (the triangle cell: Pascal / Mahonian / Stirling …) plus the min/max/sum of the other
   *  statistics over that group. Read-only aggregation: no fibers are materialized, no re-ranking. `summarize`
   *  picks which statistics to reduce (default: all the others). */
  async groupBy(statId: string, opts: { summarize?: string[] } = {}): Promise<GroupRow[]> {
    const stats = await this.stats()
    const g = stats.find((s) => s.statId === statId)
    if (!g) throw new Error(`${this.coll}: unknown statistic '${statId}' (see: describe ${this.coll})`)
    if ((await this.card()) === null) throw new Error(`${this.ctor} is infinite — groupBy needs a finite collection`)
    const summ = (opts.summarize ?? stats.map((s) => s.statId).filter((id) => id !== statId))
      .map((id) => stats.find((s) => s.statId === id)).filter((s): s is Stat => !!s)
    const cols = summ.flatMap((s) => [
      `min(${s.valueFunc}((e).value))::float8 AS "min:${s.statId}"`,
      `max(${s.valueFunc}((e).value))::float8 AS "max:${s.statId}"`,
      `sum(${s.valueFunc}((e).value))::float8 AS "sum:${s.statId}"`,
    ])
    const out = await rows<Row>(
      `SELECT ${g.valueFunc}((e).value)::int AS "value", count(*)::int AS "count"${cols.length ? ', ' + cols.join(', ') : ''}
         FROM elements(${await this.built()}, 2147483647) e GROUP BY 1 ORDER BY 1`,
    )
    return out.map((r) => ({
      value: Number(r.value),
      count: Number(r.count),
      stats: Object.fromEntries(summ.map((s) => [s.statId, {
        min: Number(r[`min:${s.statId}`]), max: Number(r[`max:${s.statId}`]), sum: Number(r[`sum:${s.statId}`]),
      }])),
    }))
  }

  /** A statistic's DISTRIBUTION over the (finite) collection — the histogram (count per value, ascending) plus
   *  total / support / mode / mean. One SQL GROUP BY, no fibers materialized. Over a multi-fiber handle (a range or
   *  an unbound parameter) the fibers are LUMPED into one distribution; use `triangle()` to split them per fiber. */
  async distribution(statId: string): Promise<Distribution> {
    const g = (await this.stats()).find((s) => s.statId === statId)
    if (!g) throw new Error(`${this.coll}: unknown statistic '${statId}' (see: describe ${this.coll})`)
    if ((await this.card()) === null) throw new Error(`${this.ctor} is infinite — distribution needs a finite collection`)
    const bins = (await rows<{ value: number; count: number }>(
      `SELECT ${g.valueFunc}((e).value)::int AS "value", count(*)::int AS "count"
         FROM elements(${await this.built()}, 2147483647) e GROUP BY 1 ORDER BY 1`,
    )).map((r) => ({ value: Number(r.value), count: Number(r.count) }))
    return summarizeDist(statId, bins)
  }

  /** A statistic TRIANGLE: its distribution within EACH fiber the handle spans, one TriangleRow per fiber (tagged
   *  with that fiber's parameters). Over a size range this is the Mahonian / Eulerian / Stirling / Narayana triangle.
   *  A fully-pointed handle yields a single row (== `distribution()`). Every spanned fiber must be finite. */
  async triangle(statId: string): Promise<TriangleRow[]> {
    if (!(await this.stats()).some((s) => s.statId === statId)) {
      throw new Error(`${this.coll}: unknown statistic '${statId}' (see: describe ${this.coll})`)
    }
    const out: TriangleRow[] = []
    for (const f of await this.fibers()) {
      if (f.card === null) throw new Error(`${f.collection.ctor} is infinite — triangle needs finite fibers`)
      const d = await f.collection.distribution(statId)
      out.push({ params: f.params, address: f.address, total: d.total, bins: d.bins })
    }
    return out
  }

  /** Default async iteration follows the fibers-vs-elements rule: a handle spanning MANY fibers (a range or an
   *  unbound parameter) yields its FIBERS (drill in via `.collection`); a single-fiber handle yields its ELEMENTS. */
  async *[Symbol.asyncIterator](): AsyncGenerator<Fiber | Result> {
    if ((await this.fiberCount()) > 1) yield* await this.fibers()
    else yield* this.elements()
  }
}

/** Build a handle for any collection from named args — `size` is parameter 1; each value is a point or a [lo,hi] range. */
export function construct(collection: string, args: Record<string, ParamValue> = {}): Handle {
  return new Handle(collection, args)
}

// ── the whole catalog, for the docs reference page (a degraded CollFull — the pure core has no oeis/sage/formats/
//    media/multi-order metadata yet, so those fall back: reprs carry one canonical ascii-only format with a live
//    sample, orders = the single canonical order). ────────────────────────────────────────────────────────────
export type FormatInfo = { id: string; title: string; canonical: boolean; selfComplete: boolean; aliases: string[]; media: string[]; sample: Record<string, string> }
export type Repr = { id: string; title: string; canonical: boolean }
export type RankingInfo = { id: string; title: string }
export type CollFull = {
  id: string; title: string; carrier: string | null; oeis: string | null; sageParent: string | null
  description: string; axes: string[]; realized: string[][]; stats: Stat[]; reprs: Repr[]
  maps: MapInfo[]; rankings: RankingInfo[]; formats: Record<string, FormatInfo[]>; examples: Example[]
}

// a small sample size per collection so the rendered sample is non-degenerate (not the empty/identity element)
const SAMPLE: Record<string, number> = { permutations: 4, integer_partitions: 6, integer_compositions: 5, dyck_paths: 3, set_partitions: 4, subsets: 4 }

export async function catalog(): Promise<CollFull[]> {
  const out: CollFull[] = []
  for (const c of (await catalogMap()).values()) {
    const info = await describe(c.id)
    const h = new Handle(c.id, c.unbounded ? {} : { size: SAMPLE[c.id] ?? 4 })
    const maps = await h.maps()
    const formats: Record<string, FormatInfo[]> = {}
    for (const r of info.reprs) {
      const sample: Record<string, string> = {}
      try { const [v] = await h.serialize(0, 1, { repr: r.id }); if (v) sample.ascii = v } catch { /* unrankable sample — skip */ }
      formats[r.id] = [{ id: 'canonical', title: r.title, canonical: true, selfComplete: true, aliases: [], media: [], sample }]
    }
    out.push({
      id: c.id, title: c.id, carrier: c.carrier, oeis: null, sageParent: null, description: '',
      axes: info.axes, realized: c.grades.length ? [c.grades] : [[]], stats: info.stats, reprs: info.reprs,
      maps, rankings: [{ id: 'canonical', title: 'canonical' }], formats, examples: info.examples,
    })
  }
  return out
}

// ── the statistic finder (#124/#134): "which known stats agree with this value vector" ──────────────────────────
/** One find_stat hit: a stat (identified by its collection + id) whose value_fn — optionally through a chain of
 *  maps (`mapPath`, empty = the stat applies directly) — reproduces the submitted values. `qa`/`qd` are FindStat's
 *  quality numbers (fraction explained / discriminating power), already sorted best-first by the SQL side. */
export type FindStatHit = { statCollection: string; statId: string; mapPath: string[]; qa: number; qd: number }
/** Sweep the catalog for statistics matching a handful of submitted (element render → value) pairs, via the pure-SQL
 *  find_stat() (issue #124) — the catalog is the oracle, so a hit means a registered value_fn actually reproduces
 *  every value you gave it. `elementValues` keys must be canonical renders of `collection`'s own elements (as
 *  `.serialize()` returns them); an empty map short-circuits to no hits without a query. `opts.depth` walks chains
 *  of maps before trying a stat (0 = stats registered directly on the collection only); `sizeCap`/`perFiberCap`
 *  bound the sweep — the SQL defaults (6 / 2000) are fine for the small samples this is meant for. */
export async function findStat(
  collection: string, elementValues: Record<string, number>,
  opts: { depth?: number; sizeCap?: number; perFiberCap?: number } = {},
): Promise<FindStatHit[]> {
  if (!isIdent(collection)) throw new Error(`invalid collection name: ${collection}`)
  if (!Object.keys(elementValues).length) return []
  return rows<FindStatHit>(
    `SELECT stat_collection AS "statCollection", stat_id AS "statId", coalesce(map_path, '{}') AS "mapPath",
            q_a::float8 AS qa, q_d::float8 AS qd
       FROM find_stat($1, $2::jsonb, $3, $4, $5)`,
    [collection, JSON.stringify(elementValues), opts.depth ?? 0, opts.sizeCap ?? 6, opts.perFiberCap ?? 2000],
  )
}

// ── the distribution finder (#125): "which known stats are equidistributed with this histogram" ────────────────────
/** One distribution_match hit: a stat (identified by its collection + id) whose value_fn — optionally through a
 *  chain of maps (`mapPath`) — produces the same histogram (up to overlap) over the target fiber. `qa` is the
 *  overlap fraction (1.0 = identical histograms, i.e. genuine equidistribution); `qd` is the candidate's own
 *  discriminating power (distinct values / fiber size), same ratio findStat reports. */
export type DistributionMatchHit = { statCollection: string; statId: string; mapPath: string[]; qa: number; qd: number }
/** Sweep the catalog for statistics equidistributed with a submitted value→multiplicity histogram, via the pure-SQL
 *  distribution_match() (issue #125) — find_stat's distributional sibling: find_stat matches per-element VALUES,
 *  this matches a FIBER's value DISTRIBUTION (an order-agnostic multiset/histogram), the equidistribution question
 *  ("which stats are Mahonian/Eulerian/Narayana here?"). `targetDistribution` keys are stat values (as they'd
 *  stringify) mapped to their multiplicity, e.g. the Mahonian distribution on permutations(4):
 *  `{0:1,1:3,2:5,3:6,4:5,5:3,6:1}`. `n` pins the single fiber to compare against — required for a graded
 *  collection (a distribution is one fiber's shape, not a range of them), ignored for an ungraded one.
 *  `opts.depth` walks chains of maps before trying a stat (0 = stats registered directly on the collection only);
 *  `perFiberCap` bounds the fiber enumeration (the SQL default of 2000 is fine for reasonable n). */
export async function distributionMatch(
  collection: string, targetDistribution: Record<string, number>, n?: number,
  opts: { depth?: number; perFiberCap?: number } = {},
): Promise<DistributionMatchHit[]> {
  if (!isIdent(collection)) throw new Error(`invalid collection name: ${collection}`)
  if (!Object.keys(targetDistribution).length) return []
  return rows<DistributionMatchHit>(
    `SELECT stat_collection AS "statCollection", stat_id AS "statId", coalesce(map_path, '{}') AS "mapPath",
            q_a::float8 AS qa, q_d::float8 AS qd
       FROM distribution_match($1, $2::jsonb, $3, $4, $5)`,
    [collection, JSON.stringify(targetDistribution), n ?? null, opts.depth ?? 0, opts.perFiberCap ?? 2000],
  )
}

// Low-level access for sibling modules (rows.ts): run SQL against the provided Db, and the memoized catalog.
export { rows as runSql, catalogMap }
