import { describe, expect, it } from 'vitest'
import { makeParser } from '../src/ce/latex.js'
import { toCalcText, toLatex, toMathJsonString } from '../src/format.js'
import { freeSymbols, spanAt } from '../src/ast.js'
import type { Expression } from '../src/ast.js'

const parser = makeParser({
  collections: ['triangular_numbers'],
  functions: ['next'],
  symbols: { '\\mathbb{N}': 'natural_numbers' },
})

/** The MathJSON of the top-level payload — `body` for `expr`/`define`, `["Element", name, domain]` for
 *  `declare` — as stable JSON, sidestepping the boxed-leaf span carriers entirely (see ce/latex.ts). */
function shape(latex: string): { kind: string; json: string } {
  const parsed = parser.parse(latex)
  const { stmt } = parsed
  if (stmt.k === 'declare') return { kind: stmt.k, json: toMathJsonString(['Element', stmt.name, stmt.domain] as Expression) }
  if (stmt.k === 'define') {
    const withParams: Expression = stmt.params ? [stmt.name, stmt.params as unknown as Expression, stmt.body] : [stmt.name, stmt.body]
    return { kind: stmt.k, json: toMathJsonString(withParams) }
  }
  return { kind: stmt.k, json: toMathJsonString(stmt.body) }
}

describe('parse: MathJSON shape + statement kind', () => {
  it.each([
    ['\\binom{6}{2} - x', 'expr', '["Subtract",["Binomial",6,2],"x"]'],
    ['\\operatorname{next}(x)', 'expr', '["next","x"]'],
    ['\\gcd(4,6)', 'expr', '["GCD",4,6]'],
    ['x!', 'expr', '["Factorial","x"]'],
    ['\\frac{1}{2}', 'expr', '["Divide",1,2]'],
    ['\\sqrt[3]{8}', 'expr', '["Root",8,3]'],
    ['\\lfloor x \\rfloor', 'expr', '["Floor","x"]'],
    ['|x|', 'expr', '["Abs","x"]'],
    ['x \\le 5', 'expr', '["LessEqual","x",5]'],
    ['\\{1,2\\} \\cup \\{3\\}', 'expr', '["Union",["Set",1,2],["Set",3]]'],
    ['\\sum_{i=1}^{n} i', 'expr', '["Sum","i",["Tuple","i",1,"n"]]'],
    ['\\pi', 'expr', '"Pi"'],
    ['\\mathbb{N}', 'expr', '"natural_numbers"'],
    ['i_1 i_2', 'expr', '["InvisibleOperator","i_1","i_2"]'],
    ['x_{1}', 'expr', '"x_1"'],
    ['2x', 'expr', '["InvisibleOperator",2,"x"]'],
    ['triangular_numbers', 'expr', '"triangular_numbers"'], // bare run, rewritten by pre-parse normalization
    ['xy', 'expr', '["InvisibleOperator","x","y"]'], // two symbols — not a catalog id
    ['x = 10', 'define', '["x",10]'],
    ['f(n) = n^2 + 1', 'define', '["f",["n"],["Add",["Power","n",2],1]]'],
    ['x \\in \\operatorname{triangular\\_numbers}', 'declare', '["Element","x","triangular_numbers"]'],
  ])('%s', (latex, kind, json) => {
    expect(shape(latex)).toEqual({ kind, json })
  })
})

describe('spans', () => {
  it('point at the exact source substring for a compound node and a leaf, keyed by path', () => {
    const parsed = parser.parse('x + \\binom{6}{2}')
    if (parsed.stmt.k !== 'expr') throw new Error('expected expr')
    // body = ["Add", "x", ["Binomial", 6, 2]] — "x" is child 1 of the root, the Binomial call is child 2.
    expect(spanAt(parsed.spans, '1')).toEqual([0, 1])
    expect(spanAt(parsed.spans, '2')).toEqual([4, 16])
    expect('\\binom{6}{2}'.length).toBe(12)
  })
})

describe('plain MathJSON (no boxing)', () => {
  it('leaves are ordinary primitives — JSON.stringify has no {} leaf wrappers, typeof a symbol is string', () => {
    const parsed = parser.parse('x + \\binom{6}{2}')
    if (parsed.stmt.k !== 'expr') throw new Error('expected expr')
    const body = parsed.stmt.body as unknown as [string, Expression, Expression]
    const [, x, binom] = body
    expect(typeof x).toBe('string')
    expect(typeof (binom as unknown as [string, number, number])[1]).toBe('number')
    expect(JSON.stringify(parsed.stmt)).not.toMatch(/\{\s*\}/)
  })
})

describe('errors', () => {
  it('an unterminated \\frac produces a ParseError with a span inside the input', () => {
    const parsed = parser.parse('\\frac{1}{')
    expect(parsed.errors.length).toBeGreaterThanOrEqual(1)
    const [e] = parsed.errors
    expect(e.span[0]).toBeGreaterThanOrEqual(0)
    expect(e.span[1]).toBeLessThanOrEqual('\\frac{1}{'.length)
  })

  it('a dangling infix operator produces a ParseError with a span inside the input', () => {
    const parsed = parser.parse('x +')
    expect(parsed.errors.length).toBeGreaterThanOrEqual(1)
    const [e] = parsed.errors
    expect(e.span[0]).toBeGreaterThanOrEqual(0)
    expect(e.span[1]).toBeLessThanOrEqual('x +'.length)
  })
})

describe('round-trip', () => {
  it('serialize(parse(declare)) matches the input up to whitespace', () => {
    const input = 'x \\in \\operatorname{triangular\\_numbers}'
    const parsed = parser.parse(input)
    if (parsed.stmt.k !== 'declare') throw new Error('expected declare')
    const out = toLatex(['Element', parsed.stmt.name, parsed.stmt.domain] as Expression, parser)
    expect(out.replace(/\s+/g, '')).toBe(input.replace(/\s+/g, ''))
  })

  it('serialize(["next","x"]) round-trips through the \\operatorname{} spelling', () => {
    expect(toLatex(['next', 'x'] as Expression, parser)).toContain('\\operatorname{next}')
  })
})

describe('freeSymbols', () => {
  it('body of f(n) = n^2 + m is free in both n and m; excluding params leaves just m', () => {
    const parsed = parser.parse('f(n) = n^2 + m')
    if (parsed.stmt.k !== 'define') throw new Error('expected define')
    const free = freeSymbols(parsed.stmt.body)
    expect(free).toEqual(new Set(['n', 'm']))
    const params = new Set(parsed.stmt.params ?? [])
    expect([...free].filter((s) => !params.has(s))).toEqual(['m'])
  })
})

describe('toCalcText', () => {
  it('formats a plain catalog call as fn(args)', () => {
    expect(toCalcText(['binomial', 5, 2] as Expression)).toBe('binomial(5, 2)')
  })

  it('throws naming the head for an operator the calc grammar has no syntax for', () => {
    expect(() => toCalcText(['Add', 'x', 1] as Expression)).toThrow(/Add/)
  })
})
