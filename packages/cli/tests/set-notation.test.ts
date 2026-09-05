import { afterAll, expect, it } from 'vitest'
import { provideDb, makeDb, construct, describe, hasSetNotation, close } from '@enumeratio/client'

// The generic "ambient set" rendering: set_notation(element) = "<element> ∈ <fiber symbol>", exposed as the
// 'ambient' repr. Present iff the collection defines fiber_symbol.
provideDb(() => makeDb())
afterAll(() => close())

it('serializes elements in their ambient set via the ambient repr', async () => {
  expect(await construct('permutations', { size: 4 }).serialize(0, 1, { repr: 'ambient' })).toEqual(['1234 ∈ S₄'])
  expect(await construct('subsets', { n: 3 }).serialize(0, 1, { repr: 'ambient' })).toEqual(['000 ∈ 2^[3]'])
  expect(await construct('k_subsets', { n: 4, k: 2 }).serialize(0, 1, { repr: 'ambient' })).toEqual(['1100 ∈ C(4,2)'])
})

it('works for ungraded number families (constant symbol)', async () => {
  expect(await construct('catalan_numbers', {}).serialize(3, 1, { repr: 'ambient' })).toEqual(['5 ∈ C'])
})

it('hasSetNotation reflects whether a fiber_symbol is defined', async () => {
  expect(await hasSetNotation('permutations')).toBe(true)
  expect(await hasSetNotation('glyphs')).toBe(false)   // internal machinery — no ambient-set symbol
})

it('describe lists ambient as a repr where available', async () => {
  const reprs = (await describe('set_partitions')).reprs.map((r) => r.id)
  expect(reprs).toContain('ambient')
})
