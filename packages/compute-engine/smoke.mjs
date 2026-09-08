// smoke — the "actually slotted in" check the in-workspace vitest (test/interop.test.ts, which runs against
// ../src) cannot make: pack THIS package to a tarball, install it + compute-engine ONLY into a throwaway dir
// OUTSIDE the workspace, and evaluate. Proves the published artifact loads into a bare ComputeEngine with no
// @enumeratio/* internals and no pglite pulled in — the whole point of the "extend, don't wrap" posture.
//
//   node smoke.mjs            (from packages/compute-engine)
//   pnpm --filter @enumeratio/compute-engine smoke
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = dirname(fileURLToPath(import.meta.url))
const CE_VERSION = '0.125.0'
const work = mkdtempSync(join(tmpdir(), 'enumeratio-ce-smoke-')) // OUTSIDE the workspace — no pnpm graph reaches here
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString()
const fail = (m) => { console.error('✗ smoke:', m); rmSync(work, { recursive: true, force: true }); process.exit(1) }

try {
  console.log('smoke: packing tarball (pnpm pack → runs prepack build, applies publishConfig → dist exports)…')
  run(`pnpm pack --pack-destination "${work}"`, pkgDir)
  const tgz = readdirSync(work).find((f) => f.endsWith('.tgz'))
  if (!tgz) fail('pnpm pack produced no tarball')
  const tarball = join(work, tgz)

  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'smoke', private: true, type: 'module' }))
  console.log('smoke: installing the tarball + compute-engine into a clean dir outside the workspace…')
  run(`npm install --no-audit --no-fund --no-package-lock "${tarball}" @cortex-js/compute-engine@${CE_VERSION}`, work)

  // No @enumeratio/* internals, no pglite, should have been dragged in.
  const scoped = existsSync(join(work, 'node_modules/@enumeratio')) ? readdirSync(join(work, 'node_modules/@enumeratio')) : []
  if (scoped.some((n) => n !== 'compute-engine')) fail(`pulled extra @enumeratio internals: ${scoped.join(', ')}`)
  for (const banned of ['@electric-sql', 'pglite', 'pg']) {
    if (existsSync(join(work, 'node_modules', banned))) fail(`pulled ${banned} — this package must be pglite-free`)
  }

  writeFileSync(join(work, 'app.mjs'), `
    import { ComputeEngine } from '@cortex-js/compute-engine'
    import { installEnumeratio } from '@enumeratio/compute-engine'
    const ce = installEnumeratio(new ComputeEngine())
    const s = (mj) => ce.box(mj).evaluate().toString()
    console.log(JSON.stringify({
      lastPerm: s(['At', ['SymmetricGroup', 4], 24]),
      dyck5:    s(['Length', ['DyckPaths', 5]]),
      rank:     s(['Rank', ['SymmetricGroup', 4], ['List', 1, 3, 2, 4]]),
      bell5:    s(['BellB', 5]),
      hex255:   s(['IntegerDigits', 255, 16]),
      ceFact:   s(['Factorial', 6]),
    }))
  `)
  console.log('smoke: evaluating on a bare engine (plain node — the tarball ships built dist/*.js)…')
  const out = JSON.parse(run('node app.mjs', work))

  const expect = {
    lastPerm: '[4,3,2,1]', dyck5: '42', rank: '3', bell5: '52', hex255: '[15,15]', ceFact: '720',
  }
  for (const [k, want] of Object.entries(expect)) {
    if (out[k] !== want) fail(`${k}: got ${JSON.stringify(out[k])}, want ${JSON.stringify(want)}`)
  }
  console.log('✓ smoke: packed tarball loads into a bare ComputeEngine — no @enumeratio internals, no pglite —', JSON.stringify(out))
  rmSync(work, { recursive: true, force: true })
} catch (e) {
  console.error(e?.stdout?.toString?.() ?? '', e?.stderr?.toString?.() ?? '')
  fail(e?.message ?? String(e))
}
