#!/usr/bin/env -S tsx
// The node entry point: enumerate a collection and dump its elements to stdout. All the parsing + dispatch
// lives in dispatch.ts (environment-agnostic, shared with the docs site's in-browser terminal); this file is just
// the node plumbing around it — stdout with backpressure, EPIPE, the main-thread db, and turning a CliError into
// stderr + a non-zero exit. Everything routes through enumeratio-client (the pure-SQL core).
import debug from 'debug'
import { close, provideDb, makeDb, collections, construct, describe, summary, mapGraph, terminalSelect } from '@enumeratio/client'
import { runCli, CliError, type Client } from './dispatch.js'

const log = debug('enumeratio:cli:run')

/** Write with backpressure — resolve immediately, or wait for drain when the buffer is full. */
function write(s: string): Promise<void> {
  return new Promise((resolve) => {
    if (process.stdout.write(s)) resolve()
    else process.stdout.once('drain', resolve)
  })
}

// a closed pipe (`| head`, quitting `less`) is a normal end, not an error
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(0)
  throw e
})

async function main() {
  // Run pglite in-process (not the worker): the one-shot CLI doesn't need the worker's watchdog — Ctrl-C or an
  // external `timeout` wrapper kills a runaway, and skipping the worker spawn shaves cold-start time. The CLI now
  // drives the PURE-SQL core (bare pglite, zero C) via the injected client.
  provideDb(() => makeDb())
  const client: Client = { collections, construct, describe, summary, mapGraph, terminalSelect }
  log('dispatching argv=%o', process.argv.slice(2))
  const t0 = Date.now()
  await runCli(process.argv.slice(2), { client, write })
  log('done in %dms', Date.now() - t0)
}

main()
  .then(() => close())
  .catch(async (e) => {
    // the message first: close() must never sit between an error and the user seeing it
    process.stderr.write((e instanceof CliError ? e.message : String(e instanceof Error ? e.message : e)) + '\n')
    await close()
    process.exit(1)
  })
