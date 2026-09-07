// Autocomplete over LaTeX text before the caret. Pure text-in/candidates-out — no compute-engine dependency (see
// ce/latex.ts for the only module that touches it); this only needs the catalog's id lists and the caller's
// binder-resolved scope. MathLive spells a typed identifier as adjacent plain-letter chars, so most of the work
// here is finding the right trailing "word" to treat as a prefix.
import type { CatalogNames } from './ce/latex.js'

export type CompletionContext = {
  catalog: CatalogNames & { stats?: (coll: string) => string[]; maps?: (coll: string) => string[] }
  scope: { symbols: string[]; elemOf?: (sym: string) => string | undefined }
}

export type Candidate = {
  label: string
  insert: string
  kind: 'collection' | 'function' | 'stat' | 'map' | 'symbol' | 'command'
  detail?: string
}

export type Completion = { replaceLen: number; candidates: Candidate[] }

const escapeId = (id: string): string => id.replace(/_/g, '\\_')

const COMMANDS = [
  '\\in', '\\binom', '\\frac', '\\sqrt', '\\sum', '\\gcd',
  '\\le', '\\ge', '\\ne', '\\cup', '\\cap', '\\mathbb{N}', '\\operatorname{}',
]

function commandName(cmd: string): string {
  const m = /^\\([A-Za-z]+)/.exec(cmd)
  return m ? m[1] : ''
}

// ── prefix extraction ────────────────────────────────────────────────────────────────────────────────────────────

type Extracted = { prefix: string; replaceLen: number; kind: 'operatorname' | 'command' | 'identifier' }

const OPERATORNAME_OPEN = /\\(?:operatorname|mathrm)\{([^{}]*)$/
const TRAILING_IDENT = /[A-Za-z0-9_]*$/

function extractPrefix(before: string): Extracted {
  const opMatch = OPERATORNAME_OPEN.exec(before)
  if (opMatch) {
    return { prefix: opMatch[1].replace(/\\_/g, '_'), replaceLen: opMatch[0].length, kind: 'operatorname' }
  }

  const identMatch = TRAILING_IDENT.exec(before) // always matches — possibly the empty string
  const run = identMatch ? identMatch[0] : ''
  const runStart = before.length - run.length
  const precedingChar = runStart > 0 ? before[runStart - 1] : ''

  // A letters-only run immediately preceded by a backslash is a command name, not a plain identifier — `\bi`
  // must not be read as identifier "bi" preceded-by-nothing.
  if (precedingChar === '\\' && /^[A-Za-z]*$/.test(run)) {
    return { prefix: '\\' + run, replaceLen: run.length + 1, kind: 'command' }
  }
  if (run.length > 0) return { prefix: run, replaceLen: run.length, kind: 'identifier' }
  if (before.endsWith('\\')) return { prefix: '\\', replaceLen: 1, kind: 'command' }
  return { prefix: '', replaceLen: 0, kind: 'identifier' }
}

// ── matching + ranking (rule c: exact-prefix on id, then word-start, then shorter ids first) ───────────────────────

/** 0 = exact-prefix match on `id`, 1 = matches a `_`-separated word start, `null` = no match. An empty prefix
 *  matches everything at rank 0 (lets `\in ` list every collection before the user types anything). */
function scoreMatch(id: string, prefix: string): 0 | 1 | null {
  if (prefix === '') return 0
  const lowerId = id.toLowerCase()
  const lowerPrefix = prefix.toLowerCase()
  if (lowerId.startsWith(lowerPrefix)) return 0
  if (id.split('_').some((w) => w.toLowerCase().startsWith(lowerPrefix))) return 1
  return null
}

type Scored = { cand: Candidate; rank: 0 | 1; len: number }

function collectMatches(ids: string[], prefix: string, build: (id: string) => Candidate): Scored[] {
  const out: Scored[] = []
  for (const id of ids) {
    const rank = scoreMatch(id, prefix)
    if (rank === null) continue
    out.push({ cand: build(id), rank, len: id.length })
  }
  return out
}

function rankAndCap(matches: Scored[]): Candidate[] {
  return matches
    .slice()
    .sort((a, b) => a.rank - b.rank || a.len - b.len)
    .slice(0, 20)
    .map((m) => m.cand)
}

// ── candidate builders ───────────────────────────────────────────────────────────────────────────────────────────

const collectionCandidate = (id: string): Candidate => ({
  label: id, insert: `\\operatorname{${escapeId(id)}}`, kind: 'collection',
})
const functionCandidate = (id: string): Candidate => ({
  label: id, insert: `\\operatorname{${escapeId(id)}}(`, kind: 'function',
})
const symbolCandidate = (id: string): Candidate => ({ label: id, insert: id, kind: 'symbol' })
const statOrMapCandidate = (name: string, sym: string, kind: 'stat' | 'map'): Candidate => ({
  label: `${name}(${sym})`, insert: `\\operatorname{${escapeId(name)}}(${sym})`, kind,
})

function builtinSetMatches(ctx: CompletionContext, prefix: string): Scored[] {
  const out: Scored[] = []
  for (const [macro, id] of Object.entries(ctx.catalog.symbols ?? {})) {
    const rank = scoreMatch(id, prefix)
    if (rank === null) continue
    out.push({ cand: { label: macro, insert: macro, kind: 'collection', detail: id }, rank, len: id.length })
  }
  return out
}

/** For every scope symbol with a known element-of collection, one candidate per matching stat/map of that
 *  collection — matched against the stat/map's own id, labelled with the actual scope symbol (`inversions(x)`). */
function statMapMatches(ctx: CompletionContext, prefix: string): Scored[] {
  const out: Scored[] = []
  const { scope, catalog } = ctx
  if (!scope.elemOf) return out
  for (const sym of scope.symbols) {
    const coll = scope.elemOf(sym)
    if (!coll) continue
    for (const name of catalog.stats?.(coll) ?? []) {
      const rank = scoreMatch(name, prefix)
      if (rank === null) continue
      out.push({ cand: statOrMapCandidate(name, sym, 'stat'), rank, len: name.length })
    }
    for (const name of catalog.maps?.(coll) ?? []) {
      const rank = scoreMatch(name, prefix)
      if (rank === null) continue
      out.push({ cand: statOrMapCandidate(name, sym, 'map'), rank, len: name.length })
    }
  }
  return out
}

function commandMatches(prefix: string): Scored[] {
  const bare = prefix.replace(/^\\/, '')
  const out: Scored[] = []
  for (const cmd of COMMANDS) {
    const rank = scoreMatch(commandName(cmd), bare)
    if (rank === null) continue
    out.push({ cand: { label: cmd, insert: cmd, kind: 'command' }, rank, len: cmd.length })
  }
  return out
}

// ── entry point ──────────────────────────────────────────────────────────────────────────────────────────────────

export function complete(before: string, ctx: CompletionContext): Completion {
  const { prefix, replaceLen, kind } = extractPrefix(before)

  if (kind === 'command') {
    return { replaceLen, candidates: rankAndCap(commandMatches(prefix)) }
  }

  const beforePrefix = before.slice(0, before.length - replaceLen)
  const inContext = /\\in\s*$/.test(beforePrefix)

  if (prefix === '' && !inContext) return { replaceLen: 0, candidates: [] }

  const matches = inContext
    ? [...collectMatches(ctx.catalog.collections, prefix, collectionCandidate), ...builtinSetMatches(ctx, prefix)]
    : [
        ...collectMatches(ctx.catalog.functions, prefix, functionCandidate),
        ...statMapMatches(ctx, prefix),
        ...collectMatches(ctx.scope.symbols, prefix, symbolCandidate),
      ]

  return { replaceLen, candidates: rankAndCap(matches) }
}
