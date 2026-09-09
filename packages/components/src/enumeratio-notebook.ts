import { css, html, type CSSResultGroup, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { LineId } from '@enumeratio/notatio'
import { EnumeratioExpressions, type NotebookSeed } from './enumeratio-expressions'

// <enumeratio-notebook> — a full notebook: an <enumeratio-expressions> evaluation core (the shared-scope stack of
// lines) plus CHROME. The base owns everything about parsing/binding/lowering/evaluating and rendering the lines;
// this subclass adds the surrounding affordances a bare embed doesn't want:
//   • a bordered frame + a footer toolbar (add-cell menu, undo/redo, ticker, reshuffle, virtual keyboard)
//   • localStorage persistence (attribute `storage-key`)
//   • structural undo/redo history (a linear stack of {value, seed} snapshots, one per settled change)
//   • the ticker loop that fires every action line on an interval
// It plugs into the base's hooks: `seedFromStorage`, `persist`, `onSettled`, `onSettledDebounced`, `renderChrome`.
@customElement('enumeratio-notebook')
export class EnumeratioNotebook extends EnumeratioExpressions {
  @property({ type: String, attribute: 'storage-key' }) storageKey = ''

  // ── persistence (base hooks) ─────────────────────────────────────────────────────────────────────────────────
  protected seedFromStorage(): NotebookSeed | null {
    if (!this.storageKey) return null
    try {
      const raw = localStorage.getItem(this.storageKey)
      return raw ? (JSON.parse(raw) as NotebookSeed) : null
    } catch {
      return null // storage unavailable/corrupt — fall through to the value attribute
    }
  }

  protected persist(): void {
    if (!this.storageKey) return
    try { localStorage.setItem(this.storageKey, this.value) } catch { /* storage unavailable — in-memory only */ }
  }

  // ── undo / redo ──────────────────────────────────────────────────────────────────────────────────────────────
  /** A linear history of serialized {value, seed} snapshots, one per settled change (text-edit burst, add/remove/
   *  reorder, reshuffle, triggered action). MathLive keeps its own per-field text undo; this is the STRUCTURAL
   *  history. `restoring` guards the recompute an undo triggers from recording itself. */
  private history: string[] = []
  private histPos = -1
  private restoring = false
  @state() private canUndo = false
  @state() private canRedo = false

  /** Capture the current {value, seed} unless it duplicates the current top, or we're mid-restore / coalescing a
   *  ticker run. Truncates any redo tail. Called from the base's `onSettled` hook. */
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
    await this.restore(this.history[this.histPos])
  }

  async redo(): Promise<void> {
    if (this.histPos >= this.history.length - 1) return
    this.histPos++
    await this.restore(this.history[this.histPos])
  }

  private async restore(snap: string): Promise<void> {
    this.restoring = true
    try { await this.restoreValue(snap) } finally { this.restoring = false }
    this.canUndo = this.histPos > 0
    this.canRedo = this.histPos < this.history.length - 1
  }

  // ── base settle hooks ────────────────────────────────────────────────────────────────────────────────────────
  protected onSettled(): void {
    if (this.hasActions === false && this.tickerOn) this.stopTicker() // last action removed while ticking
    this.record()
  }

  /** Comment typing bursts don't recompute (which is what normally settles), so debounce their own capture — a
   *  burst collapses to one undo step. */
  private commentRecordTimer: ReturnType<typeof setTimeout> | null = null
  protected onSettledDebounced(): void {
    if (this.commentRecordTimer) clearTimeout(this.commentRecordTimer)
    this.commentRecordTimer = setTimeout(() => { this.commentRecordTimer = null; this.record() }, 500)
  }

  // ── ticker: run every action line each tick; the whole run is ONE undo step ──────────────────────────────────
  @state() private tickerOn = false
  private tickerTimer: ReturnType<typeof setInterval> | null = null
  private ticking = false

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
  private async tick(): Promise<void> {
    if (this.ticking) return // a slow evaluate must not overlap the next interval
    this.ticking = true
    try { await this.runActions() }
    finally { this.ticking = false }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    if (this.tickerTimer) { clearInterval(this.tickerTimer); this.tickerTimer = null }
    if (this.commentRecordTimer) { clearTimeout(this.commentRecordTimer); this.commentRecordTimer = null }
  }

  // ── active-cell controls (virtual keyboard + add menu) — never steal the field's focus ───────────────────────
  @state() private vkOn = false
  /** The footer `+` cell-type dropdown (math / comment). */
  @state() private addMenuOpen = false

  /** MathLive's on-screen keyboard is a global singleton; with policy 'manual' we drive it. It types into the
   *  focused mathfield, and the toggle's mousedown is prevented, so focus stays on the active cell. */
  private toggleVirtualKeyboard(): void {
    const vk = (globalThis as { mathVirtualKeyboard?: { visible: boolean; show(): void; hide(): void } }).mathVirtualKeyboard
    if (!vk) return
    if (vk.visible) vk.hide()
    else vk.show()
    this.vkOn = vk.visible
  }

  /** Footer `+` dropdown: append a blank cell of the chosen kind and focus it. */
  private addCell(kind: 'math' | 'comment'): void {
    this.addMenuOpen = false
    const id: LineId = this.addLine('', undefined, kind === 'comment' ? 'comment' : undefined)
    this.focusLine(id)
  }

  // ── chrome (base hook) ───────────────────────────────────────────────────────────────────────────────────────
  protected renderChrome(): TemplateResult {
    return html`
      <div class="toolbar">
        <div class="tools-left">
          <div class="addwrap">
            <button class="tool ${this.addMenuOpen ? 'on' : ''}" @click=${() => (this.addMenuOpen = !this.addMenuOpen)}
                    title="Add cell" aria-label="Add cell">+</button>
            ${this.addMenuOpen
              ? html`
                  <div class="add-backdrop" @click=${() => (this.addMenuOpen = false)}></div>
                  <div class="addmenu">
                    <button @click=${() => this.addCell('math')}>Math</button>
                    <button @click=${() => this.addCell('comment')}>Comment</button>
                  </div>`
              : ''}
          </div>
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
        </div>
      </div>
    `
  }

  // The base gives a light, frameless stack of lines; the notebook wraps it in a bordered frame + toolbar.
  static styles: CSSResultGroup = [
    EnumeratioExpressions.styles,
    css`
      :host {
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
      /* The + cell-type dropdown, opening UPWARD from the footer over a transparent close-on-click backdrop. */
      .addwrap { position: relative; }
      .add-backdrop { position: fixed; inset: 0; z-index: 39; }
      .addmenu {
        position: absolute;
        bottom: calc(100% + 0.3rem);
        left: 0;
        z-index: 40;
        display: flex;
        flex-direction: column;
        min-width: 7rem;
        padding: 0.25rem;
        border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
        border-radius: 6px;
        background: var(--enumeratio-surface, var(--p-content-background, canvas));
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
      }
      .addmenu button {
        font: inherit;
        text-align: left;
        padding: 0.35rem 0.6rem;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .addmenu button:hover {
        background: color-mix(in srgb, var(--enumeratio-accent, #d97706) 12%, transparent);
      }
    `,
  ]
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

export { EnumeratioExpressions } from './enumeratio-expressions'
export type { NotebookSeed, LineMode, LineKind, ScrubBounds } from './enumeratio-expressions'

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-notebook': EnumeratioNotebook
    'enumeratio-expression-set': EnumeratioExpressionSet
  }
}
