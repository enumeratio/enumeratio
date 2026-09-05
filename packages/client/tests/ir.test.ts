// The IR round-trips (#278 increment 1). Two claims, and the line between them is the whole point:
//   FAITHFUL — a clause the codec declines to reinterpret is kept as `{ raw }` and printed back BYTE-IDENTICAL.
//   CANONICAL — a clause it does represent round-trips to its canonical spelling, which is a fixed point.
// The canonicalization cases below are the documented behaviour, spelled out so a future change to them is a
// deliberate edit to this file rather than a surprise in the explorer's URLs.
import { describe, expect, it } from 'vitest'
import {
  calcText, exprFromStatement, fnRef, functionsIn, parseCalc, handleExprText, groupingText, irToSpec, isClosed, orderByText, parseOrderBy,
  relFromRowQuery, rowQueryFromRel, selectFromText, specToIr, statementFromExpr, textFromSelect,
  parseSelect, rowQueryFromSearch, searchFromRowQuery, type RowQuery, type SelectExpr,
} from '../src/index.ts'

/** every RowQuery shape selfcert-rows.mts exercises — the row half's real fixture set */
const ROW_QUERIES: RowQuery[] = [
  { from: 'permutations(size=4)', where: 'descents >= 2' },
  { from: 'permutations(4)', orderBy: 'inversions DESC, rank' },
  { from: 'permutations(size=0..4)' },
  { from: 'k_subsets(n=2..3)' },
  { from: 'subsets(3)', where: 'rank_stat = 2' },
  { from: 'permutations(size=0..6)', groupBy: 'size' },
  { from: 'k_subsets(n=0..4)', groupBy: 'n' },
  { from: 'k_subsets(n=0..7)', groupBy: 'n, k', having: 'k = 2' },
  { from: 'permutations(size=0..7)', groupBy: 'size', having: 'count(*) > 5' },
  { from: 'colored_motzkin_paths(n=0..3)', groupBy: 'n, r' },
  { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)' },
  { from: 'permutations(4)', groupBy: 'inversions' },
  { from: 'permutations(size=0..4)', groupBy: 'size, descents' },
  { from: 'collections', groupBy: 'carrier', having: 'count(*) >= 8', orderBy: 'count DESC' },
  { from: 'permutations' },
  { from: 'integer_partitions', groupBy: 'n' },
  { from: 'prime_numbers' },
  { from: 'permutations(size=0..5)', groupBy: 'ROLLUP (size, descents)' },
  { from: 'permutations(size=0..5)', groupBy: 'ROLLUP (size, cycles)', having: 'count(*) > 1' },
  { from: 'permutations(size=0..4)', groupBy: 'GROUPING SETS ((size, descents), ())' },
  { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)', having: 'k = 2' },
  { from: 'permutations(size=0..5)', groupBy: 'size, cycles', having: 'count(*) > 10' },
  { from: 'subsets(n=0..4)', groupBy: 'cardinality, n' },
  { from: 'permutations(size=0..3)', groupBy: 'GROUPING SETS ((size, rank, element), (size))' },
  { from: 'k_subsets(n=0..3)', groupBy: 'GROUPING SETS ((n, k, rank, element), (n))', having: 'count(*) > 1' },
  { from: 'k_subsets(n=0..3)', groupBy: 'GROUPING SETS ((n, k, rank, element), (n))', having: 'n >= 2' },
  { from: 'words(4, 2)', groupBy: 'orbit:rotation' },
  { from: 'permutations(4)', groupBy: 'map:inverse' },
  { from: 'permutations(4)', orderBy: 'weak_order' },
  { from: 'collections', where: `element IN (SELECT collection FROM base_collection_tag WHERE tag = 'classical')` },
  { from: 'collections', where: `carrier = 'permutation'` },
  { from: 'permutations(4)', where: 'descents BETWEEN 1 AND 2' },
  { from: 'permutations(4)', where: `element LIKE '1%'` },
  { from: 'permutations(4)', where: 'descents IN (1, 2)' },
  { from: 'permutations(4)', where: 'is_derangement(value)' },
]

describe('the row half: RowQuery ⇄ Rel', () => {
  it.each(ROW_QUERIES.map((q) => [q.from + (q.where ? ` WHERE ${q.where}` : '') + (q.groupBy ? ` GROUP BY ${q.groupBy}` : '') + (q.having ? ` HAVING ${q.having}` : '') + (q.orderBy ? ` ORDER BY ${q.orderBy}` : ''), q] as const))(
    'round-trips %s unchanged', (_id, q) => {
      expect(rowQueryFromRel(relFromRowQuery(q))).toEqual(q)
    })

  it('keeps an unrepresentable WHERE verbatim (faithful or nothing)', () => {
    const q: RowQuery = { from: 'permutations(4)', where: 'descents >= 2 OR inversions < 3' }
    const rel = relFromRowQuery(q)
    expect(rel.where).toEqual({ raw: 'descents >= 2 OR inversions < 3' })
    expect(rowQueryFromRel(rel).where).toBe(q.where)
  })

  it('keeps an expression ORDER BY verbatim, and a kernel token too', () => {
    for (const orderBy of ['abs(inversions) DESC', 'orbit:rotation', 'count DESC, size']) {
      const rel = relFromRowQuery({ from: 'permutations(4)', orderBy })
      expect(rowQueryFromRel(rel).orderBy).toBe(orderBy)
    }
  })

  it('parses the sort keys it can, with direction and NULLS', () => {
    expect(parseOrderBy('inversions DESC, rank')).toEqual([{ col: 'inversions', dir: 'desc' }, { col: 'rank' }])
    expect(parseOrderBy('n NULLS LAST')).toEqual([{ col: 'n', nulls: 'last' }])
    expect(orderByText([{ col: 'n', dir: 'asc', nulls: 'last' }])).toBe('n ASC NULLS LAST')
    expect(parseOrderBy('orbit:rotation')).toBeNull()
  })

  it('prints a handle from its bindings, positional before named', () => {
    expect(handleExprText({ coll: 'permutations', named: {}, positional: [] })).toBe('permutations')
    expect(handleExprText({ coll: 'k_subsets', named: {}, positional: [4, 2] })).toBe('k_subsets(4, 2)')
    expect(handleExprText({ coll: 'k_subsets', named: { n: [2, 4], k: 2 }, positional: [] })).toBe('k_subsets(n=2..4, k=2)')
  })

  it('prints each GROUP BY shape back to the spelling parseGroupBy reads', () => {
    expect(groupingText({ rollup: false, sets: [['size', 'descents']] })).toBe('size, descents')
    expect(groupingText({ rollup: true, sets: [['n', 'k'], ['n'], []] })).toBe('ROLLUP (n, k)')
    expect(groupingText({ rollup: false, sets: [['size', 'descents'], []] })).toBe('GROUPING SETS ((size, descents), ())')
  })
})

describe('the row half: canonicalization (documented, not accidental)', () => {
  // Each case: what a hand-typed clause becomes once it has been through the tree. The right-hand side is the
  // canonical spelling, and canonical text is a FIXED POINT — round-tripping it again changes nothing.
  const CASES: [string, RowQuery, RowQuery][] = [
    ['a predicate gains its spaces', { from: 'permutations(4)', where: 'descents>=2' }, { from: 'permutations(4)', where: 'descents >= 2' }],
    ['!= becomes <>', { from: 'permutations(4)', where: 'descents != 2' }, { from: 'permutations(4)', where: 'descents <> 2' }],
    ['a lowercase ROLLUP is spelled up', { from: 'k_subsets(n=0..3)', groupBy: 'rollup (n, k)' }, { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)' }],
    ['a bare GROUPING SETS member gains its parentheses', { from: 'permutations(size=0..4)', groupBy: 'GROUPING SETS (size, (size, descents))' }, { from: 'permutations(size=0..4)', groupBy: 'GROUPING SETS ((size), (size, descents))' }],
    ['handle whitespace closes up', { from: 'k_subsets( n = 2..4 ,  k = 2 )' }, { from: 'k_subsets(n=2..4, k=2)' }],
    ['an unbound open range is dropped, as parseHandle drops it', { from: 'permutations(size=0..)' }, { from: 'permutations' }],
    ['a sort keyword is spelled up', { from: 'permutations(4)', orderBy: 'inversions desc' }, { from: 'permutations(4)', orderBy: 'inversions DESC' }],
  ]
  it.each(CASES)('%s', (_name, input, canonical) => {
    expect(rowQueryFromRel(relFromRowQuery(input))).toEqual(canonical)
    expect(rowQueryFromRel(relFromRowQuery(canonical))).toEqual(canonical)   // the fixed point
  })
})

describe('the column half: SelectSpec ⇄ SelectExpr', () => {
  /** one canonical spelling per SelectSpec kind — all 17 of them */
  const SELECTS = [
    'ordinality', 'rank', 'address', 'omega', 'element', 'repr:cycle', 'repr:cycle@latex', 'descents',
    'map:inverse', 'through:rsk_insertion.shape', 'glyph', 'data', 'title', 'count', 'min:descents',
    'max:descents', 'sum:descents', 'avg:descents', 'dist:descents', 'pivot:descents', 'symbol', 'level',
    'over:count', 'over:symbol', 'over:max:descents',
  ]

  it.each(SELECTS)('round-trips %s', (text) => {
    expect(textFromSelect(selectFromText(text))).toBe(text)
    expect(irToSpec(specToIr(parseSelect(text)[0])).text).toBe(text)
  })

  it('round-trips a whole list in order', () => {
    const list = 'address,element,repr:cycle,map:inverse,descents'
    expect(textFromSelect(selectFromText(list))).toBe(list)
  })

  it('tells a one-hop map from a through: chain by nesting depth alone', () => {
    const one = specToIr(parseSelect('map:inverse')[0]) as Extract<SelectExpr, { kind: 'apply' }>
    const two = specToIr(parseSelect('through:rsk_insertion.shape')[0]) as Extract<SelectExpr, { kind: 'apply' }>
    expect(one.args[0].kind).toBe('subject')
    expect(two.args[0].kind).toBe('apply')
    expect(irToSpec(one).kind).toBe('map')
    expect(irToSpec(two).kind).toBe('through')
  })

  it('leaves a bare id ambiguous — only the catalog knows axis from statistic', () => {
    const e = specToIr(parseSelect('descents')[0]) as Extract<SelectExpr, { kind: 'apply' }>
    expect(String(e.fn)).toBe('column')
    expect(e.args[1]).toEqual({ kind: 'lit', value: 'descents' })
  })
})

describe('the whole statement', () => {
  it('round-trips the query-view URL byte-for-byte', () => {
    const search = '?from=permutations%284%29&select=element%2Cdescents'
    const back = searchFromRowQuery(statementFromExpr(exprFromStatement(rowQueryFromSearch(search))))
    expect(back).toBe(search)
  })

  it('round-trips a statement with every clause populated', () => {
    const s = { from: 'permutations(size=0..5)', select: 'size,count,symbol', where: 'descents >= 2', groupBy: 'ROLLUP (size, descents)', having: 'count(*) > 1', orderBy: 'size DESC' }
    expect(statementFromExpr(exprFromStatement(s))).toEqual(s)
  })

  it('a FROM-less statement is a scalar: no from, and its select is closed of the subject', () => {
    const e = exprFromStatement({ from: '', select: 'count' })
    expect(e.from).toBeUndefined()
    expect(isClosed({ kind: 'apply', fn: fnRef('binomial'), args: [{ kind: 'lit', value: 5 }, { kind: 'lit', value: 2 }] })).toBe(true)
    expect(isClosed(selectFromText('element')[0])).toBe(false)
    expect(isClosed({ kind: 'lit', value: 5 })).toBe(true)
  })

  it('lists the functions a tree applies, leaves first', () => {
    const e = selectFromText('through:rsk_insertion.shape')[0]
    expect(functionsIn(e).map(String)).toEqual(['map', 'map'])
    expect(functionsIn(selectFromText('max:descents')[0]).map(String)).toEqual(['column', 'max'])
  })
})

describe('the scalar surface: calc text ⇄ a FROM-less Expr', () => {
  const OK: [string, string][] = [
    ['binomial(5, 2)', 'binomial(5, 2)'],
    ['binomial(5,2)', 'binomial(5, 2)'],
    ['cardinality(permutations(4))', 'cardinality(permutations(4))'],
    ['factorial(25)', 'factorial(25)'],
    ['gcd(-12, 18)', 'gcd(-12, 18)'],
    ['pi', 'pi'],
    ["notation('abc')", "notation('abc')"],
    ['bell()', 'bell'],
  ]
  it.each(OK)('parses %s', (input, canonical) => {
    const e = parseCalc(input)
    expect(e.from).toBeUndefined()
    expect(e.select).toHaveLength(1)
    expect(calcText(e.select[0])).toBe(canonical)
    expect(isClosed(e.select[0])).toBe(true)
  })

  it.each(['binomial(5,', 'binomial 5', '5 + 2', 'binomial(5, 2) extra', ''])('rejects %s', (bad) => {
    expect(() => parseCalc(bad)).toThrow(/calc:/)
  })

  it('walks the leaves an engine must claim, innermost first', () => {
    expect(functionsIn(parseCalc('cardinality(permutations(4))').select[0]).map(String))
      .toEqual(['permutations', 'cardinality'])
  })
})
