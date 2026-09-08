import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Completer } from './enumeratio-math-input'
import type { IdentifierDisplay } from '@enumeratio/expressions'
import './enumeratio-math-input'

// <enumeratio-expression-line> — one row of a notebook <enumeratio-notebook>. The math-input field spans the full
// row (so every field in a notebook is the same width, Desmos-style); the value sits on its own row below it,
// right-aligned, free to spread across the full width; and a quiet meta line below THAT carries the value's TYPE
// in notation (∈ ℕ / ∈ ℚ / ∈ 𝔖₅ …), right-aligned and gray — or, when the line can't be parsed/bound, the error
// message in its place. Purely PRESENTATIONAL: the owning set feeds it `state` and reacts to the events it
// re-emits (`line-input`/`line-commit`/`line-move`/`line-remove`).
//
// Errors are DEBOUNCED for display: not shown until the input has settled (~350 ms), never while a line is empty,
// so a half-typed symbol doesn't flash "unknown symbol …".
//
// Right-clicking a line opens an opt-in AST inspector showing the MathJSON the field parsed to.
export type LineState = {
  /** Rendered type, in notation, e.g. "∈ ℕ", "∈ ℚ", "∈ 𝔖₅", "f: (n) ↦" — the set derives this from the bound
   *  Type and the evaluated value; empty/undefined while the line hasn't bound to anything. */
  type?: string
  value?: string
  error?: string
  /** The parsed AST (MathJSON, pretty JSON) for the opt-in right-click inspector. */
  ast?: string
  engine?: string
  sql?: string
  busy?: boolean
  /** This line is an ACTION (`p → …`): show a ▶ trigger instead of a value. */
  action?: boolean
}

const ERROR_SHOW_DELAY_MS = 350

@customElement('enumeratio-expression-line')
export class EnumeratioExpressionLine extends LitElement {
  @property({ type: String, attribute: 'line-id' }) lineId = ''
  @property({ type: String }) latex = ''
  @property({ type: Number }) index = 0
  @property({ attribute: false }) completer: Completer | null = null
  @property({ attribute: false }) classify: ((run: string) => IdentifierDisplay | null) | null = null
  @property({ attribute: false }) state: LineState = {}

  /** Gated display of `state.error` — see the debounce note above. */
  @state() private showError = false
  @state() private astOpen = false
  /** Drag state: `dragging` = this row is the one being moved (dim it); `dropEdge` = which edge a drop bar shows on. */
  @state() private dragging = false
  @state() private dropEdge: 'above' | 'below' | null = null
  private errorTimer: ReturnType<typeof setTimeout> | null = null
  private lastError: string | undefined = undefined

  focus(): void {
    this.mathInput?.focus()
  }

  private get mathInput() {
    return this.renderRoot.querySelector('enumeratio-math-input') as (HTMLElement & { focus(): void }) | null
  }

  private emit(name: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  private onInput = (ev: CustomEvent<{ latex: string }>): void => {
    this.latex = ev.detail.latex
    this.hideError()
    this.emit('line-input', { lineId: this.lineId, latex: this.latex })
  }

  private onCommit = (): void => {
    this.emit('line-commit', { lineId: this.lineId })
    if (this.latex.trim() === '') this.emit('line-remove', { lineId: this.lineId })
  }

  private onMove = (ev: CustomEvent<{ direction: 'up' | 'down' }>): void => {
    this.emit('line-move', { lineId: this.lineId, direction: ev.detail.direction })
  }

  private onKeydownCapture = (ev: KeyboardEvent): void => {
    if (ev.key === 'Backspace' && this.latex === '') {
      this.emit('line-remove', { lineId: this.lineId })
    }
  }

  private onContextMenu = (ev: MouseEvent): void => {
    if (!this.state.ast) return // nothing parsed to show — fall through to the native menu
    ev.preventDefault()
    this.astOpen = !this.astOpen
  }

  // Reorder by dragging the handle. The dragged GHOST is the whole row (setDragImage); the source dims while it
  // moves; the target shows a drop bar on the edge the pointer is nearest. The set owns the actual reordering
  // (line-reorder → onLineReorder), told which side to drop on.
  private get lineEl(): HTMLElement | null {
    return this.renderRoot.querySelector('.line')
  }
  private onDragStart = (ev: DragEvent): void => {
    ev.dataTransfer?.setData('text/plain', this.lineId)
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move'
      const row = this.lineEl
      if (row) ev.dataTransfer.setDragImage(row, 16, row.offsetHeight / 2) // ghost = the whole row, not just the number
    }
    this.dragging = true
  }
  private onDragEnd = (): void => { this.dragging = false; this.dropEdge = null }
  private onDragOver = (ev: DragEvent): void => {
    ev.preventDefault()
    if (this.dragging) return // don't show a drop bar on the row being dragged
    const rect = this.lineEl?.getBoundingClientRect()
    this.dropEdge = rect ? (ev.clientY < rect.top + rect.height / 2 ? 'above' : 'below') : null
  }
  private onDragLeave = (ev: DragEvent): void => {
    // ignore leaves into a child; only clear when the pointer actually exits the row
    if (!this.lineEl?.contains(ev.relatedTarget as Node)) this.dropEdge = null
  }
  private onDrop = (ev: DragEvent): void => {
    ev.preventDefault()
    const sourceId = ev.dataTransfer?.getData('text/plain')
    const position = this.dropEdge ?? 'above'
    this.dropEdge = null
    if (sourceId && sourceId !== this.lineId) this.emit('line-reorder', { sourceId, targetId: this.lineId, position })
  }

  private hideError(): void {
    if (this.errorTimer) { clearTimeout(this.errorTimer); this.errorTimer = null }
    this.showError = false
  }

  updated(changed: Map<string, unknown>): void {
    if (!changed.has('state')) return
    const err = this.state.error
    if (err === this.lastError) return
    this.lastError = err
    if (this.errorTimer) { clearTimeout(this.errorTimer); this.errorTimer = null }
    if (err && this.latex.trim() !== '') {
      this.errorTimer = setTimeout(() => { this.showError = true; this.errorTimer = null }, ERROR_SHOW_DELAY_MS)
    } else {
      this.showError = false
    }
  }

  disconnectedCallback(): void {
    if (this.errorTimer) clearTimeout(this.errorTimer)
    super.disconnectedCallback()
  }

  render(): TemplateResult {
    const s = this.state
    const errVisible = this.showError && !!s.error && this.latex.trim() !== ''
    const hasValue = !errVisible && !s.busy && s.value != null
    // The meta slot shows the error (when there is one) in place of the type — the natural home for a parse/bind
    // failure, right where the type would otherwise sit.
    const lineClass = `line${this.dragging ? ' dragging' : ''}${this.dropEdge ? ` drop-${this.dropEdge}` : ''}`
    return html`
      <div class=${lineClass} @keydown=${this.onKeydownCapture} @contextmenu=${this.onContextMenu}
           @focusin=${() => this.emit('line-focus', { lineId: this.lineId })}
           @dragover=${this.onDragOver} @dragleave=${this.onDragLeave} @drop=${this.onDrop}>
        <div class="gutter">
          <span class="rownum" draggable="true" @dragstart=${this.onDragStart} @dragend=${this.onDragEnd}
                title="drag to reorder">${this.index}</span>
          ${s.action
            ? html`<button class="rowbtn" @mousedown=${(e: MouseEvent) => e.preventDefault()}
                      @click=${() => this.emit('line-run', { lineId: this.lineId })}
                      title="run this action" aria-label="run this action">→</button>`
            : ''}
        </div>
        <div class="body">
          <div class="field">
            <enumeratio-math-input
              .latex=${this.latex}
              .completer=${this.completer}
              .classify=${this.classify}
              @enumeratio-input=${this.onInput}
              @enumeratio-commit=${this.onCommit}
              @enumeratio-move=${this.onMove}
            ></enumeratio-math-input>
            ${!errVisible && s.type ? html`<span class="type">${s.type}</span>` : ''}
          </div>
          <div class="value">
            ${s.busy ? html`<span class="hint">…</span>` : hasValue ? html`<span class="eq">=</span> ${s.value}` : ''}
          </div>
          ${errVisible ? html`<div class="error">${s.error}</div>` : ''}
        </div>
        ${this.astOpen && s.ast
          ? html`<div class="ast" @click=${() => (this.astOpen = false)} title="click to close — this is the parsed FullForm"><pre>${s.ast}</pre></div>`
          : ''}
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .line {
      position: relative;
      display: flex;
      align-items: stretch;
      gap: 0.5rem;
      padding: 0.4rem 0.5rem 0.4rem 0;
      border-bottom: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
    }
    /* The row being dragged dims so the moving ghost reads as the "real" one. */
    .line.dragging { opacity: 0.4; }
    /* Drop indicator: a fat accent bar on the edge the pointer is nearest. */
    .line.drop-above::before,
    .line.drop-below::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--enumeratio-accent, #d97706) 40%, transparent);
      pointer-events: none;
    }
    .line.drop-above::before { top: -1px; }
    .line.drop-below::after { bottom: -1px; }
    /* The left-margin gutter (Desmos-style): a fat column with its own faint background, holding the row number
       (which is the drag handle) and an optional per-row icon button below it — the action ▶/→ today; a
       visibility toggle or an assignment scrubber to come. */
    .gutter {
      flex: 0 0 auto;
      align-self: stretch;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      min-width: 2rem;
      padding: 0.5rem 0.35rem 0.3rem;
      background: color-mix(in srgb, var(--enumeratio-muted, currentColor) 6%, transparent);
      border-right: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
      transition: background 0.12s;
    }
    .line:hover .gutter {
      background: color-mix(in srgb, var(--enumeratio-accent, var(--p-primary-color, #d97706)) 12%, transparent);
    }
    .rownum {
      align-self: flex-end;
      font-size: 0.85em;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      opacity: 0.6;
      cursor: grab;
      user-select: none;
    }
    .rownum:active { cursor: grabbing; }
    /* Per-row icon button in the gutter (mousedown prevented so it never steals the field's caret). */
    .rowbtn {
      font: inherit;
      font-size: 0.95rem;
      line-height: 1;
      cursor: pointer;
      width: 1.5rem;
      height: 1.5rem;
      display: grid;
      place-items: center;
      border: 1px solid var(--enumeratio-accent, var(--p-primary-color, #d97706));
      border-radius: 6px;
      background: transparent;
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
    }
    .rowbtn:hover {
      background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 14%, transparent);
    }
    .body {
      flex: 1 1 auto;
      min-width: 0;
    }
    /* The field is the full row, so every field in a notebook is exactly the same width. */
    .field {
      position: relative;
    }
    enumeratio-math-input {
      display: block;
      width: 100%;
    }
    /* The bound type, in notation, floating at the right INSIDE the field — a faint chip so it reads over the
       field's content; hidden on error. */
    .type {
      position: absolute;
      right: 0.55rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      font-size: 0.8em;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      opacity: 0.8;
      padding: 0 0.25rem;
      border-radius: 4px;
      background: color-mix(in srgb, var(--enumeratio-surface, var(--p-content-background, canvas)) 78%, transparent);
    }
    /* Value on its own row below the field, right-aligned and free to use the full width. */
    .value {
      margin-top: 0.25rem;
      text-align: right;
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      font-weight: 600;
      overflow-wrap: anywhere;
      min-height: 1.2em;
    }
    .eq {
      opacity: 0.4;
      font-weight: 400;
    }
    /* A parse/bind error takes the value's place, below the field — full width for the whole message, muted. */
    .error {
      margin-top: 0.15rem;
      text-align: right;
      font-size: 0.9em;
      overflow-wrap: anywhere;
      color: color-mix(in srgb, var(--p-red-500, #dc2626) 80%, var(--enumeratio-muted, currentColor));
    }
    .hint {
      opacity: 0.35;
    }
    .ast {
      position: absolute;
      right: 0.5rem;
      top: 100%;
      z-index: 30;
      max-width: min(90vw, 32rem);
      max-height: 18rem;
      overflow: auto;
      margin-top: 0.15rem;
      padding: 0.4rem 0.6rem;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 6px;
      background: var(--enumeratio-surface, var(--p-content-background, canvas));
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      cursor: pointer;
    }
    .ast pre {
      margin: 0;
      font-size: 0.78em;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-expression-line': EnumeratioExpressionLine
  }
}
