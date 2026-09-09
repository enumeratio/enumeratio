// THE ONLY module in this package that imports @cortex-js/compute-engine/latex-syntax. Everything else works
// over the plain MathJSON produced here — see ../ast.ts for the shapes and ../format.ts for the reverse
// direction (MathJSON -> our own display/calc text). Findings this is built from: .scratch/ce-spike.md.
import { LatexSyntax, LATEX_DICTIONARY } from '@cortex-js/compute-engine/latex-syntax'
import type { LatexDictionaryEntry } from '@cortex-js/compute-engine/latex-syntax'
import type { Expression, MathJsonSymbol, NodePath, Parsed, ParseError, SpanMap, Span, Stmt } from './ast.js'
import { args, head, isSymbol, mapExpr, symbolName } from './ast.js'
import { normalize, head as nHead, args as nArgs, isSymbol as nIsSymbol, symbolName as nSymbolName, type Node } from './node.js'
import { OPERATORS } from './names.js'

/** The catalog surface a parser is bound to: collection ids (bare symbols), function ids (call heads), and any
 *  extra LaTeX macro -> catalog-id bindings (e.g. `'\\mathbb{N}': 'natural_numbers'`). */
export type CatalogNames = {
  collections: string[]
  functions: string[]
  symbols?: Record<string, string>
  /** Optional per-id math NOTATION as display LaTeX (`permutations` -> `\mathfrak{S}`). Where present it becomes
   *  the spelling shown/inserted/serialized AND a parse trigger, so it round-trips; where absent the fallback is
   *  `\operatorname{<PascalCase>}` — never the raw snake id, which is immaterial once you're in the notebook. */
  notation?: Record<string, string>
}

export type ExpressionParser = {
  parse(latex: string): Parsed
  serialize(expr: Expression): string
  dictionary: ReadonlyArray<Partial<LatexDictionaryEntry>>
}

const escapeId = (id: string): string => id.replace(/_/g, '\\_')

/** snake_case catalog id -> its PascalCase alias: `random_element` -> `RandomElement`, `catalan_number` ->
 *  `CatalanNumber`, `bell_number` -> `BellNumber`. Lets a user TYPE the clean word-run (no underscores, which
 *  MathLive turns into subscripts) and have it resolve to the same catalog id. */
export const pascalCase = (id: string): string => id.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join('')

/** How an identifier SHOWS: its registered notation if any (spliced verbatim), otherwise `\operatorname{}` over
 *  the PascalCase spelling. Both render upright with no MathLive double-wrap — same look as `\mathrm{}` — but
 *  `\operatorname{}` never triggers CE's UNIT lookup, whereas `\mathrm{cd}`/`\mathrm{bar}`/`\mathrm{deg}` parse to
 *  `["__unit__", …]` (candela/pressure/degree are SI unit names). So every identifier — plain variable AND catalog
 *  id — reads `\operatorname{}`. Genuine operator words (`det`→Determinant, `sin`→Sin, `gcd`→GCD) resolve the same
 *  under both wrappers. The internal MathJSON symbol stays the snake id regardless — this is purely the
 *  display/parse spelling. `role` is kept for callers that still care to distinguish. */
export type IdentifierDisplay = { kind: 'operator' | 'entity' | 'notation'; latex: string }
export function identifierDisplay(
  id: string,
  role: 'function' | 'collection',
  notation?: Record<string, string>,
): IdentifierDisplay {
  void role
  const n = notation?.[id]
  return n ? { kind: 'notation', latex: n } : { kind: 'entity', latex: `\\operatorname{${pascalCase(id)}}` }
}

/** The single spelling an id serializes to / the completer inserts / the parser round-trips: notation if present,
 *  else `\operatorname{<PascalCase>}` (see identifierDisplay for why `\operatorname{}`, not `\mathrm{}`). */
export const serializeLatex = (id: string, notation?: Record<string, string>): string =>
  notation?.[id] ?? `\\operatorname{${pascalCase(id)}}`

/** One `kind:'function'`/`kind:'symbol'` dictionary entry per catalog id. The TRIGGER is the PascalCase spelling
 *  (what you type — `\operatorname{Permutations}(...)` parses to `[permutations, ...]`, `\operatorname{BellNumber}` to
 *  the symbol `bell_number`) while the MathJSON `name` stays the snake id everything downstream routes on; the snake
 *  spelling is immaterial once you're in the notebook. An id with registered `notation` gets an extra parse
 *  trigger for its glyph and serializes to it. `symbols` adds direct macro -> id bindings (`\mathbb{N}`). */
export function catalogDictionary(names: CatalogNames): Partial<LatexDictionaryEntry>[] {
  const entries: Partial<LatexDictionaryEntry>[] = []
  const notation = names.notation
  // standaloneSymbol: true is what makes an unapplied name serialize via our chosen spelling instead of the
  // default `\mathrm{Name}` fallback (types.d.ts BaseEntry.standaloneSymbol) — confirmed empirically, the field
  // is easy to miss since serialize alone silently has no effect without it.
  const push = (kind: 'function' | 'symbol', id: string): void => {
    entries.push({ kind, symbolTrigger: pascalCase(id), name: id, serialize: serializeLatex(id, notation), standaloneSymbol: true })
    // A registered glyph is a second, name-less parse trigger onto the same symbol (mirrors the `symbols` macros
    // below — a second entry carrying `name` would be a duplicate-definition warning). No snake compat trigger: a
    // kind-less parse entry degrades a function from application to a bare symbol, and nothing emits snake
    // `\operatorname{}` any more (the normalizer/completer/reformat all produce the Pascal spelling).
    const glyph = notation?.[id]
    if (glyph) entries.push({ latexTrigger: glyph, parse: id })
  }
  for (const id of names.functions) push('function', id)
  for (const id of names.collections) push('symbol', id)
  for (const [macro, id] of Object.entries(names.symbols ?? {})) {
    // `\mathbb{N}` etc. already have a built-in latexTrigger (default-dictionary SETS_DICTIONARY -> NonNegative-
    // Integers) — a plain latexTrigger-only entry appended after LATEX_DICTIONARY does NOT win against it
    // (verified empirically: neither append nor prepend order changes the built-in's answer). An explicit
    // `parse` handler appended last DOES override it — but ONLY on a `DefaultEntry` (no `kind` field); adding
    // `kind: 'symbol'` back (which the catalog function/collection entries above use, harmlessly, since their
    // triggers are new) silently loses the override again. Unclear why kind:'symbol' + parse doesn't win where
    // kind-less + parse does; flagged for the binder rather than guessed at further.
    // No `name`: the collection entry above already owns the MathJSON symbol (a second definition of the same
    // name is a dictionary warning). This entry only maps the macro's trigger onto it; serialization stays with
    // the collection entry's `\operatorname{}` spelling.
    entries.push({ latexTrigger: macro, parse: id })
  }
  return entries
}

// ── `$`-session symbols (#406) ───────────────────────────────────────────────────────────────────────────────────
// A bare `$` is not a valid identifier char to CE's tokenizer under ANY escaping — `\$System`, `\operatorname{\$
// System}`, `\mathrm{\$System}` all fail to parse (checked live against @cortex-js/compute-engine 0.125: each
// reports `invalid-first-char`/`unexpected-command`/`unexpected-token`). So a `$`-var is never handed to CE's own
// parser as such — `normalizeLatex` below recognizes it in the RAW text (same pre-parse pass that already rewrites
// bare catalog-id runs) and rewrites straight to the internal `\operatorname{Dollar<Name>}` spelling, which IS an
// ordinary identifier as far as CE is concerned. Two raw spellings are recognized: `$Name` (a bare `$` glyph — what
// a programmatic `mathfield.insert('$Name')` produces) and `\$Name` (an escaped `\$` — what a REAL keystroke in
// MathLive serializes a typed `$` to; checked live in a `<enumeratio-expression-line>`'s math-field). Both compose
// with `pascalCase`'s Pascal-word convention: `SESSION_VAR_NAMES` holds the bare suffix (`System`, `VersionNumber`,
// …), read straight off `OPERATORS`'s `session` entries so this file and names.ts can never list a different set.
const SESSION_VAR_NAMES = new Set(Object.values(OPERATORS).flatMap((b) => ('session' in b ? [b.session] : [])))

/** One `kind:'symbol'` dictionary entry per `$`-session var — same `standaloneSymbol` shape catalogDictionary's
 *  entries use, but keyed by the fixed internal `Dollar<Name>` OPERATORS key (never a literal `$…` — CE's own
 *  dictionary validation rejects `$` in a symbol's `name`, checked live) for BOTH the parse trigger and the
 *  MathJSON symbol, so bind.ts's plain scope lookup (see enumeratio-expressions.ts's `injectSessionScope`) needs no
 *  translation between the two. */
function sessionDictionary(): Partial<LatexDictionaryEntry>[] {
  return Object.entries(OPERATORS)
    .filter((e): e is [string, { session: string }] => 'session' in e[1])
    .map(([name]) => ({
      kind: 'symbol' as const,
      symbolTrigger: name,
      name,
      serialize: `\\operatorname{${name}}`,
      standaloneSymbol: true,
    }))
}

// ── pre-parse: `.`-method sugar ────────────────────────────────────────────────────────────────────────────────
// `p.inverse` -> `inverse(p)`, `p.foo(x)` -> `foo(p, x)` — a receiver written before the function, the way a method
// reads. CE itself rejects `.` as an operator, so this rewrites the raw latex BEFORE anything else, and carries an
// offset map back to the ORIGINAL so spans still point at what the caller typed. Deliberately narrow (a later slice
// widens it): the receiver is a single letter-start identifier (so `3.5` and `\frac{}{}.x` are untouched), no
// chaining, rewrite is skipped inside \text{}/\operatorname{}/\mathrm{}.
type DotResult = { text: string; map: number[] }
const isIdentChar = (c: string): boolean => /[A-Za-z0-9]/.test(c)

function rewriteDotMethods(src: string): DotResult {
  let out = ''
  const map: number[] = []
  const copy = (from: number, to: number): void => { for (let k = from; k < to; k++) { out += src[k]; map.push(k) } }
  const emit = (s: string, at: number): void => { for (const ch of s) { out += ch; map.push(at) } }
  const skipSpace = (k: number): number => { while (k < src.length && /\s/.test(src[k])) k++; return k }

  let i = 0
  let braceDepth = 0
  const protect: number[] = []
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      let j = i + 1
      while (j < src.length && /[A-Za-z]/.test(src[j])) j++
      copy(i, j)
      const name = src.slice(i + 1, j)
      if (name === 'operatorname' || name === 'mathrm' || name === 'text') {
        const k = skipSpace(j)
        if (src[k] === '{') { copy(j, k + 1); braceDepth++; protect.push(braceDepth); i = k + 1; continue }
      }
      i = j
      continue
    }
    if (c === '{') { braceDepth++; copy(i, i + 1); i++; continue }
    if (c === '}') { copy(i, i + 1); if (protect.length && protect[protect.length - 1] === braceDepth) protect.pop(); braceDepth--; i++; continue }
    if (protect.length === 0 && /[A-Za-z]/.test(c)) {
      const recStart = i
      i++
      while (i < src.length && isIdentChar(src[i])) i++
      const recEnd = i
      const dot = skipSpace(i)
      if (src[dot] === '.') {
        const mStart = skipSpace(dot + 1)
        if (mStart < src.length && /[A-Za-z]/.test(src[mStart])) {
          let mEnd = mStart + 1
          while (mEnd < src.length && isIdentChar(src[mEnd])) mEnd++
          const argAt = skipSpace(mEnd)
          const leftParen = src.startsWith('\\left(', argAt)
          const hasParen = leftParen || src[argAt] === '('
          const open = leftParen ? '\\left(' : '('
          emit(src.slice(mStart, mEnd), mStart) // method name
          emit(open, dot)                        // open paren (matches an existing \right) if any)
          copy(recStart, recEnd)                 // receiver becomes the first argument
          if (hasParen) {
            const afterOpen = argAt + open.length
            const b = skipSpace(afterOpen)
            const empty = src[b] === ')' || src.startsWith('\\right)', b)
            if (!empty) emit(', ', dot)
            i = afterOpen // the main loop copies the remaining args + their closing delimiter verbatim
            continue
          }
          emit(')', mEnd)
          i = mEnd
          continue
        }
      }
      copy(recStart, recEnd) // a plain identifier, no method — emit as-is
      continue
    }
    copy(i, i + 1)
    i++
  }
  return { text: out, map }
}

// ── pre-parse normalization: bare catalog-id runs -> \operatorname{} ───────────────────────────────────────────
// compute-engine has no unknown-identifier hook (spike item 2): a bare multi-letter run always splits into
// single-char symbols under implicit multiplication, dictionary entries notwithstanding. So a pasted/typed
// `triangular_numbers` (no `\operatorname{}`) has to be rewritten before it ever reaches the parser. This keeps
// a best-effort offset map back to the ORIGINAL latex so spans built after parsing still point at the input the
// caller gave us, not the rewritten string.
type NormalizeResult = { text: string; toOriginal: (pos: number) => number }

function normalizeLatex(latex: string, catalogIds: ReadonlySet<string>, aliases: ReadonlyMap<string, string>): NormalizeResult {
  let out = ''
  const mapping: number[] = []
  const appendRaw = (s: string, fromOrig: number) => {
    for (let k = 0; k < s.length; k++) mapping.push(fromOrig + k)
    out += s
  }
  let i = 0
  let braceDepth = 0
  const protectStack: number[] = [] // brace depths at which a protected (\operatorname{/\mathrm{/\text{) group started
  while (i < latex.length) {
    const c = latex[i]
    // `$Name` / `\$Name` naming a known `$`-session var (see the SESSION_VAR_NAMES block above) → rewrite straight
    // to its internal `\operatorname{}` spelling before either the backslash-command or identifier branch below
    // ever sees the `$` — CE's own tokenizer rejects a `$` character outright, in or out of `\operatorname{}`
    // (checked live), so this is the ONLY point a `$`-var can be recognized. An unrecognized `$word` (typo, or a
    // literal dollar amount like `\$5`) falls through unconsumed to the normal per-character handling below,
    // same degraded-but-unchanged behavior as before this rewrite existed.
    if (protectStack.length === 0 && (c === '$' || (c === '\\' && latex[i + 1] === '$'))) {
      const dollarLen = c === '$' ? 1 : 2
      let k = i + dollarLen
      while (k < latex.length && /[A-Za-z]/.test(latex[k])) k++
      const word = latex.slice(i + dollarLen, k)
      if (SESSION_VAR_NAMES.has(word)) {
        appendRaw(`\\operatorname{Dollar${word}}`, i)
        i = k
        continue
      }
    }
    if (c === '\\') {
      let j = i + 1
      while (j < latex.length && /[A-Za-z]/.test(latex[j])) j++
      const cmd = latex.slice(i, j)
      appendRaw(cmd, i)
      const name = cmd.slice(1)
      if (name === 'operatorname' || name === 'mathrm' || name === 'text') {
        let k = j
        while (k < latex.length && /\s/.test(latex[k])) k++
        if (latex[k] === '{') {
          appendRaw(latex.slice(j, k + 1), j)
          braceDepth++
          protectStack.push(braceDepth)
          i = k + 1
          continue
        }
      }
      i = j
      continue
    }
    if (c === '{') {
      braceDepth++
      appendRaw(c, i)
      i++
      continue
    }
    if (c === '}') {
      appendRaw(c, i)
      if (protectStack.length && protectStack[protectStack.length - 1] === braceDepth) protectStack.pop()
      braceDepth--
      i++
      continue
    }
    if (protectStack.length === 0 && /[A-Za-z]/.test(c)) {
      let j = i
      let ident = ''
      while (j < latex.length) {
        if (/[A-Za-z0-9]/.test(latex[j])) {
          ident += latex[j]
          j++
          continue
        }
        if (latex[j] === '_') {
          ident += '_'
          j++
          continue
        }
        if (latex[j] === '\\' && latex[j + 1] === '_') {
          ident += '_'
          j += 2
          continue
        }
        break
      }
      const canonical = catalogIds.has(ident) ? ident : aliases.get(ident)
      if (canonical) {
        // A real catalog id is an AST-node binding: Pascal spelling in `\operatorname{}` (the dictionary triggers
        // on the Pascal symbol either way). A non-id keyword such as `for` also reaches the parser as
        // `\operatorname{}` verbatim.
        appendRaw(catalogIds.has(canonical) ? `\\operatorname{${pascalCase(canonical)}}` : `\\operatorname{${escapeId(canonical)}}`, i)
      } else if (/^[A-Za-z]{2,}$/.test(ident)) {
        // An unmatched pure-letter WORD is ONE identifier (a multi-letter variable), not a product of its letters
        // — `\operatorname{}` parses to a single symbol (NOT `\mathrm{}`, which unit-parses `cd`/`bar`/`deg`; see
        // serializeLatex). Single letters (x, n) stay bare/italic; runs with digits or `_` (x2, a_1) keep meaning.
        appendRaw(`\\operatorname{${ident}}`, i)
      } else {
        appendRaw(latex.slice(i, j), i)
      }
      i = j
      continue
    }
    appendRaw(c, i)
    i++
  }
  return { text: out, toOriginal: (pos: number) => (pos < mapping.length ? mapping[pos] : (latex.length as number)) }
}

/** DISPLAY reformat (for the math field, run on a typing pause / blur): rewrite each BARE pure-letter run to the
 *  spelling that shows what it IS — `classify` returns an {@link IdentifierDisplay} (a function's `\operatorname{}`,
 *  a collection's `\operatorname{}`, or a registered `notation` glyph spliced verbatim) or `null` to leave it bare/italic
 *  (a plain variable). The `latex` it returns must be a spelling the parser round-trips to the same id — the
 *  builder guarantees that. Idempotent: runs already inside `\operatorname{}`/`\mathrm{}`/`\text{}` are protected
 *  and left alone, and a notation glyph is a command (not a bare run), so re-running never double-wraps. Single
 *  letters and runs with digits/underscores are left untouched. */
export function reformatIdentifiers(
  latex: string,
  classify: (run: string) => IdentifierDisplay | null,
): string {
  let out = ''
  let i = 0
  let braceDepth = 0
  const protect: number[] = []
  while (i < latex.length) {
    const c = latex[i]
    if (c === '\\') {
      let j = i + 1
      while (j < latex.length && /[A-Za-z]/.test(latex[j])) j++
      const cmd = latex.slice(i, j)
      out += cmd
      const name = cmd.slice(1)
      if (name === 'operatorname' || name === 'mathrm' || name === 'text') {
        let k = j
        while (k < latex.length && /\s/.test(latex[k])) k++
        if (latex[k] === '{') { out += latex.slice(j, k + 1); braceDepth++; protect.push(braceDepth); i = k + 1; continue }
      }
      i = j
      continue
    }
    if (c === '{') { braceDepth++; out += c; i++; continue }
    if (c === '}') { out += c; if (protect.length && protect[protect.length - 1] === braceDepth) protect.pop(); braceDepth--; i++; continue }
    if (protect.length === 0 && /[A-Za-z]/.test(c)) {
      let j = i
      while (j < latex.length && /[A-Za-z]/.test(latex[j])) j++
      const run = latex.slice(i, j)
      const m = run.length >= 2 ? classify(run) : null
      // The classify result already carries the exact display LaTeX (Pascal-spelled operator/entity, or a glyph),
      // which the builder guarantees re-parses to the id — so splice it straight in.
      out += m ? m.latex : run
      i = j
      continue
    }
    out += c
    i++
  }
  return out
}

// ── preserveLatex tree -> plain MathJSON + spans + errors ──────────────────────────────────────────────────────
// `preserveLatex: true` wraps every node (including leaves) as `{ latex, fn|sym|num|str|dict }` instead of a bare
// array/string (spike item 3) — a different shape from plain MathJSON that has to be walked and stripped. The
// output tree is plain MathJSON throughout (bare strings/numbers/arrays — no leaf boxing): spans are recorded in
// `SpanMap` by each node's structural `NodePath` (see ast.ts), computed as we descend, so ordinary `typeof`
// checks and `JSON.stringify` see exactly what downstream consumers expect.
type PreservedNode = string | number | { latex?: string; sourceOffsets?: [number, number] } & Record<string, unknown>

function isWrapped(n: unknown): n is Record<string, unknown> {
  return typeof n === 'object' && n !== null && !Array.isArray(n)
}

function findSpan(text: string, needle: string, from: number): [number, number] | null {
  const idx = text.indexOf(needle, from)
  return idx === -1 ? null : [idx, idx + needle.length]
}

/** Convert one `fnHead` + its (individually preserveLatex-wrapped) children into a plain `[fnHead, ...]` node,
 *  recursing depth-first with a shared monotone cursor so sibling searches never match an earlier sibling's
 *  text. `ownSpan` is this node's own span if already known (from a `{latex,fn}` wrapper); when `null` (the bare
 *  unwrapped-array case below) a best-effort span is synthesized as the union of any children's spans found.
 *  `path` is this node's own `NodePath` (see ast.ts); each child at position `k` of `rawChildren` sits at array
 *  index `k+1` of the built `[fnHead, ...children]` node (index 0 is `fnHead`), so its path is `path` extended
 *  by `k+1`. */
function convertChildren(
  fnHead: string,
  rawChildren: PreservedNode[],
  ownSpan: Span | null,
  startCursor: number,
  text: string,
  toOriginal: (pos: number) => number,
  spans: SpanMap,
  errors: ParseError[],
  path: NodePath,
): { expr: Expression; nextFrom: number; children: Expression[]; span: Span | null } {
  let cursor = startCursor
  const children: Expression[] = []
  const childPaths: NodePath[] = []
  rawChildren.forEach((child, k) => {
    const childPath = path === '' ? String(k + 1) : `${path}.${k + 1}`
    childPaths.push(childPath)
    const r = convert(child, cursor, text, toOriginal, spans, errors, childPath)
    children.push(r.expr)
    cursor = Math.max(cursor, r.nextFrom)
  })
  let span = ownSpan
  if (!span) {
    let lo: number | undefined
    let hi: number | undefined
    for (const cp of childPaths) {
      const s = spans.get(cp)
      if (s) {
        lo = lo === undefined ? s[0] : Math.min(lo, s[0])
        hi = hi === undefined ? s[1] : Math.max(hi, s[1])
      }
    }
    if (lo !== undefined && hi !== undefined) span = [lo, hi]
  }
  const expr = [fnHead, ...children] as Expression
  if (span) spans.set(path, span)
  return { expr, nextFrom: cursor, children, span }
}

/** `["Error", code, ...]` nodes carry `sourceOffsets` regardless of `preserveLatex` (spike item 5) — collect
 *  them into `errors` whichever branch of `convert` produced this node. */
function reportIfError(
  fnHead: string,
  result: { children: Expression[]; span: Span | null },
  wrapper: PreservedNode,
  searchFrom: number,
  toOriginal: (pos: number) => number,
  errors: ParseError[],
): void {
  if (fnHead !== 'Error') return
  const codeChild = result.children[0]
  const code =
    isWrapped(codeChild) && typeof (codeChild as Record<string, unknown>).str === 'string'
      ? ((codeChild as Record<string, unknown>).str as string)
      : String(codeChild)
  const rawOffsets = isWrapped(wrapper) ? (wrapper as { sourceOffsets?: [number, number] }).sourceOffsets : undefined
  const errSpan: Span = rawOffsets
    ? [toOriginal(rawOffsets[0]), toOriginal(rawOffsets[1])]
    : (result.span ?? [toOriginal(searchFrom), toOriginal(searchFrom)])
  errors.push({ span: errSpan, code, message: code.replace(/-/g, ' ') })
}

function convert(
  node: PreservedNode,
  searchFrom: number,
  text: string,
  toOriginal: (pos: number) => number,
  spans: SpanMap,
  errors: ParseError[],
  path: NodePath,
): { expr: Expression; nextFrom: number } {
  if (typeof node === 'string' || typeof node === 'number') return { expr: node, nextFrom: searchFrom }

  // Some structural heads (InvisibleOperator, ...) come through as a BARE, unwrapped MathJSON array — no
  // `{latex,fn}` wrapper of their own — while their children are still individually wrapped (spike item 3 didn't
  // surface this; found while wiring up `f(n) = n^2 + 1`, whose LHS is `InvisibleOperator(f, Delimiter(n))`).
  if (Array.isArray(node)) {
    const [fnHead, ...rawChildren] = node as unknown as [string, ...PreservedNode[]]
    const result = convertChildren(fnHead, rawChildren, null, searchFrom, text, toOriginal, spans, errors, path)
    reportIfError(fnHead, result, node, searchFrom, toOriginal, errors)
    return { expr: result.expr, nextFrom: result.nextFrom }
  }

  if (!isWrapped(node)) return { expr: node as unknown as Expression, nextFrom: searchFrom }

  const latexText = typeof node.latex === 'string' ? node.latex : undefined
  const localSpan = latexText !== undefined ? findSpan(text, latexText, searchFrom) : null
  const childStart = localSpan ? localSpan[0] : searchFrom
  const span: Span | null = localSpan ? [toOriginal(localSpan[0]), toOriginal(localSpan[1])] : null

  if ('fn' in node && Array.isArray(node.fn)) {
    const [fnHead, ...rawChildren] = node.fn as [string, ...PreservedNode[]]
    const result = convertChildren(fnHead, rawChildren, span, childStart, text, toOriginal, spans, errors, path)
    reportIfError(fnHead, result, node, searchFrom, toOriginal, errors)
    return { expr: result.expr, nextFrom: span ? Math.max(result.nextFrom, localSpan![1]) : result.nextFrom }
  }

  if ('sym' in node && typeof node.sym === 'string') {
    if (span) spans.set(path, span)
    return { expr: node.sym, nextFrom: localSpan ? localSpan[1] : searchFrom }
  }

  if ('num' in node && typeof node.num === 'string') {
    const parsed = Number(node.num)
    const roundTrips = Number.isFinite(parsed) && String(parsed) === node.num
    const expr: Expression = roundTrips ? parsed : ({ num: node.num } as unknown as Expression)
    if (span) spans.set(path, span)
    return { expr, nextFrom: localSpan ? localSpan[1] : searchFrom }
  }

  if ('str' in node) {
    const expr = { str: node.str } as unknown as Expression
    if (span) spans.set(path, span)
    return { expr, nextFrom: localSpan ? localSpan[1] : searchFrom }
  }

  // Unrecognized wrapper shape (e.g. `dict`) — pass through opaquely, no span tracking.
  return { expr: node as unknown as Expression, nextFrom: searchFrom }
}

// ── Stmt split ───────────────────────────────────────────────────────────────────────────────────────────────
// Only a top-level `Element`/`Equal` in the shapes below becomes declare/define; anything else — including a
// buried `x = 10` inside parens, or an `Equal`/`Element` whose LHS doesn't match — is `expr`.
function splitStmt(body: Node): Stmt {
  const h = nHead(body)
  if (h === 'Element') {
    const a = nArgs(body)
    if (a.length === 2 && nIsSymbol(a[0])) return { k: 'declare', name: nSymbolName(a[0]), domain: a[1] }
    return { k: 'expr', body }
  }
  if (h === 'Equal') {
    const a = nArgs(body)
    if (a.length === 2) {
      const [lhs, rhs] = a
      if (nIsSymbol(lhs)) return { k: 'define', name: nSymbolName(lhs), body: rhs }

      // Undeclared function-call LHS: compute-engine has no dictionary entry for the name being defined, so it
      // parses `f(n)` as `InvisibleOperator(f, Delimiter(n))` (implicit-multiply of a symbol and a parenthesized
      // group) rather than a function call (spike item 1's `f(n) = n^2+1` probe). Recognize that shape here and
      // pull the params back out, rather than requiring the parser to already know every user-defined name.
      if (nHead(lhs) === 'InvisibleOperator' && nArgs(lhs).length === 2 && nIsSymbol(nArgs(lhs)[0])) {
        const [fnSym, delim] = nArgs(lhs)
        if (nHead(delim) === 'Delimiter' && nArgs(delim).length >= 1) {
          const body1 = nArgs(delim)[0]
          const paramExprs = nHead(body1) === 'Sequence' ? nArgs(body1) : [body1]
          if (paramExprs.every(nIsSymbol)) {
            return { k: 'define', name: nSymbolName(fnSym), params: paramExprs.map(nSymbolName), body: rhs }
          }
        }
      }
    }
    return { k: 'expr', body }
  }
  return { k: 'expr', body }
}

/** Lift a postfix `[i]` index off a call's argument group. `f(args)[i]` parses (bottom-up) as
 *  `InvisibleOperator(f, At(Delimiter(args), i))` — the `[i]` attaches to the `(args)` delimiter rather than to
 *  the whole call `f(args)`. Rewrite to `At(InvisibleOperator(f, Delimiter(args)), i)` = `At(f(args), i)`. A
 *  general call-then-index precedence fix; the binder resolves `At` over a collection handle as element-at. */
function liftCallIndex(expr: Expression): Expression {
  if (!Array.isArray(expr)) return expr
  const lifted = mapExpr(expr, liftCallIndex) // children first, so nested calls lift too
  if (head(lifted) === 'InvisibleOperator') {
    const a = args(lifted)
    if (a.length === 2 && isSymbol(a[0]) && head(a[1]) === 'At') {
      const atArgs = args(a[1])
      if (atArgs.length >= 2 && head(atArgs[0]) === 'Delimiter') {
        const call: Expression = ['InvisibleOperator', a[0], atArgs[0]] as Expression
        return ['At', call, ...atArgs.slice(1)] as Expression
      }
    }
  }
  return lifted
}

export function makeParser(catalog: CatalogNames): ExpressionParser {
  const catalogIds = new Set<string>([...catalog.collections, ...catalog.functions])
  // PascalCase aliases for every catalog id whose Pascal form isn't already an id — so `Permutations`,
  // `RandomElement`, `CatalanNumber` typed as bare word-runs resolve to `permutations` / `random_element` / … .
  const aliases = new Map<string, string>()
  for (const id of catalogIds) {
    const p = pascalCase(id)
    if (p !== id && !catalogIds.has(p) && !aliases.has(p)) aliases.set(p, id)
  }
  // NOTE: our shuffle op is `random_shuffle`, PascalCased here to `RandomShuffle` — CE's own head. It binds to
  // CE's native RandomShuffle (which our library wraps only with a Set-noop + seeded RNG), so notebook and CE
  // agree on one spelling and one node. (CE's own `\operatorname{shuffle}`→RandomShuffle alias applies to CE's
  // parser, not this one; capital `\operatorname{Shuffle}` is an unrelated inert placeholder — never route to it.)
  // Bare keywords that must reach the parser as `\operatorname{}` to be recognized — `for` is CE's list-
  // comprehension keyword (`[i^2 for i=[1,2,3]]`). The normalizer only ever matches a WHOLE letter-run, so this
  // rewrites a standalone `for`, never the `for` inside a word like `before`.
  aliases.set('for', 'for')
  const dictionary: Partial<LatexDictionaryEntry>[] = [...LATEX_DICTIONARY, ...catalogDictionary(catalog), ...sessionDictionary()]
  const syntax = new LatexSyntax({ dictionary: dictionary as never, preserveLatex: true })

  return {
    dictionary,
    parse(latex: string): Parsed {
      // `.`-method sugar first (its own offset map back to `latex`), then the bare-run normalization on its output;
      // compose the two maps so a span still points into the ORIGINAL input the caller gave us.
      const { text: dotText, map: dotMap } = rewriteDotMethods(latex)
      const { text, toOriginal: toDot } = normalizeLatex(dotText, catalogIds, aliases)
      const toOriginal = (pos: number): number => {
        const d = toDot(pos)
        return d < dotMap.length ? dotMap[d] : latex.length
      }
      const spans: SpanMap = new Map()
      const errors: ParseError[] = []
      const raw = syntax.parse(text) as PreservedNode | null
      const body: Expression =
        raw === null
          ? (() => {
              errors.push({ span: [0, latex.length], code: 'empty-input', message: 'empty input' })
              return ['Error', { str: 'empty-input' }] as unknown as Expression
            })()
          : convert(raw, 0, text, toOriginal, spans, errors, '').expr
      // `Coll(args)[i]` parses as `InvisibleOperator(Coll, At(Delimiter(args), i))` — the postfix `[i]` binds to
      // the inner `(args)` group, not the call. Lift it to `At(Coll(args), i)`, the element-at call the binder
      // already handles. (Spans for a lifted subtree shift, so error highlighting there is approximate — a valid
      // indexing expression produces no error, so this is cosmetic-only.)
      return { stmt: splitStmt(normalize(liftCallIndex(body))), spans, errors, latex }
    },
    serialize(expr: Expression): string {
      return syntax.serialize(expr as never)
    },
  }
}
