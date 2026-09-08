import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { Completer } from './enumeratio-math-input'
import './enumeratio-math-input'

// <enumeratio-expression-line> — one row of a notebook <enumeratio-notebook>: a gutter (drag handle + type
// badge), a math-input box, a result column (value or error), and a gear-toggled details panel (engine + SQL). It
// is purely PRESENTATIONAL — it holds no LineGraph/Scope/evaluation state of its own; the owning set feeds it
// `state` and reacts to the events it re-emits (`line-input`/`line-commit`/`line-move`/`line-remove`) plus drag
// reordering (`line-reorder`, {sourceId, targetId: this.lineId}).
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

@customElement('enumeratio-expression-line')
export class EnumeratioExpressionLine extends LitElement {
  @property({ type: String, attribute: 'line-id' }) lineId = ''
  @property({ type: String }) latex = ''
  @property({ attribute: false }) completer: Completer | null = null
  @property({ attribute: false }) state: LineState = {}

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

  render(): TemplateResult {
    const s = this.state
    // Stripped to the essentials for now — just the input and its result. The gutter (drag handle + type badge),
    // the details gear, and the remove button are omitted; a notebook-level affordance can reintroduce them later.
    return html`
      <div class="line" @keydown=${this.onKeydownCapture}>
        <enumeratio-math-input
          .latex=${this.latex}
          .completer=${this.completer}
          @enumeratio-input=${this.onInput}
          @enumeratio-commit=${this.onCommit}
          @enumeratio-move=${this.onMove}
        ></enumeratio-math-input>
        <div class="result">
          ${s.busy
            ? html`<span class="hint">…</span>`
            : s.error
              ? html`<span class="err" title=${s.error}>⚠ ${s.error}</span>`
              : s.value != null
                ? html`<span class="eq">=</span><span class="val">${s.value}</span>`
                : html`<span class="hint">—</span>`}
        </div>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .line {
      /* A reserved right gutter (padding-right) holds the floating result; the field fills the rest, so its width
         is constant regardless of how wide the result text is. */
      position: relative;
      display: flex;
      align-items: center;
      padding: 0.3rem 0.4rem;
      padding-right: 9rem;
      border-bottom: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
    }
    /* The field fills the row (minus the result gutter), so every input box is the same width. */
    enumeratio-math-input {
      flex: 1 1 auto;
      min-width: 0;
    }
    .result {
      /* Floats in the reserved right gutter, OUTSIDE the field's border — out of the flex flow, so it never
         affects the field width. A fixed-width column: the equals sign pinned left, the value right-aligned. */
      position: absolute;
      right: 0.5rem;
      top: 0;
      bottom: 0;
      width: 8rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
      overflow: hidden;
      white-space: nowrap;
    }
    .eq {
      flex: 0 0 auto;
      opacity: 0.5;
    }
    .val {
      flex: 1 1 auto;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      font-weight: 600;
    }
    .err {
      color: var(--p-red-500, #dc2626);
    }
    .hint {
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      opacity: 0.5;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-expression-line': EnumeratioExpressionLine
  }
}
