import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { carriers, evaluateExpression } from '@enumeratio/client'
import { num } from './num'

// <enumeratio-expression collection="…"> — a client-backed web component that evaluates an expression in a
// collection's carrier algebra, reusing @enumeratio/client's evaluateExpression (the same core the explorer's richer
// AlgebraEvaluator input uses). Give it a `collection` (its carrier is resolved from the catalog) OR a `carrier`
// directly, and an `expr` (attribute or the input box); some carriers take a `modulus` (n for ℤ/nℤ, the ground n
// for finset, M for multicomplex), and multicomplex additionally takes a `level` (its tower order). Needs a Db
// provided once via the client's provideDb() — the docs set that up globally.
// On each evaluation it emits a composed `result` CustomEvent ({ value, error }) and exposes a `.value` getter, so a
// generic checker like <enumeratio-assert> can read what it evaluated to. For now single-collection; generalize later.
@customElement('enumeratio-expression')
export class EnumeratioExpression extends LitElement {
  @property({ type: String }) collection = ''
  @property({ type: String }) carrier = ''
  @property({ type: String }) expr = ''
  @property({ type: Number }) modulus = 0
  @property({ type: Number }) level = 0

  @state() private resolvedCarrier = ''
  @state() private result: string | null = null
  @state() private error: string | null = null
  @state() private ready = false

  // The `expr` the element was given up front (its default). Editing the box makes it `dirty`, and reset() restores it.
  private defaultExpr: string | null = null

  /** The last evaluated (rendered) value, or null while empty/pending. Pairs with the `result` event. */
  get value(): string | null {
    return this.result
  }

  /** True once the box has been edited away from the default `expr` — a wrapping checker should stop asserting. */
  get dirty(): boolean {
    return this.defaultExpr != null && this.expr.trim() !== this.defaultExpr.trim()
  }

  /** Restore the default `expr` (the one given up front) and re-evaluate. */
  reset(): void {
    if (this.defaultExpr != null) {
      this.expr = this.defaultExpr
      void this.evaluate()
    }
  }

  connectedCallback(): void {
    super.connectedCallback()
    this.defaultExpr = this.expr
    void this.resolve()
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('collection') || changed.has('carrier')) void this.resolve()
    else if (changed.has('expr') || changed.has('modulus') || changed.has('level')) void this.evaluate()
  }

  private async resolve(): Promise<void> {
    try {
      // `carrier` wins if given directly (carrier-first, e.g. the examples grid); else resolve it from the collection.
      this.resolvedCarrier = this.carrier || (this.collection ? ((await carriers())[this.collection] ?? '') : '')
      this.ready = true
      await this.evaluate()
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      this.ready = true
      this.emitResult()
    }
  }

  private async evaluate(): Promise<void> {
    const e = this.expr.trim()
    if (!this.resolvedCarrier || !e) {
      this.result = null
      this.error = null
      this.emitResult()
      return
    }
    // multicomplex needs both grounds; every other carrier here takes at most the single one
    const ground = this.level
      ? { modulus: num(this.modulus), level: num(this.level) }
      : this.modulus ? num(this.modulus) : undefined
    const r = await evaluateExpression(this.resolvedCarrier, e, ground)
    this.result = r.result
    this.error = r.error ?? null
    this.emitResult()
  }

  /** Announce the current value/error (and whether the box has been edited off its default) so a wrapping checker can
   *  read it. Composed → crosses the shadow boundary. `resettable` lets the checker offer a reset affordance. */
  private emitResult(): void {
    this.dispatchEvent(
      new CustomEvent('result', {
        detail: { value: this.result, error: this.error, dirty: this.dirty, resettable: true },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private onInput(ev: Event): void {
    this.expr = (ev.target as HTMLInputElement).value
    void this.evaluate()
  }

  render(): TemplateResult {
    const label = this.resolvedCarrier ? `evaluate in ${this.resolvedCarrier}…` : this.ready ? 'unknown collection' : 'loading…'
    return html`
      <div class="ex">
        <input class="in" .value=${this.expr} @input=${this.onInput} placeholder=${label} spellcheck="false" autocomplete="off" />
        <span class="out">
          ${this.error
            ? html`<span class="err" title=${this.error}>⚠ ${this.error}</span>`
            : this.result != null
              ? html`<span class="res">= ${this.result}</span>`
              : html`<span class="hint">—</span>`}
        </span>
      </div>
    `
  }

  static styles = css`
    :host {
      display: inline-block;
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .ex {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .in {
      padding: 0.3rem 0.5rem;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 4px;
      background: var(--p-content-hover-background, transparent);
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
      font: inherit;
      min-width: 12rem;
    }
    .in:focus {
      outline: none;
      border-color: var(--enumeratio-accent, var(--p-primary-color, #d97706));
    }
    .res {
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
    'enumeratio-expression': EnumeratioExpression
  }
}
