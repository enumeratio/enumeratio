// Persistent pglite worker for render-corpus-check.mts. Boots the full sqlsrc catalog ONCE, then answers one JSON
// request per stdin line with one JSON response per stdout line ({id, rows} or {id, error}). Split into its own
// process so the driver can SIGKILL + respawn it on a slow/hung query (a bad plpgsql loop on some obscure carrier
// must not sink the whole sweep) — see render-corpus-check.mts for why a bare in-process pg.query() isn't safe here.
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline'
import { orderSqlsrc } from './sqlsrc-order'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

const dir = join(here, 'sqlsrc')
const files = orderSqlsrc(
  readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(dir, f), 'utf8') })),
).map((f) => `${f.name}.sql`)

const pg = new PGlite()
await pg.waitReady
for (const f of files) await pg.exec(readFileSync(join(dir, f), 'utf8'))
process.stdout.write(JSON.stringify({ ready: true }) + '\n')

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return
  let msg: any
  try { msg = JSON.parse(line) } catch { return }
  try {
    const result = await pg.query(msg.sql, msg.params)
    process.stdout.write(JSON.stringify({ id: msg.id, rows: result.rows }) + '\n')
  } catch (e: any) {
    process.stdout.write(JSON.stringify({ id: msg.id, error: String(e?.message ?? e) }) + '\n')
  }
})
