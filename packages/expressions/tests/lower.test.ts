import { describe, expect, it } from 'vitest'
import { makeParser } from '../src/ce/latex.js'
import { bind } from '../src/bind.js'
import { lower } from '../src/lower.js'
import type { Catalog, CollectionInfo, FunctionInfo, MapInfo, Scope, StatInfo, TypeOpInfo } from '../src/types.js'

const COLLECTIONS: Record<string, CollectionInfo> = {
  triangular_numbers: { id: 'triangular_numbers', carrier: 'numeric', unbounded: true, params: [] },
}
const FUNCTIONS: Record<string, FunctionInfo> = { binomial: { id: 'binomial', arity: 2 } }
const catalog: Catalog = {
  collection: (id) => COLLECTIONS[id],
  fn: (id) => FUNCTIONS[id],
  statsOf: (): StatInfo[] => [],
  mapsOf: (): MapInfo[] => [],
  typeOps: (): TypeOpInfo[] => [],
  builtin: () => undefined,
}
const parser = makeParser({ collections: ['triangular_numbers'], functions: ['next', 'rank', 'binomial'] })

const handle = { coll: 'triangular_numbers', named: {}, positional: [] }
const xElem = { kind: 'apply', fn: 'unrank', args: [{ kind: 'handle', handle }, { kind: 'lit', value: 4 }] }

describe('lower: x re-embedded as ValueRef{elem, rank 4}', () => {
  // x : elem(triangular_numbers), already located at rank 4 by an earlier line — this is the SHAPE that earlier
  // line's own `lower()` (wants:'locate') would have produced the rank/value pair for; here we seed it directly.
  const scope: Scope = new Map([
    ['x', { k: 'var', type: { k: 'elem', coll: 'triangular_numbers', carrier: 'numeric' },
            value: { k: 'elem', coll: 'triangular_numbers', rank: 4 } }],
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
