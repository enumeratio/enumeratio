import { describe, expect, it } from 'vitest'
import { makeParser } from '../src/ce/latex.js'
import { LineGraph } from '../src/graph.js'

const parser = makeParser({ collections: ['triangular_numbers'], functions: [] })

describe('LineGraph', () => {
  it('orders lines topologically by symbol dependency, independent of insertion order', () => {
    const g = new LineGraph()
    g.set('z', 'z = y * 2', parser)
    g.set('y', 'y = x + 1', parser)
    g.set('x', 'x \\in \\operatorname{triangular\\_numbers}', parser)
    expect(g.order()).toEqual(['x', 'y', 'z'])
  })

  it('dirtyAfter reports transitive dependents (incl. itself) in topo order', () => {
    const g = new LineGraph()
    g.set('x', 'x \\in \\operatorname{triangular\\_numbers}', parser)
    g.set('y', 'y = x + 1', parser)
    g.set('z', 'z = y * 2', parser)
    expect(g.dirtyAfter('x')).toEqual(new Set(['x', 'y', 'z']))
  })

  it('a second definer of the same symbol marks both lines "defined twice"', () => {
    const g = new LineGraph()
    g.set('y1', 'y = 5', parser)
    g.set('y2', 'y = 5', parser)
    const errs = new Map(g.lines().map((l) => [l.id, l.errors]))
    expect(errs.get('y1')).toEqual(['y defined twice'])
    expect(errs.get('y2')).toEqual(['y defined twice'])
    expect(g.definers().has('y')).toBe(false)
  })

  it('a cycle between two defines marks both lines with the same cyclic-dependency trail', () => {
    const g = new LineGraph()
    g.set('a', 'a = b', parser)
    g.set('b', 'b = a', parser)
    for (const line of g.lines()) {
      expect(line.errors).toEqual(['cyclic dependency: a → b → a'])
    }
  })

  it('a define with params excludes those params from deps', () => {
    const g = new LineGraph()
    g.set('f', 'f(n) = n^2', parser)
    const [line] = g.lines()
    expect(line.defines).toBe('f')
    expect(line.deps).toEqual(new Set())
  })

  it('an unresolved symbol is not a graph error, and the line still orders fine', () => {
    const g = new LineGraph()
    g.set('w', 'w = q', parser)
    expect(g.order()).toEqual(['w'])
    expect(g.lines()[0].errors).toEqual([])
  })
})
