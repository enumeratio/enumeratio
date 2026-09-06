// Shared ordering for the sqlsrc files. Each file declares its dependencies in a header comment:
//   -- requires: integer_compositions, dyck_paths        (by file name)
//   -- requires-tag: collection                          (by TAG — slurps every file that provides it)
//   -- provides: figurate, species-target                (tags this file offers; a file always provides its own name)
// The built-in tag `collection` is inferred for any file that declares a `base_collection` — so `requires-tag: collection`
// depends on every collection with no list to maintain. The single bootstrap.sql (the irreducible seed) always loads
// first; every other file implicitly follows it. Order is a stable topological sort (Kahn, ties broken lexically) over
// the resolved edges. Used by run.mts (disk) and index.ts (the Vite bundle) — one ordering, one source of truth.
//
// `orderPacks` (core/packs split, #283) is the pack-scoped variant: a pack's own files are ordered by the same
// Kahn pass, but `requires-tag` expands only over that pack's OWN files, and `requires: x` satisfied by a file in
// the pack's dependency closure (already emitted) contributes no edge — see orderFiles below.

export type SqlFile = { name: string; content: string }   // name = basename without .sql (e.g. 'subsets', 'bootstrap')
export type Pack = { name: string; requiresPack: string[]; files: SqlFile[] }

const BOOTSTRAP = 'bootstrap'

/** Basename of a pack's manifest file (`packs/<p>/_pack.sql`, wiki Core-And-Packs §3.1) — the pack's own implicit
 *  seed, the way `bootstrap` is core's: every other file in the pack implicitly follows it, with no `requires:`
 *  to write. `pack-migrate.mts` generates the file this parses. */
export const PACK_MANIFEST = '_pack'

/** Parse a pack manifest's two headers: `-- pack: <name>` and `-- requires-pack: a, b` (or `(none)`, or absent —
 *  both mean no deps). Pure — no fs — so both the node loaders and the Vite-bundled browser entry (index.ts) share
 *  one parser instead of each screen-scraping the header format. */
export function parsePackManifest(content: string): { pack: string; requiresPack: string[] } {
  const packMatch = content.match(/^--\s*pack:\s*(.+)$/im)
  if (!packMatch) throw new Error(`pack manifest missing "-- pack: <name>" header`)
  const pack = packMatch[1].trim()
  const reqMatch = content.match(/^--\s*requires-pack:\s*(.*)$/im)
  const raw = reqMatch ? reqMatch[1].trim() : ''
  const requiresPack = raw === '' || raw === '(none)' ? [] : raw.split(',').map(s => s.trim()).filter(Boolean)
  return { pack, requiresPack }
}

export function parseRequires(content: string): string[] {
  const m = content.match(/^--\s*requires:\s*(.+)$/im)
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []
}
export function parseRequiresTags(content: string): string[] {
  const m = content.match(/^--\s*requires-tag:\s*(.+)$/im)
  return m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []
}
// the tags a file offers: an explicit `-- provides:` list, plus the built-in `collection` for any file with a
// `base_collection` declaration (so a new collection is auto-included by `requires-tag: collection`, no list to edit).
export function parseProvides(content: string): string[] {
  const m = content.match(/^--\s*provides:\s*(.+)$/im)
  const explicit = m ? m[1].split(',').map(s => s.trim()).filter(Boolean) : []
  if (/INSERT\s+INTO\s+base_collection\b/i.test(content)) explicit.push('collection')
  return explicit
}

// Shared Kahn toposort over one file set. `externals` (default empty) are basenames already loaded elsewhere — a
// `requires: x` on an external is satisfied with no edge; `requires-tag` still expands only over `files` (its own
// set), never `externals`. `packName` + `ownerOf` are only used to shape the "owned by pack" error for orderPacks;
// orderSqlsrc's plain-file call omits them and gets today's "requires unknown" wording unchanged. `impliedSeed`
// (default `bootstrap`) is the one file every other file in the set implicitly follows with no `requires:` to
// write — core's `bootstrap`, or a pack's `_pack` manifest (orderPacks passes `PACK_MANIFEST` for pack file sets).
function orderFiles(
  files: SqlFile[],
  opts: { externals?: Set<string>; packName?: string; ownerOf?: Map<string, string>; impliedSeed?: string } = {},
): SqlFile[] {
  const impliedSeed = opts.impliedSeed ?? BOOTSTRAP
  const externals = opts.externals ?? new Set<string>()
  const names = new Set(files.map(f => f.name))
  // tag → the file names that provide it (a file also implicitly provides its own name, handled by name-requires)
  const providers = new Map<string, Set<string>>()
  for (const f of files) for (const tag of parseProvides(f.content)) {
    if (!providers.has(tag)) providers.set(tag, new Set())
    providers.get(tag)!.add(f.name)
  }
  const deps = new Map<string, string[]>()
  for (const f of files) {
    const req = parseRequires(f.content)
    for (const tag of parseRequiresTags(f.content)) {          // expand each requires-tag to its providers (minus self)
      const provs = providers.get(tag)
      if (!provs || provs.size === 0) throw new Error(`sqlsrc "${f.name}" requires-tag "${tag}" but no file provides it`)
      for (const p of provs) if (p !== f.name) req.push(p)
    }
    const reqSet = [...new Set(req)]
    const ownReq: string[] = []
    for (const d of reqSet) {
      if (externals.has(d)) continue                            // already loaded by a required pack — no edge
      if (!names.has(d)) {
        const owner = opts.ownerOf?.get(d)
        if (owner) {
          throw new Error(
            `pack "${opts.packName}" requires "${d}" owned by pack "${owner}" — declare \`requires-pack: ${owner}\``,
          )
        }
        throw new Error(`sqlsrc "${f.name}" requires unknown "${d}"`)
      }
      ownReq.push(d)
    }
    if (f.name !== impliedSeed && names.has(impliedSeed) && !ownReq.includes(impliedSeed)) ownReq.push(impliedSeed)   // implicit seed
    deps.set(f.name, ownReq)
  }
  const indeg = new Map([...names].map(n => [n, 0] as [string, number]))
  const adj = new Map([...names].map(n => [n, [] as string[]]))
  for (const [n, req] of deps) for (const d of req) { adj.get(d)!.push(n); indeg.set(n, indeg.get(n)! + 1) }
  const ready = [...names].filter(n => indeg.get(n) === 0).sort()
  const out: string[] = []
  while (ready.length) {
    const n = ready.shift()!
    out.push(n)
    for (const m of adj.get(n)!.sort()) { indeg.set(m, indeg.get(m)! - 1); if (indeg.get(m) === 0) { ready.push(m); ready.sort() } }
  }
  if (out.length !== names.size) throw new Error(`sqlsrc dependency cycle among: ${[...names].filter(n => !out.includes(n)).join(', ')}`)
  const byName = new Map(files.map(f => [f.name, f]))
  return out.map(n => byName.get(n)!)
}

export function orderSqlsrc(files: SqlFile[]): SqlFile[] {
  return orderFiles(files)
}

// Pack-scoped ordering (#283 phase 1.1). `core` is always first and the implicit dependency of every pack (its
// files are always in every pack's externals). Packs are toposorted by `requiresPack`, stable + lexical tie-break
// like the file sort within a pack. For each pack (in that order) its own files are ordered by `orderFiles` with
// `externals` = every basename in the pack's transitive requiresPack closure (core included) — so `requires-tag`
// on a pack file expands over the pack's own files only, never reaching into an external.
export function orderPacks(core: Pack, packs: Pack[]): SqlFile[] {
  const packMap = new Map<string, Pack>([[core.name, core], ...packs.map(p => [p.name, p] as const)])

  // owner map for the "owned by pack" error — every file basename (core + all packs) → its owning pack name.
  const ownerOf = new Map<string, string>()
  for (const p of packMap.values()) for (const f of p.files) ownerOf.set(f.name, p.name)

  // toposort the pack graph (core excluded — it's always first, not a node to schedule).
  const packNames = packs.map(p => p.name)
  const indeg = new Map(packNames.map(n => [n, 0] as [string, number]))
  const adj = new Map(packNames.map(n => [n, [] as string[]]))
  for (const p of packs) {
    for (const r of new Set(p.requiresPack)) {
      if (r === core.name) continue                              // core is implicit, not a graph edge to schedule
      if (!packMap.has(r)) throw new Error(`pack "${p.name}" requires-pack unknown "${r}"`)
      adj.get(r)!.push(p.name)
      indeg.set(p.name, indeg.get(p.name)! + 1)
    }
  }
  const ready = packNames.filter(n => indeg.get(n) === 0).sort()
  const packOrder: string[] = []
  while (ready.length) {
    const n = ready.shift()!
    packOrder.push(n)
    for (const m of adj.get(n)!.sort()) { indeg.set(m, indeg.get(m)! - 1); if (indeg.get(m) === 0) { ready.push(m); ready.sort() } }
  }
  if (packOrder.length !== packNames.length) {
    throw new Error(`pack dependency cycle among: ${packNames.filter(n => !packOrder.includes(n)).join(', ')}`)
  }

  // transitive closure of files reachable via requiresPack (core always included) — the pack's `externals`.
  function closureFiles(packName: string): Set<string> {
    const seenPacks = new Set<string>([core.name])
    const stack = [...packMap.get(packName)!.requiresPack]
    while (stack.length) {
      const n = stack.pop()!
      if (seenPacks.has(n)) continue
      seenPacks.add(n)
      const p = packMap.get(n)
      if (p) stack.push(...p.requiresPack)
    }
    const files = new Set<string>()
    for (const pn of seenPacks) for (const f of packMap.get(pn)!.files) files.add(f.name)
    return files
  }

  const out: SqlFile[] = [...orderFiles(core.files, { packName: core.name, ownerOf })]
  for (const packName of packOrder) {
    const pack = packMap.get(packName)!
    out.push(...orderFiles(pack.files, { externals: closureFiles(packName), packName, ownerOf, impliedSeed: PACK_MANIFEST }))
  }
  return out
}

export type PackSegment = { pack: string; files: SqlFile[] }

/** Group `orderPacks()`'s flat output into contiguous per-pack segments (core's segment first, then each pack in
 *  pack order — contiguous by construction, since orderPacks emits one pack's files at a time). A loader wraps
 *  each non-core segment with `set_config('enumeratio.pack', …)` / resets to 'core' after (see applyPackSegments,
 *  and node.ts/run.mts for the pglite-specific wiring).
 *
 *  Owner lookup is keyed by FILE OBJECT identity, not name — every pack's manifest file shares the same basename
 *  (`PACK_MANIFEST` = `_pack`, see readPacksFromDisk), so a name-keyed map collides across packs and misattributes
 *  every pack's manifest entry to whichever pack was inserted last. `orderPacks`/`orderFiles` only ever reorder the
 *  input `SqlFile` objects (never clone them), so the objects in `ordered` are the exact same references found in
 *  `core.files`/`p.files` — identity is safe to key on. */
export function segmentByPack(ordered: SqlFile[], core: Pack, packs: Pack[]): PackSegment[] {
  const owners = new Map<SqlFile, string>()
  for (const f of core.files) owners.set(f, core.name)
  for (const p of packs) for (const f of p.files) owners.set(f, p.name)
  const segments: PackSegment[] = []
  for (const f of ordered) {
    const owner = owners.get(f) ?? core.name
    const last = segments[segments.length - 1]
    if (last && last.pack === owner) last.files.push(f)
    else segments.push({ pack: owner, files: [f] })
  }
  return segments
}

export type ApplyFn = (label: string, sql: string) => Promise<void>

/** Apply pack segments to a session (pglite or real Postgres — `apply` owns the actual `.exec`/`.query`, so this
 *  stays backend-agnostic), bracketing each non-core segment with `set_config('enumeratio.pack', <p>, false)` and
 *  resetting to the concrete value `'core'` afterward — never `NULL` (that resets a placeholder GUC to `''`, not
 *  NULL; see AGENTS.md "Common gotchas"). Each pack is finalized with `base_pack_finalize(<pack>)` before the
 *  reset, so a finalizer sees that pack's collections and only those. Core finalizes itself at the tail of its own
 *  load (meta-collections.stats.sql), since core is not a segment the loader brackets. */
export async function applyPackSegments(segments: PackSegment[], apply: ApplyFn): Promise<void> {
  for (const seg of segments) {
    const inPack = seg.pack !== 'core'
    if (inPack) await apply(`set_config(enumeratio.pack='${seg.pack}')`, `SELECT set_config('enumeratio.pack', '${seg.pack.replace(/'/g, "''")}', false)`)
    for (const f of seg.files) await apply(`${f.name}.sql`, f.content)
    if (inPack) {
      await apply(`base_pack_finalize('${seg.pack}')`, `SELECT base_pack_finalize('${seg.pack.replace(/'/g, "''")}')`)
      await apply(`set_config(enumeratio.pack='core')`, `SELECT set_config('enumeratio.pack', 'core', false)`)
    }
  }
}
