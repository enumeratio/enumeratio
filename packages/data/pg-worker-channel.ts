// A hang-proof query channel over a pglite worker process.
//
// pglite does NOT honour `statement_timeout` — a plpgsql loop or a combinatorial floor scan ignores it, and there
// is no way to cancel such a query from inside the same process. The only real cancellation is killing the
// process that runs it. So: boot the catalog in a child (pg-worker.mts), talk to it one JSON line at a time, and
// SIGKILL + respawn it when a query outruns its wall clock. One pathological query costs one respawn (~7s of
// re-applying sqlsrc), not the whole sweep.
//
// Extracted from render-corpus-check.mts, which has used this shape since #139; selfcert.mts needs it for the
// same reason (see the SKIP handling there).
import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable, Writable } from 'node:stream'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKER = join(dirname(fileURLToPath(import.meta.url)), 'pg-worker.mts')

/** A query killed for outrunning its wall clock. The worker was respawned; the channel is usable again. */
export class QTimeout extends Error {}

export type WorkerChannel = {
  q: <T = any>(sql: string, params?: any[]) => Promise<T[]>
  close: () => void
  /** how many times the worker has been (re)spawned — 1 plus the number of queries killed */
  readonly spawns: number
}

export type ChannelOptions = {
  timeoutMs: number
  /** session setup re-applied after every (re)spawn — GUCs do not survive a kill */
  onReady?: (q: WorkerChannel['q']) => Promise<void>
}

export async function openWorkerChannel(opts: ChannelOptions): Promise<WorkerChannel> {
  let child: ChildProcessByStdio<Writable, Readable, null>   // ['pipe','pipe','inherit'] → stderr passes through
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>()
  let nextId = 1
  let spawns = 0

  const spawnWorker = async (): Promise<void> => {
    spawns++
    child = spawn('node', ['--import', 'tsx', WORKER], { stdio: ['pipe', 'pipe', 'inherit'] })
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (!line.trim()) return
      let msg: any
      try { msg = JSON.parse(line) } catch { return }
      if (msg.ready) return
      const p = pending.get(msg.id)
      if (p) { pending.delete(msg.id); p.resolve(msg) }
    })
    child.on('exit', () => { for (const [, p] of pending) p.reject(new Error('worker exited')); pending.clear() })
    await new Promise<void>((resolve) => {
      const onData = (buf: Buffer) => { if (buf.toString().includes('"ready":true')) { child.stdout.off('data', onData); resolve() } }
      child.stdout.on('data', onData)
    })
    if (opts.onReady) await opts.onReady(q)
  }

  const killWorker = (): void => { try { child.kill('SIGKILL') } catch { /* already dead */ } }

  const q: WorkerChannel['q'] = async <T = any>(sql: string, params?: any[]): Promise<T[]> => {
    const id = nextId++
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new QTimeout('query timeout')), opts.timeoutMs))
    const request = new Promise<any>((resolve, reject) => { pending.set(id, { resolve, reject }) })
    child.stdin.write(JSON.stringify({ id, sql, params }) + '\n')
    try {
      const msg = await Promise.race([request, timeout])
      if (msg.error) throw new Error(msg.error)
      return msg.rows as T[]
    } catch (e) {
      if (e instanceof QTimeout) { pending.delete(id); killWorker(); await spawnWorker() }
      throw e
    }
  }

  await spawnWorker()
  return { q, close: killWorker, get spawns() { return spawns } }
}
