import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { evaluate, type Row } from '@enumeratio/client'
import {
  bind, complete, lower, makeParser, LineGraph,
  type Bound, type Completion, type ExpressionParser, type LineId, type LineModel, type LowerResult, type Scope, type Type,
} from '@enumeratio/expressions'
import { loadNotebookCatalog, type NotebookCatalog } from './notebook-catalog'
import type { Completer, CompletionCandidate } from './enumeratio-math-input'
import { type LineState } from './enumeratio-expression-line'
import './enumeratio-expression-line'

// <enumeratio-expression-set> — a small notebook: a stack of <enumeratio-expression-line>s sharing ONE symbol
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

@customElement('enumeratio-expression-set')
export class EnumeratioExpressionSet extends LitElement {
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
    for (const [id, latex] of this.latexById) this.graph.set(id, latex, this.parser)
    for (const id of this.displayOrder) this.pendingChanged.add(id)
    await this.flushRecompute(true)
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
    for (const id of this.graph.order()) {
      if (!dirty.has(id)) continue
      await this.evalLine(id, models)
    }
    this.results = new Map(this.results)
    this.requestUpdate()
    this.emitResult()
  }

  private setResult(id: LineId, patch: LineResult): void {
    this.results.set(id, patch)
  }

  private async evalLine(id: LineId, models: Map<LineId, LineModel>): Promise<void> {
    const notebook = this.notebook!
    const model = models.get(id)
    if (!model) return
    if (model.errors.length > 0) { this.setResult(id, { error: model.errors[0] }); return }
    if (!model.parsed) { this.setResult(id, {}); return }
    if (model.parsed.errors.length > 0) { this.setResult(id, { error: model.parsed.errors[0].message }); return }

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
      this.setResult(id, { type: typeBadge(bound.type) })
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
        this.setResult(id, { type: typeBadge(bound.type), value: String(valueText), engine: p.engine, sql: p.sql })
        return
      }

      // wants: 'value'
      const text = cols[0] !== null && cols[0] !== undefined ? String(cols[0]) : ''
      const name = bound.stmt.k !== 'expr' ? bound.stmt.name : undefined
      if (name) this.scope.set(name, { k: 'var', type: bound.type, value: { k: 'scalar', text, pg: effectivePg(bound.type) ?? 'numeric' } })

      this.setResult(id, { type: typeBadge(bound.type), value: text, engine: p.engine, sql: p.sql })
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

  private onLineReorder = (ev: CustomEvent<{ sourceId: LineId; targetId: LineId }>): void => {
    const { sourceId, targetId } = ev.detail
    const from = this.displayOrder.indexOf(sourceId)
    if (from === -1 || sourceId === targetId) return
    const order = this.displayOrder.filter((x) => x !== sourceId)
    const to = order.indexOf(targetId)
    order.splice(to === -1 ? order.length : to, 0, sourceId)
    this.displayOrder = order
    this.persist()
    this.emitChange()
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
          (id) => html`
            <enumeratio-expression-line
              line-id=${id}
              .latex=${this.latexById.get(id) ?? ''}
              .completer=${completer}
              .state=${this.results.get(id) ?? {}}
              @line-input=${this.onLineInput}
              @line-commit=${this.onLineCommit}
              @line-move=${this.onLineMove}
              @line-remove=${this.onLineRemove}
              @line-reorder=${this.onLineReorder}
            ></enumeratio-expression-line>
          `,
        )}
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
      font-family: ui-monospace, SFMono-Regular, monospace;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 8px;
      overflow: hidden;
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

function typeBadge(t: Type): string {
  if (t.k === 'elem') return `∈ ${t.coll}`
  if (t.k === 'fn') return `f: (${t.params.join(', ')}) ↦`
  if (t.k === 'handle') return t.coll
  if (t.k === 'scalar') {
    if (t.pg === 'natural_number') return 'ℕ'
    if (t.pg === 'integer_number') return 'ℤ'
    if (t.pg === 'boolean') return '𝔹'
    return t.pg
  }
  return ''
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** @enumeratio/expressions' types.ts defines this (and bind.ts/lower.ts both use it internally) but does not
 *  re-export it through the package's index — reimplemented locally rather than editing that package (out of
 *  this component package's scope; see the build receipt). Must stay identical to types.ts's `effectivePg`. */
function effectivePg(t: Type): string | undefined {
  if (t.k === 'scalar') return t.pg
  if (t.k === 'elem') return t.carrier
  return undefined
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-expression-set': EnumeratioExpressionSet
  }
}
