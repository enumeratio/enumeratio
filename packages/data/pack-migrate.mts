// Codemod for the core/packs file split (#283, wiki Core-And-Packs §3.1/§3.4). Moves each sqlsrc file to where
// pack-map.ts's placementOf says it belongs today (`sqlsrc/` for core, `packs/<pack>/` for an EXTRACTED pack),
// and (re)generates each extracted pack's `_pack.sql` manifest. Also the CI lint (`--check`) and what a peer branch
// runs after rebasing onto main to re-normalize itself — see AGENTS.md.
//
//   node --import tsx pack-migrate.mts                 # apply moves + write manifests
//   node --import tsx pack-migrate.mts --dry-run        # print what would happen, change nothing
//   node --import tsx pack-migrate.mts --check          # exit 1 if anything is misplaced/stale, change nothing
//   node --import tsx pack-migrate.mts --packs a,b      # restrict to these packs (still honours EXTRACTED_PACKS)
//
// EXTRACTED_PACKS (pack-map.ts) is empty today, so a bare run is a legitimate no-op — that's the expected state
// until a pack actually lands (#283 phase 3). For testing, ENUMERATIO_PACKS_OVERRIDE=<pack,pack,...> substitutes
// the extracted-set without editing pack-map.ts (which this script never touches).
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { parseRequires } from './sqlsrc-order'
import { packOf, isGlyphLayer, packClosure, PACK_DEPS, extractedPacks, placementOf, dirOf, carrierOfGlyph, type PackName } from './pack-map'

const here = dirname(fileURLToPath(import.meta.url))
const sqlsrcDir = join(here, 'sqlsrc')
const packsDir = join(here, 'packs')

// placement lives in pack-map.ts — including the ENUMERATIO_PACKS_OVERRIDE test hook, so the lint, the codemod
// and the loader can never disagree about where a file belongs.
const overrideEnv = process.env.ENUMERATIO_PACKS_OVERRIDE
const EXTRACTED_PACKS = extractedPacks()

// ---- argv ------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const check = argv.includes('--check')
const packsArgIdx = argv.indexOf('--packs')
const restrictPacks = packsArgIdx >= 0 ? argv[packsArgIdx + 1].split(',').map(s => s.trim()).filter(Boolean) : null

// ---- enumerate every .sql under sqlsrc/ and packs/*/ (manifests excluded — generated/reconciled separately) ----
type Loc = { name: string; dir: string; path: string }   // dir is relative to packages/data/, e.g. 'sqlsrc' or 'packs/paths'

function listSqlFiles(dir: string, relDir: string): Loc[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.sql') && f !== '_pack.sql')
    .map(f => ({ name: f.replace(/\.sql$/, ''), dir: relDir, path: join(dir, f) }))
}

const coreLocs = listSqlFiles(sqlsrcDir, 'sqlsrc')
const packDirNames = existsSync(packsDir) ? readdirSync(packsDir).filter(f => statSync(join(packsDir, f)).isDirectory()) : []
const packLocs = packDirNames.flatMap(p => listSqlFiles(join(packsDir, p), `packs/${p}`))
const allLocs = [...coreLocs, ...packLocs]

// all known basenames (for glyph carrier resolution) — content read lazily below
const contentOf = new Map<string, string>()
function readContent(loc: Loc): string {
  let c = contentOf.get(loc.name)
  if (c === undefined) { c = readFileSync(loc.path, 'utf8'); contentOf.set(loc.name, c) }
  return c
}
const basenameSet = new Set(allLocs.map(l => l.name))
const locByName = new Map(allLocs.map(l => [l.name, l]))

// ---- glyph carrier resolution (O.4) — packOf can't see it: glyph basenames don't match the domain regexes ----
// resolution itself lives in pack-map.ts (carrierOfGlyph), shared with pack-lint.mts. Files matched by
// GLYPH_LAYER but with no trailing `_glyph` (glyph_kinds, hasse_svg) are core machinery, not per-carrier —
// they get the header edit but no carrier-pack override.
const unresolvedGlyphs: string[] = []
function carrierOf(loc: Loc): string | null {
  const carrier = carrierOfGlyph(loc.name, basenameSet, () => parseRequires(readContent(loc)))
  if (/^(.*)_glyph$/.test(loc.name) && carrier === null) unresolvedGlyphs.push(loc.name)
  return carrier
}

// ---- desired directory for each file, honouring the glyph-carrier override ----
function desiredDirOf(loc: Loc): string {
  const carrier = carrierOf(loc)
  return dirOf(carrier ?? loc.name)   // dirOf(carrier) is the carrier's OWN target dir, whether or not it has moved yet
}

// ---- header edit: `-- layer: glyph` on every isGlyphLayer file, idempotent ----
function withLayerHeader(content: string): string {
  if (/^--\s*layer:\s*glyph\s*$/im.test(content)) return content
  // insert right after the leading run of `--` comment lines (the header block), before the first blank/code line
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length && lines[i].startsWith('--')) i++
  lines.splice(i, 0, '-- layer: glyph')
  return lines.join('\n')
}

// ---- plan: one entry per file that needs to move (dir mismatch) ----
type Move = { name: string; fromDir: string; toDir: string; fromPath: string; toPath: string; addsLayerHeader: boolean }
const moves: Move[] = []
for (const loc of allLocs) {
  const toDir = desiredDirOf(loc)
  if (restrictPacks) {
    const fromPack = loc.dir === 'sqlsrc' ? 'core' : loc.dir.replace(/^packs\//, '')
    const toPack = toDir === 'sqlsrc' ? 'core' : toDir.replace(/^packs\//, '')
    if (!restrictPacks.includes(fromPack) && !restrictPacks.includes(toPack)) continue
  }
  if (toDir === loc.dir) continue   // already in place — header edits ride along with a move, not a standalone pass
  const addsLayerHeader = isGlyphLayer(loc.name) && !/^--\s*layer:\s*glyph\s*$/im.test(readContent(loc))
  moves.push({
    name: loc.name, fromDir: loc.dir, toDir,
    fromPath: loc.path, toPath: join(here, toDir, loc.name + '.sql'),
    addsLayerHeader,
  })
}
moves.sort((a, b) => a.name.localeCompare(b.name))

// ---- which packs need a _pack.sql (any extracted pack that owns >=1 file after the moves) ----
const extractedInScope = restrictPacks ? EXTRACTED_PACKS.filter(p => restrictPacks.includes(p)) : EXTRACTED_PACKS

// A pack's MANIFEST `requires-pack` only names dependencies actually materialized as `packs/<p>/` directories
// (§5's PACK_DEPS is the full aspirational graph — most of it still lives in sqlsrc/ mid-split). A dependency
// that hasn't been extracted yet needs no graph edge: its files are still core, already the implicit dependency
// of every pack, and `orderPacks` errors on a `requires-pack` naming a pack it can't find on disk. Staged as the
// split lands lane-by-lane (#283 §10 phase 3) — a dep here starts appearing in the manifest the moment ITS OWN
// pack is extracted, no manual bookkeeping.
function materializedDeps(pack: PackName): PackName[] {
  return PACK_DEPS[pack].filter(dep => dep === 'core' || EXTRACTED_PACKS.includes(dep))
}

type PackManifestStatus = { pack: PackName; exists: boolean; stale: boolean; path: string; requires: string; description: string | null; version: string }
const manifestStatuses: PackManifestStatus[] = []
for (const pack of extractedInScope) {
  const dir = join(packsDir, pack)
  const path = join(dir, '_pack.sql')
  const deps = materializedDeps(pack)
  const requiresLine = deps.join(', ') || '(none)'
  let exists = existsSync(path)
  let description: string | null = null
  let version = '0.1.0'
  let stale = !exists
  if (exists) {
    const content = readFileSync(path, 'utf8')
    // First `-- ...` comment line that isn't the `pack:`/`requires-pack:` header (a bare negative-lookahead regex
    // here mismatches: `\s*` backtracks to zero chars so the lookahead sees a leading space instead of "pack:"
    // and matches anyway — filter line-by-line instead of relying on one regex to reject the header lines).
    const descLine = content.split('\n').find(l => {
      const m = /^--\s*(.+)$/.exec(l)
      return m && !/^(pack|requires-pack):/.test(m[1])
    })
    description = descLine ? /^--\s*(.+)$/.exec(descLine)![1] : null
    const versionMatch = content.match(/VALUES\s*\(\s*'[^']*'\s*,\s*'([^']+)'/)
    if (versionMatch) version = versionMatch[1]
    const reqMatch = content.match(/^--\s*requires-pack:\s*(.*)$/m)
    const currentReq = reqMatch ? reqMatch[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean) : []
    const wantReq = deps.slice().sort()
    stale = JSON.stringify(currentReq.slice().sort()) !== JSON.stringify(wantReq)
  }
  manifestStatuses.push({ pack, exists, stale, path, requires: requiresLine, description, version })
}

function renderPackManifest(pack: PackName, description: string, version: string): string {
  const deps = materializedDeps(pack)
  return [
    `-- pack: ${pack}`,
    `-- requires-pack: ${deps.join(', ') || '(none)'}`,
    `-- ${description}`,
    '',
    `INSERT INTO base_pack (id, version, requires) VALUES ('${pack}', '${version}', '{${deps.join(',')}}');`,
    '',
  ].join('\n')
}

// ---- report / apply ---------------------------------------------------------------------------------------
const label = check ? 'pack-migrate --check' : dryRun ? 'pack-migrate --dry-run' : 'pack-migrate'
console.log(`${label}: ${allLocs.length} sql files scanned (${coreLocs.length} in sqlsrc/, ${packLocs.length} in packs/*)`)
if (overrideEnv) console.log(`  [ENUMERATIO_PACKS_OVERRIDE active: extracted = ${EXTRACTED_PACKS.join(', ') || '(none)'}]`)

if (unresolvedGlyphs.length) {
  console.log(`\n-- glyph files whose carrier could not be resolved (left in place) --`)
  for (const g of unresolvedGlyphs) console.log(`  ${g}`)
}

for (const m of moves) {
  const what = m.fromDir === m.toDir ? `header: ${m.name} += "-- layer: glyph"` : `move: ${m.name}  ${m.fromDir} -> ${m.toDir}${m.addsLayerHeader ? '  (+ layer: glyph)' : ''}`
  console.log(`  ${what}`)
}

const staleManifests = manifestStatuses.filter(m => m.stale)
for (const m of staleManifests) {
  console.log(`  manifest: packs/${m.pack}/_pack.sql  ${m.exists ? 'reconcile requires-pack' : 'create'}  (requires-pack: ${m.requires})`)
}

console.log(`\n-- summary --`)
console.log(`  ${moves.length} file(s) to move/edit, ${staleManifests.length} manifest(s) to write`)

if (check) {
  const clean = moves.length === 0 && staleManifests.length === 0
  console.log(clean ? '  OK — no-op, everything already in place' : '  FAIL — see above')
  process.exit(clean ? 0 : 1)
}

if (dryRun) {
  process.exit(0)
}

// ---- apply -------------------------------------------------------------------------------------------------
function gitTracked(path: string): boolean {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', path], { cwd: here, stdio: 'pipe' })
    return true
  } catch { return false }
}

for (const m of moves) {
  mkdirSync(dirname(m.toPath), { recursive: true })
  if (m.fromDir !== m.toDir) {
    if (gitTracked(m.fromPath)) {
      execFileSync('git', ['mv', m.fromPath, m.toPath], { cwd: here })
    } else {
      writeFileSync(m.toPath, readContent(locByName.get(m.name)!))
      // untracked source — remove the old file since git mv wasn't used
      try { unlinkSync(m.fromPath) } catch {}
    }
  }
  if (m.addsLayerHeader) {
    const target = m.fromDir !== m.toDir ? m.toPath : m.fromPath
    const content = readFileSync(target, 'utf8')
    writeFileSync(target, withLayerHeader(content))
  }
}

for (const m of manifestStatuses) {
  if (!m.stale) continue
  const dir = join(packsDir, m.pack)
  mkdirSync(dir, { recursive: true })
  const description = m.description ?? `${m.pack} pack.`
  writeFileSync(m.path, renderPackManifest(m.pack, description, m.version))
}

console.log(`\napplied: ${moves.length} file(s) moved/edited, ${staleManifests.length} manifest(s) written`)
