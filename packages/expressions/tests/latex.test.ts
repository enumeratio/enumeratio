import { describe, expect, it } from 'vitest'
import { makeParser, reformatIdentifiers, identifierDisplay, type IdentifierDisplay } from '../src/ce/latex.js'
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
    ['\\operatorname{Next}(x)', 'expr', '["next","x"]'], // Pascal is the parse spelling; the symbol stays snake
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
    ['xy', 'expr', '"xy"'], // a multi-letter run is ONE identifier now (not x·y) — normalizer wraps it \mathrm
    ['x', 'expr', '"x"'], // a single letter stays a bare variable
    ['p.next(x)', 'expr', '["next","p","x"]'], // `.`-method sugar: receiver becomes the first argument
    ['p.next', 'expr', '["next","p"]'], // no-arg method
    ['3.5', 'expr', '3.5'], // a decimal is NOT a method call (receiver must be a letter-start identifier)
    ['x = 10', 'define', '["x",10]'],
    ['f(n) = n^2 + 1', 'define', '["f",["n"],["Add",["Power","n",2],1]]'],
    ['x \\in \\operatorname{TriangularNumbers}', 'declare', '["Element","x","triangular_numbers"]'],
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
  it('serialize(parse(declare)) matches the input up to whitespace, in the Pascal \\mathrm spelling', () => {
    const input = 'x \\in \\mathrm{TriangularNumbers}'
    const parsed = parser.parse(input)
    if (parsed.stmt.k !== 'declare') throw new Error('expected declare')
    const out = toLatex(['Element', parsed.stmt.name, parsed.stmt.domain] as Expression, parser)
    expect(out.replace(/\s+/g, '')).toBe(input.replace(/\s+/g, ''))
  })

  it('serialize(["next","x"]) round-trips through the Pascal \\mathrm{} spelling', () => {
    expect(toLatex(['next', 'x'] as Expression, parser)).toContain('\\mathrm{Next}')
  })
})

describe('reformatIdentifiers (display reformat)', () => {
  // Mirrors the notebook's classify: `identifierDisplay` turns an id into its display LaTeX — Pascal
  // `\operatorname{}` for a function, `\mathrm{}` for a collection, or a registered notation glyph. Keyed by the
  // pure-letter spellings MathLive produces (snake_case with `_` never arrives as one run). A parser that KNOWS
  // the notation is built alongside, so the round-trip covers the glyph too.
  const notation = { permutations: '\\mathfrak{S}' }
  const npParser = makeParser({ collections: ['triangular_numbers', 'permutations'], functions: ['next'], notation })
  const npShape = (latex: string) => {
    const p = npParser.parse(latex)
    return p.stmt.k === 'declare'
      ? toMathJsonString(['Element', p.stmt.name, p.stmt.domain] as Expression)
      : p.stmt.k === 'expr' ? toMathJsonString(p.stmt.body) : p.stmt.k
  }
  const classify = (run: string): IdentifierDisplay | null =>
    run === 'next' ? identifierDisplay('next', 'function', notation)
      : run === 'TriangularNumbers' ? identifierDisplay('triangular_numbers', 'collection', notation)
        : run === 'Permutations' ? identifierDisplay('permutations', 'collection', notation)
          : null

  it.each([
    ['next', '\\mathrm{Next}'], // known function → \mathrm node binding, Pascal spelling
    ['TriangularNumbers', '\\mathrm{TriangularNumbers}'], // known collection → \mathrm, Pascal spelling
    ['Permutations', '\\mathfrak{S}'], // a registered notation glyph is spliced verbatim
    ['xy', 'xy'], // unknown multi-letter run → left bare (a variable)
    ['x', 'x'], // single letter → untouched
  ])('%s → %s', (input, expected) => {
    expect(reformatIdentifiers(input, classify)).toBe(expected)
  })

  it('is idempotent — protected groups and glyphs are left alone, so re-running never double-wraps', () => {
    for (const run of ['TriangularNumbers', 'Permutations', 'next']) {
      const once = reformatIdentifiers(run, classify)
      expect(reformatIdentifiers(once, classify)).toBe(once)
    }
  })

  it('every reformatted spelling re-parses to the SAME symbol (the load-bearing correctness claim)', () => {
    expect(npShape('Next(x)')).toEqual(npShape(reformatIdentifiers('next', classify) + '(x)'))
    expect(npShape('x \\in triangular_numbers'))
      .toEqual(npShape('x \\in ' + reformatIdentifiers('TriangularNumbers', classify)))
    // the notation glyph binds to the same collection symbol as the typed word
    expect(npShape('x \\in permutations'))
      .toEqual(npShape('x \\in ' + reformatIdentifiers('Permutations', classify)))
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
