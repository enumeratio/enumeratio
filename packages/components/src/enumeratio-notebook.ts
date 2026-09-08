import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { evaluate, fnRef, reseedRandom, type Expr, type HandleExpr, type Row, type SelectExpr } from '@enumeratio/client'
import {
  bind, complete, lower, makeParser, LineGraph, identifierDisplay, pascalCase,
  head, args, isSymbol, symbolName,
  type Bound, type Completion, type Expression, type ExpressionParser, type IdentifierDisplay, type LineId, type LineModel, type LowerResult, type Parsed, type Scope, type Type,
} from '@enumeratio/expressions'
import { loadNotebookCatalog, type NotebookCatalog } from './notebook-catalog'
import type { Completer, CompletionCandidate } from './enumeratio-math-input'
import { type LineState } from './enumeratio-expression-line'
import './enumeratio-expression-line'

// <enumeratio-notebook> — a small notebook: a stack of <enumeratio-expression-line>s sharing ONE symbol
// Scope and ONE LineGraph (@enumeratio/expressions' dependency-order + cycle/dup-define detector). The set owns
// every stateful thing a line does not: parsing (one ExpressionParser, built once the catalog loads), binding,
// lowering, evaluation (one AbortController per line), and persistence.
//
// Public surface:
//   property/attribute `value`  — seed/serialize as JSON `{ lines: [{id, latex}] }`. Read live via the `.value`
//                                  getter (this is a noAccessor property so the getter can be the live serialized
//                                  state rather than an echo of whatever was last written to the attribute).
//   attribute `storage-key`     — when set, lines persist to `localStorage[storage-key]` and seed FROM it if
//                                  non-empty (taking precedence over the `value` attribute's seed).
//   .values                     — `Record<lineId, string>`: each line's rendered value, or its error text.
//   .value                      — current `{lines:[...]}` JSON (see above).
//   .addLine(latex?, afterId?)  — append (or insert after `afterId`) a line; returns its id. DOM test hook.
//   events: composed `change` ({value}) on any edit, composed `result` ({value: JSON of `.values`}) after each
//   evaluation pass — <enumeratio-assert> can wrap the whole set and check that JSON blob.
export type NotebookSeed = { lines: { id?: string; latex: string }[] }

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


@customElement('enumeratio-notebook')
export class EnumeratioNotebook extends LitElement {
  @property({ type: String, attribute: 'storage-key' }) storageKey = ''

  // `value` is a manual (noAccessor) property: the SETTER only records the raw seed text (consumed once at
  // connect, see #seedInitialLines); the GETTER always computes the live `{lines:[...]}` JSON. The two
  // deliberately diverge after connect — this is a serialize/seed pair, not a mirrored attribute.
  #rawSeed = ''
  @property({ type: String, attribute: 'value', noAccessor: true })
  get value(): string {
    return JSON.stringify({
      lines: this.displayOrder.map((id) => ({ id, latex: this.latexById.get(id) ?? '' })),
    } satisfies NotebookSeed)
  }
  set value(v: string) {
    const old = this.#rawSeed
    this.#rawSeed = v
    this.requestUpdate('value', old)
  }

  @state() private notebook: NotebookCatalog | null = null
  @state() private displayOrder: LineId[] = []
  @state() private results = new Map<LineId, LineResult>()

  private latexById = new Map<LineId, string>()
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
  /** The seed behind every random op (RandomElement/Shuffle/RandomSample). Fixed per notebook so results are
   *  reproducible; the reshuffle button rolls a new one. (Global to the compute-engine library, so it is the whole
   *  page's randomness — one notebook's reshuffle reseeds all.) */
  @state() private seed = (Math.random() * 2 ** 32) >>> 0
  /** Whether any line uses a random op — the reshuffle button is disabled otherwise (nothing to reroll). */
  @state() private usesRandom = false
  /** Classifies a typed word for the field's display reformat (operator / entity / plain variable). Set on boot. */
  private classify: (run: string) => IdentifierDisplay | null = () => null
  /** Display spelling for a MathJSON head/symbol in the FullForm inspector: a catalog id shows PascalCase, else
   *  as-is (CE builtins are already Pascal; user variables stay bare). Set on boot. */
  private spellHead: (s: string) => string = (s) => s

  /** Notebook-level undo/redo: a linear history of serialized {value, seed} snapshots, one per settled change
   *  (text-edit burst, add/remove/reorder, reshuffle, and — to come — a triggered action). MathLive keeps its own
   *  per-field text undo; this is the STRUCTURAL history. `restoring` guards the recompute an undo triggers from
   *  recording itself. */
  private history: string[] = []
  private histPos = -1
  private restoring = false
  @state() private canUndo = false
  @state() private canRedo = false

  /** Actions: a line whose body is `p → expr` (or a tuple of them) is an ACTION, not a value — it reassigns its
   *  targets when triggered. Assignments are cached per line so the play button / ticker can fire them. */
  private actions = new Map<LineId, { target: string; rhs: Expression }[]>()
  /** While a ticker is running we suppress per-tick `record()`; the whole run collapses to ONE undo step at stop. */
  private coalescing = false
  private tickerTimer: ReturnType<typeof setInterval> | null = null
  @state() private tickerOn = false
  /** Whether any line is an action — gates the ticker button. */
  @state() private hasActions = false

  /** The ACTIVE cell — the last line to hold focus. Separate from control focus: clicking the virtual-keyboard
   *  toggle or the hamburger (both mousedown-prevented) does NOT change it or blur the field, so those controls
   *  act on / inject into whichever cell the caret was last in. */
  @state() private activeLineId: LineId | null = null
  @state() private vkOn = false
  @state() private menuOpen = false

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
  addLine(latex = '', afterId?: LineId): LineId {
    const id = `line-${++nextIdNum}`
    this.latexById.set(id, latex)
    if (afterId && this.displayOrder.includes(afterId)) {
      this.displayOrder.splice(this.displayOrder.indexOf(afterId) + 1, 0, id)
    } else {
      this.displayOrder.push(id)
    }
    this.displayOrder = [...this.displayOrder]
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
    if (this.tickerTimer) { clearInterval(this.tickerTimer); this.tickerTimer = null }
    if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null }
    this.controllers.forEach((c) => c.abort())
  }

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
    for (const [id, latex] of this.latexById) this.graph.set(id, latex, this.parser)
    for (const id of this.displayOrder) this.pendingChanged.add(id)
    await this.flushRecompute(true)
  }

  /** Roll a new random seed and recompute — every `RandomElement`/`Shuffle`/`RandomSample` line redraws. */
  async reshuffle(): Promise<void> {
    this.seed = (Math.random() * 2 ** 32) >>> 0
    await reseedRandom(this.seed)
    for (const id of this.displayOrder) this.pendingChanged.add(id)
    await this.flushRecompute(true)
  }

  // ── undo / redo ──────────────────────────────────────────────────────────────────────────────────────────────
  /** Capture the current {value, seed} as a history entry, unless it duplicates the current top (so a no-op flush
   *  or a redundant call adds nothing) or we're mid-restore. Truncates any redo tail. */
  private record(): void {
    if (this.restoring || this.coalescing) return
    const snap = JSON.stringify({ value: this.value, seed: this.seed })
    if (this.histPos >= 0 && this.history[this.histPos] === snap) return
    this.history = this.history.slice(0, this.histPos + 1)
    this.history.push(snap)
    if (this.history.length > 200) this.history.shift()
    this.histPos = this.history.length - 1
    this.canUndo = this.histPos > 0
    this.canRedo = false
  }

  async undo(): Promise<void> {
    if (this.histPos <= 0) return
    this.histPos--
    await this.applyState(this.history[this.histPos])
  }

  async redo(): Promise<void> {
    if (this.histPos >= this.history.length - 1) return
    this.histPos++
    await this.applyState(this.history[this.histPos])
  }

  /** Rebuild the whole notebook from a serialized snapshot: lines, order, seed. Recompute from scratch (scope and
   *  bindings are derived, not stored), guarded so the recompute doesn't record a new history entry. */
  private async applyState(snap: string): Promise<void> {
    if (!this.parser) return
    const { value, seed } = JSON.parse(snap) as { value: string; seed: number }
    const parsed = JSON.parse(value) as NotebookSeed
    this.restoring = true
    try {
      for (const id of [...this.latexById.keys()]) this.graph.remove(id)
      this.controllers.forEach((c) => c.abort())
      this.controllers.clear()
      this.latexById.clear()
      this.scope = new Map()
      this.declared.clear()
      this.results = new Map()
      const order: LineId[] = []
      for (const l of parsed.lines ?? []) {
        const id = l.id ?? `line-${++nextIdNum}`
        this.latexById.set(id, l.latex)
        order.push(id)
        this.graph.set(id, l.latex, this.parser)
      }
      this.displayOrder = order
      this.seed = seed
      await reseedRandom(seed)
      this.pendingChanged = new Set(order)
      await this.flushRecompute(true)
    } finally {
      this.restoring = false
    }
    this.canUndo = this.histPos > 0
    this.canRedo = this.histPos < this.history.length - 1
    this.persist()
    this.emitChange()
  }

  // ── actions ──────────────────────────────────────────────────────────────────────────────────────────────────
  /** The `p → expr` assignments in a line's AST, or null if it isn't an action. A single `To`, or a tuple of them
   *  inside a Delimiter/Sequence; each target must be a bare symbol. */
  private actionOf(parsed: Parsed): { target: string; rhs: Expression }[] | null {
    if (parsed.stmt.k !== 'expr') return null
    const tos: Expression[] = []
    const collect = (e: Expression): void => {
      const h = head(e)
      if (h === 'To') { tos.push(e); return }
      if (h === 'Delimiter' || h === 'Sequence') for (const a of args(e)) collect(a)
    }
    collect(parsed.stmt.body)
    if (tos.length === 0) return null
    const out: { target: string; rhs: Expression }[] = []
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
  private async evalScalar(body: Expression): Promise<string | null> {
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

  // ── ticker: run every action line each tick; the whole run is ONE undo step ──────────────────────────────────
  toggleTicker(): void {
    if (this.tickerOn) this.stopTicker()
    else this.startTicker()
  }
  private startTicker(): void {
    if (this.tickerOn) return
    this.tickerOn = true
    this.coalescing = true // suppress per-tick record(); the pre-ticker state is already the history top
    this.tickerTimer = setInterval(() => void this.tick(), 400)
  }
  private stopTicker(): void {
    if (this.tickerTimer) { clearInterval(this.tickerTimer); this.tickerTimer = null }
    this.tickerOn = false
    this.coalescing = false
    this.record() // collapse the whole run into a single undo step
  }
  private ticking = false
  private async tick(): Promise<void> {
    if (this.ticking) return // a slow evaluate must not overlap the next interval
    this.ticking = true
    try { for (const id of this.displayOrder) if (this.actions.has(id)) await this.runAction(id) }
    finally { this.ticking = false }
  }

  private seedInitialLines(): void {
    let seed: NotebookSeed | null = null
    if (this.storageKey) {
      try {
        const raw = localStorage.getItem(this.storageKey)
        if (raw) seed = JSON.parse(raw) as NotebookSeed
      } catch { /* storage unavailable/corrupt — fall through to the value attribute */ }
    }
    if (!seed && this.#rawSeed) {
      try { seed = JSON.parse(this.#rawSeed) as NotebookSeed } catch { /* malformed seed — start blank */ }
    }
    const lines = seed?.lines?.length ? seed.lines : [{ latex: '' }]
    for (const l of lines) {
      const id = l.id ?? `line-${++nextIdNum}`
      this.latexById.set(id, l.latex)
      this.displayOrder.push(id)
    }
  }

  private persist(): void {
    if (!this.storageKey) return
    try { localStorage.setItem(this.storageKey, this.value) } catch { /* storage unavailable — edits stay in-memory only */ }
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
    // A line uses randomness if its parsed AST names a random op (random_element / random_sample / scramble). This
    // gates the reshuffle button; a CE-purity check would be the principled source once threaded through.
    this.usesRandom = [...this.lineAst.values()].some((a) => /random_element|random_sample|scramble/i.test(a))
    this.hasActions = this.actions.size > 0
    if (this.hasActions === false && this.tickerOn) this.stopTicker() // last action removed while ticking
    this.results = new Map(this.results)
    this.requestUpdate()
    this.emitResult()
    this.record() // one history entry per settled change (no-op if nothing actually changed, or mid-restore)
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
      const { plan, rows } = evaluate(lowered.expr!, { signal: controller.signal })
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

      // A value carrying a LaTeX control sequence is an EXACT symbolic result (√2, ⅙π²) — render it via KaTeX in
      // its own slot; a plain number/rational stays text (and drives the type-badge set refinement as before).
      const isTex = text.includes('\\')
      this.setResult(id, isTex
        ? { type: typeBadge(bound.type), valueTex: text, engine: p.engine, sql: p.sql }
        : { type: typeBadge(bound.type, text), value: text, engine: p.engine, sql: p.sql })
    } catch (e) {
      if (stale()) return
      this.setResult(id, { type: typeBadge(bound.type), error: message(e) })
    }
  }

  // ── line event handlers ──────────────────────────────────────────────────────────────────────────────────────

  private onLineInput = (ev: CustomEvent<{ lineId: LineId; latex: string }>): void => {
    const { lineId, latex } = ev.detail
    this.latexById.set(lineId, latex)
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

  private onLineFocus = (ev: CustomEvent<{ lineId: LineId }>): void => {
    this.activeLineId = ev.detail.lineId
    this.menuOpen = false // a click into a different cell closes an open hamburger
  }

  // ── active-cell controls (virtual keyboard + hamburger) — never steal the field's focus ──────────────────────
  /** MathLive's on-screen keyboard is a global singleton; with policy 'manual' we drive it. It types into the
   *  focused mathfield, and the toggle's mousedown is prevented, so focus stays on the active cell. */
  private toggleVirtualKeyboard(): void {
    const vk = (globalThis as { mathVirtualKeyboard?: { visible: boolean; show(): void; hide(): void } }).mathVirtualKeyboard
    if (!vk) return
    if (vk.visible) vk.hide()
    else vk.show()
    this.vkOn = vk.visible
  }

  /** Focus the active cell (or the first line) — used after a menu action so the caret returns to the field. */
  private focusLine(id: LineId | null): void {
    const target = id ?? this.displayOrder[0]
    if (target) { this.focusAfterUpdate = target; this.requestUpdate() }
  }

  private menuAction(kind: 'duplicate' | 'clear' | 'delete'): void {
    const id = this.activeLineId
    this.menuOpen = false
    if (!id) return
    if (kind === 'delete') { this.removeLine(id); return }
    if (kind === 'duplicate') { const n = this.addLine(this.latexById.get(id) ?? '', id); this.focusLine(n); return }
    if (kind === 'clear') {
      this.latexById.set(id, '')
      if (this.parser) this.graph.set(id, '', this.parser)
      this.scheduleRecompute(id)
      this.persist(); this.emitChange()
      this.requestUpdate()
      this.focusLine(id)
    }
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
    this.record() // a pure reorder doesn't recompute, so record it here
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
        ? html`<div class="loading">notebook unavailable: ${this.bootError}</div>`
        : html`<div class="loading">loading catalog…</div>`
    }
    const completer = this.completerFor()
    return html`
      <div class="set">
        ${this.displayOrder.map(
          (id, i) => html`
            <enumeratio-expression-line
              line-id=${id}
              .index=${i + 1}
              .latex=${this.latexById.get(id) ?? ''}
              .completer=${completer}
              .classify=${this.classify}
              .active=${this.activeLineId === id}
              .state=${this.results.get(id) ?? {}}
              @line-input=${this.onLineInput}
              @line-commit=${this.onLineCommit}
              @line-move=${this.onLineMove}
              @line-remove=${this.onLineRemove}
              @line-reorder=${this.onLineReorder}
              @line-run=${this.onLineRun}
              @line-focus=${this.onLineFocus}
              @line-expand=${this.onLineExpand}
            ></enumeratio-expression-line>
          `,
        )}
      </div>
      <div class="toolbar">
        <div class="tools-left">
          <button class="tool" @click=${() => this.appendBlankLine()}
                  title="Add line" aria-label="Add line">+</button>
          <button class="tool" ?disabled=${!this.canUndo} @click=${() => void this.undo()}
                  title="Undo" aria-label="Undo">↺</button>
          <button class="tool" ?disabled=${!this.canRedo} @click=${() => void this.redo()}
                  title="Redo" aria-label="Redo">↻</button>
          ${this.hasActions
            ? html`<button class="tool ${this.tickerOn ? 'on' : ''}" @click=${() => this.toggleTicker()}
                     title=${this.tickerOn ? 'Stop ticker' : 'Start ticker (run actions repeatedly)'}
                     aria-label="Ticker">${this.tickerOn ? '⏸' : '▶'}</button>`
            : ''}
          <button class="tool" ?disabled=${!this.usesRandom} @click=${() => void this.reshuffle()}
                  title="Reshuffle" aria-label="Reshuffle">⤮</button>
        </div>
        <div class="tools-right">
          <button class="tool ${this.vkOn ? 'on' : ''}"
                  @mousedown=${(e: MouseEvent) => e.preventDefault()} @click=${() => this.toggleVirtualKeyboard()}
                  title="Virtual keyboard" aria-label="Virtual keyboard">⌨</button>
          <div class="menuwrap">
            <button class="tool ${this.menuOpen ? 'on' : ''}" ?disabled=${!this.activeLineId}
                    @mousedown=${(e: MouseEvent) => e.preventDefault()} @click=${() => (this.menuOpen = !this.menuOpen)}
                    title="Cell menu" aria-label="Cell menu">☰</button>
            ${this.menuOpen && this.activeLineId
              ? html`<div class="menu right" @mousedown=${(e: MouseEvent) => e.preventDefault()}>
                  <button @click=${() => this.menuAction('duplicate')}>Duplicate</button>
                  <button @click=${() => this.menuAction('clear')}>Clear</button>
                  <button @click=${() => this.menuAction('delete')} ?disabled=${this.displayOrder.length <= 1}>Delete</button>
                </div>`
              : ''}
          </div>
        </div>
      </div>
    `
  }

  /** Footer `+`: append a blank line and focus it. */
  private appendBlankLine(): void {
    const id = this.addLine('')
    this.focusAfterUpdate = id
    this.requestUpdate()
  }

  static styles = css`
    :host {
      /* Standard notebook width: fill the container up to a fixed max, centered — so every notebook on a
         page presents at the same width regardless of where it's embedded. --enumeratio-notebook-width
         overrides the cap. */
      display: block;
      box-sizing: border-box;
      width: 100%;
      max-width: var(--enumeratio-notebook-width, 46rem);
      margin-inline: auto;
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 1.05rem;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 8px;
      overflow: hidden;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.3rem 0.5rem;
      border-top: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
    }
    .tools-left,
    .tools-right {
      display: flex;
      gap: 0.3rem;
    }
    .tool {
      font: inherit;
      font-size: 1.1rem;
      line-height: 1;
      cursor: pointer;
      width: 1.9rem;
      height: 1.9rem;
      display: grid;
      place-items: center;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 6px;
      background: transparent;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
    }
    .tool:hover:not(:disabled) {
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      border-color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
    }
    .tool:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .tool.on {
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      border-color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 12%, transparent);
    }
    .menuwrap { position: relative; }
    /* The hamburger's per-cell menu opens UPWARD (the toolbar sits at the notebook's bottom). */
    .menu {
      position: absolute;
      bottom: calc(100% + 0.3rem);
      left: 0;
      z-index: 40;
      display: flex;
      flex-direction: column;
      min-width: 8rem;
      padding: 0.25rem;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 6px;
      background: var(--enumeratio-surface, var(--p-content-background, canvas));
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    }
    .menu button {
      font: inherit;
      text-align: left;
      padding: 0.35rem 0.6rem;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .menu button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 12%, transparent);
    }
    .menu button:disabled { opacity: 0.35; cursor: default; }
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

/** @enumeratio/expressions' types.ts defines this (and bind.ts/lower.ts both use it internally) but does not
 *  re-export it through the package's index — reimplemented locally rather than editing that package (out of
 *  this component package's scope; see the build receipt). Must stay identical to types.ts's `effectivePg`. */
function effectivePg(t: Type): string | undefined {
  if (t.k === 'scalar') return t.pg
  if (t.k === 'elem') return t.carrier
  return undefined
}

/** @deprecated Back-compat alias for the previous tag name `<enumeratio-expression-set>`. The element was renamed
 *  to `<enumeratio-notebook>`; this keeps any existing embed working (custom-element names are public API, and the
 *  repo convention is augment-or-tombstone, never a silent rename). A distinct subclass because customElements
 *  requires one constructor per tag. Emits a one-time console warning; remove once no embed uses the old name. */
@customElement('enumeratio-expression-set')
export class EnumeratioExpressionSet extends EnumeratioNotebook {
  connectedCallback(): void {
    super.connectedCallback()
    if (!EnumeratioExpressionSet.warned) {
      EnumeratioExpressionSet.warned = true
      console.warn('<enumeratio-expression-set> is deprecated — use <enumeratio-notebook>.')
    }
  }
  private static warned = false
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-notebook': EnumeratioNotebook
    'enumeratio-expression-set': EnumeratioExpressionSet
  }
}
