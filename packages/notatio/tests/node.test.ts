import { describe, expect, it } from 'vitest'
import { makeParser } from '../src/ce/latex.js'
import { normalize, toExpression, symbolsIn, type Node } from '../src/node.js'
import type { Expression } from '../src/ast.js'

const parser = makeParser({ collections: ['permutations'], functions: ['Fibonacci', 'CatalanNumber'] })
// the AST of a whole line, from its parsed statement body
const ast = (latex: string): Node => {
  const p = parser.parse(latex)
  const body: Expression =
    p.stmt.k === 'expr' ? p.stmt.body : p.stmt.k === 'define' ? p.stmt.body : p.stmt.domain
  return normalize(body)
}

describe('normalize: CE MathJSON → the closed Notatio node tree', () => {
  it.each<[string, Node]>([
    ['5', { kind: 'num', value: 5 }],
    ['x', { kind: 'sym', name: 'x' }],
    ['ab', { kind: 'sym', name: 'ab' }],                                   // a compound identifier is one sym
    ['\\pi', { kind: 'const', name: 'Pi' }],                              // a constant, not a plain sym
    ['\\varphi', { kind: 'const', name: 'GoldenRatio' }],
    ['x + 1', { kind: 'apply', head: 'Add', args: [{ kind: 'sym', name: 'x' }, { kind: 'num', value: 1 }] }],
    ['Fibonacci(10)', { kind: 'apply', head: 'Fibonacci', args: [{ kind: 'num', value: 10 }] }],
    ['2\\pi', { kind: 'apply', head: 'InvisibleOperator', args: [{ kind: 'num', value: 2 }, { kind: 'const', name: 'Pi' }] }],
  ])('%s', (latex, expected) => {
    expect(ast(latex)).toEqual(expected)
  })
})

describe('normalize/toExpression round-trip', () => {
  it.each(['5', 'x', '\\pi', 'x + 1', 'Fibonacci(10)', '\\gcd(12,18)', '\\sqrt{9}', '[1, 2, 3]', '2\\pi + 1'])(
    '%s survives normalize → toExpression → normalize',
    (latex) => {
      const body = parser.parse(latex).stmt
      const expr: Expression = body.k === 'expr' ? body.body : body.k === 'define' ? body.body : (body as { domain: Expression }).domain
      const n = normalize(expr)
      expect(normalize(toExpression(n))).toEqual(n)
    },
  )
})

describe('symbolsIn', () => {
  it('collects bare symbols, not constants or heads', () => {
    expect(symbolsIn(ast('x + y \\cdot \\pi'))).toEqual(new Set(['x', 'y']))
  })
})
