// THE ONLY module in this package that imports @cortex-js/compute-engine/latex-syntax. Everything else works
// over the plain MathJSON produced here — see ../ast.ts for the shapes and ../format.ts for the reverse
// direction (MathJSON -> our own display/calc text). Findings this is built from: .scratch/ce-spike.md.
import { LatexSyntax, LATEX_DICTIONARY } from '@cortex-js/compute-engine/latex-syntax'
import type { LatexDictionaryEntry } from '@cortex-js/compute-engine/latex-syntax'
import type { Expression, MathJsonSymbol, NodePath, Parsed, ParseError, SpanMap, Span, Stmt } from '../ast.js'
import { args, head, isSymbol, symbolName } from '../ast.js'

/** The catalog surface a parser is bound to: collection ids (bare symbols), function ids (call heads), and any
 *  extra LaTeX macro -> catalog-id bindings (e.g. `'\\mathbb{N}': 'natural_numbers'`). */
export type CatalogNames = {
  collections: string[]
  functions: string[]
  symbols?: Record<string, string>
}

export type ExpressionParser = {
  parse(latex: string): Parsed
  serialize(expr: Expression): string
  dictionary: ReadonlyArray<Partial<LatexDictionaryEntry>>
}

const escapeId = (id: string): string => id.replace(/_/g, '\\_')

/** One `kind:'function'`/`kind:'symbol'` dictionary entry per catalog id, so `\operatorname{<id>}(...)` parses
 *  to `[id, ...args]` (functions) or `\operatorname{<id>}` parses to the bare symbol `id` (collections) — and
 *  both serialize back to the `\operatorname{}` spelling (the default fallback is `\mathrm{}` with an
 *  un-escaped `_`, see spike item 4). `symbols` adds direct macro -> id bindings (`\mathbb{N} -> natural_numbers`). */
export function catalogDictionary(names: CatalogNames): Partial<LatexDictionaryEntry>[] {
  const entries: Partial<LatexDictionaryEntry>[] = []
  // standaloneSymbol: true is what makes an unapplied name serialize via our `\operatorname{}` spelling instead
  // of the default `\mathrm{Name}` fallback (types.d.ts BaseEntry.standaloneSymbol) — confirmed empirically,
  // the field is easy to miss since serialize alone silently has no effect without it.
  for (const id of names.functions) {
    entries.push({
      kind: 'function', symbolTrigger: id, name: id,
      serialize: `\\operatorname{${escapeId(id)}}`, standaloneSymbol: true,
    })
  }
  for (const id of names.collections) {
    entries.push({
      kind: 'symbol', symbolTrigger: id, name: id,
      serialize: `\\operatorname{${escapeId(id)}}`, standaloneSymbol: true,
    })
  }
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

// ── pre-parse normalization: bare catalog-id runs -> \operatorname{} ───────────────────────────────────────────
// compute-engine has no unknown-identifier hook (spike item 2): a bare multi-letter run always splits into
// single-char symbols under implicit multiplication, dictionary entries notwithstanding. So a pasted/typed
// `triangular_numbers` (no `\operatorname{}`) has to be rewritten before it ever reaches the parser. This keeps
// a best-effort offset map back to the ORIGINAL latex so spans built after parsing still point at the input the
// caller gave us, not the rewritten string.
type NormalizeResult = { text: string; toOriginal: (pos: number) => number }

function normalizeLatex(latex: string, catalogIds: ReadonlySet<string>): NormalizeResult {
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
      if (catalogIds.has(ident)) {
        appendRaw(`\\operatorname{${escapeId(ident)}}`, i)
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
function splitStmt(body: Expression): Stmt {
  const h = head(body)
  if (h === 'Element') {
    const a = args(body)
    if (a.length === 2 && isSymbol(a[0])) return { k: 'declare', name: symbolName(a[0]), domain: a[1] }
    return { k: 'expr', body }
  }
  if (h === 'Equal') {
    const a = args(body)
    if (a.length === 2) {
      const [lhs, rhs] = a
      if (isSymbol(lhs)) return { k: 'define', name: symbolName(lhs), body: rhs }

      // Undeclared function-call LHS: compute-engine has no dictionary entry for the name being defined, so it
      // parses `f(n)` as `InvisibleOperator(f, Delimiter(n))` (implicit-multiply of a symbol and a parenthesized
      // group) rather than a function call (spike item 1's `f(n) = n^2+1` probe). Recognize that shape here and
      // pull the params back out, rather than requiring the parser to already know every user-defined name.
      if (head(lhs) === 'InvisibleOperator' && args(lhs).length === 2 && isSymbol(args(lhs)[0])) {
        const [fnSym, delim] = args(lhs)
        if (head(delim) === 'Delimiter' && args(delim).length >= 1) {
          const body1 = args(delim)[0]
          const paramExprs = head(body1) === 'Sequence' ? args(body1) : [body1]
          if (paramExprs.every(isSymbol)) {
            return { k: 'define', name: symbolName(fnSym), params: paramExprs.map(symbolName), body: rhs }
          }
        }
      }
    }
    return { k: 'expr', body }
  }
  return { k: 'expr', body }
}

export function makeParser(catalog: CatalogNames): ExpressionParser {
  const catalogIds = new Set<string>([...catalog.collections, ...catalog.functions])
  const dictionary: Partial<LatexDictionaryEntry>[] = [...LATEX_DICTIONARY, ...catalogDictionary(catalog)]
  const syntax = new LatexSyntax({ dictionary: dictionary as never, preserveLatex: true })

  return {
    dictionary,
    parse(latex: string): Parsed {
      const { text, toOriginal } = normalizeLatex(latex, catalogIds)
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
      return { stmt: splitStmt(body), spans, errors, latex }
    },
    serialize(expr: Expression): string {
      return syntax.serialize(expr as never)
    },
  }
}
