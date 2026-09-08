import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Completer } from './enumeratio-math-input'
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
}

const ERROR_SHOW_DELAY_MS = 350

@customElement('enumeratio-expression-line')
export class EnumeratioExpressionLine extends LitElement {
  @property({ type: String, attribute: 'line-id' }) lineId = ''
  @property({ type: String }) latex = ''
  @property({ attribute: false }) completer: Completer | null = null
  @property({ attribute: false }) state: LineState = {}

  /** Gated display of `state.error` — see the debounce note above. */
  @state() private showError = false
  @state() private astOpen = false
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
    return html`
      <div class="line" @keydown=${this.onKeydownCapture} @contextmenu=${this.onContextMenu}>
        <div class="field">
          <enumeratio-math-input
            .latex=${this.latex}
            .completer=${this.completer}
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
      padding: 0.4rem 0.5rem;
      border-bottom: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
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
