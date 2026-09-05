import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { provideDb, makeDb, construct, close } from '@enumeratio/client'

// The sympy oracle, driven by cases-sympy.yaml (same equivalency-table shape as the sage oracle in oracle.test.ts
// / cases.yaml — see that file's header for the general contract). For each construction we enumerate through the
// PURE-SQL core (in-process PGlite, zero C) and assert the element SET equals sympy's.
//
// Unlike sage (an optional external system gated on SAGE_PATH), sympy is a plain pip package with no external
// binary — so this gates on `python3 -c "import sympy"` succeeding rather than an env var. A dev box without
// python3/sympy skips cleanly; CI has neither wired up (same as the sage oracle), so this is a LOCAL verification
// tool, not a CI gate.
provideDb(() => makeDb())

type Case = { collection: string; args: Record<string, number>; sympy: string }
type SympyOut = { card?: number; elements?: string[]; error?: string }

const casesPath = fileURLToPath(new URL('../cases-sympy.yaml', import.meta.url))
const scriptPath = fileURLToPath(new URL('./oracle_sympy.py', import.meta.url))
const cases: Case[] = parseYaml(readFileSync(casesPath, 'utf8'))

function sympyRuns(): boolean {
  try {
    execFileSync('python3', ['-c', 'import sympy'], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 30_000 })
    return true
  } catch {
    return false
  }
}

const expectSympy = sympyRuns()

let oracle: SympyOut[] = []
beforeAll(() => {
  if (!expectSympy) return
  const out = execFileSync('python3', [scriptPath], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120_000 })
  oracle = JSON.parse(out)
})
afterAll(() => close())

const label = (c: Case) => `${c.collection}(${Object.entries(c.args).map(([k, v]) => `${k}=${v}`).join(', ')})`

describe.skipIf(!expectSympy)('sympy oracle', () => {
  cases.forEach((c, i) => {
    it(`${label(c)} matches sympy`, async () => {
      const spec = oracle[i]
      expect(spec, `no sympy output at index ${i}`).toBeDefined()
      expect(spec.error, `sympy errored on ${label(c)}: ${spec.error}`).toBeUndefined()

      const ours = await construct(c.collection, c.args).serialize()
      const O = new Set(ours)
      const T = new Set(spec.elements)

      expect(O.size, 'our enumeration has duplicates').toBe(ours.length)
      expect(ours.length, 'cardinality').toBe(spec.card)
      expect([...O].filter((x) => !T.has(x)), 'elements we have that sympy does not').toEqual([])
      expect([...T].filter((x) => !O.has(x)), 'elements sympy has that we do not').toEqual([])
    })
  })
})

it.skipIf(expectSympy)('sympy oracle skipped — python3 with sympy not available', () => {
  expect(expectSympy).toBe(false)
})
