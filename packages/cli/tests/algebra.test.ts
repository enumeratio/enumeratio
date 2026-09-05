import { afterAll, expect, it } from 'vitest'
import { provideDb, makeDb, evaluateExpression, algebraTypes, close } from '@enumeratio/client'

// The per-ring expression evaluator (client-side parser → SQL over the operation registry), against in-process PGlite.
provideDb(() => makeDb())
afterAll(() => close())

const ev = (t: string, e: string, g?: number | Record<string, number>) => evaluateExpression(t, e, g).then((r) => r.error ?? r.result)

it('rational field: reduces, distributes, subtracts', async () => {
  expect(await ev('rational_number', '1/2 + 1/3')).toBe('5/6')
  expect(await ev('rational_number', '2 * (1/2 + 1/3)')).toBe('5/3')
  expect(await ev('rational_number', '1/2 - 3/4')).toBe('-1/4')
})

it('ordinal semiring: non-commutative + and ·', async () => {
  expect(await ev('omega_ordinal', '2 + w')).toBe('ω')          // finite absorbed on the left
  expect(await ev('omega_ordinal', 'w + 2')).toBe('ω + 2')      // survives on the right
  expect(await ev('omega_ordinal', 'w * w')).toBe('ω^2')
  expect(await ev('omega_ordinal', '(w + 1) * (w + 1)')).toBe('ω^2 + ω + 1')
})

it('cardinal: ℵ₀ arithmetic incl. the 0 annihilator', async () => {
  expect(await ev('cardinal', 'oo * 3 + 5')).toBe('∞')
  expect(await ev('cardinal', 'oo * 0')).toBe('0')
})

it('ℤ and ℕ evaluate with precedence', async () => {
  expect(await ev('integer_number', '5 - 3 * 4')).toBe('-7')
  expect(await ev('natural_number', '2 + 3 * 4')).toBe('14')
})

it('ℤ/mℤ evaluates per modulus', async () => {
  expect(await ev('modular_residue', '3 * 4 + 2', 5)).toBe('4')   // 14 ≡ 4
  expect(await ev('modular_residue', '2 - 4', 5)).toBe('3')       // −2 ≡ 3
})

it('rejects ops a type lacks and a missing modulus', async () => {
  expect(await ev('omega_ordinal', '1 - 2')).toMatch(/no subtraction/)
  expect(await ev('modular_residue', '1 + 1')).toMatch(/modulus/)
  expect(await ev('rational_number', '1 +')).toMatch(/unexpected/)
})

it('Gaussian integers ℤ[i]: the i literal + ring arithmetic', async () => {
  expect(await ev('gaussian_integer', '3 + 2i')).toBe('3+2i')
  expect(await ev('gaussian_integer', 'i * i')).toBe('-1')
  expect(await ev('gaussian_integer', '(1 + i) * (1 + i)')).toBe('2i')
  expect(await ev('gaussian_integer', '(3 + 2i) * (3 - 2i)')).toBe('13')   // (a+bi)(a−bi) = norm
})

it('algebraTypes lists the rings, including modular + Gaussian', async () => {
  const ids = (await algebraTypes()).map((t) => t.type)
  expect(ids).toContain('rational_number')
  expect(ids).toContain('omega_ordinal')
  expect(ids).toContain('gaussian_integer')
  expect(ids).toContain('modular_residue')
})
