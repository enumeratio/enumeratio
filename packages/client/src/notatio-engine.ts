// notatioEngine — the notebook's ONE evaluation engine. No SQL, no generic router: a single engine that owns the
// whole policy and dispatches EXPLICITLY, so it's obvious what computes what (and fast to verify).
//
// Three substrates, all pure-TS, kept behind ONE `classify(expr)` decision — this is the "where does any given
// thing live" answer:
//
//   • ENUMERATION over a collection handle — `unrank`/`rank`/`locate`/`next`/`prev`/`random_element`/`cardinality`,
//     and a bare handle result — is answered by `@enumeratio/compute-engine`'s CollectionHandlers via
//     `ceEnumEngine` (the library's O(1) `At`/`Rank`/`Length` IS the enumerator). This is the ONLY substrate that
//     touches a handle.
//   • SCALAR math — arithmetic, curated identities, CE-native heads (trig/√/ζ/…), constants — is answered by our
//     own `@enumeratio/math` twins (`tsEngine`) when they have an EXACT impl, else by compute-engine (`ceEngine`).
//     ts goes first only because it carries exact bigint for the curated sequences (`bell(30)` to the last digit)
//     that CE has no operator for; where ts has no impl, or reports its float64 result would be INEXACT, CE — the
//     kernel we reuse directly and intentionally — takes it. That ts→ce step is the one runtime decision here, and
//     it is NAMED (not an opaque fall-through down an anonymous engine list): `dispatch()` returns the exact,
//     ordered candidate set for the expr, and nothing else is consulted.
//
// What is NOT here: `pgEngine`. The notebook never round-trips to SQL. The pg path is kept for the EXPLORER and for
// cross-verification — the same IR compiles to SQL, and a differential harness can check the two agree (parity is
// a design constraint + a free correctness oracle), but that is a separate wiring, never the notebook's evaluator.
import { ceEngine } from './ce-engine'
import { ceEnumEngine } from './ce-enum-engine'
import type { CanOpts, Engine, EngineDelta, EngineOpts, EvaluateResult, Plan } from './engine'
import type { Expr } from './ir'
import type { Registry } from './registry'
import { InexactResult, tsEngine } from './ts-engine'
import type { Row } from './core'

export function notatioEngine(reg: Registry): Engine {
  // exactRationals: the notebook has no pg to be bit-identical to, so int/int division yields an exact reduced
  // rational ∈ ℚ (ts declines the non-integral quotient → ce prints `p/q`) rather than a float (#365). ce also
  // renders CE-native results as exact LaTeX and folds constants/`.N()` numerically (symbolicLatex/numericFallback).
  const enumE = ceEnumEngine()
  const ts = tsEngine(reg, { exactRationals: true })
  const ce = ceEngine(reg, { exactRationals: true, numericFallback: true, symbolicLatex: true })

  /** The ordered substrate candidates for `expr`, chosen explicitly by shape — enumeration to the CE library,
   *  everything else to the scalar pair (exact twins, then the CE kernel). The list is tried in order, an
   *  `InexactResult` from one advancing to the next; a scalar never reaches `enumE`, a handle never reaches ts/ce. */
  const dispatch = (expr: Expr): Engine[] => (enumE.can(expr) ? [enumE] : [ts, ce])

  return {
    id: 'notatio',
    can: (expr, opts) => dispatch(expr).some((e) => e.can(expr, opts)),

    why(expr, opts) {
      const cands = dispatch(expr)
      if (cands.some((e) => e.can(expr, opts))) return undefined
      return cands.map((e) => `${e.id}: ${e.why(expr, opts) ?? 'declined'}`).join('; ')
    },

    evaluate(expr: Expr, opts: EngineOpts = {}): EvaluateResult {
      const claimants = dispatch(expr).filter((e) => e.can(expr))
      if (!claimants.length) throw new Error(`notatio: nothing can evaluate this expression — ${this.why(expr) ?? ''}`)
      // Drain eagerly so an engine's SOFT decline (ts's float64 past exact range throws InexactResult) is caught
      // HERE and the next candidate tried, before any row reaches the caller. Mirrors routerEngine's drain — the
      // one subtle bit (a dangling ce `plan` rejection on the abandoned attempt gets a no-op catch).
      const run = (async (): Promise<{ plan: Plan; rows: Row[] }> => {
        let last: unknown
        for (const e of claimants) {
          let r: EvaluateResult | undefined
          try {
            r = e.evaluate(expr, opts)
            const rows: Row[] = []
            for await (const row of r.rows) rows.push(row)
            return { plan: await r.plan, rows }
          } catch (err) {
            if (!(err instanceof InexactResult)) throw err
            r?.plan.catch(() => {})
            last = err
          }
        }
        throw last instanceof Error ? last : new Error('notatio: no substrate could evaluate this expression')
      })()
      const plan = run.then((r) => r.plan)
      plan.catch(() => {})
      return { plan, rows: { async *[Symbol.asyncIterator]() { yield* (await run).rows } } }
    },

    async extend(delta: EngineDelta): Promise<void> { await Promise.all([enumE, ts, ce].map((e) => e.extend(delta))) },
    async close(): Promise<void> { await Promise.all([enumE, ts, ce].map((e) => e.close())) },
  }
}
