import { describe, it, expect } from 'vitest'
import { computeEngineEnumerator } from '../src/compute-engine-enumerator'
import { fnRef, type Expr, type SelectExpr, type HandleExpr } from '../src/ir'
import { Registry, type CatalogSnapshot, type CollectionRow } from '../src/registry'

// Pure-CE enumeration: the notebook's handle-primitives (unrank/locate/rank/next/cardinality) answered entirely by
// @enumeratio/compute-engine's CollectionHandlers on the shared CE instance — no pg, no Db provided. The registry
// carries only the catalog-owned twin fact (`base_compute_engine_twin`) for the snake_case ids these tests use;
// Pascal-head cases (SymmetricGroup, DyckPaths, KSubsets, …) resolve via compute-engine-enumerator's own LIBRARY_TWIN
// regardless of what the registry knows.

const collRow = (id: string, computeEngineTwin: CollectionRow['computeEngineTwin']): CollectionRow => ({
  id, carrier: null, grades: [], unbounded: false, aliasOf: null, category: 'mathematical', tags: [],
  hooks: { fiberCount: false, fiberUnrank: false, fiberElements: false, containsInFiber: false },
  computeEngineTwin,
})

const snapshot: CatalogSnapshot = {
  hash: '', builtAt: '', functions: [], carriers: [], engines: [], columnGroups: [], grants: [], foldable: [],
  typeOperations: [],
  collections: [
    collRow('permutations', { head: 'SymmetricGroup', arity: 1 }),
    collRow('dyck_paths', { head: 'DyckPaths', arity: 1 }),
    collRow('triangular_numbers', null),
  ],
}

const reg = new Registry(snapshot, null)
const engine = computeEngineEnumerator(reg)
const handle = (coll: string, ...positional: number[]): SelectExpr => ({
  kind: 'handle', handle: { coll, named: {}, positional } as HandleExpr,
})
const ap = (fn: string, ...args: SelectExpr[]): SelectExpr => ({ kind: 'apply', fn: fnRef(fn), args })
const lit = (value: number | number[]): SelectExpr => ({ kind: 'lit', value })

async function one(col: SelectExpr): Promise<string> {
  const expr: Expr = { select: [col] }
  const { rows } = engine.evaluate(expr)
  for await (const r of rows) return String(Object.values(r)[0])
  throw new Error('no row')
}

describe('computeEngineEnumerator — pure-CE enumeration over library CollectionHandlers', () => {
  it('unrank = At(coll, r+1), 0-based in / 1-based out', async () => {
    expect(await one(ap('unrank', handle('SymmetricGroup', 4), lit(0)))).toBe('[1,2,3,4]') // identity
    expect(await one(ap('unrank', handle('SymmetricGroup', 4), lit(23)))).toBe('[4,3,2,1]') // last, 24=4!
  })

  it('cardinality = Length(coll), the closed-form count', async () => {
    expect(await one(ap('cardinality', handle('SymmetricGroup', 5)))).toBe('120')
    expect(await one(ap('cardinality', handle('DyckPaths', 4)))).toBe('14') // Catalan C(4)
  })

  it('rank ∘ unrank = id (0-based round-trip through CE)', async () => {
    expect(await one(ap('rank', ap('unrank', handle('SymmetricGroup', 4), lit(5))))).toBe('5')
  })

  it('locate: rank(locate(handle, v)) is the 0-based rank of a member, empty for a non-member', async () => {
    expect(await one(ap('rank', ap('locate', handle('SymmetricGroup', 4), lit([1, 3, 2, 4]))))).toBe('2')
    expect(await one(ap('rank', ap('locate', handle('SymmetricGroup', 4), lit([1, 1, 2, 4]))))).toBe('') // not a member
  })

  it('cast(locate(handle, v)) re-emits the located value itself', async () => {
    const col: SelectExpr = { kind: 'cast', expr: ap('locate', handle('SymmetricGroup', 4), lit([1, 3, 2, 4])), to: 'permutation' }
    expect(await one(col)).toBe('[1,3,2,4]')
  })

  it('next/prev step the rank', async () => {
    expect(await one(ap('next', ap('unrank', handle('SymmetricGroup', 4), lit(0))))).toBe('[1,2,4,3]') // rank 1
    expect(await one(ap('prev', ap('unrank', handle('SymmetricGroup', 4), lit(23))))).toBe('[4,3,1,2]') // rank 22
  })

  it('snake_case catalog ids alias onto the same CE heads', async () => {
    expect(await one(ap('cardinality', handle('permutations', 5)))).toBe('120')
    expect(await one(ap('unrank', handle('dyck_paths', 3), lit(0)))).toBe(await one(ap('unrank', handle('DyckPaths', 3), lit(0))))
  })

  it('a 2-arg family binds both params', async () => {
    expect(await one(ap('cardinality', handle('KSubsets', 5, 2)))).toBe('10') // C(5,2)
  })

  it('can(): claims enumeration trees, declines FROM row-queries, pure scalars, and untwinned collections', () => {
    expect(engine.can({ select: [ap('unrank', handle('SymmetricGroup', 4), lit(0))] })).toBe(true)
    expect(engine.can({ select: [lit(5)] })).toBe(false) // pure scalar → ce/ts
    expect(engine.can({ select: [ap('cardinality', handle('triangular_numbers', 4))] })).toBe(false) // no CE twin
    expect(engine.can({ select: [handle('SymmetricGroup', 4)], from: { from: { coll: 'x', named: {}, positional: [] } } as any })).toBe(false)
  })
})
