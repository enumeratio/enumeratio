// The router-side adaptive window sizer (#273 Piece 1) — pure, no Db. Covers the prior derivation, the EWMA fold over
// the WindowPerf ring, and the clamp law (w_next = clamp(floor(B/t̄), 1, w_prior_cap)) including the down-to-1 floor.
import { describe, expect, it } from 'vitest'
import {
  priorFromAccel, priorFromClass, ewmaPerItemMs, sizeWindow, WindowSizer,
  DEFAULT_BUDGET_MS, type WindowPrior,
} from '../src/window-sizer'
import type { WindowPerf } from '../src/core'

const perf = (coll: string, ms: number, rows: number): WindowPerf =>
  ({ coll, first: 0, count: rows, rows, bytes: 0, ms, cols: 0, at: 0 })

describe('priorFromAccel — accelerator presence → growth class', () => {
  it('cheap random access (fiber_unrank) ⇒ poly, a wide cap', () => {
    expect(priorFromAccel({ count: true, unrank: true }).cls).toBe('poly')
    expect(priorFromAccel({ count: false, unrank: true }).cls).toBe('poly')
  })
  it('fiber_count without unrank ⇒ exp (know sparsity, must scan to address)', () => {
    expect(priorFromAccel({ count: true, unrank: false }).cls).toBe('exp')
  })
  it('no accelerators ⇒ superexp, opening at w_0 = 1', () => {
    const p = priorFromAccel({ count: false, unrank: false })
    expect(p.cls).toBe('superexp')
    expect(p.w0).toBe(1)
  })
  it('the cap widens monotonically from superexp → constant', () => {
    const caps = (['superexp', 'exp', 'poly', 'constant'] as const).map((c) => priorFromClass(c).cap)
    expect(caps).toEqual([...caps].sort((a, b) => a - b))
  })
})

describe('ewmaPerItemMs — the EWMA fold over the perf ring', () => {
  it('is null before anything is measured for the collection', () => {
    expect(ewmaPerItemMs([], 'permutations')).toBeNull()
    expect(ewmaPerItemMs([perf('subsets', 10, 5)], 'permutations')).toBeNull()
  })
  it('filters to the named collection and ignores empty (0-row) windows', () => {
    const ring = [perf('permutations', 100, 0), perf('permutations', 20, 10), perf('subsets', 999, 10)]
    expect(ewmaPerItemMs(ring, 'permutations')).toBe(2)   // only the 20ms/10row window counts ⇒ 2 ms/item
  })
  it('a sudden slowdown moves t̄ up within a batch or two (α = 0.3)', () => {
    const cheap = Array.from({ length: 8 }, () => perf('c', 1, 100))   // 0.01 ms/item, settled
    const t0 = ewmaPerItemMs(cheap, 'c')!
    const t1 = ewmaPerItemMs([...cheap, perf('c', 1000, 1)], 'c')!    // one 1000 ms/item window
    expect(t0).toBeLessThan(1)
    expect(t1).toBeGreaterThan(t0)
    expect(t1).toBeCloseTo(0.3 * 1000 + 0.7 * t0, 5)
  })
})

describe('sizeWindow — the clamp law', () => {
  const poly: WindowPrior = priorFromClass('poly')   // w0 64, cap 1024
  it('opens at the prior w_0 when no timing has arrived', () => {
    expect(sizeWindow(poly, null)).toBe(poly.w0)
  })
  it('floor(B / t̄), clamped to the prior cap', () => {
    expect(sizeWindow(poly, 1)).toBe(Math.min(poly.cap, DEFAULT_BUDGET_MS))   // 250 ms budget / 1 ms
    expect(sizeWindow(poly, 0.01)).toBe(poly.cap)                              // 25000 → capped at 1024
    expect(sizeWindow(poly, 50, { budgetMs: 200 })).toBe(4)                    // 200/50
  })
  it('never drops below the down-to-1 floor, however expensive the item', () => {
    expect(sizeWindow(poly, 100_000)).toBe(1)
    expect(sizeWindow(priorFromClass('superexp'), 100_000)).toBe(1)
  })
  it('shrinks below a caller-requested window but never grows past it', () => {
    expect(sizeWindow(poly, null, { requested: 10 })).toBe(10)    // w0 64 capped to the ask
    expect(sizeWindow(poly, 250, { requested: 10 })).toBe(1)      // 250/250 = 1, still ≤ ask
    expect(sizeWindow(poly, 0.001, { requested: 10 })).toBe(10)   // huge → clamped to the ask, not the prior cap
  })
})

describe('WindowSizer — the stateful streaming wrapper', () => {
  it('opens at w_0, then re-sizes from observed per-item cost', () => {
    const s = new WindowSizer(priorFromClass('constant'), { budgetMs: 100 })
    expect(s.next()).toBe(priorFromClass('constant').w0)   // no obs yet
    s.observe(perf('c', 100, 2))                            // 50 ms/item
    expect(s.perItemMs).toBe(50)
    expect(s.next()).toBe(2)                                // 100 / 50
  })
  it('monotonically shrinks under sustained slowdown', () => {
    const s = new WindowSizer(priorFromClass('poly'), { budgetMs: 250 })
    const sizes = [s.next()]
    for (const ms of [250, 2500, 25000]) { s.observe(perf('c', ms, 1)); sizes.push(s.next()) }
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1])
    expect(sizes.at(-1)).toBe(1)
  })
  it('ignores empty windows (they measure query overhead, not per-item cost)', () => {
    const s = new WindowSizer(priorFromClass('poly'))
    s.observe(perf('c', 999, 0))
    expect(s.perItemMs).toBeNull()
    expect(s.next()).toBe(priorFromClass('poly').w0)
  })
})
