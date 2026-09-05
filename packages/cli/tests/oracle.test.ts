import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { provideDb, makeDb, construct, close } from '@enumeratio/client'

// The sage oracle, driven by cases.yaml (the equivalency table). For each construction we enumerate through the
// PURE-SQL core (in-process PGlite, zero C) and assert the element SET equals sage's — same objects, no extras, no
// dupes, right count. Element strings are compared coerced to a canonical text form (the serialization convention
// may differ, but its ::text is stable), so oracle_sage.py's converters just need to agree with the core's render().
//
// GATED ON SAGE_PATH: if set (the sage binary, or just `sage`), sage is EXPECTED — the first test fails loudly if it
// is not runnable, then every case runs. If unset, the whole oracle skips (CI without sage). This makes "I'm supposed
// to have sage" an explicit, enforced contract rather than a silent skip.
provideDb(() => makeDb())

type Case = { collection: string; args: Record<string, number>; sage: string; stats?: Record<string, string> }
type SageOut = { card?: number; elements?: string[]; stats?: Record<string, Record<string, string>>; error?: string }

const casesPath = fileURLToPath(new URL('../cases.yaml', import.meta.url))
const scriptPath = fileURLToPath(new URL('./oracle_sage.py', import.meta.url))
const cases: Case[] = parseYaml(readFileSync(casesPath, 'utf8'))

const sageBin = (process.env.SAGE_PATH || '').trim()
const expectSage = sageBin !== ''

function sageRuns(): boolean {
  try {
    execFileSync(sageBin, ['--version'], { stdio: ['ignore', 'ignore', 'ignore'], timeout: 60_000 })
    return true
  } catch {
    return false
  }
}

let oracle: SageOut[] = []
beforeAll(() => {
  if (!expectSage || !sageRuns()) return
  const out = execFileSync(sageBin, ['--python', scriptPath], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 300_000 })
  oracle = JSON.parse(out)
})
afterAll(() => close())

// stat values cross the wire as pg text / js numbers / sage strings — compare numerically when both sides parse as
// numbers ('3' vs 3 vs '3.0'), by text otherwise (a cycle type or other structured stat).
const norm = (v: unknown): string => {
  const t = String(v)
  const n = Number(t)
  return t.trim() !== '' && Number.isFinite(n) ? String(n) : t
}

const label = (c: Case) => `${c.collection}(${Object.entries(c.args).map(([k, v]) => `${k}=${v}`).join(', ')})`

// Secondary grade-axis binding — restricting a collection to a fiber over a NON-primary axis (k blocks/parts,
// k inversions, k cycles, a fixed cardinality) — isn't wired into the pure client yet: the core has the fibers,
// but construct() can only bind the primary dimension (plus the positional 2nd arg where one exists, e.g.
// arrangements' length, words' base). These cases stay in cases.yaml as valid sage equivalences, but are pending
// until the client can bind a grade axis through the core's catalog (see .scratch task H).
const UNBOUND_AXES = new Set(['parts_count', 'cardinality', 'inversions_count', 'cycles_count'])
const gradeBound = (c: Case) => Object.keys(c.args).some((k) => UNBOUND_AXES.has(k))

describe.skipIf(!expectSage)('sage oracle', () => {
  // The contract: SAGE_PATH is set, so sage MUST be runnable. This fails first (before the cases) if it is not.
  it('sage is available (SAGE_PATH is set)', () => {
    expect(sageRuns(), `SAGE_PATH=${sageBin} is set but sage is not runnable`).toBe(true)
  })

  cases.forEach((c, i) => {
    const run = gradeBound(c) ? it.skip : it   // pending: pure client can't bind a secondary grade axis yet
    run(`${label(c)} matches sage`, async () => {
      const spec = oracle[i]
      expect(spec, `no sage output at index ${i}`).toBeDefined()
      expect(spec.error, `sage errored on ${label(c)}: ${spec.error}`).toBeUndefined()

      const ours = await construct(c.collection, c.args).serialize()
      const O = new Set(ours)
      const T = new Set(spec.elements)

      expect(O.size, 'our enumeration has duplicates').toBe(ours.length)
      expect(ours.length, 'cardinality').toBe(spec.card)
      expect([...O].filter((x) => !T.has(x)), 'elements we have that sage does not').toEqual([])
      expect([...T].filter((x) => !O.has(x)), 'elements sage has that we do not').toEqual([])

      // STATISTICS: a case may also pin our per-element stats against sage's own methods (cases.yaml `stats:`).
      // Compared per ELEMENT (keyed by the serial), so it is independent of enumeration order.
      if (c.stats) {
        const ids = Object.keys(c.stats)
        const win = await construct(c.collection, c.args).window(0, ours.length, { stats: ids })
        for (const id of ids) {
          const mine = new Map(win.map((r) => [String(r.element), norm(r[id])]))
          const theirs = spec.stats?.[id] ?? {}
          const wrong = Object.entries(theirs).filter(([serial, v]) => mine.get(serial) !== norm(v)).slice(0, 4)
          expect(wrong.map(([serial, v]) => `${serial}: ours=${mine.get(serial)} sage=${norm(v)}`), `stat ${id}`).toEqual([])
        }
      }
    })
  })
})

it.skipIf(expectSage)('sage oracle skipped — set SAGE_PATH to enable', () => {
  expect(expectSage).toBe(false)
})
