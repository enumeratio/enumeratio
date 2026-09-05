// Shared ordering for the sqlsrc files. Each file declares its dependencies in a header comment:
//   -- requires: integer_compositions, dyck_paths        (by file name)
//   -- requires-tag: collection                          (by TAG — slurps every file that provides it)
//   -- provides: figurate, species-target                (tags this file offers; a file always provides its own name)
// The built-in tag `collection` is inferred for any file that declares a `base_collection` — so `requires-tag: collection`
// depends on every collection with no list to maintain. The single bootstrap.sql (the irreducible seed) always loads
// first; every other file implicitly follows it. Order is a stable topological sort (Kahn, ties broken lexically) over
// the resolved edges. Used by run.mts (disk) and index.ts (the Vite bundle) — one ordering, one source of truth.

export type SqlFile = { name: string; content: string }   // name = basename without .sql (e.g. 'subsets', 'bootstrap')

const BOOTSTRAP = 'bootstrap'

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

export function orderSqlsrc(files: SqlFile[]): SqlFile[] {
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
    for (const d of reqSet) if (!names.has(d)) throw new Error(`sqlsrc "${f.name}" requires unknown "${d}"`)
    if (f.name !== BOOTSTRAP && names.has(BOOTSTRAP) && !reqSet.includes(BOOTSTRAP)) reqSet.push(BOOTSTRAP)   // implicit seed
    deps.set(f.name, reqSet)
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
