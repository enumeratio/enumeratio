// The node-backed Client for dispatch.ts — collection/map reads straight from enumeratio-client, plus a `calc`
// that routes an expression through the engine and reports which one answered. Split out of cli.ts (which is the
// node ENTRY: stdout plumbing + main()) so tests can build the same client in-process without importing — and
// thereby running — cli.ts's top-level main(). The db/engine are read lazily when a method is called, so building
// this object has no side effects (the caller wires provideDb/provideEngine).
import { construct, collections, describe, summary, mapGraph, terminalSelect, evaluate, parseCalc, whyNot } from '@enumeratio/client'
import { CliError, type Client } from './dispatch.js'

export function nodeClient(): Client {
  return {
    collections, construct, describe, summary, mapGraph, terminalSelect,
    async calc(text) {
      const expr = parseCalc(text)
      const { plan, rows } = evaluate(expr)
      const out: Record<string, unknown>[] = []
      try {
        for await (const r of rows) out.push(r as Record<string, unknown>)
      } catch (e) {
        const why = await whyNot(expr)
        throw new CliError(`${(e as Error).message}${why ? `\n  ${why}` : ''}`)
      }
      const p = await plan
      return { value: String(Object.values(out[0] ?? {})[0] ?? ''), engine: p.engine, impl: p.impl }
    },
  }
}
