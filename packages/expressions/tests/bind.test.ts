import { describe, expect, it } from 'vitest'
import { makeParser } from '../src/ce/latex.js'
import { bind } from '../src/bind.js'
import type { Catalog, CollectionInfo, FunctionInfo, MapInfo, Scope, StatInfo, TypeOpInfo } from '../src/types.js'

const COLLECTIONS: Record<string, CollectionInfo> = {
  triangular_numbers: { id: 'triangular_numbers', carrier: 'numeric', unbounded: true, params: [] },
  permutations: { id: 'permutations', carrier: 'permutation', unbounded: false, params: ['size'] },
  natural_numbers: { id: 'natural_numbers', carrier: 'natural_number', unbounded: true, params: [] },
}
const FUNCTIONS: Record<string, FunctionInfo> = {
  binomial: { id: 'binomial', arity: 2 },
  factorial: { id: 'factorial', arity: 1 },
  gcd: { id: 'gcd', arity: 2 },
}
const STATS: Record<string, StatInfo[]> = {
  permutations: [{ id: 'inversions', codomain: null }, { id: 'descents', codomain: null }],
}
const TYPE_OPS: Record<string, TypeOpInfo[]> = {
  rational_number: [
    { op: 'add', implFn: 'rational_add' }, { op: 'mul', implFn: 'rational_mul' },
    { op: 'neg', implFn: 'rational_neg' }, { op: 'recip', implFn: 'reciprocal' }, { op: 'le', implFn: 'rational_le' },
  ],
}

const catalog: Catalog = {
  collection: (id) => COLLECTIONS[id],
  fn: (id) => FUNCTIONS[id],
  statsOf: (coll) => STATS[coll] ?? [],
  mapsOf: (): MapInfo[] => [],
  typeOps: (type) => TYPE_OPS[type] ?? [],
  builtin: () => undefined,
}

const parser = makeParser({
  collections: ['triangular_numbers', 'permutations'],
  functions: ['next', 'prev', 'rank', 'inversions', 'binomial', 'factorial', 'gcd'],
})

describe('bind: a notebook session', () => {
  it('declares, uses, and re-uses x across lines', () => {
    const scope: Scope = new Map()

    const declare = bind(parser.parse('x \\in \\operatorname{triangular\\_numbers}'), scope, catalog)
    expect(declare.stmt.k).toBe('declare')
    expect(declare.type).toEqual({ k: 'elem', coll: 'triangular_numbers', carrier: 'numeric' })
    expect(declare.errors).toEqual([])

    const add = bind(parser.parse('x + 1'), scope, catalog)
    expect(add.stmt.k).toBe('expr')
    expect(add.type).toEqual({ k: 'scalar', pg: 'numeric' })
    expect(add.deps).toEqual(new Set(['x']))
    expect(add.errors).toEqual([])

    const next = bind(parser.parse('\\operatorname{next}(x)'), scope, catalog)
    expect(next.type).toEqual({ k: 'elem', coll: 'triangular_numbers', carrier: 'numeric' })

    const rank = bind(parser.parse('\\operatorname{rank}(x)'), scope, catalog)
    expect(rank.type).toEqual({ k: 'scalar', pg: 'natural_number' })

    const binom = bind(parser.parse('\\binom{6}{2} - x'), scope, catalog)
    expect(binom.type).toEqual({ k: 'scalar', pg: 'numeric' })
    expect(binom.errors).toEqual([])

    const cmp = bind(parser.parse('x \\le 5'), scope, catalog)
    expect(cmp.type).toEqual({ k: 'scalar', pg: 'boolean' })
    expect(cmp.errors).toEqual([])
  })

  it('a stat of a pre-bound permutation element types numeric', () => {
    const scope: Scope = new Map([
      ['p', { k: 'var', type: { k: 'elem', coll: 'permutations', carrier: 'permutation' } }],
    ])
    const bound = bind(parser.parse('\\operatorname{inversions}(p)'), scope, catalog)
    expect(bound.type).toEqual({ k: 'scalar', pg: 'numeric' })
    expect(bound.errors).toEqual([])
    expect(bound.deps).toEqual(new Set(['p']))
  })

  it('an unbound symbol errors with a path resolvable to its source span', () => {
    const parsed = parser.parse('y')
    const bound = bind(parsed, new Map(), catalog)
    expect(bound.type).toEqual({ k: 'unknown' })
    expect(bound.errors).toHaveLength(1)
    expect(bound.errors[0].message).toMatch(/unknown symbol "y"/)
    expect(bound.errors[0].path).toBe('')
    expect(bound.errors[0].span).toEqual([0, 1])
  })

  it('a user function defines as fn, and beta-reduces on call', () => {
    const scope: Scope = new Map()

    const def = bind(parser.parse('f(n) = n^2 + 1'), scope, catalog)
    expect(def.stmt.k).toBe('define')
    expect(def.type.k).toBe('fn')
    if (def.type.k === 'fn') expect(def.type.params).toEqual(['n'])
    expect(def.errors).toEqual([])

    const call = bind(parser.parse('f(3)'), scope, catalog)
    expect(call.type).toEqual({ k: 'scalar', pg: 'numeric' })
    expect(call.errors).toEqual([])
  })

  it('a non-symbol Element (buried in an expr, not a declare) types as boolean membership', () => {
    const bound = bind(parser.parse('3 \\in \\operatorname{triangular\\_numbers}'), new Map(), catalog)
    expect(bound.stmt.k).toBe('expr')
    expect(bound.type).toEqual({ k: 'scalar', pg: 'boolean' })
    expect(bound.errors).toEqual([])
  })
})

describe('bind: errors', () => {
  it('a heads with no curated base_function id (Sqrt, Floor, …) reports "unknown operator" naming the head', () => {
    const bound = bind(parser.parse('\\sqrt{9}'), new Map(), catalog)
    expect(bound.errors).toHaveLength(1)
    expect(bound.errors[0].message).toMatch(/Sqrt/)
  })

  it('mismatched arity against a curated function reports the expected count', () => {
    const bound = bind(parser.parse('\\operatorname{binomial}(6,2,1)'), new Map(), catalog)
    expect(bound.errors.some((e) => /binomial expects 2/.test(e.message))).toBe(true)
  })
})
