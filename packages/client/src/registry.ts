// The engine registry — the layered view of the catalog an engine's `can()` reads (#278 D2).
//
// LAYERED, like a search_path: a build-time base snapshot, then ordered overlays from `extend()`, each shadowing
// the ones under it. A lookup walks the overlays top-down and falls through to the base.
//
// DIRTY is the safety valve. Raw `extendDb(sql)` can define anything — a function, a glyph overload, a whole
// table — so after one the snapshot is no longer a description of the live database. The registry marks itself
// dirty and every non-pg engine's `can()` collapses to false: whatever else happens, an engine must never answer
// from a picture of a world that has moved. Same for a snapshot whose hash does not match the live core, and for
// no snapshot at all (a source checkout, where the artifact was never generated).
import type { CarrierRow, CatalogSnapshot, CollectionRow, FunctionRow, ImplRow, TypeKind, TypeOperationRow } from '@enumeratio/data/catalog-snapshot'
import { grantsFor, isFoldable, kindOfType } from '@enumeratio/data/catalog-snapshot'
import { onDbExtended } from './core'
import type { Representation } from './engine'

export type { CarrierRow, CatalogSnapshot, CollectionRow, FunctionRow, ImplRow, TypeKind, TypeOperationRow }

/** What an entry knows: the artifact (or null), and the hash of the core actually running. */
export type CatalogSource = () => Promise<{ snapshot: CatalogSnapshot | null; liveHash: string }>

const EMPTY: CatalogSnapshot = {
  hash: '', builtAt: '', functions: [], collections: [], carriers: [], engines: [], columnGroups: [], grants: [], foldable: [],
  typeOperations: [],
}

let source: CatalogSource | null = null
let loaded: Promise<Registry> | null = null

/** An environment entry (client/src/node.ts, browser.ts) wires how the snapshot is found — the two environments
 *  differ, and neither can do the other's trick (fs vs import.meta.glob). */
export function provideCatalog(f: CatalogSource): void {
  source = f
  loaded = null
}

/** One `extend()` delta, already normalized into registry rows. */
export type Overlay = { functions: Map<string, FunctionRow>; bodies: Map<string, unknown> }

export class Registry {
  /** empty when there is no usable snapshot — which is exactly the "everything falls to pg" state */
  readonly base: CatalogSnapshot
  readonly overlays: Overlay[] = []
  /** why the base is empty, for `why()` to quote instead of a bare false */
  readonly unusable: string | null
  private _dirty: string | null = null

  constructor(base: CatalogSnapshot, unusable: string | null) {
    this.base = base
    this.unusable = unusable
  }

  /** true once the live database has been changed out from under the snapshot */
  get dirty(): string | null { return this._dirty ?? this.unusable }
  markDirty(why = 'the live database was extended with raw SQL after this snapshot was built'): void { this._dirty = why }

  push(o: Overlay): void { this.overlays.unshift(o) }

  /** Shadowing is per IMPL, not per function. Each engine's `extend()` describes only its own side, so an
   *  overlay that replaced the whole function row would hide the other engine's implementations — which is
   *  exactly what happened the first time a router extended pg and ts together (found by selfcert-engine). The
   *  metadata comes from the topmost layer that has the function; the impls are the union of every layer, first
   *  writer of a given (engine, impl_ref, argTypes) winning. */
  fn(id: string): FunctionRow | undefined {
    const layers = [...this.overlays.map((o) => o.functions.get(id)), this.base.functions.find((f) => f.id === id)]
    const found = layers.filter((f): f is FunctionRow => f !== undefined)
    if (!found.length) return undefined
    const impls: ImplRow[] = []
    const seen = new Set<string>()
    for (const f of found) {
      for (const i of f.impls) {
        const key = `${i.engine}|${i.implRef}|${i.argKinds.join(',')}`
        if (seen.has(key)) continue
        seen.add(key)
        impls.push(i)
      }
    }
    return { ...found[0], impls }
  }
  /** the JS implementation an overlay registered for an impl_ref, if any (ts `extend()`) */
  body(implRef: string): unknown {
    for (const o of this.overlays) { const b = o.bodies.get(implRef); if (b !== undefined) return b }
    return undefined
  }
  /** Is this a CURATED identity at all? A name the catalog has never heard of is not "unsupported" — it is
   *  outside the registry's authority, and pg is free to try it as plain SQL. */
  curated(id: string): boolean { return this.fn(id) !== undefined }

  impls(id: string, engine?: string): ImplRow[] {
    const f = this.fn(id)
    if (!f) return []
    return engine ? f.impls.filter((i) => i.engine === engine) : f.impls
  }

  collection(id: string): CollectionRow | undefined { return this.base.collections.find((c) => c.id === id) }
  /** A composite carrier's layout — what an engine needs to CONSTRUCT one from a `carrier(a, b)` call. */
  carrier(name: string): CarrierRow | undefined { return this.base.carriers.find((c) => c.name === name) }
  grants(engine: string, coll: string | null): string[] { return grantsFor(this.base, engine, coll) }
  foldable(engine: string, coll: string, stat: string): boolean { return isFoldable(this.base, engine, coll, stat) }
  /** The `base_type_operation` row binding `type` to algebra op `op`, if the catalog has one. */
  typeOperation(type: string, op: string): TypeOperationRow | undefined {
    return this.base.typeOperations.find((t) => t.type === type && t.op === op)
  }
  /** The TypeKind of a NAMED pg type — a builtin, a curated algebra type, or a carrier. See catalog-snapshot's
   *  kindOfType for the resolution order. */
  kindOfType(name: string): TypeKind { return kindOfType(this.base, name) }

  /** Resolve an OVERLOAD the way Postgres does: an exact match on argument kinds first, then the candidates each
   *  argument can widen into (int → numeric → float, pg's own numeric-tower direction). Among survivors, an
   *  explicitly requested representation wins, then the cheaper `cost`, then the earlier row — and never a
   *  narrower widening over an exact match, which is the rule that keeps a float64 impl from quietly claiming an
   *  exact-integer call. */
  resolveImpl(id: string, engine: string, args: TypeKind[], representation?: Representation): ImplRow | undefined {
    const cands = this.impls(id, engine).filter((i) => i.argKinds.length === args.length)
    const exact = cands.filter((i) => i.argKinds.every((k, n) => k === args[n]))
    const widened = cands.filter((i) => i.argKinds.every((k, n) => widensTo(args[n], k)))
    const pool = exact.length ? exact : widened
    if (representation) {
      const wanted = pool.filter((i) => i.representation === representation)
      return [...wanted].sort(byCost)[0]
    }
    // Unasked, PREFER THE EXACT REPRESENTATION. This is the rule that makes two impls of one identity safe to
    // carry: binomial has a float64 twin and a bigint twin, and the bigint one is the answer pg would give at any
    // magnitude. Choosing by cost first would trade correctness for speed without anyone asking for that trade.
    const preferred = pool.filter((i) => EXACT.has(i.representation))
    return [...(preferred.length ? preferred : pool)].sort(byCost)[0]
  }
}

/** pg's implicit numeric widening, and nothing else — no text↔number coercions, which is where a permissive
 *  resolver starts inventing answers pg would have rejected. */
const WIDENS: Record<TypeKind, TypeKind[]> = {
  int: ['int', 'numeric', 'float'],
  numeric: ['numeric', 'float'],
  float: ['float'],
  text: ['text'],
  bool: ['bool'],
  composite: ['composite'],
  array: ['array'],
  other: ['other'],
}
const widensTo = (from: TypeKind, to: TypeKind): boolean => WIDENS[from]?.includes(to) ?? false
const byCost = (a: ImplRow, b: ImplRow): number => (a.cost ?? Infinity) - (b.cost ?? Infinity)
/** representations that carry an integer result without loss at ANY magnitude */
const EXACT = new Set<string>(['numeric', 'bigint', 'text'])
/** Is this value faithfully carried by that representation? An exact representation always carries; a float64 one
 *  carries only inside 2^53. Past that the engine has computed something pg would not agree with — factorial(25)
 *  is 1.5511210043330986e25 in float64 and 15511210043330985984000000 in pg — and the honest move is to say so
 *  and let the oracle answer, not to print the near-miss. Only a `number` can be at risk; a bigint or a string
 *  from an exact impl is fine by construction. */
export function carriesExactly(representation: string, v: unknown): boolean {
  if (EXACT.has(representation)) return true
  if (typeof v !== 'number') return true
  return Number.isSafeInteger(v)
}

/** The kind of a JavaScript value, for overload resolution. */
export function kindOfValue(v: unknown): TypeKind {
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'bigint') return 'int'
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float'
  if (typeof v === 'string') return 'text'
  if (typeof v === 'boolean') return 'bool'
  return 'composite'
}

let warned = false
/** The registry, memoized. Never throws: a missing or stale snapshot yields an EMPTY base carrying the reason. */
export function registry(): Promise<Registry> {
  if (!loaded) {
    loaded = (async (): Promise<Registry> => {
      if (!source) return new Registry(EMPTY, 'no catalog source — this entry did not call provideCatalog()')
      let snapshot: CatalogSnapshot | null = null
      let liveHash = ''
      try { ({ snapshot, liveHash } = await source()) } catch { /* fall through to unusable */ }
      let unusable: string | null = null
      if (!snapshot) unusable = 'no catalog snapshot was built for this @enumeratio/data (a source checkout ships none)'
      else if (snapshot.hash !== liveHash) unusable = `the catalog snapshot was built from a different core (${snapshot.hash.slice(0, 8)} vs ${liveHash.slice(0, 8)})`
      if (unusable && !warned) { warned = true; console.warn(`@enumeratio/client: ${unusable} — every expression falls to pg.`) }
      const reg = new Registry(unusable ? EMPTY : snapshot!, unusable)
      onDbExtended(() => reg.markDirty())
      settled = reg
      return reg
    })()
  }
  return loaded
}

let settled: Registry | null = null
/** The registry IF it has already loaded — for a synchronous `can()`. Null before `registry()` has resolved,
 *  which the façade prevents by awaiting `Engine.ready()` first. */
export function registrySync(): Registry | null { return settled }

/** Drop the memoized registry — a test that re-wires the catalog, or a consumer swapping databases. */
export function resetRegistry(): void { loaded = null; settled = null }
