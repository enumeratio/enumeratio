import { LitElement, html, css, type CSSResultGroup, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { evaluate, fnRef, reseedRandom, type Expr, type HandleExpr, type Row, type SelectExpr } from '@enumeratio/client'
import {
  bind, complete, lower, makeParser, LineGraph, identifierDisplay, pascalCase,
  head, args, isSymbol, symbolName,
  type Bound, type Completion, type Node, type ExpressionParser, type IdentifierDisplay, type LineId, type LineModel, type LowerResult, type Parsed, type Scope, type Type,
} from '@enumeratio/notatio'
import { loadNotebookCatalog, type NotebookCatalog } from './notebook-catalog'
import type { Completer, CompletionCandidate } from './enumeratio-math-input'
import { type LineState } from './enumeratio-expression-line'
import './enumeratio-expression-line'

// <enumeratio-expressions> — a lexically-scoped evaluation environment: a stack of <enumeratio-expression-line>s
// sharing ONE symbol Scope and ONE LineGraph (@enumeratio/notatio' dependency-order + cycle/dup-define detector).
// The environment owns every stateful thing a line does not: parsing (one ExpressionParser, built once the catalog
// loads), binding, lowering, and evaluation (one AbortController per line). It is the lightweight core that
// <enumeratio-notebook> wraps with chrome (toolbar, drag, persistence, undo, ticker); on its own it renders just
// the stack of lines, so it can be embedded bare (e.g. a reference-page example) and wrapped by <enumeratio-assert>.
//
// Public surface:
//   property/attribute `value`  — seed/serialize as JSON `{ lines: [{id, latex}] }`. Read live via the `.value`
//                                  getter (this is a noAccessor property so the getter can be the live serialized
//                                  state rather than an echo of whatever was last written to the attribute).
//   .values                     — `Record<lineId, string>`: each line's rendered value, or its error text.
//   .value                      — current `{lines:[...]}` JSON (see above).
//   .addLine(latex?, afterId?)  — append (or insert after `afterId`) a line; returns its id. DOM test hook.
//   events: composed `change` ({value}) on any edit, composed `result` ({value: JSON of `.values`}) after each
//   evaluation pass — <enumeratio-assert> can wrap the environment and check that JSON blob.
//
// Subclass hooks (overridden by <enumeratio-notebook> for chrome): `persist()` (no-op here), `onSettled()` (called
// after each settled change — notebook records an undo step + manages the ticker), `seedFromStorage()` (null here),
// `renderChrome()` (empty here — notebook returns the toolbar).
export type LineMode = 'N' | 'hold'
/** A cell's TYPE. `math` (the default, and absent in the seed) routes through the parser/evaluator; `comment` is
 *  prose (markdown + inline `$…$`) that never touches the math pipeline. */
export type LineKind = 'comment'
export type ScrubBounds = { min: number; max: number; step: number }
export type NotebookSeed = { lines: { id?: string; latex: string; mode?: LineMode; kind?: LineKind; scrub?: ScrubBounds }[] }

type LineResult = LineState

let nextIdNum = 0

/** How many collection-preview elements to show, and to add per "pull more" click. */
const PREVIEW_STEP = 5

/** Conventional parameter names by position (n = size, then k, …) — used to spell a handle's bindings into a
 *  deep link when the catalog doesn't hand us real param names (the notebook's in-memory catalog carries the
 *  binding VALUES on the handle, not the names). Real names, when present, win over this. */
const POSITIONAL_PARAM_NAMES = ['n', 'k', 'm', 'r', 's']

/** The text of a bare MathJSON string body (a `{str}` leaf, or `["String", {str}]`), else null. Used to treat a
 *  string-only line as a comment rather than lowering it (which throws on a raw string leaf). */
function stringComment(e: unknown): string | null {
  if (e && typeof e === 'object' && !Array.isArray(e) && 'str' in (e as Record<string, unknown>)) {
    return String((e as { str: unknown }).str)
  }
  if (Array.isArray(e) && e[0] === 'String') {
    const inner = e[1] as Record<string, unknown> | undefined
    return inner && typeof inner === 'object' && 'str' in inner ? String((inner as { str: unknown }).str) : ''
  }
  return null
}


@customElement('enumeratio-expressions')
export class EnumeratioExpressions extends LitElement {
  // `value` is a manual (noAccessor) property: the SETTER only records the raw seed text (consumed once at
  // connect, see #seedInitialLines); the GETTER always computes the live `{lines:[...]}` JSON. The two
  // deliberately diverge after connect — this is a serialize/seed pair, not a mirrored attribute.
  protected rawSeed = ''
  @property({ type: String, attribute: 'value', noAccessor: true })
  get value(): string {
    return JSON.stringify({
      lines: this.displayOrder.map((id) => {
        const mode = this.lineModes.get(id)
        const kind = this.lineKinds.get(id)
        const scrub = this.scrubBounds.get(id)
        return { id, latex: this.latexById.get(id) ?? '', ...(mode ? { mode } : {}), ...(kind ? { kind } : {}), ...(scrub ? { scrub } : {}) }
      }),
    } satisfies NotebookSeed)
  }
  set value(v: string) {
    const old = this.rawSeed
    this.rawSeed = v
    this.requestUpdate('value', old)
  }

  @state() protected notebook: NotebookCatalog | null = null
  @state() protected displayOrder: LineId[] = []
  @state() private results = new Map<LineId, LineResult>()

  protected latexById = new Map<LineId, string>()
  /** Per-line evaluation MODE: 'N' forces a numeric approximation, 'hold' leaves the cell unevaluated; absent = the
   *  default (exact where possible). Set from the hamburger menu, persisted in `value`. */
  private lineModes = new Map<LineId, LineMode>()
  /** Per-line cell KIND — only `comment` is stored (math is the default/absent). Comment cells stay out of the
   *  LineGraph and never recompute; the line renders their prose itself. */
  private lineKinds = new Map<LineId, LineKind>()
  /** Per-line scrubber bounds override (`n = 3` slider min/max/step). Absent = derive defaults from the value. */
  private scrubBounds = new Map<LineId, { min: number; max: number; step: number }>()
  /** Per-line collection-preview element count (grows on "pull more"). */
  private previewCounts = new Map<LineId, number>()
  private readonly graph = new LineGraph()
  private parser: ExpressionParser | null = null
  private scope: Scope = new Map()
  /** the type each DECLARED symbol carries (`x \in C`), so a failed or removed define falls back to it */
  private declared = new Map<string, Type>()
  @state() private bootError: string | null = null
  private readonly controllers = new Map<LineId, AbortController>()
  private pendingChanged = new Set<LineId>()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private focusAfterUpdate: LineId | null = null
  /** The seed behind every random op (RandomElement/RandomShuffle/RandomSample). Fixed per notebook so results are
   *  reproducible; the reshuffle button rolls a new one. (Global to the compute-engine library, so it is the whole
   *  page's randomness — one notebook's reshuffle reseeds all.) */
  @state() protected seed = (Math.random() * 2 ** 32) >>> 0
  /** Whether any line uses a random op — the reshuffle button is disabled otherwise (nothing to reroll). */
  @state() protected usesRandom = false
  /** Classifies a typed word for the field's display reformat (operator / entity / plain variable). Set on boot. */
  private classify: (run: string) => IdentifierDisplay | null = () => null
  /** Display spelling for a MathJSON head/symbol in the FullForm inspector: a catalog id shows PascalCase, else
   *  as-is (CE builtins are already Pascal; user variables stay bare). Set on boot. */
  private spellHead: (s: string) => string = (s) => s

  /** Actions: a line whose body is `p → expr` (or a tuple of them) is an ACTION, not a value — it reassigns its
   *  targets when triggered. Assignments are cached per line so the play button / ticker can fire them. */
  protected actions = new Map<LineId, { target: string; rhs: Node }[]>()
  /** Whether any line is an action — gates the ticker button (read by the notebook chrome). */
  @state() protected hasActions = false
  /** Suppress `onSettled()` while a chrome-driven batch (ticker run, undo restore) is in flight — the subclass sets
   *  it so a coalesced run collapses to a single undo step. */
  protected coalescing = false

  /** The ACTIVE cell — the last line to hold focus. Separate from control focus: clicking the virtual-keyboard
   *  toggle or the hamburger (both mousedown-prevented) does NOT change it or blur the field, so those controls
   *  act on / inject into whichever cell the caret was last in. */
  @state() protected activeLineId: LineId | null = null

  /** Each line's rendered value, or its error text if it errored. */
  get values(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const id of this.displayOrder) {
      const r = this.results.get(id)
      out[id] = r?.error ?? r?.value ?? ''
    }
    return out
  }

  /** Append (default) or insert-after-`afterId` a new line; returns its id. Public — the DOM test hook, and what
   *  a `line-commit` (Enter) uses internally. */
  addLine(latex = '', afterId?: LineId, kind?: LineKind): LineId {
    const id = `line-${++nextIdNum}`
    this.latexById.set(id, latex)
    if (kind) this.lineKinds.set(id, kind)
    if (afterId && this.displayOrder.includes(afterId)) {
      this.displayOrder.splice(this.displayOrder.indexOf(afterId) + 1, 0, id)
    } else {
      this.displayOrder.push(id)
    }
    this.displayOrder = [...this.displayOrder]
    if (kind === 'comment') {
      // Comment cells are prose, not expressions: keep them out of the graph and never recompute them.
      this.persist()
      this.emitChange()
      this.onSettled()
      return id
    }
    if (this.parser) this.graph.set(id, latex, this.parser)
    this.pendingChanged.add(id)
    void this.flushRecompute()
    this.persist()
    this.emitChange()
    return id
  }

  removeLine(id: LineId): void {
    if (this.displayOrder.length <= 1) return
    const idx = this.displayOrder.indexOf(id)
    if (idx === -1) return
    this.displayOrder = this.displayOrder.filter((x) => x !== id)
    this.latexById.delete(id)
    this.lineModes.delete(id)
    this.lineKinds.delete(id)
    this.scrubBounds.delete(id)
    const removed = this.graph.lines().find((m) => m.id === id)
    if (removed?.defines) {
      if (removed.bindKind === 'declare') { this.declared.delete(removed.defines); this.scope.delete(removed.defines) }
      else this.resetBinding(removed.defines)
    }
    this.graph.remove(id)
    this.results.delete(id)
    this.results = new Map(this.results)
    this.controllers.get(id)?.abort()
    this.controllers.delete(id)
    const neighbor = this.displayOrder[Math.min(idx, this.displayOrder.length - 1)]
    if (neighbor) this.focusAfterUpdate = neighbor
    void this.flushRecompute() // dependents of the removed line likely now error ("unknown symbol …")
    this.persist()
    this.emitChange()
  }

  connectedCallback(): void {
    super.connectedCallback()
    // Inner elements (each math input) emit their own composed `result`; only the set's summary may leave here,
    // or a wrapping <enumeratio-assert> reads a line's latex as the notebook's value.
    this.renderRoot.addEventListener('result', (ev) => { if (ev.target !== this) ev.stopPropagation() })
    this.seedInitialLines()
    void this.boot()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null }
    this.controllers.forEach((c) => c.abort())
  }

  // ── subclass hooks (no-ops here; <enumeratio-notebook> overrides for chrome) ─────────────────────────────────
  /** Persist the environment's serialized state (no-op — the notebook writes localStorage). */
  protected persist(): void {}
  /** Called after each SETTLED change (edit burst, add/remove/reorder, recompute pass) — the notebook records an
   *  undo step here and manages the ticker. */
  protected onSettled(): void {}
  /** Like onSettled but for a comment typing burst the notebook wants to debounce into one undo step. */
  protected onSettledDebounced(): void {}
  /** A seed drawn from persistent storage, taking precedence over the `value` attribute (null — the notebook reads
   *  localStorage[storage-key]). */
  protected seedFromStorage(): NotebookSeed | null { return null }

  /** Drop a symbol's VALUE: back to its declared type-only binding, or out of scope entirely. */
  private resetBinding(name: string): void {
    const t = this.declared.get(name)
    if (t) this.scope.set(name, { k: 'var', type: t })
    else this.scope.delete(name)
  }

  private async boot(): Promise<void> {
    let nb: NotebookCatalog
    try { nb = await loadNotebookCatalog() }
    catch (e) { this.bootError = message(e); return }
    this.bootError = null
    this.notebook = nb
    this.parser = makeParser(nb.names)
    // Classify a typed word for the field's display reformat: a catalog FUNCTION reads as an operator, a COLLECTION
    // as an entity, else a plain variable — and `identifierDisplay` turns that into the exact display LaTeX (Pascal
    // `\operatorname{}`/`\mathrm{}`, or a registered notation glyph) the reformat splices. Both snake_case and
    // PascalCase typed spellings map to the same id.
    const notation = nb.names.notation
    const entityMap = new Map<string, IdentifierDisplay>()
    for (const id of nb.names.functions) for (const s of [id, pascalCase(id)]) entityMap.set(s, identifierDisplay(id, 'function', notation))
    for (const id of nb.names.collections) for (const s of [id, pascalCase(id)]) if (!entityMap.has(s)) entityMap.set(s, identifierDisplay(id, 'collection', notation))
    // Syntax keywords render upright via `\operatorname{}` (they're not catalog ids, so identifierDisplay wouldn't
    // reach them) — so `for`/`with` in a comprehension/substitution read as keywords, not italic variables.
    for (const kw of ['for', 'with']) entityMap.set(kw, { kind: 'operator', latex: `\\operatorname{${kw}}` })
    this.classify = (run) => entityMap.get(run) ?? null
    const idSet = new Set<string>([...nb.names.functions, ...nb.names.collections])
    this.spellHead = (s) => (idSet.has(s) ? pascalCase(s) : s)
    await reseedRandom(this.seed) // reproducible randomness from the first evaluation
    for (const [id, latex] of this.latexById) {
      if (this.lineKinds.get(id) === 'comment') continue // prose, not an expression
      this.graph.set(id, latex, this.parser)
      this.pendingChanged.add(id)
    }
    await this.flushRecompute(true)
  }

  /** Roll a new random seed and recompute — every `RandomElement`/`Shuffle`/`RandomSample` line redraws. */
  async reshuffle(): Promise<void> {
    this.seed = (Math.random() * 2 ** 32) >>> 0
    await reseedRandom(this.seed)
    for (const id of this.displayOrder) this.pendingChanged.add(id)
    await this.flushRecompute(true)
  }

  // ── state restore (undo/redo lives in the notebook chrome; this is the model rebuild it drives) ───────────────
  /** Rebuild the whole environment from a serialized {value, seed} snapshot: lines, order, seed. Recompute from
   *  scratch (scope and bindings are derived, not stored). The caller (notebook undo/redo) guards its own history
   *  recording via `coalescing` so this recompute doesn't push a new entry. */
  protected async restoreValue(snap: string): Promise<void> {
    if (!this.parser) return
    const { value, seed } = JSON.parse(snap) as { value: string; seed: number }
    const parsed = JSON.parse(value) as NotebookSeed
    for (const id of [...this.latexById.keys()]) this.graph.remove(id)
    this.controllers.forEach((c) => c.abort())
    this.controllers.clear()
    this.latexById.clear()
    this.lineModes.clear()
    this.lineKinds.clear()
    this.scrubBounds.clear()
    this.scope = new Map()
    this.declared.clear()
    this.results = new Map()
    const order: LineId[] = []
    const dirty = new Set<LineId>()
    for (const l of parsed.lines ?? []) {
      const id = l.id ?? `line-${++nextIdNum}`
      this.latexById.set(id, l.latex)
      if (l.mode) this.lineModes.set(id, l.mode)
      if (l.kind) this.lineKinds.set(id, l.kind)
      if (l.scrub) this.scrubBounds.set(id, l.scrub)
      order.push(id)
      if (l.kind !== 'comment') { this.graph.set(id, l.latex, this.parser); dirty.add(id) }
    }
    this.displayOrder = order
    this.seed = seed
    await reseedRandom(seed)
    this.pendingChanged = dirty
    await this.flushRecompute(true)
    this.persist()
    this.emitChange()
  }

  // ── actions ──────────────────────────────────────────────────────────────────────────────────────────────────
  /** The `p → expr` assignments in a line's AST, or null if it isn't an action. A single `To`, or a tuple of them
   *  inside a Delimiter/Sequence; each target must be a bare symbol. */
  private actionOf(parsed: Parsed): { target: string; rhs: Node }[] | null {
    if (parsed.stmt.k !== 'expr') return null
    const tos: Node[] = []
    const collect = (e: Node): void => {
      const h = head(e)
      if (h === 'To') { tos.push(e); return }
      if (h === 'Delimiter' || h === 'Sequence') for (const a of args(e)) collect(a)
    }
    collect(parsed.stmt.body)
    if (tos.length === 0) return null
    const out: { target: string; rhs: Node }[] = []
    for (const t of tos) {
      const [target, rhs] = args(t)
      if (!isSymbol(target)) return null // only bare-symbol targets in this slice
      out.push({ target: symbolName(target), rhs })
    }
    return out
  }

  /** Trigger one action line: read every RHS against the CURRENT scope (simultaneous semantics), then rewrite each
   *  target's define-line latex to the new value and recompute once. Reassigning by rewriting the source line keeps
   *  actions inside the pure recompute+undo model — downstream cells update and the change is one undo step. */
  async runAction(id: LineId): Promise<void> {
    const assigns = this.actions.get(id)
    if (!assigns || !this.parser || !this.notebook) return
    const definers = this.graph.definers()
    const edits: { defLine: LineId; latex: string }[] = []
    for (const { target, rhs } of assigns) {
      const defLine = definers.get(target)
      if (!defLine) continue // no `target = …` line to reassign — skip (declared-only / unknown target)
      const value = await this.evalScalar(rhs)
      if (value === null) continue // non-scalar / errored RHS — skip in this slice
      edits.push({ defLine, latex: `${target} = ${value}` })
    }
    if (edits.length === 0) return
    for (const { defLine, latex } of edits) {
      this.latexById.set(defLine, latex)
      this.graph.set(defLine, latex, this.parser)
      this.pendingChanged.add(defLine)
    }
    await this.flushRecompute(true) // one pass → one undo entry (unless coalescing under a ticker)
  }

  /** Evaluate a bare expression against the current scope and return its scalar text, or null if it doesn't reduce
   *  to a single scalar (or errors). Reuses the normal bind→lower→evaluate pipeline via a synthetic Parsed. */
  private async evalScalar(body: Node): Promise<string | null> {
    if (!this.notebook) return null
    const parsed: Parsed = { stmt: { k: 'expr', body }, spans: new Map(), errors: [], latex: '' }
    try {
      const bound = bind(parsed, this.scope, this.notebook.catalog)
      if (bound.errors.length > 0) return null
      const lowered = lower(bound, this.scope)
      if (lowered.wants !== 'value' || !lowered.expr) return null
      const { rows } = evaluate(lowered.expr)
      let first: Row | undefined
      for await (const r of rows) { first = r; break }
      const cols = first ? Object.values(first) : []
      return cols[0] !== null && cols[0] !== undefined ? String(cols[0]) : null
    } catch {
      return null
    }
  }

  /** Evaluate one lowered `Expr` to its first column's text (or null). The low-level twin of `evalScalar`, for the
   *  synthetic cardinality/unrank calls the collection preview builds directly from a handle. */
  private async evalCell(expr: Expr, signal?: AbortSignal): Promise<string | null> {
    try {
      const { rows } = evaluate(expr, { signal })
      let first: Row | undefined
      for await (const r of rows) { first = r; break }
      const cols = first ? Object.values(first) : []
      return cols[0] !== null && cols[0] !== undefined ? String(cols[0]) : null
    } catch {
      return null
    }
  }

  /** Preview a bare collection as `{e₀, e₁, …, e_{k-1}, …}` — the first PREVIEW_COUNT elements by rank, with a
   *  trailing `…` when the cardinality (or the fact we stopped early) says there are more. Uses the handle's own
   *  cardinality + unrank primitives (ce-enum answers both), so it never materializes the collection. */
  private async previewCollection(id: LineId, handle: HandleExpr, typeBadgeText: string, href?: string): Promise<void> {
    const count = this.previewCounts.get(id) ?? PREVIEW_STEP
    this.controllers.get(id)?.abort()
    const controller = new AbortController()
    this.controllers.set(id, controller)
    this.setResult(id, { type: typeBadgeText, typeHref: href, busy: true })
    const stale = () => this.controllers.get(id) !== controller
    const handleSel: SelectExpr = { kind: 'handle', handle }
    const cell = (e: SelectExpr): Expr => ({ select: [e] })

    const cardText = await this.evalCell(cell({ kind: 'apply', fn: fnRef('cardinality'), args: [handleSel] }), controller.signal)
    if (stale()) return
    const card = cardText !== null && /^\d+$/.test(cardText) ? Number(cardText) : null
    const take = card === null ? count : Math.min(count, card)

    const elems: string[] = []
    for (let i = 0; i < take; i++) {
      const e = await this.evalCell(cell({ kind: 'apply', fn: fnRef('unrank'), args: [handleSel, { kind: 'lit', value: i }] }), controller.signal)
      if (stale()) return
      if (e === null) break
      elems.push(e)
    }
    const more = card === null ? elems.length >= count : card > elems.length
    this.setResult(id, { type: typeBadgeText, typeHref: href, value: `{${elems.join(', ')}}`, more })
  }

  /** Atlas link for a collection/element type — carries the handle's parameter bindings as matrix params
   *  (`/explore/collection/permutations;n=3`) so it lands on the exact parameterized collection, not the bare one. */
  private hrefOfType(t: Type): string | undefined {
    if (t.k !== 'elem' && t.k !== 'handle') return undefined
    const base = `/explore/collection/${encodeURIComponent(t.coll)}`
    const h = t.handle
    if (!h || 'raw' in h) return base // an unresolved/raw handle — link to the bare collection
    const params = this.notebook?.catalog.collection(t.coll)?.params ?? []
    const parts: string[] = []
    const scalar = (v: unknown): v is number | string => typeof v === 'number' || typeof v === 'string'
    // Prefer a real catalog param name; fall back to the positional convention (n, k, …) so the bindings still
    // reach the URL — the notebook holds the VALUES in memory even when it has no names.
    h.positional.forEach((v, i) => { const name = params[i] ?? POSITIONAL_PARAM_NAMES[i]; if (name != null && scalar(v)) parts.push(`${name}=${v}`) })
    for (const [k, v] of Object.entries(h.named)) if (scalar(v)) parts.push(`${k}=${v}`)
    return parts.length ? `${base};${parts.join(';')}` : base
  }

  /** Link a located element to the SQL query view that reproduces it: the collection filtered to its rank. A
   *  best-effort "verify we're talking about the same thing" link until a first-class element route exists. */
  private elementQueryHref(t: Type, rank: number): string | undefined {
    const base = this.hrefOfType(t)
    return base ? `${base}?where=${encodeURIComponent(`rank = ${rank}`)}` : undefined
  }

  /** Pull the next batch of a collection preview: bump this line's element count and re-preview it. */
  private onLineExpand = (ev: CustomEvent<{ lineId: LineId }>): void => {
    const id = ev.detail.lineId
    this.previewCounts.set(id, (this.previewCounts.get(id) ?? PREVIEW_STEP) + PREVIEW_STEP)
    this.pendingChanged.add(id)
    void this.flushRecompute()
  }

  /** Run every action line once — the notebook's ticker calls this each tick. */
  protected async runActions(): Promise<void> {
    for (const id of this.displayOrder) if (this.actions.has(id)) await this.runAction(id)
  }

  protected seedInitialLines(): void {
    let seed: NotebookSeed | null = this.seedFromStorage()
    if (!seed && this.rawSeed) {
      try { seed = JSON.parse(this.rawSeed) as NotebookSeed } catch { /* malformed seed — start blank */ }
    }
    const lines = seed?.lines?.length ? seed.lines : [{ latex: '' }]
    for (const l of lines) {
      const id = l.id ?? `line-${++nextIdNum}`
      this.latexById.set(id, l.latex)
      if (l.mode) this.lineModes.set(id, l.mode)
      if (l.kind) this.lineKinds.set(id, l.kind)
      if (l.scrub) this.scrubBounds.set(id, l.scrub)
      this.displayOrder.push(id)
    }
  }

  private emitChange(): void {
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true, composed: true }))
  }

  private emitResult(): void {
    this.dispatchEvent(
      new CustomEvent('result', { detail: { value: JSON.stringify(this.values) }, bubbles: true, composed: true }),
    )
  }

  // ── recompute pipeline ───────────────────────────────────────────────────────────────────────────────────────

  private scheduleRecompute(changedId: LineId): void {
    this.pendingChanged.add(changedId)
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => void this.flushRecompute(), 150)
  }

  private async flushRecompute(immediate = false): Promise<void> {
    if (!immediate && this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null }
    if (!this.parser || !this.notebook) return
    const changed = [...this.pendingChanged]
    this.pendingChanged.clear()
    if (changed.length === 0) return
    const dirty = new Set<LineId>()
    for (const id of changed) for (const d of this.graph.dirtyAfter(id)) dirty.add(d)
    const models = new Map(this.graph.lines().map((m) => [m.id, m]))
    // Reset the shared RNG to the notebook's seed before each pass, so random cells are STABLE across recomputes
    // (editing an unrelated line doesn't reroll them) and reproducible for a given seed — Desmos's model.
    await reseedRandom(this.seed)
    for (const id of this.graph.order()) {
      if (!dirty.has(id)) continue
      await this.evalLine(id, models)
    }
    // Promote any math cell whose whole body is a bare string into a real comment cell — the Desmos leading-`"`
    // gesture, and any string-only line. Done AFTER the eval pass so the graph is never mutated mid-iteration.
    let promoted = false
    for (const id of [...this.graph.order()]) {
      if (this.lineKinds.get(id)) continue
      const stmt = models.get(id)?.parsed?.stmt
      const text = stmt && stmt.k === 'expr' ? stringComment(stmt.body) : null
      if (text === null) continue
      this.promoteToComment(id, text)
      promoted = true
    }
    if (promoted) { this.persist(); this.emitChange() }
    // A line uses randomness if its parsed AST names a random op (random_element / random_sample / random_shuffle).
    // This gates the reshuffle button; a CE-purity check would be the principled source once threaded through.
    this.usesRandom = [...this.lineAst.values()].some((a) => /random_element|random_sample|random_shuffle/i.test(a))
    this.hasActions = this.actions.size > 0
    this.results = new Map(this.results)
    this.requestUpdate()
    this.emitResult()
    this.onSettled() // one settled change (the notebook records an undo step + stops a stale ticker here)
  }

  /** Promote a math cell whose body is a bare string into a real comment cell (Desmos's leading-`"`): move it out
   *  of the graph, drop its math result, re-home its text as the comment body. If it was the active cell, keep the
   *  caret by landing focus in the new comment editor so typing continues without a beat. */
  private promoteToComment(id: LineId, text: string): void {
    this.lineKinds.set(id, 'comment')
    this.latexById.set(id, text)
    this.graph.remove(id)
    this.results.delete(id)
    this.lineAst.delete(id)
    if (this.activeLineId === id) this.focusAfterUpdate = id
  }

  /** The parsed AST (MathJSON, pretty JSON) per line, for the line's opt-in right-click inspector. Merged into
   *  every result so the line always has it without threading it through each setResult call. */
  private lineAst = new Map<LineId, string>()

  private setResult(id: LineId, patch: LineResult): void {
    const ast = this.lineAst.get(id)
    this.results.set(id, ast ? { ...patch, ast } : patch)
  }

  private async evalLine(id: LineId, models: Map<LineId, LineModel>): Promise<void> {
    const notebook = this.notebook!
    this.lineAst.delete(id) // fresh each pass; set once the line parses (below)
    this.actions.delete(id) // ditto — re-detected below if this line is (still) an action
    // An empty / whitespace-only line is a blank, not an expression — never bind it (CE parses "" to the `Nothing`
    // symbol, which would otherwise surface as a spurious "unknown symbol Nothing").
    if ((this.latexById.get(id) ?? '').trim() === '') { this.setResult(id, {}); return }
    // Hold mode: the cell is intentionally left unevaluated (a Wolfram-style HoldForm) — parse it (so the AST
    // inspector still works) but stop before binding/evaluating.
    if (this.lineModes.get(id) === 'hold') {
      const held = models.get(id)?.parsed
      // Show the AST inside a Hold wrapper — Wolfram's HoldForm/Hold — so the inspector reads as what the mode does.
      if (held) this.lineAst.set(id, `Hold[${astFullForm(held, this.spellHead)}]`)
      this.setResult(id, { held: true })
      return
    }
    const model = models.get(id)
    if (!model) return
    if (model.errors.length > 0) { this.setResult(id, { error: model.errors[0] }); return }
    if (!model.parsed) { this.setResult(id, {}); return }
    if (model.parsed.errors.length > 0) { this.setResult(id, { error: model.parsed.errors[0].message }); return }
    this.lineAst.set(id, astFullForm(model.parsed, this.spellHead))

    // A bare STRING body is prose, not math — render it as a comment and NEVER lower it (a raw string leaf reaching
    // lower throws "unsupported literal node"). An interim comment: plain text now; full markdown+KaTeX to come.
    if (model.parsed.stmt.k === 'expr') {
      const c = stringComment(model.parsed.stmt.body)
      if (c !== null) { this.setResult(id, { comment: c }); return }
    }

    // An action line (`p → expr`, or a tuple) isn't a value — cache its assignments and show a trigger, don't eval.
    const assigns = this.actionOf(model.parsed)
    if (assigns) {
      this.actions.set(id, assigns)
      this.setResult(id, { type: '↻ action', action: true })
      return
    }

    // A define re-binds its symbol from scratch: back to the declared type (no value) or gone — never a stale value.
    if (model.bindKind === 'define' && model.defines) this.resetBinding(model.defines)

    let bound: Bound
    try {
      bound = bind(model.parsed, this.scope, notebook.catalog)
    } catch (e) {
      this.setResult(id, { error: message(e) })
      return
    }
    if (bound.errors.length > 0) {
      this.setResult(id, { type: typeBadge(bound.type), error: bound.errors[0].message })
      return
    }
    // A symbol just became elem(coll) — kick off that collection's stats/maps fetch so a later line that reads
    // them (once this resolves) has something to type against. See notebook-catalog.ts's NotebookCatalog.prefetch.
    if (bound.stmt.k === 'declare' && bound.type.k === 'elem') void notebook.prefetch(bound.type.coll)

    // A bare COLLECTION expression (`Permutations(5)`) has no scalar value — instead PREVIEW it: the first few
    // elements + a `…` when there are more, so the collection reads as itself.
    if (bound.stmt.k === 'expr' && bound.type.k === 'handle') {
      await this.previewCollection(id, bound.type.handle, typeBadge(bound.type), this.hrefOfType(bound.type))
      return
    }

    let lowered: LowerResult
    try {
      lowered = lower(bound, this.scope)
    } catch (e) {
      this.setResult(id, { type: typeBadge(bound.type), error: message(e) })
      return
    }
    if (lowered.wants === 'none') {
      // a declare puts its TYPE in scope (value comes from the define line, which orders after this one)
      if (bound.stmt.k === 'declare') {
        this.declared.set(bound.stmt.name, bound.type)
        this.scope.set(bound.stmt.name, { k: 'var', type: bound.type })
      }
      this.setResult(id, { type: typeBadge(bound.type), typeHref: this.hrefOfType(bound.type) })
      return
    }

    this.controllers.get(id)?.abort()
    const controller = new AbortController()
    this.controllers.set(id, controller)
    this.setResult(id, { type: typeBadge(bound.type), busy: true })
    const stale = () => this.controllers.get(id) !== controller

    try {
      const { plan, rows } = evaluate(lowered.expr!, { signal: controller.signal, numeric: this.lineModes.get(id) === 'N' })
      const collected: Row[] = []
      for await (const r of rows) collected.push(r)
      if (stale()) return
      const p = await plan
      if (stale()) return
      const cols = collected[0] ? Object.values(collected[0]) : []

      if (lowered.wants === 'locate') {
        const rankText = cols[0]
        const valueText = cols[1]
        const elemType = bound.type.k === 'elem' ? bound.type : undefined
        if (rankText === null || rankText === undefined || rankText === '') {
          this.setResult(id, { type: typeBadge(bound.type), error: `not a member of ${elemType?.coll ?? ''}`, engine: p.engine, sql: p.sql })
          return
        }
        const name = bound.stmt.k !== 'expr' ? bound.stmt.name : undefined
        if (name && elemType) {
          this.scope.set(name, { k: 'var', type: bound.type, value: { k: 'elem', coll: elemType.coll, handle: elemType.handle, rank: Number(rankText) } })
        }
        this.setResult(id, {
          type: typeBadge(bound.type, String(valueText)), typeHref: this.hrefOfType(bound.type),
          value: String(valueText), valueHref: this.elementQueryHref(bound.type, Number(rankText)),
          engine: p.engine, sql: p.sql,
        })
        return
      }

      // wants: 'value'
      const text = cols[0] !== null && cols[0] !== undefined ? String(cols[0]) : ''
      const name = bound.stmt.k !== 'expr' ? bound.stmt.name : undefined
      if (name) this.scope.set(name, { k: 'var', type: bound.type, value: { k: 'scalar', text, pg: effectivePg(bound.type) ?? 'numeric' } })

      // A free numeric parameter (`n = 3` — a define whose RHS is a literal number) gets a Desmos-style scrubber.
      const defBody = model.parsed.stmt.k === 'define' ? model.parsed.stmt.body : undefined
      const lit = numericLiteral(defBody)
      const scrub = lit !== null ? this.scrubFor(id, lit) : undefined

      // A value carrying a LaTeX control sequence is an EXACT symbolic result (√2, ⅙π²) — render it via KaTeX in
      // its own slot; a plain number/rational stays text (and drives the type-badge set refinement as before).
      const isTex = text.includes('\\')
      const base = isTex
        ? { type: typeBadge(bound.type), valueTex: text, engine: p.engine, sql: p.sql }
        : { type: typeBadge(bound.type, text), value: text, engine: p.engine, sql: p.sql }
      this.setResult(id, scrub ? { ...base, scrub } : base)
    } catch (e) {
      if (stale()) return
      this.setResult(id, { type: typeBadge(bound.type), error: message(e) })
    }
  }

  // ── line event handlers ──────────────────────────────────────────────────────────────────────────────────────

  private onLineInput = (ev: CustomEvent<{ lineId: LineId; latex: string }>): void => {
    const { lineId, latex } = ev.detail
    this.latexById.set(lineId, latex)
    if (this.lineKinds.get(lineId) === 'comment') {
      // Prose edit — no parse/recompute. Debounce a settle so a typing burst is one undo step.
      this.persist()
      this.emitChange()
      this.onSettledDebounced()
      return
    }
    // Desmos leading-quote: the moment a math cell's text starts with a `"`, it becomes a comment — immediately, so
    // the shape change tracks the keystroke rather than waiting for a completed string to parse. Strip the quote(s).
    if (latex.trimStart().startsWith('"')) {
      this.promoteToComment(lineId, latex.trim().replace(/^"+/, '').replace(/"+$/, ''))
      this.focusAfterUpdate = lineId
      this.persist(); this.emitChange(); this.requestUpdate()
      return
    }
    if (this.parser) this.graph.set(lineId, latex, this.parser)
    this.scheduleRecompute(lineId)
    this.persist()
    this.emitChange()
  }

  private onLineCommit = (ev: CustomEvent<{ lineId: LineId }>): void => {
    const id = this.addLine('', ev.detail.lineId)
    this.focusAfterUpdate = id
    this.requestUpdate()
  }

  private onLineMove = (ev: CustomEvent<{ lineId: LineId; direction: 'up' | 'down' }>): void => {
    const { lineId, direction } = ev.detail
    const idx = this.displayOrder.indexOf(lineId)
    if (idx === -1) return
    const neighbor = this.displayOrder[direction === 'up' ? idx - 1 : idx + 1]
    if (neighbor) { this.focusAfterUpdate = neighbor; this.requestUpdate() }
  }

  private onLineRemove = (ev: CustomEvent<{ lineId: LineId }>): void => {
    this.removeLine(ev.detail.lineId)
  }

  private onLineRun = (ev: CustomEvent<{ lineId: LineId }>): void => {
    void this.runAction(ev.detail.lineId)
  }

  // ── value scrubber ───────────────────────────────────────────────────────────────────────────────────────────
  /** Slider bounds for a free numeric define: a stored override, else sensible defaults from the current value —
   *  integers step by 1 from 0 (or −max..max when negative) up to a round headroom; reals get a fine step. */
  private scrubFor(id: LineId, value: number): { value: number; min: number; max: number; step: number } {
    const stored = this.scrubBounds.get(id)
    if (stored) return { value, ...stored }
    const int = Number.isInteger(value)
    const max = Math.max(10, Math.ceil(Math.abs(value) * 2))
    const min = value < 0 ? -max : 0
    const step = int ? 1 : Math.max(0.01, Number((Math.max(Math.abs(value), 1) / 100).toPrecision(1)))
    return { value, min, max, step }
  }

  /** Drag: rewrite the define's source to the scrubbed value and recompute (debounced) so downstream cells follow
   *  live. Rewriting the line keeps the scrubber inside the pure recompute+undo model, like actions do. */
  private onLineScrub = (ev: CustomEvent<{ lineId: LineId; value: number }>): void => {
    const { lineId, value } = ev.detail
    const name = this.graph.lines().find((m) => m.id === lineId)?.defines
    if (!name || !this.parser) return
    const latex = `${name} = ${value}`
    this.latexById.set(lineId, latex)
    this.graph.set(lineId, latex, this.parser)
    this.scheduleRecompute(lineId)
    this.persist(); this.emitChange()
    this.requestUpdate()
  }

  private onLineScrubBounds = (ev: CustomEvent<{ lineId: LineId; min: number; max: number }>): void => {
    const { lineId, min, max } = ev.detail
    const step = this.scrubBounds.get(lineId)?.step ?? (Number.isInteger(min) && Number.isInteger(max) ? 1 : 0.1)
    this.scrubBounds.set(lineId, { min, max, step })
    this.pendingChanged.add(lineId)
    void this.flushRecompute(true) // re-eval so the scrubber re-emits with the new bounds
    this.persist(); this.emitChange()
  }

  private onLineFocus = (ev: CustomEvent<{ lineId: LineId }>): void => {
    this.activeLineId = ev.detail.lineId
  }

  /** Focus the active cell (or the first line) — used after a menu action so the caret returns to the field. */
  protected focusLine(id: LineId | null): void {
    const target = id ?? this.displayOrder[0]
    if (target) { this.focusAfterUpdate = target; this.requestUpdate() }
  }

  /** A per-cell menu action from a line (its right-click menu or gutter config icon), routed to the matching op —
   *  the line names the target, so it acts on the clicked cell whether or not it's the active one. */
  private onLineAction = (ev: CustomEvent<{ lineId: LineId; action: 'N' | 'hold' | 'duplicate' | 'clear' }>): void => {
    const { lineId, action } = ev.detail
    if (action === 'N' || action === 'hold') this.setLineMode(lineId, action)
    else this.menuAction(lineId, action)
  }

  private menuAction(id: LineId, kind: 'duplicate' | 'clear' | 'delete'): void {
    if (!id) return
    if (kind === 'delete') { this.removeLine(id); return }
    if (kind === 'duplicate') { const n = this.addLine(this.latexById.get(id) ?? '', id, this.lineKinds.get(id)); this.focusLine(n); return }
    if (kind === 'clear') {
      this.latexById.set(id, '')
      if (this.lineKinds.get(id) === 'comment') { this.persist(); this.emitChange(); this.onSettled(); this.requestUpdate(); this.focusLine(id); return }
      if (this.parser) this.graph.set(id, '', this.parser)
      this.scheduleRecompute(id)
      this.persist(); this.emitChange()
      this.requestUpdate()
      this.focusLine(id)
    }
  }

  /** Toggle a cell's evaluation mode (numeric `N` / `hold`) — off if it was already that mode — then recompute it. */
  private setLineMode(id: LineId, mode: LineMode): void {
    if (!id) return
    if (this.lineModes.get(id) === mode) this.lineModes.delete(id)
    else this.lineModes.set(id, mode)
    this.pendingChanged.add(id)
    void this.flushRecompute()
    this.persist(); this.emitChange()
    this.requestUpdate()
  }

  private onLineReorder = (ev: CustomEvent<{ sourceId: LineId; targetId: LineId; position?: 'above' | 'below' }>): void => {
    const { sourceId, targetId, position = 'above' } = ev.detail
    const from = this.displayOrder.indexOf(sourceId)
    if (from === -1 || sourceId === targetId) return
    const order = this.displayOrder.filter((x) => x !== sourceId)
    const to = order.indexOf(targetId)
    const at = to === -1 ? order.length : position === 'below' ? to + 1 : to
    order.splice(at, 0, sourceId)
    this.displayOrder = order
    this.persist()
    this.emitChange()
    this.onSettled() // a pure reorder doesn't recompute, so settle it here
  }

  updated(): void {
    if (this.focusAfterUpdate) {
      const id = this.focusAfterUpdate
      this.focusAfterUpdate = null
      const el = this.renderRoot.querySelector<HTMLElement & { focus(): void }>(`enumeratio-expression-line[line-id="${id}"]`)
      el?.focus()
    }
  }

  private completerFor = (): Completer => {
    return (before: string): { replaceLen: number; candidates: CompletionCandidate[] } | null => {
      if (!this.notebook) return null
      const symbols = [...this.scope.keys()]
      const elemOf = (sym: string): string | undefined => {
        const b = this.scope.get(sym)
        return b?.k === 'var' && b.type.k === 'elem' ? b.type.coll : undefined
      }
      const res: Completion = complete(before, { catalog: this.notebook.completion, scope: { symbols, elemOf } })
      return { replaceLen: res.replaceLen, candidates: res.candidates }
    }
  }

  render(): TemplateResult {
    if (!this.notebook) {
      return this.bootError
        ? html`<div class="loading">environment unavailable: ${this.bootError}</div>`
        : html`<div class="loading">loading catalog…</div>`
    }
    return html`${this.renderLines()}${this.renderChrome()}`
  }

  /** The stack of expression lines — the whole environment on its own. <enumeratio-notebook> appends chrome after
   *  this via renderChrome(); a bare <enumeratio-expressions> renders just the lines. */
  protected renderLines(): TemplateResult {
    const completer = this.completerFor()
    // Row numbers count math cells only — a comment cell is "not there" for numbering, so the sequence reads 1, 2,
    // 3 straight through however many comments sit between them.
    let mathNum = 0
    return html`
      <div class="set">
        ${this.displayOrder.map(
          (id) => html`
            <enumeratio-expression-line
              line-id=${id}
              .index=${this.lineKinds.get(id) === 'comment' ? 0 : ++mathNum}
              .latex=${this.latexById.get(id) ?? ''}
              .completer=${completer}
              .classify=${this.classify}
              .active=${this.activeLineId === id}
              .mode=${this.lineModes.get(id) ?? ''}
              .kind=${this.lineKinds.get(id) ?? 'math'}
              .canDelete=${this.displayOrder.length > 1}
              .state=${this.results.get(id) ?? {}}
              @line-input=${this.onLineInput}
              @line-commit=${this.onLineCommit}
              @line-move=${this.onLineMove}
              @line-remove=${this.onLineRemove}
              @line-reorder=${this.onLineReorder}
              @line-run=${this.onLineRun}
              @line-action=${this.onLineAction}
              @line-scrub=${this.onLineScrub}
              @line-scrub-bounds=${this.onLineScrubBounds}
              @line-focus=${this.onLineFocus}
              @line-expand=${this.onLineExpand}
            ></enumeratio-expression-line>
          `,
        )}
      </div>
    `
  }

  /** Chrome appended after the lines — empty here; <enumeratio-notebook> returns its toolbar. */
  protected renderChrome(): TemplateResult {
    return html``
  }

  static styles: CSSResultGroup = css`
    :host {
      /* The bare environment is visually light: fill the container up to a fixed max, centered, no frame — so it
         can be embedded (e.g. a reference-page example). --enumeratio-notebook-width overrides the cap.
         <enumeratio-notebook> adds the bordered frame on top of this. */
      display: block;
      box-sizing: border-box;
      width: 100%;
      max-width: var(--enumeratio-notebook-width, 46rem);
      margin-inline: auto;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 1.05rem;
    }
    .set {
      display: flex;
      flex-direction: column;
    }
    .loading {
      padding: 1rem;
      opacity: 0.6;
      font-style: italic;
    }
  `
}

/** The type shown under a line's value, in notation. Scalars read as `∈ ℕ`/`∈ ℤ`/`∈ ℚ`/`∈ ℝ`/`∈ 𝔹`; an element of
 *  a collection as `∈ <coll>`; a function as `n ↦` / `(m, n) ↦`. When the bound scalar type is only the generic pg
 *  `numeric` (as counting functions come back), the concrete set is REFINED from the value itself — a plain
 *  integer is ℕ (or ℤ if negative), a `p/q` is ℚ, anything else with a fractional part is ℝ — so a Bell number no
 *  longer mislabels itself "numeric". */
function typeBadge(t: Type, value?: string): string {
  if (t.k === 'elem') return `∈ ${t.coll}`
  // Standard maps-to: bare `n ↦` for one argument, `(m, n) ↦` only when a tuple actually needs the parens.
  if (t.k === 'fn') return `${t.params.length === 1 ? t.params[0] : `(${t.params.join(', ')})`} ↦`
  if (t.k === 'handle') return t.coll
  if (t.k === 'scalar') {
    if (t.pg === 'boolean') return '∈ 𝔹'
    if (t.pg === 'natural_number') return '∈ ℕ'
    if (t.pg === 'integer_number') return '∈ ℤ'
    return `∈ ${scalarSet(t.pg, value)}`
  }
  return ''
}

/** Notation for a scalar carrier, refined by the evaluated value when the pg type is the generic `numeric`. */
function scalarSet(pg: string, value?: string): string {
  if (pg === 'rational_number') return 'ℚ'
  const v = value?.trim()
  if (v) {
    if (v.startsWith('[')) return 'list' // a list/tuple element (e.g. a random permutation) — not a scalar set
    if (/^-?\d+$/.test(v)) return v.startsWith('-') ? 'ℤ' : 'ℕ'
    if (/^-?\d+\s*\/\s*\d+$/.test(v)) return 'ℚ'
    if (/^-?\d*\.\d+$/.test(v)) return 'ℝ'
  }
  return pg === 'numeric' ? 'ℝ' : pg
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** A MathJSON body that is a bare (optionally negated) numeric literal → its number, else null. Used to spot a
 *  free numeric parameter (`n = 3`) that should get a scrubber — a computed RHS (`n = 3+2`) returns null. */
function numericLiteral(e: unknown): number | null {
  if (e == null) return null
  if (typeof e === 'number') return Number.isFinite(e) ? e : null
  if (Array.isArray(e)) {
    if (e[0] === 'Negate') { const n = numericLiteral(e[1]); return n === null ? null : -n }
    if (e[0] === 'Rational') { const a = numericLiteral(e[1]); const b = numericLiteral(e[2]); return a !== null && b ? a / b : null }
    return null
  }
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    if ('num' in o) { const n = Number(o.num); return Number.isFinite(n) ? n : null }
  }
  return null
}

/** MathJSON → a Wolfram-FullForm-style string: `["Binomial",6,2]` → `Binomial[6, 2]`, `n^2+1` →
 *  `Add[Power[n, 2], 1]`. Handles the boxed MathJSON number/symbol/string/function wrappers. `spell` maps a raw
 *  symbol/head to its DISPLAY spelling — used to show a catalog id in PascalCase (`random_element` →
 *  `RandomElement`), matching what you type; CE builtins and user variables pass through unchanged. */
function fullForm(x: unknown, spell: (s: string) => string = (s) => s): string {
  if (Array.isArray(x)) {
    const [h, ...rest] = x
    return `${fullForm(h, spell)}[${rest.map((r) => fullForm(r, spell)).join(', ')}]`
  }
  if (typeof x === 'string') return spell(x)
  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>
    if ('sym' in o) return spell(String(o.sym))
    if ('num' in o) return String(o.num)
    if ('str' in o) return JSON.stringify(o.str)
    if ('fn' in o) return fullForm(o.fn, spell)
    return JSON.stringify(x)
  }
  return String(x)
}

/** The parsed statement rendered in FullForm, for the opt-in line inspector. Pulls the statement's MathJSON
 *  (`body`/`domain`) and prefixes a define/declare so the shape is legible; length-capped. */
function astFullForm(parsed: unknown, spell: (s: string) => string = (s) => s): string {
  try {
    const stmt = (parsed as any)?.stmt ?? parsed
    const mj = stmt?.body ?? stmt?.domain ?? stmt
    let out = fullForm(mj, spell)
    if (stmt?.k === 'declare' && stmt?.name) out = `${stmt.name} ∈ ${out}`
    else if (stmt?.k === 'define' && stmt?.name) {
      const params = Array.isArray(stmt.params) && stmt.params.length ? `(${stmt.params.join(', ')})` : ''
      out = `${stmt.name}${params} := ${out}`
    }
    return out.length > 8000 ? out.slice(0, 8000) + ' … (truncated)' : out
  } catch (e) {
    return message(e)
  }
}

/** @enumeratio/notatio' types.ts defines this (and bind.ts/lower.ts both use it internally) but does not
 *  re-export it through the package's index — reimplemented locally rather than editing that package (out of
 *  this component package's scope; see the build receipt). Must stay identical to types.ts's `effectivePg`. */
function effectivePg(t: Type): string | undefined {
  if (t.k === 'scalar') return t.pg
  if (t.k === 'elem') return t.carrier
  return undefined
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-expressions': EnumeratioExpressions
  }
}
