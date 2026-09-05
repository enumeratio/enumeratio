import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, it } from 'vitest'
import { provideDb, makeDb, close, terminalSelect } from '@enumeratio/client'

// Drive the actual CLI process (arg parsing → enumeratio-client → worker → pglite) end to end. A second, in-process
// db (below) answers `terminalSelect` directly — the SAME registry function the CLI itself resolves against — so the
// bare-invocation assertions check the printed header against the policy, never a hardcoded copy of it (#246).
provideDb(() => makeDb())
afterAll(() => close())

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const run = (args: string[]) =>
  execFileSync('node', ['--import', 'tsx', cli, ...args], { encoding: 'utf8', timeout: 120_000 }).trim()

it('list includes the core collections', () => {
  const out = run(['list']).split('\n')
  expect(out).toContain('permutations')
  expect(out).toContain('set_partitions')
})

it('enumerates permutations(size=3) under its terminal-policy columns (#246)', async () => {
  const cols = await terminalSelect('permutations')
  const out = run(['permutations', 'size=3']).split('\n')
  expect(out[0]).toBe(cols.join('\t'))   // the header IS policy_resolve('permutations','terminal','select')
  expect(out).toHaveLength(1 + 6)        // header + 6 permutations
  expect(out[1].split('\t')[cols.indexOf('element')]).toBe('123') // canonical order still starts at the identity
})

it('a bare collection with no terminal-specific policy resolves its general one (integer_partitions, #246)', async () => {
  const cols = await terminalSelect('integer_partitions')
  expect(cols).toContain('repr:ferrers')       // its own collection-scope append
  expect(cols).not.toContain('descents')       // not the permutation carrier's override — no special-casing
  const lines = run(['integer_partitions', 'size=4']).split('\n')
  expect(lines[0]).toBe(cols.join('\t'))
  // repr:ferrers is multi-line ASCII, so a logical row can span several '\n' lines — count by the leading
  // ordinality (always numeric-tab) rather than raw line count
  const rows = lines.filter((l) => /^\d+\t/.test(l))
  expect(rows).toHaveLength(5)                 // p(4) = 5 partitions
  expect(rows[0]).toMatch(/^1\t4\.0\t4\t/)      // ordinality 1, address 4.0, element '4'
})

it('--count prints the cardinality', () => {
  expect(run(['integer_partitions', 'size=20', '--count'])).toBe('627')
})

it('a chain grade arg fixes a secondary axis', async () => {
  // arrangements' chain is {size, length}; a bound length restricts to the k-arrangements (sage Permutations(5,2))
  const cols = await terminalSelect('arrangements')
  const out = run(['arrangements', 'size=5', 'length=2']).split('\n')
  expect(out[0]).toBe(cols.join('\t'))
  expect(out).toHaveLength(1 + 20) // header + 5·4
})

it('a family-parameter range (name=LO:HI) enumerates the union of fibers', async () => {
  const cols = await terminalSelect('permutations')
  const out = run(['permutations', 'size=1:3']).split('\n')
  expect(out[0]).toBe(cols.join('\t'))
  expect(out).toHaveLength(1 + 9) // header + 1! + 2! + 3! = 1 + 2 + 6
  expect(run(['permutations', 'size=1:3', '--count'])).toBe('9')
})

it('--fibers lists the fibers a handle spans, with cardinalities', () => {
  const out = run(['k_subsets', 'size=6', '--fibers']).split('\n')
  expect(out).toHaveLength(7) // the unbound k spans 0..6
  expect(out[0]).toBe('n=6 k=0\t1') // C(6,0)
  expect(out[3]).toBe('n=6 k=3\t20') // C(6,3) — the Pascal row
})

it('--group-by STAT prints a statistic distribution (the Mahonian row) with a summary', () => {
  const out = run(['permutations', 'size=4', '-g', 'inversions']).split('\n')
  expect(out[0]).toBe('inversions\tcount')
  expect(out.slice(1).filter((l) => !l.startsWith('#'))).toEqual(['0\t1', '1\t3', '2\t5', '3\t6', '4\t5', '5\t3', '6\t1'])
  expect(out.find((l) => l.startsWith('#'))).toContain('total=24') // the summary footer: total/support/mode/mean
})

it('--triangle STAT prints the statistic distribution per fiber (the Mahonian triangle over sizes)', () => {
  const out = run(['permutations', 'size=1:4', '--triangle', 'inversions']).split('\n')
  expect(out[0].split(/\s+/).filter(Boolean)).toEqual(['inversions', '0', '1', '2', '3', '4', '5', '6']) // header: stat values
  // one row per size; the n=4 row carries the Mahonian numbers 1,3,5,6,5,3,1
  const n4 = out.find((l) => l.includes('size=4'))!
  expect(n4.split(/\s+/).filter(Boolean).slice(1)).toEqual(['1', '3', '5', '6', '5', '3', '1'])
})

it('a restricted variant inherits its base carrier stats (carrier-level resolution)', () => {
  // compositions_into_k_parts registers no stats of its own; it shares the `composition` carrier with
  // integer_compositions, so it inherits those stats and can compute them.
  const listed = run(['list', 'compositions_into_k_parts'])
  expect(listed).toMatch(/stats\s+.*largest_part/)
  const stats = run(['compositions_into_k_parts', 'n=4', 'k=2', '--range', '0', '--fields', 'largest_part']).split('\n')
  expect(stats[0]).toBe('#\telement\tlargest_part')
  expect(stats[1]).toMatch(/^0\t\S+\t\d+$/) // an element with a computed largest_part
  // reprs inherit too: derangements borrow the permutation carrier's cycle notation
  expect(run(['list', 'derangements'])).toMatch(/reprs\s+.*cycle/)
  expect(run(['derangements', 'size=4', '-R', 'cycle', '--range', '0'])).toBe('(1 2)(3 4)')
})

it('--at inspects one element: its rank, every statistic, and every map image', () => {
  const byRank = run(['permutations', 'size=4', '--at', '9']).split('\n')
  expect(byRank[0]).toBe('element  2341  (rank 9)') // rank-addressed → the rank is echoed
  expect(byRank.find((l) => l.startsWith('stats'))).toMatch(/inversions=3/)
  expect(byRank.find((l) => l.startsWith('maps'))).toMatch(/inverse=4123/)
  // value-addressed by @serialization: the rank is looked up (2413 is rank 10 of S_4), RSK P tableau is 1,3/2,4
  const bySer = run(['permutations', 'size=4', '--at', '@2413']).split('\n')
  expect(bySer[0]).toBe('element  2413  (rank 10)')
  expect(bySer.find((l) => l.startsWith('maps'))).toMatch(/rsk_insertion=1,3\/2,4/)
})

it('maps <collection> lists the map graph edges out of a collection', () => {
  const out = run(['maps', 'permutations'])
  expect(out).toMatch(/permutations\s+rsk_insertion\s+→ standard_tableaux/)
  expect(out).toMatch(/permutations\s+cycle_type\s+→ integer_partitions/)
})

it('--through composes maps across collections (permutation → RSK P tableau → its shape)', () => {
  const out = run(['permutations', 'size=3', '--through', 'rsk_insertion,shape']).split('\n')
  expect(out[0]).toBe('#\telement\tthrough:rsk_insertion.shape')
  // identity ↦ single-row shape 3; the reverse ↦ column shape 1+1+1; the rest ↦ 2+1
  expect(out.find((l) => l.startsWith('0\t'))).toBe('0\t123\t3')
  expect(out.find((l) => l.startsWith('5\t'))).toBe('5\t321\t1+1+1')
})

it('-m projects each named map image as its own column', () => {
  const out = run(['permutations', 'size=3', '-m', 'to_lehmer_code,descent_set']).split('\n')
  expect(out[0]).toBe('#\telement\tmap:to_lehmer_code\tmap:descent_set')
  expect(out.find((l) => l.startsWith('5\t'))).toBe('5\t321\t210\t11')
})

it('--range slices the canonical order', async () => {
  const cols = await terminalSelect('permutations')
  const idx = cols.indexOf('element')
  const out = run(['permutations', 'size=5', '--range', '0:3']).split('\n')
  expect(out[0]).toBe(cols.join('\t'))
  expect(out.slice(1).map((l) => l.split('\t')[idx])).toEqual(['12345', '12354', '12435']) // undelimited one-line words
})

it('list <collection> shows the catalog shape', () => {
  const out = run(['list', 'set_partitions'])
  expect(out).toContain('set_partitions')
  expect(out).toMatch(/axes\s+n/) // the grade chain (primary axis named n)
  expect(out).toMatch(/reprs\s+rgs/) // canonical repr = the RGS word (starred), then blocks
})

it('--repr serializes elements in an alternate representation', () => {
  // permutations(3) rank 0 = identity → cycle notation lists every fixed point
  const cyc = run(['permutations', 'size=3', '--repr', 'cycle', '--range', '0']).trim()
  expect(cyc).toBe('(1)(2)(3)')
  // set_partitions' blocks repr renders the RGS word as brace/slash blocks
  const blocks = run(['set_partitions', 'size=3', '--repr', 'blocks', '--range', '0:2']).split('\n')
  expect(blocks).toEqual(['{1,2,3}', '{1,2}/{3}']) // rgs 000 and 001
})
