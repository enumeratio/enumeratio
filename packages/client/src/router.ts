// The router: ask each engine in turn whether it can answer, and take the first that says yes (#278 D6). Order is
// the caller's — fastest first, the oracle last — because `can()` is a claim about correctness, not speed.
//
// One subtlety earns its code: an engine may only discover mid-evaluation that it cannot faithfully report a
// result (ts-engine's float64 impls past 2^53). That is a SOFT decline — the router moves on to the next engine
// rather than surfacing a near-miss, and `Plan.engine` then names whoever actually answered. An engine that
// declines this way must not have produced side effects, which is true of every pure evaluation.
import type { CanOpts, Engine, EngineDelta, EngineOpts, EvaluateResult, Plan } from './engine'
import type { Expr } from './ir'
import { ceEngine } from './ce-engine'
import { pgEngine } from './pg-engine'
import { registry } from './registry'
import { InexactResult, tsEngine } from './ts-engine'
import type { Db, Row } from './core'

export function routerEngine(engines: Engine[]): Engine {
  if (!engines.length) throw new Error('routerEngine: give it at least one engine')
  const pick = (expr: Expr, opts?: CanOpts): Engine | undefined => engines.find((e) => e.can(expr, opts))

  return {
    id: `router(${engines.map((e) => e.id).join(',')})`,
    can: (expr, opts) => pick(expr, opts) !== undefined,

    why(expr, opts) {
      if (pick(expr, opts)) return undefined
      return engines.map((e) => `${e.id}: ${e.why(expr, opts) ?? 'declined'}`).join('; ')
    },

    evaluate(expr: Expr, opts: EngineOpts = {}): EvaluateResult {
      const claimants = engines.filter((e) => e.can(expr))
      if (!claimants.length) throw new Error(`no engine can evaluate this expression — ${this.why(expr) ?? ''}`)
      // Drain eagerly so a soft decline is caught HERE, before any of it reaches the caller. Scalars are one row;
      // a FROM-present expr is claimed by pg, which never soft-declines, so this is not a streaming regression.
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
            // An ASYNC engine (ce, unlike ts's fully-synchronous evalTree) derives `r.plan` from the same pending
            // work as `r.rows` — so a soft decline caught above by draining `rows` leaves `r.plan` independently
            // rejecting with the SAME error, on its own microtask, with nobody ever awaiting it. Attach a no-op
            // catch so that rejection doesn't surface as an unhandled promise rejection (found by ce-engine's
            // arrival — ts never hit this path, since its InexactResult throws before evaluate() even returns).
            r?.plan.catch(() => {})
            last = err
          }
        }
        throw last instanceof Error ? last : new Error('no engine could evaluate this expression')
      })()
      const plan = run.then((r) => r.plan)
      plan.catch(() => {})   // see engine.ts: a caller consuming only `rows` must not also crash the process
      return { plan, rows: { async *[Symbol.asyncIterator]() { yield* (await run).rows } } }
    },

    async extend(delta: EngineDelta): Promise<void> { await Promise.all(engines.map((e) => e.extend(delta))) },
    async close(): Promise<void> { await Promise.all(engines.map((e) => e.close())) },
  }
}

/** The standard wiring: ts, then ce, then pg last. ts first because its native-op path over small arguments is
 *  synchronous and free of any import; ce sits between ts and the oracle because it is exact and still fast, but
 *  is a sizable lazily-loaded chunk (@cortex-js/compute-engine) — nothing imports it until an expression actually
 *  reaches past ts and gets claimed, so a session whose expressions ts already answers never pays for it. Async
 *  because the ts engine reads the catalog snapshot, and a `can()` asked of a half-loaded registry would answer
 *  conservatively for the rest of the session.
 *
 *  Wire the DATABASE eagerly and the ENGINE lazily, so the legacy exports work from the first call:
 *
 *      provideDb(() => makeDb())
 *      provideEngine(() => standardEngine())
 */
export async function standardEngine(dbFactory?: () => Db | Promise<Db>): Promise<Engine> {
  const reg = await registry()
  const pg = pgEngine(dbFactory)
  return routerEngine([tsEngine(reg), ceEngine(reg), pg])
}
