// Persistent pglite worker. Boots the full catalog ONCE — core + every extracted pack (#283 phase 3.4; buildCore()
// is the same loader node.ts's bootCore()/the CLI use, so this worker sees whatever's on disk under packs/*, not
// just sqlsrc/) — then answers one JSON request per stdin line with one JSON response per stdout line ({id, rows}
// or {id, error}). Split into its own process so the driver can SIGKILL + respawn it on a slow/hung query — pglite
// ignores statement_timeout, so killing the process is the only real cancellation there is. Driven through
// pg-worker-channel.ts by render-corpus-check.mts and selfcert.mts.
import { createInterface } from 'node:readline'
import { buildCore } from './node.ts'
import { routeNotice } from './debug-env'

const pg = await buildCore()
process.stdout.write(JSON.stringify({ ready: true }) + '\n')

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return
  let msg: any
  try { msg = JSON.parse(line) } catch { return }
  try {
    const result = await pg.query(msg.sql, msg.params, { onNotice: routeNotice })
    process.stdout.write(JSON.stringify({ id: msg.id, rows: result.rows }) + '\n')
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ id: msg.id, error: String(e?.message ?? e) }) + '\n')
  }
})
