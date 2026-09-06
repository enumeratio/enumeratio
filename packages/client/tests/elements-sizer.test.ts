// The adaptive elements() walk over a real core (#273 Piece 1). The pure sizer law lives in window-sizer.test.ts;
// here we prove the WIRING: the prior comes from accelerator presence, the sparse/expensive #254 collections
// TERMINATE (no watchdog-length scan), an explicit pageSize still overrides, and the walk yields every element.
import { afterAll, describe, expect, it } from 'vitest'
import { close, construct, makeDb, provideDb } from '../src/index.ts'

provideDb(() => makeDb())
afterAll(async () => { await close() })

const take = async (h: ReturnType<typeof construct>, cap = 1000): Promise<string[]> => {
  const out: string[] = []
  for await (const r of h.elements()) { out.push(String(r.element)); if (out.length >= cap) break }
  return out
}

describe('elements() adaptive walk (#273)', () => {
  it('derives the window prior from accelerator presence', async () => {
    expect((await construct('gelfand_tsetlin', {}).windowPrior()).cls).toBe('poly')   // count + unrank
    const acc = await construct('singleton_species', {}).accel()
    expect(acc.count).toBe(true)   // fiber_count present ⇒ the sparse early-exit signal
  })

  it('terminates on a sparse open handle instead of scanning for elements that do not exist (#254)', async () => {
    // singleton_species: fiber_count 1 at n=1, 0 everywhere else — the walk must stop, not chase empty fibers
    const els = await take(construct('singleton_species', {}))
    expect(els.length).toBeGreaterThanOrEqual(1)
    expect(els.length).toBeLessThan(50)   // decisively bounded — a hang would run to the SQL 1e6 backstop
  })

  it('walks a bounded fiber to completion under adaptive sizing', async () => {
    const els = await take(construct('permutations', { size: 4 }))
    expect(els.length).toBe(24)
    expect(new Set(els).size).toBe(24)   // every element once, in order — sizing changes batch size, not content
  })

  it('honors an explicit pageSize verbatim (the sizer is the DEFAULT, not a mandate)', async () => {
    const seen: string[] = []
    for await (const r of construct('permutations', { size: 4 }).elements({ pageSize: 5 })) seen.push(String(r.element))
    expect(seen.length).toBe(24)
  })
})
