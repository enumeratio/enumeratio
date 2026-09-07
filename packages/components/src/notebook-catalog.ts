// Builds the @enumeratio/expressions `Catalog` (bind.ts's type-checking seam) + `CatalogNames` (the LaTeX parser's
// dictionary) + a completion catalog, all from live @enumeratio/client reads — no raw SQL, no provideDb() call of
// its own (the docs wire the Db globally; this module only ever reads through the client's async API surface).
//
// Cached module-level (one Promise, built once per page load) — a notebook set calls loadNotebookCatalog() on
// connect and awaits it; every set instance on the page shares the same catalog snapshot.
import {
  aliases, carriers, collectionParams, collections, construct,
  type MapInfo as ClientMapInfo, type Stat as ClientStat,
} from '@enumeratio/client'
import { registry } from '@enumeratio/client'
import {
  BUILTIN_SYMBOLS,
  type Binding, type Catalog, type CollectionInfo, type FunctionInfo, type MapInfo, type StatInfo, type TypeOpInfo,
} from '@enumeratio/expressions'
import type { CatalogNames } from '@enumeratio/expressions'
import type { CompletionContext } from '@enumeratio/expressions'

/** Generic engine primitives dispatched by head name (bind.ts's NEXT_PREV_RANK plus the handle-level ones) — not
 *  per-collection, so these are known up front rather than discovered lazily like stats/maps. */
const GENERIC_PRIMITIVES = ['next', 'prev', 'rank', 'locate', 'unrank', 'random_element'] as const

export type NotebookCatalog = {
  catalog: Catalog
  names: CatalogNames
  completion: CompletionContext['catalog']
  /** Kick off (or reuse) the stats()/maps() fetch for `coll` — call this when a symbol becomes an `elem(coll)`
   *  (e.g. right after a `declare` binds). The FIRST bind after that declare may still see empty statsOf/mapsOf
   *  (the sync cache is empty until this resolves) — the caller should await this, then re-run bind() for lines
   *  that read the new symbol's stats/maps. */
  prefetch(coll: string): Promise<void>
}

let cached: Promise<NotebookCatalog> | null = null

export function loadNotebookCatalog(): Promise<NotebookCatalog> {
  // a failed build (no Db yet, a transient query error) is dropped from the cache so the next caller retries
  return (cached ??= build().catch((e: unknown) => { cached = null; throw e }))
}

/** Test/dev escape hatch — force a fresh build (e.g. after swapping the provided Db). */
export function resetNotebookCatalog(): void {
  cached = null
}

async function build(): Promise<NotebookCatalog> {
  const [collIds, aliasMapObj, carrierMap, paramMap, reg] = await Promise.all([
    collections(), aliases(), carriers(), collectionParams(), registry(),
  ])
  const aliasMap = new Map(Object.entries(aliasMapObj))
  const collRowById = new Map(reg.base.collections.map((c) => [c.id, c]))

  const collectionInfo = (canonical: string): CollectionInfo | undefined => {
    const row = collRowById.get(canonical)
    const carrier = row?.carrier ?? carrierMap[canonical]
    if (!carrier) return undefined
    return {
      id: canonical,
      carrier,
      // `row.unbounded` is authoritative when the snapshot is live; a stale/missing snapshot degrades to `false`
      // (bounded) rather than guessing infinite — flagged, not silently assumed correct.
      unbounded: row?.unbounded ?? false,
      params: paramMap[canonical] ?? [],
    }
  }

  const fnRowById = new Map(reg.base.functions.map((f) => [f.id, f]))
  const typeOpsByType = new Map<string, TypeOpInfo[]>()
  for (const t of reg.base.typeOperations) {
    const arr = typeOpsByType.get(t.type) ?? []
    arr.push({ op: t.op, implFn: t.implFn })
    typeOpsByType.set(t.type, arr)
  }

  // ── lazy per-collection stats/maps: a sync cache the Catalog interface reads, filled by an async prefetch ──────
  const statsCache = new Map<string, StatInfo[]>()
  const mapsCache = new Map<string, MapInfo[]>()
  const pending = new Map<string, Promise<void>>()

  const prefetch = (coll: string): Promise<void> => {
    let p = pending.get(coll)
    if (!p) {
      p = Promise.all([construct(coll).stats(), construct(coll).maps()])
        .then(([stats, maps]: [ClientStat[], ClientMapInfo[]]) => {
          statsCache.set(coll, stats.map((s) => ({ id: s.statId, codomain: s.codomain })))
          mapsCache.set(coll, maps.map((m) => ({ id: m.id, codomain: m.codomain })))
        })
        .catch(() => {
          // an unknown/misnamed collection — leave the cache empty rather than wedging future prefetches of it
          statsCache.set(coll, [])
          mapsCache.set(coll, [])
        })
      pending.set(coll, p)
    }
    return p
  }
  const statsOf = (coll: string): StatInfo[] => {
    const cached = statsCache.get(coll)
    if (cached) return cached
    void prefetch(coll)
    return []
  }
  const mapsOf = (coll: string): MapInfo[] => {
    const cached = mapsCache.get(coll)
    if (cached) return cached
    void prefetch(coll)
    return []
  }

  const catalog: Catalog = {
    collection(id: string): CollectionInfo | undefined {
      const canonical = aliasMap.get(id) ?? id
      const info = collectionInfo(canonical)
      if (!info) return undefined
      return aliasMap.has(id) ? { ...info, aliasOf: canonical } : info
    },
    fn(id: string): FunctionInfo | undefined {
      if (GENERIC_PRIMITIVES.includes(id as (typeof GENERIC_PRIMITIVES)[number])) return { id, arity: 1 }
      const row = fnRowById.get(id)
      if (!row) return undefined
      const arity = row.impls[0]?.argTypes.length
      return { id, arity }
    },
    statsOf,
    mapsOf,
    typeOps(type: string): TypeOpInfo[] {
      return typeOpsByType.get(type) ?? []
    },
    builtin(name: string): Binding | undefined {
      const b = BUILTIN_SYMBOLS[name]
      if (b?.k === 'collection') return { k: 'collection', coll: b.coll }
      return undefined
    },
  }

  // `\mathbb{N}`/`\mathbb{Z}`/`\mathbb{Q}` -> the canonical numeric-set collection ids, only when the catalog
  // actually has them (a small pack-less catalog might not realize rational_numbers, say).
  const symbols: Record<string, string> = {}
  const collSet = new Set(collIds)
  if (collSet.has('natural_numbers')) symbols['\\mathbb{N}'] = 'natural_numbers'
  if (collSet.has('integer_numbers')) symbols['\\mathbb{Z}'] = 'integer_numbers'
  if (collSet.has('rational_numbers')) symbols['\\mathbb{Q}'] = 'rational_numbers'

  const functionIds = [
    ...new Set([...reg.base.functions.map((f) => f.id), ...GENERIC_PRIMITIVES]),
  ]

  const names: CatalogNames = { collections: collIds, functions: functionIds, symbols }

  const completion: CompletionContext['catalog'] = {
    collections: names.collections,
    functions: names.functions,
    symbols: names.symbols,
    stats: (coll: string) => statsOf(coll).map((s) => s.id),
    maps: (coll: string) => mapsOf(coll).map((m) => m.id),
  }

  return { catalog, names, completion, prefetch }
}
