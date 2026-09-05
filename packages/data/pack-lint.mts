// Cross-pack dependency lint for the core/packs split (#283, wiki Core-And-Packs §3.2/§3.3/§5).
// Reads the CURRENT sqlsrc/ (unsplit) and, using the provisional file->pack map (pack-map.ts), reports what the
// split WOULD look like: file counts per pack, direct cross-pack `requires:` edges (tag edges excluded), and
// tag-anchor files whose SQL text literally mentions a non-core pack's collection ids (the "hidden" per-pack rows
// that §5 says must split alongside the file). Exits 1 if any cross-pack edge violates the declared PACK_DEPS
// closure (undeclared inter-pack dependency) — the linter is meant to run clean against the trial partition.
//   node --import tsx pack-lint.mts            # human-readable report
//   node --import tsx pack-lint.mts --json     # same report as JSON
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseRequires, parseRequiresTags, parseProvides } from './sqlsrc-order'
import { packOf, isGlyphLayer, packClosure, PACK_DEPS, type PackName } from './pack-map'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, 'sqlsrc')
const asJson = process.argv.includes('--json')

type File = { name: string; content: string; requires: string[]; requiresTags: string[]; provides: string[] }

const files: File[] = readdirSync(dir).filter(f => f.endsWith('.sql')).map(f => {
  const name = f.replace(/\.sql$/, '')
  const content = readFileSync(join(dir, f), 'utf8')
  return { name, content, requires: parseRequires(content), requiresTags: parseRequiresTags(content), provides: parseProvides(content) }
})

// ---- (a) file count per pack, with glyph-layer sub-count ----------------------------------------------------
const perPack = new Map<PackName, { files: number; glyph: number }>()
for (const f of files) {
  const pack = packOf(f.name)
  const entry = perPack.get(pack) ?? { files: 0, glyph: 0 }
  entry.files++
  if (isGlyphLayer(f.name)) entry.glyph++
  perPack.set(pack, entry)
}
const packCounts = [...perPack.entries()]
  .map(([pack, { files, glyph }]) => ({ pack, files, glyph }))
  .sort((a, b) => b.files - a.files || a.pack.localeCompare(b.pack))

// ---- (b) direct requires: edges crossing pack boundaries (tag edges excluded) -------------------------------
type Edge = { from: string; to: string }
const groups = new Map<string, Edge[]>()   // "packOf(X) -> packOf(Y)" -> edges
for (const f of files) {
  const fromPack = packOf(f.name)
  for (const dep of f.requires) {
    const toPack = packOf(dep)
    if (toPack === 'core' || toPack === fromPack) continue
    const key = `${fromPack} -> ${toPack}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ from: f.name, to: dep })
  }
}
const edgeGroups = [...groups.entries()]
  .map(([key, edges]) => ({ key, count: edges.length, edges: edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)) }))
  .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
const totalCrossPackEdges = edgeGroups.reduce((n, g) => n + g.count, 0)

// ---- (c) tag-anchor files mentioning a non-core pack's collection ids literally -----------------------------
// "collection id" = basename of any file that provides the `collection` tag (auto- or explicitly).
const collectionIds = files.filter(f => f.provides.includes('collection')).map(f => f.name)
const nonCoreCollectionIds = collectionIds.filter(id => packOf(id) !== 'core')
const idRegex = new Map(nonCoreCollectionIds.map(id => [id, new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)]))

const anchorFiles = files.filter(f => f.requiresTags.length > 0)
type AnchorReport = { file: string; byPack: { pack: PackName; count: number; ids: string[] }[] }
const anchorReports: AnchorReport[] = []
for (const f of anchorFiles) {
  const byPack = new Map<PackName, string[]>()
  for (const id of nonCoreCollectionIds) {
    if (id === f.name) continue                          // a file mentioning its own name isn't a cross-pack leak
    if (idRegex.get(id)!.test(f.content)) {
      const pack = packOf(id)
      if (!byPack.has(pack)) byPack.set(pack, [])
      byPack.get(pack)!.push(id)
    }
  }
  if (byPack.size === 0) continue
  anchorReports.push({
    file: f.name,
    byPack: [...byPack.entries()].map(([pack, ids]) => ({ pack, count: ids.length, ids: ids.sort() }))
      .sort((a, b) => b.count - a.count || a.pack.localeCompare(b.pack)),
  })
}
anchorReports.sort((a, b) => a.file.localeCompare(b.file))
const totalAnchorMentions = anchorReports.reduce((n, r) => n + r.byPack.reduce((m, p) => m + p.count, 0), 0)

// ---- violations: edge whose target pack isn't in the declared closure of the source pack --------------------
type Violation = Edge & { fromPack: PackName; toPack: PackName }
const violations: Violation[] = []
for (const g of edgeGroups) {
  const [fromPack, toPack] = g.key.split(' -> ') as [PackName, PackName]
  const closure = packClosure(fromPack)
  if (!closure.has(toPack)) for (const e of g.edges) violations.push({ ...e, fromPack, toPack })
}

const report = {
  filesScanned: files.length,
  packCounts,
  crossPackEdges: { total: totalCrossPackEdges, groups: edgeGroups },
  anchorMentions: { total: totalAnchorMentions, files: anchorReports },
  declaredDeps: PACK_DEPS,
  violations,
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(`pack-lint: scanned ${files.length} sqlsrc files\n`)

  console.log('-- (a) files per pack --')
  for (const { pack, files: n, glyph } of packCounts) {
    console.log(`  ${pack.padEnd(20)} ${String(n).padStart(4)} files${glyph ? `  (${glyph} glyph)` : ''}`)
  }

  console.log(`\n-- (b) direct cross-pack requires: edges (tag edges excluded) — ${totalCrossPackEdges} total --`)
  for (const g of edgeGroups) {
    console.log(`  ${g.key}  (${g.count})`)
    for (const e of g.edges) console.log(`      ${e.from} -> ${e.to}`)
  }

  console.log(`\n-- (c) tag-anchor files mentioning a non-core pack's collection ids — ${totalAnchorMentions} mentions across ${anchorReports.length} files --`)
  for (const r of anchorReports) {
    console.log(`  ${r.file}`)
    for (const p of r.byPack) console.log(`      ${p.pack.padEnd(20)} ${String(p.count).padStart(3)}  [${p.ids.join(', ')}]`)
  }

  console.log(`\n-- summary --`)
  console.log(`  ${totalCrossPackEdges} cross-pack edges, ${violations.length} violate declared PACK_DEPS closure`)
  if (violations.length) {
    console.log(`  violations:`)
    for (const v of violations) console.log(`    ${v.from} -> ${v.to}  (${v.fromPack} -> ${v.toPack}, not in closure(${v.fromPack}))`)
  }
}

process.exit(violations.length ? 1 : 0)
