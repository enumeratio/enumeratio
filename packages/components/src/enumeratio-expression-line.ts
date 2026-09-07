import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { Completer } from './enumeratio-math-input'
import './enumeratio-math-input'

// <enumeratio-expression-line> — one row of a notebook <enumeratio-expression-set>: a gutter (drag handle + type
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

  @state() private detailsOpen = false

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

  private onDragStart = (ev: DragEvent): void => {
    ev.dataTransfer?.setData('text/plain', this.lineId)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
  }

  private onDragOver = (ev: DragEvent): void => {
    ev.preventDefault()
  }

  private onDrop = (ev: DragEvent): void => {
    ev.preventDefault()
    const sourceId = ev.dataTransfer?.getData('text/plain')
    if (sourceId && sourceId !== this.lineId) this.emit('line-reorder', { sourceId, targetId: this.lineId })
  }

  private toggleDetails = (): void => {
    this.detailsOpen = !this.detailsOpen
  }

  render(): TemplateResult {
    const s = this.state
    return html`
      <div
        class="line"
        @dragover=${this.onDragOver}
        @drop=${this.onDrop}
        @keydown=${this.onKeydownCapture}
      >
        <div class="gutter">
          <span class="handle" draggable="true" @dragstart=${this.onDragStart} title="drag to reorder">⋮⋮</span>
          <span class="badge" title=${s.type ?? ''}>${s.type ?? ''}</span>
        </div>
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
                ? html`<span class="val">= ${s.value}</span>`
                : html`<span class="hint">—</span>`}
        </div>
        <button class="gear" title="details" aria-label="details" @click=${this.toggleDetails}>⚙</button>
        ${this.detailsOpen
          ? html`
              <div class="panel">
                <div class="row"><span class="k">engine</span><span class="v">${s.engine ?? '—'}</span></div>
                <div class="row"><span class="k">sql</span><code class="sql">${s.sql ?? '—'}</code></div>
              </div>
            `
          : ''}
        <button class="remove" title="remove line" aria-label="remove line" @click=${() => this.emit('line-remove', { lineId: this.lineId })}>×</button>
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
      align-items: center;
      gap: 0.6rem;
      padding: 0.3rem 0.4rem;
      border-bottom: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
    }
    .gutter {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 6.5rem;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
    }
    .handle {
      cursor: grab;
      opacity: 0.5;
      user-select: none;
    }
    .handle:active {
      cursor: grabbing;
    }
    .badge {
      font-size: 0.8em;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .result {
      flex: 0 0 auto;
      min-width: 5rem;
    }
    .val {
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
    .gear,
    .remove {
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      font: inherit;
      line-height: 1;
      padding: 0.15rem 0.3rem;
    }
    .gear:hover,
    .remove:hover {
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
    }
    .panel {
      position: absolute;
      right: 0.5rem;
      top: 100%;
      z-index: 10;
      background: var(--enumeratio-surface, var(--p-content-background, canvas));
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      font-size: 0.8em;
      min-width: 16rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    .row {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
    }
    .k {
      opacity: 0.6;
      min-width: 3.5rem;
    }
    .sql {
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
