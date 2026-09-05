import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, it } from 'vitest'
import { close, provideDb, makeDb, runSql } from '@enumeratio/client'

// `enumeratio calc` end to end — the proving consumer for the engine seam (#278). Every assertion here is about
// ROUTING, not arithmetic: which engine answered, with which implementation, and whether the answer is the one
// the oracle gives. A second in-process db answers the pg side directly, so the expected values come from the
// core itself rather than from a hardcoded copy of them.
provideDb(() => makeDb())
afterAll(() => close())

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))
const run = (args: string[]) =>
  execFileSync('node', ['--import', 'tsx', cli, ...args], { encoding: 'utf8', timeout: 180_000 }).trim()
const calc = (expr: string, explain = true) => run(explain ? ['calc', expr, '--explain'] : ['calc', expr])
const parse = (out: string) => {
  const [value, ...notes] = out.split('\n')
  const m = notes.join(' ').match(/engine=(\S+)(?: impl=(\S+))?/)
  return { value, engine: m?.[1], impl: m?.[2] }
}
const oracle = async (sql: string) => String(Object.values((await runSql<Record<string, unknown>>(`SELECT (${sql})::text`))[0])[0])

it('answers from the ts engine, and agrees with the oracle', async () => {
  const r = parse(calc('binomial(30, 15)'))
  expect(r.engine).toBe('ts')
  expect(r.value).toBe(await oracle('binomial(30, 15)'))
})

it('prefers the exact implementation, so a large factorial is still ts and still right', async () => {
  const r = parse(calc('factorial(25)'))
  expect(r).toMatchObject({ engine: 'ts', impl: 'factorial_bigint' })
  expect(r.value).toBe(await oracle('factorial(25)'))
})

it('routes a curated identity pg cannot compute to the engine that can', () => {
  const r = parse(calc('lcm(4, 6)'))
  expect(r).toMatchObject({ engine: 'ts', impl: 'lcm_int', value: '12' })
})

it('falls through to the oracle rather than printing a float64 near-miss', async () => {
  const r = parse(calc('bell(30)'))
  expect(r.engine).toBe('pg')                       // ts has only a float64 twin, and bell(30) is past 2^53
  expect(r.value).toBe(await oracle('bell(30)'))
  expect(parse(calc('bell(20)')).engine).toBe('ts') // inside 2^53 the fast engine answers
})

it('an uncurated name is pg’s to try — the registry has no opinion on it', async () => {
  const r = parse(calc('cardinality(permutations(4))'))
  expect(r.engine).toBe('pg')
  expect(r.value).toBe('24')
})

it('prints just the value without --explain', () => {
  expect(calc('gcd(-12, 18)', false)).toBe('6')
})

it('rejects an expression it cannot parse, naming the position', () => {
  expect(() => run(['calc', '5 + 2'])).toThrow(/calc:/)
})
