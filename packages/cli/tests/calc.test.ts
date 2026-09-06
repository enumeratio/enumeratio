import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, it } from 'vitest'
import { close, provideDb, provideEngine, makeDb, standardEngine, runSql } from '@enumeratio/client'
import { runCli } from '../src/dispatch.js'
import { nodeClient } from '../src/node-client.js'

// `enumeratio calc` end to end — the proving consumer for the engine seam (#278). Every assertion here is about
// ROUTING, not arithmetic: which engine answered, with which implementation, and whether the answer is the one
// the oracle gives. Runs IN-PROCESS through the shared dispatch (runCli) over one pglite boot; a second in-process
// db answers the pg side directly, so expected values come from the core itself, not a hardcoded copy. One binary
// smoke test below still drives the real process (parse error → stderr → non-zero exit).
provideDb(() => makeDb())
provideEngine(() => standardEngine())
afterAll(() => close())

const client = nodeClient()
const run = async (args: string[]): Promise<string> => {
  let buf = ''
  await runCli(args, { client, write: (s) => { buf += s } })
  return buf.trim()
}
const calc = (expr: string, explain = true) => run(explain ? ['calc', expr, '--explain'] : ['calc', expr])
const parse = (out: string) => {
  const [value, ...notes] = out.split('\n')
  const m = notes.join(' ').match(/engine=(\S+)(?: impl=(\S+))?/)
  return { value, engine: m?.[1], impl: m?.[2] }
}
const oracle = async (sql: string) => String(Object.values((await runSql<Record<string, unknown>>(`SELECT (${sql})::text`))[0])[0])

const cli = fileURLToPath(new URL('../src/cli.ts', import.meta.url))

it('answers from the ts engine, and agrees with the oracle', async () => {
  const r = parse(await calc('binomial(30, 15)'))
  expect(r.engine).toBe('ts')
  expect(r.value).toBe(await oracle('binomial(30, 15)'))
})

it('prefers the exact implementation, so a large factorial is still ts and still right', async () => {
  const r = parse(await calc('factorial(25)'))
  expect(r).toMatchObject({ engine: 'ts', impl: 'factorial_bigint' })
  expect(r.value).toBe(await oracle('factorial(25)'))
})

it('routes a curated identity pg cannot compute to the engine that can', async () => {
  const r = parse(await calc('lcm(4, 6)'))
  expect(r).toMatchObject({ engine: 'ts', impl: 'lcm_int', value: '12' })
})

it('falls through to the oracle rather than printing a float64 near-miss', async () => {
  const r = parse(await calc('bell(30)'))
  expect(r.engine).toBe('pg')                       // ts has only a float64 twin, and bell(30) is past 2^53
  expect(r.value).toBe(await oracle('bell(30)'))
  expect(parse(await calc('bell(20)')).engine).toBe('ts') // inside 2^53 the fast engine answers
})

it('an uncurated name is pg’s to try — the registry has no opinion on it', async () => {
  const r = parse(await calc('cardinality(permutations(4))'))
  expect(r.engine).toBe('pg')
  expect(r.value).toBe('24')
})

it('prints just the value without --explain', async () => {
  expect(await calc('gcd(-12, 18)', false)).toBe('6')
})

it('rejects an expression it cannot parse, naming the position (binary: stderr + non-zero exit)', () => {
  // the one genuine subprocess: proves the CliError → stderr → exit-1 plumbing, not just that runCli throws
  expect(() => execFileSync('node', ['--import', 'tsx', cli, 'calc', '5 + 2'], { encoding: 'utf8', timeout: 120_000 })).toThrow(/calc:/)
})
