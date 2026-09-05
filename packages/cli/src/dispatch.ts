// The environment-agnostic heart of the CLI: parse argv, dispatch, and write output through an INJECTED
// writer. No node builtins, no process, no fs — so the exact same `enumeratio …` grammar runs in node
// (src/cli.ts wires stdout + backpressure + fs) and in the browser (the docs site's PrimeVue terminal wires
// a line sink over the in-browser pglite). Errors throw `CliError` (a usage/validation failure the caller
// renders); everything else streams through `write`.
// The client is INJECTED (see RunOpts.client) rather than imported, so the same dispatcher drives either backend:
// node's src/cli.ts and the browser terminal both hand it enumeratio-client, differing only in the Db loader
// (node vs in-browser pglite). These are the minimal structural shapes the dispatcher needs; the client satisfies them.
export type RenderOpts = { repr?: string; format?: string; medium?: 'ascii' | 'unicode' | 'latex'; alphabet?: string }
export type Result = { __rank?: unknown; element?: string; [k: string]: unknown }
export type CollSummary = { id: string; title: string; axes: string[]; fiberCount: number; statsCount: number; reprsCount: number; mapsCount: number; examplesCount: number; oeis: string | null }
export type Example = { title: string; kind: string; expected: string | null }
export type CollInfo = { id: string; axes: string[]; realized: string[][]; stats: { statId: string }[]; reprs: { id: string; canonical: boolean }[]; examples: Example[] }
/** A family-parameter value: a point (a number) or a [lo, hi] range (a union of fibers). */
export type ParamValue = number | readonly [number, number]
export type Fiber = { params: Record<string, number>; card: number | null }
export type DistBin = { value: number; count: number }
export type Distribution = { statId: string; total: number; support: [number, number] | null; mode: number | null; mean: number | null; bins: DistBin[] }
export type TriangleRow = { params: Record<string, number>; address: number[]; total: number; bins: DistBin[] }
export interface Handle {
  readonly ctor: string
  card(): Promise<number | null>
  stats(): Promise<{ statId: string }[]>
  serialize(first?: number, count?: number, opts?: RenderOpts): Promise<string[]>
  fibers(): Promise<Fiber[]>
  groupBy(statId: string, opts?: { summarize?: string[] }): Promise<{ value: number; count: number }[]>
  distribution(statId: string): Promise<Distribution>
  triangle(statId: string): Promise<TriangleRow[]>
  maps(): Promise<{ id: string; title: string; codomain: string }[]>
  window(first: number, count: number, opts?: { stats?: string[]; maps?: string[]; through?: string[] }): Promise<Result[]>
  at(address: string, opts?: RenderOpts & { stats?: string[]; maps?: string[] }): Promise<Result | null>
  rankOf(serialization: string): Promise<number | null>
}
export type MapEdge = { source: string; mapId: string; title: string; codomain: string; findstatId: string | null }
export interface Client {
  collections(): Promise<string[]>
  construct(collection: string, args: Record<string, ParamValue>): Handle
  describe(name: string): Promise<CollInfo>
  summary(): Promise<CollSummary[]>
  mapGraph(): Promise<MapEdge[]>
  /** the terminal environment's resolved SELECT list (elements archetype) — the CLI's default projection when no
   *  --select is given (#246); always the registry (policy_resolve), never a hardcoded list here. */
  terminalSelect(collection: string): Promise<string[]>
  /** Evaluate a scalar expression through the engine seam (#278). OPTIONAL: a host that wired only a Db and no
   *  engine simply doesn't offer `calc`, and the command says so instead of failing somewhere deeper. */
  calc?(text: string): Promise<CalcResult>
}

/** What `calc` reports: the value, and WHICH engine produced it with which implementation — the provenance is the
 *  point of routing, so `--explain` can show it rather than asking anyone to trust the router. */
export type CalcResult = { value: string; engine: string; impl?: string; declined?: { engine: string; why: string }[] }

export const USAGE = `
enumeratio — enumerate a combinatorial collection and stream its elements

  enumeratio <collection> [arg=value ...] [options]   enumerate, one element per line (canonical order)
  enumeratio list [collection]                         list the realized collections (or one's catalog shape)
  enumeratio table                                     show all collections as an aligned catalog grid
  enumeratio maps [collection]                          the map graph: every map as source → codomain (or one's)
  enumeratio calc '<fn>(<args>)'                       evaluate a scalar expression (add --explain for provenance)
  enumeratio examples [collection]                     a collection's verified examples (or all, with counts)
  enumeratio --help

Args
  name=value           a family parameter: name=INT fixes it (size=5), name=LO:HI ranges it (size=1:3 → a union
                       of fibers). size is parameter 1. Nothing is required — an infinite collection just streams.

Options
  -R, --repr NAME      serialize elements in a named representation (e.g. cycle, parts) — see list <c>
  -F, --format NAME    which format of that repr (e.g. bars, sets) — the repr's canonical one by default
  -M, --medium NAME    spell it for a medium: unicode (default), latex, ascii — only where a repr has that sibling
  -A, --alphabet NAME  name the atoms with a named alphabet (latin, greek, binary, suits, numeric)
  -r, --range A:B      only ranks [A, B) in canonical order; A: to the end, :B from 0, A a single element
      --at ADDR        inspect ONE element — a rank, or @serialization (e.g. @2413): its rank (when known), every
                       statistic, and every map image, as a card
  -c, --count          print |collection(...)| and exit
      --fibers         list the fibers the handle spans (one per parameter address) with each cardinality
  -g, --group-by STAT  the distribution of a statistic: the count per value, then a # total/mode/mean summary
      --triangle STAT  the statistic's distribution PER FIBER as an aligned triangle (rows = fibers/sizes) —
                       Mahonian, Eulerian, Stirling, Narayana … pair with a size range (size=1:6)
  -s, --stats          project every statistic as TSV columns (with a header)
  -m, --maps A,B,…     project each named map's image as a column (alongside the element)
      --through A,B,…  project ONE column: the element sent through the composition of maps A∘B∘… (each map's
                       codomain feeds the next; e.g. rsk_insertion,shape sends a permutation to a partition)
      --json           project as newline-delimited JSON objects
      --fields A,B,…   project only the named stat IDs (implies --stats; DB computes only these)

Examples
  enumeratio permutations size=4
  enumeratio permutations size=1:3            # a family-parameter range: sizes 1,2,3 (a union of fibers)
  enumeratio subsets size=6 --fibers          # the fibers over the unbound k, with cardinalities
  enumeratio permutations size=4 -g inversions # the Mahonian distribution (count per inversion number)
  enumeratio permutations size=1:6 --triangle inversions  # the Mahonian triangle across sizes 1..6
  enumeratio permutations size=4 --at @2413    # one element's card: its rank, every stat, every map image
  enumeratio permutations size=8 | head
  enumeratio words size=3 base=2 --repr letters --format digits --alphabet binary
  enumeratio subsets size=5 --stats
  enumeratio integer_partitions size=20 --count
`

/** A usage/validation error — the caller decides how to surface it (node: stderr + exit 1; browser: print). */
export class CliError extends Error {}

export type Writer = (s: string) => void | Promise<void>
/** What the environment supplies: the client backend and a writer. */
export type RunOpts = { client: Client; write: Writer }

type OptType = 'string' | 'boolean'
const OPTS: Record<string, { type: OptType; short?: string }> = {
  range: { type: 'string', short: 'r' },
  repr: { type: 'string', short: 'R' },
  format: { type: 'string', short: 'F' },
  medium: { type: 'string', short: 'M' },
  alphabet: { type: 'string', short: 'A' },
  count: { type: 'boolean', short: 'c' },
  at: { type: 'string' },
  fibers: { type: 'boolean' },
  'group-by': { type: 'string', short: 'g' },
  triangle: { type: 'string' },
  stats: { type: 'boolean', short: 's' },
  maps: { type: 'string', short: 'm' },
  through: { type: 'string' },
  json: { type: 'boolean' },
  fields: { type: 'string' },
  explain: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
}
const SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(OPTS).flatMap(([k, o]) => (o.short ? [[o.short, k]] : [])),
)
type Values = { [K in keyof typeof OPTS]?: string | boolean }

/** A tiny browser-safe argv parser matching the CLI grammar: positionals, `--long`/`-x` booleans, and
 * `--long val` / `--long=val` / `-x val` / `-x=val` / `-xval` (attached) for string options. */
function parseArgv(argv: string[]): { values: Values; positionals: string[] } {
  const values: Values = {}
  const positionals: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]
    let name: string | undefined
    let inlineVal: string | undefined
    if (tok.startsWith('--')) {
      const body = tok.slice(2)
      const eq = body.indexOf('=')
      name = eq === -1 ? body : body.slice(0, eq)
      if (eq !== -1) inlineVal = body.slice(eq + 1)
      if (!(name in OPTS)) throw new CliError(`unknown option --${name}`)
    } else if (tok.length > 1 && tok[0] === '-' && !/^-\d/.test(tok)) {
      const body = tok.slice(1)
      const eq = body.indexOf('=')
      const head = eq === -1 ? body : body.slice(0, eq)
      if (SHORT[head]) {
        name = SHORT[head]
        if (eq !== -1) inlineVal = body.slice(eq + 1)
      } else if (SHORT[head[0]] && OPTS[SHORT[head[0]]].type === 'string') {
        name = SHORT[head[0]] // attached short value: -r0:3
        inlineVal = body.slice(1)
      } else {
        throw new CliError(`unknown option -${head}`)
      }
    } else {
      positionals.push(tok)
      continue
    }
    const spec = OPTS[name]
    if (spec.type === 'boolean') {
      if (inlineVal !== undefined) throw new CliError(`--${name} takes no value`)
      values[name] = true
    } else {
      if (inlineVal === undefined) {
        inlineVal = argv[++i]
        if (inlineVal === undefined) throw new CliError(`--${name} requires a value`)
      }
      values[name] = inlineVal
    }
  }
  return { values, positionals }
}

function parseArgsList(specs: string[]): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  for (const s of specs) {
    const eq = s.indexOf('=')
    const key = eq === -1 ? s : s.slice(0, eq)
    const val = eq === -1 ? '' : s.slice(eq + 1)
    // name=INT (a point) or name=LO:HI (a family-parameter range → a union of fibers)
    const m = eq === -1 ? null : val.match(/^(-?\d+)(?::(-?\d+))?$/)
    if (!m) throw new CliError(`bad arg "${s}" (want name=INT or name=LO:HI, e.g. size=5 or size=1:3)`)
    out[key] = m[2] === undefined ? Number(m[1]) : [Number(m[1]), Number(m[2])]
  }
  return out
}

/** A range spec → {first, count}; count undefined means "to the end". */
function parseRange(r: string | undefined): { first: number; count: number | undefined } {
  if (r === undefined) return { first: 0, count: undefined }
  if (!r.includes(':')) return { first: Number(r), count: 1 } // a single rank
  const [a, b] = r.split(':')
  const first = a === '' ? 0 : Number(a)
  return { first, count: b === '' || b === undefined ? undefined : Number(b) - first }
}

const CHUNK = 2048

async function* serializeWindows(h: Handle, first: number, count: number | undefined, opts: RenderOpts): AsyncGenerator<string> {
  let i = first
  const end = count === undefined ? null : first + count
  while (end === null || i < end) {
    const n = end === null ? CHUNK : Math.min(CHUNK, end - i)
    const batch = await h.serialize(i, n, opts)
    for (const s of batch) yield s
    i += batch.length
    if (batch.length < n) break // ran off the end of a finite collection
  }
}

async function* rowWindows(h: Handle, first: number, count: number, stats?: string[]): AsyncGenerator<Result> {
  for (let i = first; i < first + count; i += CHUNK) {
    const batch = await h.window(i, Math.min(CHUNK, first + count - i), stats !== undefined ? { stats } : {})
    for (const r of batch) yield r
    if (batch.length === 0) break
  }
}

const tsvLine = (r: Result, ids: string[]) => [r.__rank, r.element, ...ids.map((id) => r[id])].join('\t') + '\n'
const jsonLine = (r: Result, ids: string[]) =>
  JSON.stringify({ rank: r.__rank, element: r.element, stats: Object.fromEntries(ids.map((id) => [id, r[id]])) }) + '\n'

/** Render a statistic triangle (one distribution per fiber) as aligned rows: a header of stat values, then one
 *  right-aligned row per fiber labelled by its varying parameter(s). Absent cells show as `·`. */
function triangleLines(stat: string, tri: TriangleRow[]): string[] {
  if (!tri.length) return [`(no fibers)`]
  const values = [...new Set(tri.flatMap((r) => r.bins.map((b) => b.value)))].sort((a, b) => a - b)
  // label each row by the parameters that actually vary across fibers (fall back to all if only one fiber)
  const keys = Object.keys(tri[0].params)
  const varying = keys.filter((k) => new Set(tri.map((r) => r.params[k])).size > 1)
  const label = (r: TriangleRow) => (varying.length ? varying : keys).map((k) => `${k}=${r.params[k]}`).join(' ') || '·'
  const cells = tri.map((r) => {
    const m = new Map(r.bins.map((b) => [b.value, b.count]))
    return { label: label(r), cols: values.map((v) => (m.has(v) ? String(m.get(v)) : '·')) }
  })
  const labelW = Math.max(stat.length, ...cells.map((c) => c.label.length))
  const colW = values.map((v, i) => Math.max(String(v).length, ...cells.map((c) => c.cols[i].length)))
  const pad = (s: string, w: number) => s.padStart(w)
  const header = pad(stat, labelW) + '  ' + values.map((v, i) => pad(String(v), colW[i])).join(' ')
  const body = cells.map((c) => pad(c.label, labelW) + '  ' + c.cols.map((s, i) => pad(s, colW[i])).join(' '))
  return [header, ...body]
}

/** Parse `argv` (no program name), run the command, and stream every line to `write`. Throws `CliError` on a
 * usage/validation problem. Db-agnostic: the caller must have a db provided (node: makeMainDb; browser: the
 * client's PGliteWorker). */
export async function runCli(argv: string[], opts: RunOpts): Promise<void> {
  const { write, client } = opts
  const { values, positionals } = parseArgv(argv)

  if (values.help || positionals.length === 0) {
    await write(USAGE)
    return
  }

  const collection = positionals[0]
  if (collection === 'list') {
    if (positionals[1]) await printCollection(positionals[1], write, client)
    else for (const c of await client.collections()) await write(c + '\n')
    return
  }
  if (collection === 'table') return printTable(write, client)
  if (collection === 'maps') return printMapGraph(positionals[1], write, client)
  if (collection === 'examples') return printExamples(positionals[1], opts, write)
  if (collection === 'calc') return printCalc(positionals.slice(1).join(' '), !!values.explain, opts, write)

  const args = parseArgsList(positionals.slice(1))
  const handle = client.construct(collection, args)

  if (values.fibers) {
    // list the fibers this handle spans (one per family-parameter address) with each fiber's cardinality
    for (const f of await handle.fibers()) {
      const addr = Object.entries(f.params).map(([k, v]) => `${k}=${v}`).join(' ') || '(ungraded)'
      await write(`${addr}\t${f.card === null ? 'Infinity' : f.card}\n`)
    }
    return
  }

  if (values.at !== undefined) {
    // inspect ONE element (a rank or @serialization): its rank, every statistic, and every map image as a card
    const addr = String(values.at)
    const statIds = (await handle.stats()).map((s) => s.statId)
    const mapInfos = await handle.maps()
    const render: RenderOpts = { repr: values.repr as string, format: values.format as string, medium: values.medium as RenderOpts['medium'], alphabet: values.alphabet as string }
    const r = await handle.at(addr, { ...render, stats: statIds, maps: mapInfos.map((m) => m.id) })
    if (!r) throw new CliError(`${handle.ctor}: no element addressed by '${addr}'`)
    // rank comes free for a rank-address; for an @serialization address, look it up (canonical repr only)
    const rank = r.__rank ?? (render.repr ? undefined : await handle.rankOf(String(r.element)))
    await write(`element  ${r.element}${rank != null ? `  (rank ${rank})` : ''}\n`)
    if (statIds.length) await write(`stats    ${statIds.map((id) => `${id}=${r[id]}`).join('  ')}\n`)
    if (mapInfos.length) await write(`maps     ${mapInfos.map((m) => `${m.id}=${r['map:' + m.id]}`).join('  ')}\n`)
    return
  }

  if (values['group-by']) {
    // group by a statistic → its distribution (the count per value: Pascal / Mahonian / Stirling …), with a summary
    const stat = String(values['group-by'])
    const d = await handle.distribution(stat)
    await write(`${stat}\tcount\n`)
    for (const b of d.bins) await write(`${b.value}\t${b.count}\n`)
    if (d.total) {
      await write(`# total=${d.total}\tsupport=${d.support![0]}..${d.support![1]}\tmode=${d.mode}\tmean=${d.mean!.toFixed(3)}\n`)
    }
    return
  }

  if (values.triangle) {
    // the statistic's distribution per fiber, rendered as an aligned triangle (rows = fibers, cols = stat value)
    for (const line of triangleLines(String(values.triangle), await handle.triangle(String(values.triangle)))) await write(line + '\n')
    return
  }

  const card = await handle.card()
  if (values.count) {
    await write((card === null ? 'Infinity' : String(card)) + '\n')
    return
  }

  // slice: default is the whole (finite) collection; an infinite one streams until the reader stops
  const { first } = parseRange(values.range as string | undefined)
  let { count } = parseRange(values.range as string | undefined)
  if (count === undefined && card !== null) count = card - first

  const mapIds = values.maps ? String(values.maps).split(',').map((s) => s.trim()).filter(Boolean) : []
  const through = values.through ? String(values.through).split(',').map((s) => s.trim()).filter(Boolean) : undefined
  if (mapIds.length || through?.length) {
    // project map images: each --maps id as its own column, and/or ONE composed column for the --through chain
    if (count === undefined) throw new CliError(`${handle.ctor} is infinite — pass --range A:B to project maps`)
    const avail = await handle.maps()
    const unknown = mapIds.filter((id) => !avail.some((m) => m.id === id))
    if (unknown.length) throw new CliError(`unknown map${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} (out of ${collection}: ${avail.map((m) => m.id).join(', ') || 'none'})`)
    const mapCols = mapIds.map((id) => `map:${id}`)
    const throughCol = through?.length ? `through:${through.join('.')}` : null
    const wopts = { maps: mapIds.length ? mapIds : undefined, through }
    const row = (r: Result) => [r.__rank, r.element, ...mapCols.map((c) => r[c]), ...(throughCol ? [r[throughCol]] : [])].join('\t') + '\n'
    // fetch the first batch BEFORE the header so a broken --through chain fails cleanly (no stray header on stdout)
    let batch: Result[]
    try { batch = await handle.window(first, Math.min(CHUNK, count), wopts) }
    catch (e) { throw e instanceof CliError ? e : new CliError((e as Error).message) }
    await write(['#', 'element', ...mapCols, ...(throughCol ? [throughCol] : [])].join('\t') + '\n')
    for (let i = first; batch.length > 0; ) {
      for (const r of batch) await write(row(r))
      i += CHUNK
      if (i >= first + count) break
      batch = await handle.window(i, Math.min(CHUNK, first + count - i), wopts)
    }
    return
  }

  const fieldFilter = values.fields ? String(values.fields).split(',').map((f) => f.trim()).filter(Boolean) : undefined
  if (values.stats || values.json || fieldFilter) {
    if (count === undefined) throw new CliError(`${handle.ctor} is infinite — pass --range A:B to project stats`)
    const allStats = await handle.stats()
    const ids = fieldFilter ?? allStats.map((s) => s.statId)
    const unknown = ids.filter((id) => !allStats.some((s) => s.statId === id))
    if (unknown.length) throw new CliError(`unknown stat${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')} (available: ${allStats.map((s) => s.statId).join(', ')})`)
    if (!values.json) await write(['#', 'element', ...ids].join('\t') + '\n')
    for await (const r of rowWindows(handle, first, count, fieldFilter)) await write(values.json ? jsonLine(r, ids) : tsvLine(r, ids))
    return
  }
  // no --repr/--format/--medium/--alphabet and no explicit projection: the environment 'terminal' policy decides the
  // columns (#246) — never hardcoded here, always policy_resolve. A bare `-R`/`-F`/`-M`/`-A` still means "just the
  // element, rendered that way" (today's behavior); an open collection with no --range keeps streaming bare elements
  // (a header doesn't fit an unbounded stream, and the policy's own list rarely fits one either).
  const hasRenderOpt = values.repr !== undefined || values.format !== undefined || values.medium !== undefined || values.alphabet !== undefined
  if (!hasRenderOpt && count !== undefined) {
    const cols = await client.terminalSelect(collection)
    if (cols.length) { await printPolicyColumns(handle, cols, first, count, write); return }
  }
  const render: RenderOpts = { repr: values.repr as string, format: values.format as string, medium: values.medium as RenderOpts['medium'], alphabet: values.alphabet as string }
  for await (const s of serializeWindows(handle, first, count, render)) await write(s + '\n')
}

/** Print `cols` (a resolved SELECT list, forced to the elements archetype) as a header + one TSV row per element.
 *  `ordinality`/`address`/`element` ride window()'s own structural columns (computed unconditionally); a bare id is
 *  a statistic (`opts.stats`); `repr:<name>` is a second serialize() pass over the SAME canonical window, zipped by
 *  position — both walk elements in the identical order, so no rank lookup is needed. */
async function printPolicyColumns(h: Handle, cols: string[], first: number, count: number, write: Writer): Promise<void> {
  const structural = new Set(['ordinality', 'address', 'element'])
  const reprs = [...new Set(cols.filter((c) => c.startsWith('repr:')).map((c) => c.slice('repr:'.length)))]
  const stats = cols.filter((c) => !structural.has(c) && !c.startsWith('repr:'))
  await write(cols.join('\t') + '\n')
  for (let i = first; i < first + count; i += CHUNK) {
    const n = Math.min(CHUNK, first + count - i)
    const rows = await h.window(i, n, { stats })
    const reprCols = new Map<string, string[]>()
    for (const r of reprs) reprCols.set(r, await h.serialize(i, n, { repr: r }))
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j]
      const line = cols.map((c) =>
        c === 'ordinality' ? String(row['__ordinality']) :
        c === 'address' ? String(row['__address']) :
        c === 'element' ? String(row.element) :
        c.startsWith('repr:') ? reprCols.get(c.slice('repr:'.length))![j] :
        String(row[c])).join('\t')
      await write(line + '\n')
    }
    if (rows.length < n) break
  }
}

/** `list <collection>` — the catalog shape of one collection: axes, realized fibers, stats, reprs. */
async function printCollection(name: string, write: Writer, client: Client) {
  const info = await client.describe(name)
  const fiber = (b: string[]) => (b.length ? '[' + b.join(', ') + ']' : '[·]')
  await write(`${info.id}\n`)
  await write(`  axes     ${info.axes.join(', ') || '—'}\n`)
  await write(`  fibers   ${info.realized.map(fiber).join('  ') || '—'}\n`)
  await write(`  stats    ${info.stats.map((s) => s.statId).join(', ') || '—'}\n`)
  await write(`  reprs    ${info.reprs.map((r) => r.id + (r.canonical ? '*' : '')).join(', ') || '—'}\n`)
  await write(`  examples ${info.examples.length || '—'}${info.examples.length ? ` (enumeratio examples ${info.id})` : ''}\n`)
}

/** `maps [collection]` — the map graph: every registered map as an aligned `source → codomain` edge (a map's
 * title in parentheses, its FindStat id if known). With a collection argument, only the edges OUT of it. */
async function printMapGraph(collection: string | undefined, write: Writer, client: Client) {
  let edges = await client.mapGraph()
  if (collection) edges = edges.filter((e) => e.source === collection)
  if (!edges.length) {
    await write(collection ? `no maps out of ${collection}\n` : `no maps registered\n`)
    return
  }
  const srcW = Math.max(...edges.map((e) => e.source.length))
  const mapW = Math.max(...edges.map((e) => e.mapId.length))
  for (const e of edges) {
    const fs = e.findstatId ? `  [${e.findstatId}]` : ''
    await write(`${e.source.padEnd(srcW)}  ${e.mapId.padEnd(mapW)}  → ${e.codomain}  (${e.title})${fs}\n`)
  }
}

/** `table` — all collections as an aligned catalog grid. */
async function printTable(write: Writer, client: Client) {
  const rows = await client.summary()
  type Col = { key: string; get: (r: CollSummary) => string; right: boolean }
  const cols: Col[] = [
    { key: 'collection', get: (r) => r.id, right: false },
    { key: 'title', get: (r) => r.title, right: false },
    { key: 'axes', get: (r) => r.axes.join(', ') || '—', right: false },
    { key: 'fibers', get: (r) => String(r.fiberCount), right: true },
    { key: 'stats', get: (r) => String(r.statsCount), right: true },
    { key: 'reprs', get: (r) => String(r.reprsCount), right: true },
    { key: 'maps', get: (r) => String(r.mapsCount), right: true },
    { key: 'examples', get: (r) => String(r.examplesCount), right: true },
    { key: 'oeis', get: (r) => r.oeis ?? '—', right: false },
  ]
  const widths = cols.map((c) => Math.max(c.key.length, ...rows.map((r) => c.get(r).length)))
  const fmt = (vals: string[]) => vals.map((v, i) => (cols[i].right ? v.padStart(widths[i]) : v.padEnd(widths[i]))).join('  ')
  await write(fmt(cols.map((c) => c.key)) + '\n')
  await write(fmt(widths.map((w) => '─'.repeat(w))) + '\n')
  for (const r of rows) await write(fmt(cols.map((c) => c.get(r))) + '\n')
}

/** `examples [collection]` — a collection's VERIFIED examples: the living assertions from base_example (the title
 * is the claim, `= expected` its answer — the same rows that run as the test suite). With no collection, list the
 * collections that have examples, with counts. */
/** `enumeratio calc 'binomial(5, 2)'` — the proving consumer for the engine seam. The dispatcher stays
 *  environment-agnostic: it never imports an engine, it asks the injected client, and the ROUTER decides who
 *  answers. `--explain` prints that decision, including who declined and why, because a router nobody can
 *  interrogate is a router nobody should trust. */
async function printCalc(text: string, explain: boolean, opts: RunOpts, write: Writer) {
  const expr = text.trim()
  if (!expr) throw new CliError(`calc needs an expression, e.g. enumeratio calc 'binomial(5, 2)'`)
  if (!opts.client.calc) throw new CliError('calc needs an engine — this host wired a Db but no engine (provideEngine)')
  const r = await opts.client.calc(expr)
  await write(r.value + '\n')
  if (explain) {
    await write(`# engine=${r.engine}${r.impl ? ` impl=${r.impl}` : ''}\n`)
    for (const d of r.declined ?? []) await write(`# declined ${d.engine}: ${d.why}\n`)
  }
}

async function printExamples(collection: string | undefined, opts: RunOpts, write: Writer) {
  if (!collection) {
    for (const c of (await opts.client.summary()).filter((s) => s.examplesCount > 0)) {
      await write(`${c.id}  (${c.examplesCount})\n`)
    }
    return
  }
  const { examples } = await opts.client.describe(collection)
  if (!examples.length) return void (await write(`${collection}: no verified examples\n`))
  await write(`${collection} — ${examples.length} verified examples\n`)
  for (const e of examples) {
    await write(`  ${e.title}\n`)
    if (e.expected != null) await write(`    = ${e.expected}\n`)
  }
}
