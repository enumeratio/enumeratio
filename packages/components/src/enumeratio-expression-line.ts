import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Completer } from './enumeratio-math-input'
import './enumeratio-math-input'

// <enumeratio-expression-line> — one row of a notebook <enumeratio-notebook>: the math-input field with its value
// shown to the right, and a subtle meta line below carrying the bound TYPE (e.g. `∈ dyck_paths`, `ℕ`) and, when
// present, the full error text. Purely PRESENTATIONAL — the owning set feeds it `state` and reacts to the events
// it re-emits (`line-input`/`line-commit`/`line-move`/`line-remove`).
//
// Errors are DEBOUNCED for display: an error is not shown until the input has settled (~350 ms) and never while a
// line is empty, so a half-typed symbol doesn't flash "unknown symbol …" — but once shown it is shown in FULL,
// below the field, unobtrusively.
export type LineState = {
  /** Rendered type badge text, e.g. "∈ triangular_numbers", "ℕ", "𝔹", "f: (n) ↦" — the set derives this from the
   *  bound statement's Type; empty/undefined while the line hasn't bound to anything yet (blank/declare-only). */
  type?: string
  value?: string
  error?: string
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
    // Optimistically hide any standing error the moment the user types — it re-debounces once the set recomputes.
    this.hideError()
    this.emit('line-input', { lineId: this.lineId, latex: this.latex })
  }

  private onCommit = (): void => {
    this.emit('line-commit', { lineId: this.lineId })
    // Fallback empty-line removal: if the capture-phase Backspace detection below never fires (e.g. an adapter
    // that swallows the keydown before it bubbles), an Enter on an already-empty line at least offers a way out.
    if (this.latex.trim() === '') this.emit('line-remove', { lineId: this.lineId })
  }

  private onMove = (ev: CustomEvent<{ direction: 'up' | 'down' }>): void => {
    this.emit('line-move', { lineId: this.lineId, direction: ev.detail.direction })
  }

  // Native keyboard events are composed — they bubble out through <enumeratio-math-input>'s shadow root to here
  // even though this line never reaches into that shadow DOM itself. Backspace on an empty line removes it.
  private onKeydownCapture = (ev: KeyboardEvent): void => {
    if (ev.key === 'Backspace' && this.latex === '') {
      this.emit('line-remove', { lineId: this.lineId })
    }
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
    return html`
      <div class="line" @keydown=${this.onKeydownCapture}>
        <div class="main">
          <enumeratio-math-input
            .latex=${this.latex}
            .completer=${this.completer}
            @enumeratio-input=${this.onInput}
            @enumeratio-commit=${this.onCommit}
            @enumeratio-move=${this.onMove}
          ></enumeratio-math-input>
          <div class="value">
            ${s.busy
              ? html`<span class="hint">…</span>`
              : hasValue
                ? html`<span class="eq">=</span><span class="val" title=${s.value ?? ''}>${s.value}</span>`
                : ''}
          </div>
        </div>
        ${s.type || errVisible
          ? html`
              <div class="meta">
                ${s.type ? html`<span class="type">${s.type}</span>` : html`<span></span>`}
                ${errVisible ? html`<span class="error">${s.error}</span>` : ''}
              </div>
            `
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
      padding: 0.35rem 0.5rem;
      border-bottom: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
    }
    .main {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    /* The field fills the row; the value sits to its right and may grow (and wrap) so it is fully visible, without
       collapsing the field below a usable width. */
    enumeratio-math-input {
      flex: 1 1 auto;
      min-width: 8rem;
    }
    .value {
      flex: 0 1 auto;
      display: flex;
      align-items: baseline;
      gap: 0.35rem;
      max-width: 45%;
      justify-content: flex-end;
      text-align: right;
    }
    .eq {
      opacity: 0.4;
    }
    .val {
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      font-weight: 600;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    /* Meta line: bound type (left) and, once settled, the full error (right) — both quiet and gray. */
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 0.1rem 0 0 0.1rem;
      font-size: 0.82em;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
    }
    .type {
      opacity: 0.7;
      white-space: nowrap;
    }
    .error {
      flex: 1 1 auto;
      text-align: right;
      color: color-mix(in srgb, var(--p-red-500, #dc2626) 80%, var(--enumeratio-muted, currentColor));
      opacity: 0.85;
      overflow-wrap: anywhere;
    }
    .hint {
      opacity: 0.35;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-expression-line': EnumeratioExpressionLine
  }
}
