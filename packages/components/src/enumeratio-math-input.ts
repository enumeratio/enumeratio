import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import type { AdapterFactory, MathInputAdapter } from './math-input-adapter'
import { mathliveAdapter } from './mathlive-adapter'

// <enumeratio-math-input> — a LaTeX math box with catalog-aware autocomplete, backed by a swappable
// MathInputAdapter (MathLive by default, see mathlive-adapter.ts). The engine is a Lit element by convention with
// the rest of this package, but it has no @enumeratio/client dependency of its own — it never imports @enumeratio/
// expressions' complete.ts directly. Instead the host injects a `completer` PROPERTY, `(before: string) =>
// {replaceLen, candidates}`, so this component stays decoupled from however completion is actually computed.
//
// Emits: `enumeratio-input` ({latex}) on every edit, `enumeratio-commit` ({latex}) on Enter (when no completion
// popover is open), `enumeratio-move` ({direction: 'up'|'down'}) when the adapter reports the caret moved out of
// the field, and a composed `result` ({value, error}) — the same shape enumeratio-expression uses — so
// <enumeratio-assert> can check `.value` after e.g. `setLatex()`.

export interface CompletionCandidate {
  label: string
  insert: string
  kind: string
  detail?: string
}

export interface Completer {
  (before: string): { replaceLen: number; candidates: CompletionCandidate[] } | null | undefined
}

let nextId = 0

@customElement('enumeratio-math-input')
export class EnumeratioMathInput extends LitElement {
  @property({ type: String, reflect: true }) latex = ''
  @property({ type: String }) placeholder = ''
  @property({ type: Boolean, reflect: true }) readonly = false
  /** Which widget actually renders the box. Defaults to MathLive; swap for a mock in tests or a different engine. */
  @property({ attribute: false }) adapter: AdapterFactory = mathliveAdapter
  /** Host-injected completion source. Null/undefined disables the popover entirely. */
  @property({ attribute: false }) completer: Completer | null = null

  @state() private candidates: CompletionCandidate[] = []
  @state() private activeIndex = -1
  @state() private popoverOpen = false
  @state() private popoverAbove = false
  @state() private popoverX = 0
  @state() private popoverY = 0
  @state() private ready = false

  @query('.mount') private mountEl!: HTMLDivElement

  private readonly instanceId = `math-input-${nextId++}`
  private adapterInstance: MathInputAdapter | null = null
  private unsubs: Array<() => void> = []
  private completionTimer: ReturnType<typeof setTimeout> | null = null
  private lastReplaceLen = 0
  private mounting = false

  /** The current LaTeX value. Same as the `latex` property/attribute — a getter for parity with the other components. */
  get value(): string {
    return this.latex
  }

  focus(): void {
    this.adapterInstance?.focus()
  }

  /** Insert LaTeX at the caret (no replacement) and re-evaluate/re-emit. */
  insert(latex: string): void {
    if (!this.adapterInstance) return
    this.adapterInstance.replaceBeforeCaret(0, latex)
    this.syncFromAdapter(true)
  }

  /** Replace the field's contents outright. */
  setLatex(latex: string): void {
    this.latex = latex
  }

  connectedCallback(): void {
    super.connectedCallback()
    void this.updateComplete.then(() => this.mountAdapter())
  }

  disconnectedCallback(): void {
    this.teardownAdapter()
    if (this.completionTimer) clearTimeout(this.completionTimer)
    super.disconnectedCallback()
  }

  updated(changed: Map<string, unknown>): void {
    if ((changed.has('adapter') || changed.has('readonly')) && !changed.has('latex')) {
      // A new adapter or a readonly flip needs a fresh mount (MathInputAdapter has no live readonly setter).
      void this.remountAdapter()
      return
    }
    if (changed.has('latex') && this.adapterInstance) {
      const current = this.adapterInstance.getLatex()
      if (current !== this.latex) this.adapterInstance.setLatex(this.latex)
    }
  }

  private async mountAdapter(): Promise<void> {
    if (this.mounting || !this.mountEl) return
    this.mounting = true
    try {
      this.mountEl.innerHTML = ''
      const instance = await this.adapter(this.mountEl, { placeholder: this.placeholder, readonly: this.readonly })
      this.adapterInstance = instance
      if (this.latex) instance.setLatex(this.latex)
      this.unsubs.push(instance.on('input', () => this.onAdapterInput()))
      this.unsubs.push(instance.on('enter', () => this.onAdapterEnter()))
      this.unsubs.push(instance.on('move-out', (d) => this.onAdapterMoveOut(d)))
      this.unsubs.push(instance.on('blur', () => this.onAdapterBlur()))
      this.ready = true
      this.emitResult()
    } finally {
      this.mounting = false
    }
  }

  private teardownAdapter(): void {
    for (const u of this.unsubs) u()
    this.unsubs = []
    this.adapterInstance?.destroy()
    this.adapterInstance = null
  }

  private async remountAdapter(): Promise<void> {
    this.teardownAdapter()
    this.closePopover()
    await this.mountAdapter()
  }

  private onAdapterInput(): void {
    this.syncFromAdapter(false)
    this.scheduleCompletion()
  }

  private syncFromAdapter(reopenCompletion: boolean): void {
    if (!this.adapterInstance) return
    this.latex = this.adapterInstance.getLatex()
    this.dispatchEvent(new CustomEvent('enumeratio-input', { detail: { latex: this.latex }, bubbles: true, composed: true }))
    this.emitResult()
    if (reopenCompletion) this.scheduleCompletion()
  }

  private scheduleCompletion(): void {
    if (this.completionTimer) clearTimeout(this.completionTimer)
    if (!this.completer) {
      this.closePopover()
      return
    }
    this.completionTimer = setTimeout(() => this.runCompletion(), 120)
  }

  private runCompletion(): void {
    if (!this.completer || !this.adapterInstance) return
    const before = this.adapterInstance.latexBeforeCaret()
    const res = this.completer(before)
    if (!res || res.candidates.length === 0) {
      this.closePopover()
      return
    }
    this.candidates = res.candidates
    this.lastReplaceLen = res.replaceLen
    this.activeIndex = 0
    this.openPopover()
  }

  private openPopover(): void {
    const rect = this.adapterInstance?.caretRect() ?? null
    const hostRect = this.getBoundingClientRect()
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom
      this.popoverAbove = spaceBelow < 160
      this.popoverX = rect.left - hostRect.left
      this.popoverY = this.popoverAbove ? rect.top - hostRect.top : rect.bottom - hostRect.top
    }
    this.popoverOpen = true
  }

  private closePopover(): void {
    this.popoverOpen = false
    this.candidates = []
    this.activeIndex = -1
  }

  private moveActive(delta: number): void {
    if (this.candidates.length === 0) return
    this.activeIndex = (this.activeIndex + delta + this.candidates.length) % this.candidates.length
  }

  private acceptActive(): void {
    const c = this.candidates[this.activeIndex]
    this.closePopover()
    if (!c || !this.adapterInstance) return
    this.adapterInstance.replaceBeforeCaret(this.lastReplaceLen, c.insert)
    this.syncFromAdapter(false)
  }

  private onAdapterEnter(): void {
    if (this.popoverOpen) return // the capture-phase keydown handler below already consumed this Enter
    this.dispatchEvent(new CustomEvent('enumeratio-commit', { detail: { latex: this.latex }, bubbles: true, composed: true }))
  }

  private onAdapterMoveOut(detail?: { direction?: 'up' | 'down' }): void {
    if (!detail?.direction) return
    this.dispatchEvent(new CustomEvent('enumeratio-move', { detail: { direction: detail.direction }, bubbles: true, composed: true }))
  }

  private onAdapterBlur(): void {
    this.closePopover()
  }

  /** Announce the current value, matching enumeratio-expression's `result` shape so <enumeratio-assert> works unmodified. */
  private emitResult(): void {
    this.dispatchEvent(
      new CustomEvent('result', { detail: { value: this.latex, error: null }, bubbles: true, composed: true }),
    )
  }

  // Capture-phase keydown on `.mount` (an ancestor of the adapter's rendered field) — this runs BEFORE the field's
  // own internal keydown handling, so it can fully preempt arrow/enter/escape while the completion popover is open.
  // When the popover is closed these keys pass straight through untouched.
  private onMountKeydownCapture = (ev: KeyboardEvent): void => {
    if (!this.popoverOpen) return
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault()
        ev.stopPropagation()
        this.moveActive(1)
        break
      case 'ArrowUp':
        ev.preventDefault()
        ev.stopPropagation()
        this.moveActive(-1)
        break
      case 'Enter':
      case 'Tab':
        ev.preventDefault()
        ev.stopPropagation()
        this.acceptActive()
        break
      case 'Escape':
        ev.preventDefault()
        ev.stopPropagation()
        this.closePopover()
        break
    }
  }

  firstUpdated(): void {
    this.mountEl.addEventListener('keydown', this.onMountKeydownCapture, true)
  }

  private renderPopover(): TemplateResult {
    const style = `left:${this.popoverX}px; top:${this.popoverY}px; transform:${this.popoverAbove ? 'translateY(-100%)' : 'none'};`
    return html`
      <ul class="popover" part="popover" style=${style} role="listbox" id="${this.instanceId}-listbox">
        ${this.candidates.map(
          (c, i) => html`
            <li
              id="${this.instanceId}-opt-${i}"
              role="option"
              aria-selected=${i === this.activeIndex}
              class="opt ${i === this.activeIndex ? 'active' : ''}"
              @mousedown=${(ev: Event) => {
                ev.preventDefault() // keep focus (and selection) in the field
                this.activeIndex = i
                this.acceptActive()
              }}
            >
              <span class="kind">${c.kind}</span>
              <span class="label">${c.label}</span>
              ${c.detail ? html`<span class="detail">${c.detail}</span>` : ''}
            </li>
          `,
        )}
      </ul>
    `
  }

  render(): TemplateResult {
    const activeOptId = this.popoverOpen && this.activeIndex >= 0 ? `${this.instanceId}-opt-${this.activeIndex}` : undefined
    return html`
      <div
        class="wrap ${this.readonly ? 'readonly' : ''} ${this.ready ? '' : 'loading'}"
        role="combobox"
        aria-expanded=${this.popoverOpen}
        aria-owns="${this.instanceId}-listbox"
        aria-activedescendant=${activeOptId ?? ''}
      >
        <div class="mount"></div>
        ${this.popoverOpen ? this.renderPopover() : ''}
      </div>
    `
  }

  static styles = css`
    :host {
      display: inline-block;
      position: relative;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .wrap {
      position: relative;
      display: inline-flex;
      min-width: 8rem;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 4px;
      background: var(--p-content-hover-background, transparent);
      padding: 0.2rem 0.4rem;
    }
    .wrap:focus-within {
      border-color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
    }
    .wrap.readonly {
      opacity: 0.7;
      background: var(--enumeratio-muted, var(--p-content-border-color, currentColor) / 8%);
    }
    .wrap.loading {
      opacity: 0.5;
    }
    .mount {
      flex: 1;
      min-width: 6rem;
    }
    .mount math-field {
      width: 100%;
      border: none;
      --caret-color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
    }
    .popover {
      position: absolute;
      z-index: 20;
      margin: 0.15rem 0 0;
      padding: 0.25rem 0;
      min-width: 14rem;
      max-height: 12rem;
      overflow-y: auto;
      list-style: none;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 6px;
      background: var(--enumeratio-surface, var(--p-content-background, canvas));
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      font-size: 0.85em;
    }
    .opt {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.25rem 0.6rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .opt.active {
      background: color-mix(in srgb, var(--enumeratio-accent, var(--p-primary-color, #d97706)) 15%, transparent);
    }
    .kind {
      font-size: 0.75em;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      opacity: 0.7;
      min-width: 3.5rem;
    }
    .label {
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
      font-weight: 600;
    }
    .detail {
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      opacity: 0.75;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-math-input': EnumeratioMathInput
  }
}
