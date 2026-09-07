import { describe, expect, it } from 'vitest'
import { makeParser } from '../src/ce/latex.js'
import { bind } from '../src/bind.js'
import { lower } from '../src/lower.js'
import type { Catalog, CollectionInfo, FunctionInfo, MapInfo, Scope, StatInfo, TypeOpInfo } from '../src/types.js'

const COLLECTIONS: Record<string, CollectionInfo> = {
  triangular_numbers: { id: 'triangular_numbers', carrier: 'numeric', unbounded: true, params: [] },
  permutations: { id: 'permutations', carrier: 'permutation', unbounded: false, params: ['size'] },
}
const FUNCTIONS: Record<string, FunctionInfo> = { binomial: { id: 'binomial', arity: 2 } }
const STATS: Record<string, StatInfo[]> = {
  permutations: [{ id: 'inversions', codomain: null }],
}
const catalog: Catalog = {
  collection: (id) => COLLECTIONS[id],
  fn: (id) => FUNCTIONS[id],
  statsOf: (coll) => STATS[coll] ?? [],
  mapsOf: (): MapInfo[] => [],
  typeOps: (): TypeOpInfo[] => [],
  builtin: () => undefined,
}
const parser = makeParser({
  collections: ['triangular_numbers', 'permutations'],
  functions: ['next', 'rank', 'binomial', 'inversions'],
})

const handle = { coll: 'triangular_numbers', named: {}, positional: [] }
const xElem = { kind: 'apply', fn: 'unrank', args: [{ kind: 'handle', handle }, { kind: 'lit', value: 4 }] }

describe('lower: x re-embedded as ValueRef{elem, rank 4}', () => {
  // x : elem(triangular_numbers), already located at rank 4 by an earlier line — this is the SHAPE that earlier
  // line's own `lower()` (wants:'locate') would have produced the rank/value pair for; here we seed it directly.
  const scope: Scope = new Map([
    ['x', { k: 'var', type: { k: 'elem', coll: 'triangular_numbers', carrier: 'numeric', handle },
            value: { k: 'elem', coll: 'triangular_numbers', handle, rank: 4 } }],
  ])

  it('x + 1 → cast(unrank(x), numeric) + 1', () => {
    const bound = bind(parser.parse('x + 1'), scope, catalog)
    const result = lower(bound, scope)
    expect(result).toEqual({
      wants: 'value',
      expr: { select: [{
        kind: 'op', op: 'add', type: 'numeric',
        args: [{ kind: 'cast', expr: xElem, to: 'numeric' }, { kind: 'lit', value: 1 }],
      }] },
    })
  })

  it('binomial(6,2) - x → sub(apply(binomial, [6, 2]), cast(unrank(x), numeric))', () => {
    const bound = bind(parser.parse('\\binom{6}{2} - x'), scope, catalog)
    const result = lower(bound, scope)
    expect(result).toEqual({
      wants: 'value',
      expr: { select: [{
        kind: 'op', op: 'sub', type: 'numeric',
        args: [
          { kind: 'apply', fn: 'binomial', args: [{ kind: 'lit', value: 6 }, { kind: 'lit', value: 2 }] },
          { kind: 'cast', expr: xElem, to: 'numeric' },
        ],
      }] },
    })
  })
})

describe('lower: define-of-declared-elem wants a locate, not a value', () => {
  it('x = 10 (after x ∈ triangular_numbers) → two columns: rank(locate(...)), cast(locate(...), numeric)', () => {
    const scope: Scope = new Map()
    bind(parser.parse('x \\in \\operatorname{triangular\\_numbers}'), scope, catalog)
    const bound = bind(parser.parse('x = 10'), scope, catalog)
    const result = lower(bound, scope)
    const locateCall = { kind: 'apply', fn: 'locate', args: [{ kind: 'handle', handle }, { kind: 'lit', value: 10 }] }
    expect(result).toEqual({
      wants: 'locate',
      expr: { select: [
        { kind: 'apply', fn: 'rank', args: [locateCall] },
        { kind: 'cast', expr: locateCall, to: 'numeric' },
      ] },
    })
  })
})

describe('lower: user function call beta-reduces before lowering', () => {
  it('f(3), f(n) = n^2 + 1 → op(add, numeric, [op(pow, numeric, [3, 2]), 1])', () => {
    const scope: Scope = new Map()
    bind(parser.parse('f(n) = n^2 + 1'), scope, catalog)
    const bound = bind(parser.parse('f(3)'), scope, catalog)
    const result = lower(bound, scope)
    expect(result).toEqual({
      wants: 'value',
      expr: { select: [{
        kind: 'op', op: 'add', type: 'numeric',
        args: [
          { kind: 'op', op: 'pow', type: 'numeric', args: [{ kind: 'lit', value: 3 }, { kind: 'lit', value: 2 }] },
          { kind: 'lit', value: 1 },
        ],
      }] },
    })
  })
})

describe('lower: p re-embedded as ValueRef{elem, rank 5} carries the construction handle', () => {
  // p : elem(permutations(4)), already located at rank 5 — the handle carries the `(4)` construction arg, so
  // re-embedding p must lower to unrank against THAT handle, not the bare unparameterized `permutations` handle.
  const permsHandle = { coll: 'permutations', named: {}, positional: [4] }
  const scope: Scope = new Map([
    ['p', { k: 'var', type: { k: 'elem', coll: 'permutations', carrier: 'permutation', handle: permsHandle },
            value: { k: 'elem', coll: 'permutations', handle: permsHandle, rank: 5 } }],
  ])
  const pElem = { kind: 'apply', fn: 'unrank', args: [{ kind: 'handle', handle: permsHandle }, { kind: 'lit', value: 5 }] }

  it('\\operatorname{inversions}(p) → apply(inversions, [cast(unrank(handle{positional:[4]}, 5), permutation)])', () => {
    const bound = bind(parser.parse('\\operatorname{inversions}(p)'), scope, catalog)
    const result = lower(bound, scope)
    expect(result).toEqual({
      wants: 'value',
      expr: { select: [{ kind: 'apply', fn: 'inversions', args: [{ kind: 'cast', expr: pElem, to: 'permutation' }] }] },
    })
  })

  it('3 \\in \\operatorname{permutations}(4) keeps the handle (positional [4]) in the contains call', () => {
    const bound = bind(parser.parse('3 \\in \\operatorname{permutations}(4)'), new Map(), catalog)
    const result = lower(bound, new Map())
    expect(result).toEqual({
      wants: 'value',
      expr: { select: [{
        kind: 'apply', fn: 'contains',
        args: [{ kind: 'handle', handle: permsHandle }, { kind: 'lit', value: 3 }],
      }] },
    })
  })
})

describe('lower: a bare declare or fn define needs no evaluation', () => {
  it('a declare wants none', () => {
    const scope: Scope = new Map()
    const bound = bind(parser.parse('y \\in \\operatorname{triangular\\_numbers}'), scope, catalog)
    expect(lower(bound, scope)).toEqual({ wants: 'none' })
  })

  it('a fn define wants none', () => {
    const scope: Scope = new Map()
    const bound = bind(parser.parse('g(n) = n + 1'), scope, catalog)
    expect(lower(bound, scope)).toEqual({ wants: 'none' })
  })
})

describe('lower: shapes the compute-engine oracle differential first caught', () => {
  const scope: Scope = new Map()
  it('(3+4) \\times 2 — a bare parenthesized operand is transparent', () => {
    const bound = bind(parser.parse('(3+4) \\times 2'), scope, catalog)
    expect(bound.errors).toEqual([])
    expect(lower(bound, scope).expr).toEqual({ select: [
      { kind: 'op', op: 'mul', type: 'natural_number', args: [
        { kind: 'op', op: 'add', type: 'natural_number', args: [{ kind: 'lit', value: 3 }, { kind: 'lit', value: 4 }] },
        { kind: 'lit', value: 2 },
      ] },
    ] })
  })
  it('2 \\times 2 \\times 2 \\times 2 — an n-ary Multiply folds left into binary ops', () => {
    const bound = bind(parser.parse('2 \\times 2 \\times 2 \\times 2'), scope, catalog)
    expect(bound.errors).toEqual([])
    const two = { kind: 'lit', value: 2 }
    const mul = (a: unknown, b: unknown) => ({ kind: 'op', op: 'mul', type: 'natural_number', args: [a, b] })
    expect(lower(bound, scope).expr).toEqual({ select: [mul(mul(mul(two, two), two), two)] })
  })
})
