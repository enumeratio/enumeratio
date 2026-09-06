// The row half's adaptive DEFAULT element page (#273 phase 1.5): when a caller names no `count`, planRows() /
// rowSql() open at the declared-growth prior's w_0 (derived from accelerator presence) instead of the old blind
// fixed 100 — so an expensive collection opens small and never hangs the first page on a naive enumeration.
// window-sizer.test.ts covers the pure law; here we prove the row-half WIRING and its scope/opt-out.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { close, makeDb, planRows, provideDb, rowSql } from '../src/index.ts'

describe('planRows default element page is the #273 sizer opening, not a fixed 100', () => {
  beforeAll(() => { provideDb(() => makeDb()) })
  afterAll(async () => { await close() })

  it('an EXPENSIVE open collection (no accel ⇒ superexp ⇒ w_0=1) opens at 1, not 100', async () => {
    const t = await planRows({ from: 'prime_numbers' })   // ungraded, no fiber_count/unrank
    expect(t.rows.length).toBe(1)
    expect(t.frontier).toBe(true)   // an open handle: more exist past the (small) first page
  })

  it('a count-only collection (⇒ exp ⇒ w_0=8) opens at 8', async () => {
    const t = await planRows({ from: 'collections' })   // fiber_count, no fiber_unrank
    expect(t.rows.length).toBe(8)
  })

  it('a cheap random-access collection (⇒ poly ⇒ w_0=64) opens at 64, well under its cardinality', async () => {
    const t = await planRows({ from: 'permutations(size=6)' })   // 720 elements; the default caps the first page
    expect(t.rows.length).toBe(64)
  })

  it('an explicit count is honored verbatim — the default only fills a genuinely absent one', async () => {
    const t = await planRows({ from: 'prime_numbers' }, { count: 12 })
    expect(t.rows.length).toBe(12)
  })

  it('a WHERE / GROUP BY view opts out — it keeps the unbounded logical statement (no default LIMIT)', async () => {
    // a restriction materializes the whole (bounded) relation; the default page never truncates it
    const filtered = await planRows({ from: 'permutations(size=4)', where: 'descents >= 2' })
    expect(filtered.rows.length).toBe(12)   // all matches, not a page of them
    // and the oracle for a plain canonical page threads the SAME default (the byte-for-byte differential partner)
    expect(await rowSql({ from: 'permutations(size=4)' })).toContain('LIMIT 64')
    expect(await rowSql({ from: 'permutations(size=4)', where: 'descents >= 2' })).not.toContain('LIMIT')
  })
})
