import { LitElement, html, css, unsafeCSS, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'
import katex from 'katex'
import katexCss from 'katex/dist/katex.min.css?inline'
import MarkdownIt from 'markdown-it'
import katexPlugin from '@vscode/markdown-it-katex'
import type { Completer } from './enumeratio-math-input'
import type { IdentifierDisplay } from '@enumeratio/notatio'
import './enumeratio-math-input'

/** Render a LaTeX value to KaTeX HTML (never throws — a malformed string shows in KaTeX's error color instead of
 *  breaking the line). Fonts come from the globally-loaded katex.min.css; the layout CSS is folded into the shadow
 *  root's styles below. */
const renderTex = (tex: string): string => katex.renderToString(tex, { throwOnError: false, output: 'html' })

/** Markdown renderer for COMMENT cells: prose + inline/blocked `$…$` LaTeX via KaTeX. `html: false` keeps raw HTML
 *  out (the source is user prose, rendered into the shadow root — no need to let it inject markup). The KaTeX CSS is
 *  the same sheet folded into this element's styles, so the math is styled without any extra load. */
const katexMdPlugin = ((katexPlugin as { default?: unknown }).default ?? katexPlugin) as Parameters<MarkdownIt['use']>[0]
const md = new MarkdownIt({ html: false, linkify: true, breaks: true }).use(katexMdPlugin, { throwOnError: false })
const renderMarkdown = (src: string): string => md.render(src ?? '')

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
  /** When the type refers to a catalog entity (a collection), a link to its enumeratio.dev entry — the type badge
   *  becomes a deep link. */
  typeHref?: string
  value?: string
  /** An EXACT symbolic value as LaTeX (√2, ⅙π², …) — rendered via KaTeX in place of the plain `value`. */
  valueTex?: string
  /** When the value is a located element, a link to the SQL query view that reproduces it (the collection filtered
   *  to its rank) — click the value to verify it in the atlas. */
  valueHref?: string
  error?: string
  /** The parsed AST (MathJSON, pretty JSON) for the opt-in right-click inspector. */
  ast?: string
  engine?: string
  sql?: string
  busy?: boolean
  /** This line is an ACTION (`p → …`): show a ▶ trigger instead of a value. */
  action?: boolean
  /** A collection preview has MORE elements than shown — render a clickable `…` to pull the next batch. */
  more?: boolean
  /** This line is prose (a string body) — render it as a comment, not a math value. Interim: plain text. */
  comment?: string
  /** The cell is HELD (unevaluated by choice) — show a quiet marker instead of a value. */
  held?: boolean
  /** This cell defines a free numeric parameter (`n = 3`) — show a Desmos-style scrubber below it. `value` is the
   *  current setting; `min`/`max`/`step` bound the slider. Dragging live-rewrites the define. */
  scrub?: { value: number; min: number; max: number; step: number }
  /** This line is an ASSERTED input (a reference-page example carrying an expected value): the owner compared the
   *  rendered value to `expect` and set `status`. `pass` shows a quiet ✓; `fail` lights up with expected-vs-got. */
  assert?: { status: 'pass' | 'fail'; expect: string }
}

const ERROR_SHOW_DELAY_MS = 350

@customElement('enumeratio-expression-line')
export class EnumeratioExpressionLine extends LitElement {
  @property({ type: String, attribute: 'line-id' }) lineId = ''
  @property({ type: String }) latex = ''
  @property({ type: Number }) index = 0
  @property({ attribute: false }) completer: Completer | null = null
  @property({ attribute: false }) classify: ((run: string) => IdentifierDisplay | null) | null = null
  @property({ type: Boolean }) active = false
  @property({ attribute: false }) state: LineState = {}
  /** This cell's evaluation mode (from the owning notebook), so the cell menu can check the active mode. */
  @property({ type: String }) mode: '' | 'N' | 'hold' = ''
  /** Cell TYPE. `math` (default) uses the math-input + value; `comment` is prose (markdown + inline `$…$`). */
  @property({ type: String }) kind: 'math' | 'comment' = 'math'
  /** Whether Delete is allowed — false for the notebook's last remaining line (nothing to fall back to). */
  @property({ type: Boolean }) canDelete = true
  /** READ-ONLY row: non-editable math-input, no edit chrome (⋯/✕), no drag handle, no cell menu. The value/result
   *  and its ✓/✗ assert still render. Set by a read-only `<enumeratio-expressions>` for docs/reference examples. */
  @property({ type: Boolean }) readonly = false

  /** A comment cell is either being edited (raw markdown in a textarea) or rendered (KaTeX/markdown HTML). Empty
   *  comments always show the editor so there's somewhere to type. */
  @state() private editing = false

  /** Gated display of `state.error` — see the debounce note above. */
  @state() private showError = false
  @state() private astOpen = false
  /** The cell context/config menu — its viewport-fixed position when open, null when closed. Opened by right-click
   *  (at the pointer) or the gutter config icon (the touch affordance; anchored beside the button). */
  @state() private menuPos: { x: number; y: number } | null = null
  /** Drag state: `dragging` = this row is the one being moved (dim it); `dropEdge` = which edge a drop bar shows on. */
  @state() private dragging = false
  @state() private dropEdge: 'above' | 'below' | null = null
  private errorTimer: ReturnType<typeof setTimeout> | null = null
  private lastError: string | undefined = undefined

  focus(): void {
    if (this.kind === 'comment') { this.beginEdit(); return }
    this.mathInput?.focus()
  }

  private get mathInput() {
    return this.renderRoot.querySelector('enumeratio-math-input') as (HTMLElement & { focus(): void }) | null
  }
  private get commentEditor() {
    return this.renderRoot.querySelector('textarea.comment-edit') as HTMLTextAreaElement | null
  }

  // ── comment (prose) cell ─────────────────────────────────────────────────────────────────────────────────────
  private autosize(ta: HTMLTextAreaElement): void {
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }
  private onCommentInput = (ev: Event): void => {
    const ta = ev.target as HTMLTextAreaElement
    this.latex = ta.value
    this.autosize(ta)
    this.emit('line-input', { lineId: this.lineId, latex: this.latex })
  }
  private onCommentBlur = (): void => { this.editing = false }
  /** Enter the editor: show the textarea, select the cell, then focus + size it once it's in the DOM. */
  private beginEdit = (): void => {
    this.editing = true
    this.emit('line-focus', { lineId: this.lineId })
    void this.updateComplete.then(() => { const ta = this.commentEditor; if (ta) { ta.focus(); this.autosize(ta) } })
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
    if (this.readonly) return
    if (ev.key === 'Backspace' && this.latex === '') {
      this.emit('line-remove', { lineId: this.lineId })
    }
  }

  // The cell menu — the full set of per-cell actions (modes, AST, duplicate/clear/delete). Reached two ways: a
  // right-click anywhere on the row (desktop), or the gutter config icon (the touch affordance). The owning
  // notebook performs the actions it emits (`line-action`); AST/delete stay local (`astOpen` / `line-remove`).
  private openMenuAt(px: number, py: number): void {
    this.emit('line-focus', { lineId: this.lineId }) // right-clicking a non-active cell selects it first
    const MW = 190, MH = 260 // approx menu box — clamp so it never opens off-screen
    const x = Math.max(8, Math.min(px, window.innerWidth - MW - 8))
    const y = Math.max(8, Math.min(py, window.innerHeight - MH - 8))
    this.menuPos = { x, y }
  }
  private closeMenu = (): void => { this.menuPos = null }
  private onContextMenu = (ev: MouseEvent): void => {
    if (this.readonly) return // no cell menu in a read-only row — let the browser's own context menu through
    ev.preventDefault()
    this.openMenuAt(ev.clientX, ev.clientY)
  }
  private onConfigClick = (ev: MouseEvent): void => {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
    this.openMenuAt(r.right + 4, r.top)
  }
  private menuAct(action: 'N' | 'hold' | 'duplicate' | 'clear'): void {
    this.closeMenu()
    this.emit('line-action', { lineId: this.lineId, action })
  }
  private onDelete = (): void => {
    this.closeMenu()
    if (this.canDelete) this.emit('line-remove', { lineId: this.lineId })
  }
  private toggleAst(): void {
    this.closeMenu()
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

  // ── value scrubber ───────────────────────────────────────────────────────────────────────────────────────────
  private onScrubInput = (ev: Event): void => {
    const v = Number((ev.target as HTMLInputElement).value)
    this.emit('line-scrub', { lineId: this.lineId, value: v })
  }
  private onScrubBound = (): void => {
    const root = this.renderRoot
    const min = Number((root.querySelector('.scrubber .bound.min') as HTMLInputElement)?.value)
    const max = Number((root.querySelector('.scrubber .bound.max') as HTMLInputElement)?.value)
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      this.emit('line-scrub-bounds', { lineId: this.lineId, min, max })
    }
  }

  updated(changed: Map<string, unknown>): void {
    if (this.kind === 'comment' && this.editing) { const ta = this.commentEditor; if (ta) this.autosize(ta) }
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
    const isComment = this.kind === 'comment'
    const errVisible = this.showError && !!s.error && this.latex.trim() !== ''
    const hasValue = !errVisible && !s.busy && (s.value != null || s.valueTex != null)
    // A comment shows its editor while it's being edited, or whenever it's empty (so there's somewhere to type) —
    // never in a read-only row, where prose always shows rendered.
    const showEditor = !this.readonly && (this.editing || this.latex.trim() === '')
    // The meta slot shows the error (when there is one) in place of the type — the natural home for a parse/bind
    // failure, right where the type would otherwise sit.
    const lineClass = `line${this.active ? ' active' : ''}${this.dragging ? ' dragging' : ''}${this.dropEdge ? ` drop-${this.dropEdge}` : ''}${isComment ? ' comment-cell' : ''}`
    return html`
      <div class=${lineClass} @keydown=${this.onKeydownCapture} @contextmenu=${this.onContextMenu}
           @focusin=${() => this.emit('line-focus', { lineId: this.lineId })}
           @dragover=${this.onDragOver} @dragleave=${this.onDragLeave} @drop=${this.onDrop}>
        <div class="gutter">
          <span class="rownum ${isComment ? 'dragonly' : ''}" draggable=${this.readonly ? 'false' : 'true'}
                @dragstart=${this.onDragStart} @dragend=${this.onDragEnd}
                title=${this.readonly ? '' : 'drag to reorder'}>${isComment ? '' : this.index}</span>
          ${!isComment && s.action && !this.readonly
            ? html`<button class="rowbtn" @mousedown=${(e: MouseEvent) => e.preventDefault()}
                      @click=${() => this.emit('line-run', { lineId: this.lineId })}
                      title="run this action" aria-label="run this action">→</button>`
            : ''}
          ${this.readonly
            ? ''
            : html`<div class="chrome">
            <button class="rowbtn cfg" @mousedown=${(e: MouseEvent) => e.preventDefault()}
                    @click=${this.onConfigClick} title="cell options" aria-label="cell options">⋯</button>
            <button class="rowbtn del" @mousedown=${(e: MouseEvent) => e.preventDefault()}
                    @click=${this.onDelete} ?disabled=${!this.canDelete}
                    title="delete cell" aria-label="delete cell">✕</button>
          </div>`}
        </div>
        <div class="body">
          ${isComment
            ? html`<div class="comment-body">
                ${showEditor
                  ? html`<textarea class="comment-edit" .value=${this.latex}
                            placeholder="comment — markdown & $LaTeX$"
                            @input=${this.onCommentInput} @blur=${this.onCommentBlur}
                            @focus=${() => this.emit('line-focus', { lineId: this.lineId })}></textarea>`
                  : html`<div class="comment-rendered" @click=${this.beginEdit}
                            title="click to edit">${unsafeHTML(renderMarkdown(this.latex))}</div>`}
              </div>`
            : html`
              <div class="field">
                <enumeratio-math-input
                  .latex=${this.latex}
                  .completer=${this.readonly ? null : this.completer}
                  .classify=${this.classify}
                  ?readonly=${this.readonly}
                  @enumeratio-input=${this.onInput}
                  @enumeratio-commit=${this.onCommit}
                  @enumeratio-move=${this.onMove}
                ></enumeratio-math-input>
                ${!errVisible && s.type && s.comment == null
                  ? s.typeHref
                    ? html`<a class="type link" href=${s.typeHref} target="_blank" rel="noopener"
                            title="open in the atlas">${s.type}</a>`
                    : html`<span class="type">${s.type}</span>`
                  : ''}
              </div>
              <div class="value">
                ${s.comment != null ? html`<span class="comment">${s.comment}</span>`
                  : s.held ? html`<span class="held">held</span>`
                  : s.busy ? html`<span class="hint">…</span>`
                  : hasValue ? html`<span class="eq">=</span> ${s.valueTex != null
                      ? html`<span class="tex">${unsafeHTML(renderTex(s.valueTex))}</span>`
                      : s.valueHref
                      ? html`<a class="vlink" href=${s.valueHref} target="_blank" rel="noopener" title="open in the query view">${s.value}</a>`
                      : s.value}${s.more
                      ? html` <button class="more" @click=${() => this.emit('line-expand', { lineId: this.lineId })}
                                title="pull more elements">…</button>`
                      : ''}`
                  : ''}
                ${s.assert
                  ? s.assert.status === 'pass'
                    ? html`<span class="assert pass" title="matches the expected value">✓</span>`
                    : html`<span class="assert fail" title="does not match the expected value">✗ <span class="exp">expected ${s.assert.expect}</span></span>`
                  : ''}
              </div>
              ${errVisible ? html`<div class="error">${s.error}</div>` : ''}
              ${s.scrub
                ? html`<div class="scrubber" @mousedown=${(e: MouseEvent) => e.stopPropagation()}>
                    <input class="bound min" type="number" .value=${String(s.scrub.min)}
                           @change=${this.onScrubBound} title="lower bound" aria-label="lower bound">
                    <input class="range" type="range"
                           min=${s.scrub.min} max=${s.scrub.max} step=${s.scrub.step} .value=${String(s.scrub.value)}
                           @input=${this.onScrubInput} aria-label="scrub value">
                    <input class="bound max" type="number" .value=${String(s.scrub.max)}
                           @change=${this.onScrubBound} title="upper bound" aria-label="upper bound">
                  </div>`
                : ''}`}
        </div>
        ${this.astOpen && s.ast
          ? html`<div class="ast" @click=${() => (this.astOpen = false)} title="click to close — this is the parsed FullForm"><pre>${s.ast}</pre></div>`
          : ''}
        ${this.menuPos
          ? html`
              <div class="menu-backdrop" @mousedown=${(e: MouseEvent) => e.preventDefault()}
                   @click=${this.closeMenu}
                   @contextmenu=${(e: MouseEvent) => { e.preventDefault(); this.closeMenu() }}></div>
              <div class="cellmenu" style="left:${this.menuPos.x}px;top:${this.menuPos.y}px"
                   @mousedown=${(e: MouseEvent) => e.preventDefault()}>
                ${isComment
                  ? ''
                  : html`
                    <button @click=${() => this.menuAct('N')}>${this.mode === 'N' ? '✓ ' : ''}Numeric (N)</button>
                    <button @click=${() => this.menuAct('hold')}>${this.mode === 'hold' ? '✓ ' : ''}Hold (don't evaluate)</button>
                    ${s.ast
                      ? html`<hr><button @click=${() => this.toggleAst()}>${this.astOpen ? 'Hide AST' : 'Show AST'}</button>`
                      : ''}
                    <hr>`}
                <button @click=${() => this.menuAct('duplicate')}>Duplicate</button>
                <button @click=${() => this.menuAct('clear')}>Clear</button>
                <button @click=${this.onDelete} ?disabled=${!this.canDelete}>Delete</button>
              </div>`
          : ''}
      </div>
    `
  }

  // KaTeX's layout CSS is folded into the shadow root (global CSS can't reach it); its fonts come from the
  // document-level katex.min.css the docs already load. Our own rules follow, so they win on any overlap.
  static styles = [unsafeCSS(katexCss), css`
    :host {
      display: block;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .value .tex { font-weight: 400; }
    .assert { margin-left: 0.5rem; font-size: 0.9em; }
    .assert.pass { color: var(--p-green-500, #16a34a); }
    .assert.fail { color: var(--p-red-500, #dc2626); }
    .assert .exp { color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor)); font-size: 0.9em; }
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
      /* Cancel the line's vertical padding so the gutter background runs the FULL height of the row, edge to edge. */
      margin-block: -0.4rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.3rem;
      min-width: 2rem;
      padding: 0.5rem 0.35rem 0.3rem;
      background: color-mix(in srgb, var(--enumeratio-muted, currentColor) 6%, transparent);
      border-right: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 8%);
      transition: background 0.12s, box-shadow 0.12s;
    }
    .line:hover .gutter {
      background: color-mix(in srgb, var(--enumeratio-accent, var(--p-primary-color, #d97706)) 12%, transparent);
    }
    /* The SELECTED (last-focused) cell: color its gutter + a solid accent bar down its left edge. */
    .line.active .gutter {
      background: color-mix(in srgb, var(--enumeratio-accent, var(--p-primary-color, #d97706)) 18%, transparent);
      box-shadow: inset 3px 0 0 0 var(--enumeratio-accent, var(--p-primary-color, #d97706));
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
    /* A comment cell shows NO number, but the handle stays (draggable, sized) — a faint grab hint on hover only. */
    .rownum.dragonly { min-width: 0.7em; min-height: 1em; }
    .rownum.dragonly::before { content: '⠿'; opacity: 0; transition: opacity 0.12s; }
    .line:hover .rownum.dragonly::before { opacity: 0.4; }
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
    .rowbtn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 14%, transparent);
    }
    .rowbtn:disabled { opacity: 0.3; cursor: default; }
    /* Per-cell config (⋯) + delete (✕) icons, pinned to the bottom of the gutter. Muted and quiet by default so
       the gutter stays calm; they light up on hover/active. Always in the DOM (never hover-gated away) so they
       stay reachable on touch — the config icon IS the touch route to the cell menu (no right-click there). */
    .chrome {
      margin-top: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }
    .rowbtn.cfg,
    .rowbtn.del {
      width: 1.4rem;
      height: 1.4rem;
      font-size: 0.85rem;
      border-color: color-mix(in srgb, var(--enumeratio-muted, currentColor) 45%, transparent);
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      opacity: 0.4;
      transition: opacity 0.12s;
    }
    .line:hover .rowbtn.cfg,
    .line:hover .rowbtn.del,
    .line.active .rowbtn.cfg,
    .line.active .rowbtn.del { opacity: 0.85; }
    .rowbtn.cfg:hover:not(:disabled),
    .rowbtn.del:hover:not(:disabled) {
      opacity: 1;
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      border-color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 14%, transparent);
    }
    /* The cell menu (right-click / config icon). A viewport-fixed popup over a transparent full-screen backdrop
       that closes it on any outside click. */
    .menu-backdrop { position: fixed; inset: 0; z-index: 49; }
    .cellmenu {
      position: fixed;
      z-index: 50;
      display: flex;
      flex-direction: column;
      min-width: 10rem;
      padding: 0.25rem;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 6px;
      background: var(--enumeratio-surface, var(--p-content-background, canvas));
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      font-size: 0.9rem;
    }
    .cellmenu hr {
      margin: 0.25rem 0.3rem;
      border: none;
      border-top: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor) / 12%);
    }
    .cellmenu button {
      font: inherit;
      text-align: left;
      padding: 0.35rem 0.6rem;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      white-space: nowrap;
    }
    .cellmenu button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 12%, transparent);
    }
    .cellmenu button:disabled { opacity: 0.35; cursor: default; }
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
    /* A type that links to its atlas entry is clickable (the plain chip is pointer-transparent). */
    .type.link {
      pointer-events: auto;
      cursor: pointer;
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      text-decoration: none;
    }
    .type.link:hover { text-decoration: underline; }
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
    /* A comment line's prose — muted, left-aligned, not a math value. */
    .comment {
      display: block;
      text-align: left;
      font-style: italic;
      font-weight: 400;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
    }
    /* ── first-class COMMENT cell (kind='comment') — prose, edited as markdown, rendered with KaTeX ── */
    .comment-body { width: 100%; }
    .comment-edit {
      display: block;
      width: 100%;
      box-sizing: border-box;
      min-height: 1.6rem;
      resize: none;
      overflow: hidden;
      padding: 0.15rem 0.25rem;
      border: none;
      outline: none;
      background: transparent;
      color: inherit;
      font: inherit;
      line-height: 1.5;
    }
    .comment-edit::placeholder {
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      opacity: 0.5;
    }
    /* Rendered prose reads like body text, not code — a proportional face, normal weight, left-aligned. */
    .comment-rendered {
      font-family: var(--enumeratio-prose-font, system-ui, -apple-system, "Segoe UI", sans-serif);
      line-height: 1.55;
      cursor: text;
      padding: 0.15rem 0.25rem;
      overflow-wrap: anywhere;
    }
    .comment-rendered > :first-child { margin-top: 0; }
    .comment-rendered > :last-child { margin-bottom: 0; }
    .comment-rendered p { margin: 0.4em 0; }
    .comment-rendered h1, .comment-rendered h2, .comment-rendered h3,
    .comment-rendered h4, .comment-rendered h5, .comment-rendered h6 {
      margin: 0.6em 0 0.3em;
      line-height: 1.25;
    }
    .comment-rendered ul, .comment-rendered ol { margin: 0.4em 0; padding-inline-start: 1.4em; }
    .comment-rendered code {
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 0.9em;
      padding: 0.05em 0.3em;
      border-radius: 4px;
      background: color-mix(in srgb, var(--enumeratio-muted, currentColor) 12%, transparent);
    }
    .comment-rendered pre {
      overflow-x: auto;
      padding: 0.5em 0.7em;
      border-radius: 6px;
      background: color-mix(in srgb, var(--enumeratio-muted, currentColor) 10%, transparent);
    }
    .comment-rendered pre code { background: none; padding: 0; }
    .comment-rendered a {
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      text-decoration: none;
    }
    .comment-rendered a:hover { text-decoration: underline; }
    .comment-rendered blockquote {
      margin: 0.4em 0;
      padding-inline-start: 0.8em;
      border-inline-start: 3px solid color-mix(in srgb, var(--enumeratio-muted, currentColor) 30%, transparent);
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
    }
    /* An empty rendered comment still needs a click target to re-enter — but empty comments show the editor, so
       this only guards a whitespace-only render. */
    .comment-rendered:empty::before { content: 'comment'; opacity: 0.4; }
    /* A located element's value links to the query view that reproduces it. */
    .vlink {
      color: inherit;
      text-decoration: none;
      text-decoration: underline dotted color-mix(in srgb, currentColor 40%, transparent);
      text-underline-offset: 3px;
      cursor: pointer;
    }
    .vlink:hover { text-decoration: underline; }
    /* Clickable "pull more" for a collection preview — a quiet inline affordance. */
    .more {
      font: inherit;
      cursor: pointer;
      padding: 0 0.35rem;
      border: none;
      border-radius: 4px;
      background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 12%, transparent);
      color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
    }
    .more:hover { background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 24%, transparent); }
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
    /* Desmos-style value scrubber: editable min · slider · editable max, below a free numeric define. */
    .scrubber {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.35rem;
    }
    .scrubber .range {
      flex: 1 1 auto;
      min-width: 0;
      accent-color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      cursor: ew-resize;
    }
    .scrubber .bound {
      flex: 0 0 auto;
      width: 3.4rem;
      font: inherit;
      font-size: 0.8em;
      text-align: center;
      padding: 0.1rem 0.2rem;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 4px;
      background: transparent;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
    }
    .scrubber .bound::-webkit-inner-spin-button { opacity: 0.4; }
    /* A HELD cell (unevaluated by choice) — a quiet pill in the value slot. */
    .held {
      font-weight: 400;
      font-size: 0.85em;
      opacity: 0.6;
      padding: 0 0.4rem;
      border: 1px dashed var(--enumeratio-muted, currentColor);
      border-radius: 999px;
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
  `]
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-expression-line': EnumeratioExpressionLine
  }
}
