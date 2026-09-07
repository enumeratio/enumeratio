import { describe, expect, it } from 'vitest'
import { complete } from '../src/complete.js'
import type { CompletionContext } from '../src/complete.js'

const catalog = {
  collections: ['triangular_numbers'],
  functions: ['binomial'],
  stats: (coll: string) => (coll === 'permutations' ? ['inversions'] : []),
  maps: (_coll: string) => [],
}

function ctx(symbols: string[], elemOf?: (sym: string) => string | undefined): CompletionContext {
  return { catalog, scope: { symbols, elemOf } }
}

describe('complete', () => {
  it('x \\in tri -> collection candidates, triangular_numbers first', () => {
    const res = complete('x \\in tri', ctx([]))
    expect(res.replaceLen).toBe(3)
    expect(res.candidates[0]).toMatchObject({
      label: 'triangular_numbers',
      insert: '\\operatorname{triangular\\_numbers}',
      kind: 'collection',
    })
  })

  it('x \\in \\operatorname{tri -> replaceLen spans the whole \\operatorname{tri run', () => {
    const before = 'x \\in \\operatorname{tri'
    const res = complete(before, ctx([]))
    expect(res.replaceLen).toBe('\\operatorname{tri'.length)
    expect(res.candidates[0]).toMatchObject({ label: 'triangular_numbers' })
  })

  it('inv with x an element of permutations -> stat candidate inversions(x)', () => {
    const res = complete('inv', ctx(['x'], (s) => (s === 'x' ? 'permutations' : undefined)))
    const cand = res.candidates.find((c) => c.kind === 'stat')
    expect(cand).toMatchObject({ label: 'inversions(x)', insert: '\\operatorname{inversions}(x)', kind: 'stat' })
  })

  it('bin -> binomial function candidate with a trailing open paren', () => {
    const res = complete('bin', ctx([]))
    expect(res.candidates[0]).toMatchObject({ label: 'binomial', kind: 'function' })
    expect(res.candidates[0].insert).toBe('\\operatorname{binomial}(')
  })

  it('\\bi -> \\binom command candidate', () => {
    const res = complete('\\bi', ctx([]))
    expect(res.candidates.some((c) => c.kind === 'command' && c.insert === '\\binom')).toBe(true)
  })

  it('2+ -> no candidates', () => {
    const res = complete('2+', ctx([]))
    expect(res.candidates).toEqual([])
  })

  it('bare n with scope symbols [n, m] -> symbol candidate n (not m)', () => {
    const res = complete('n', ctx(['n', 'm']))
    expect(res.candidates.some((c) => c.kind === 'symbol' && c.label === 'n')).toBe(true)
    expect(res.candidates.some((c) => c.kind === 'symbol' && c.label === 'm')).toBe(false)
  })
})
