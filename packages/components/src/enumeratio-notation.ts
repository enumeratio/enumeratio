import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { construct } from '@enumeratio/client'
import { num } from './num'

// <enumeratio-notation collection="…" n="…" rank="…"> — a client-backed web component that resolves ONE element's
// rendered notation from the db, via the client: construct(collection, {size:n}).window(rank, 1, {medium}) → the
// element's `element` string. `medium` picks the textual form (unicode | ascii | latex; latex shows raw markup for
// now — katex-in-shadow-DOM styling is a follow-up, see render-assets.md). First cut: address by (collection, n,
// rank); a fuller resource address (fiber / value) comes with the type-model spike.
@customElement('enumeratio-notation')
export class EnumeratioNotation extends LitElement {
  @property({ type: String }) collection = ''
  @property({ type: Number }) n = 0
  @property({ type: Number }) rank = 0
  @property({ type: String }) medium = 'unicode'

  @state() private text = ''
  @state() private error = ''
  @state() private ready = false

  /** The resolved notation string, or null while pending/errored. Pairs with the `result` event. */
  get value(): string | null {
    return this.ready && !this.error ? this.text : null
  }

  connectedCallback(): void {
    super.connectedCallback()
    void this.load()
  }

  updated(changed: Map<string, unknown>): void {
    if (['collection', 'n', 'rank', 'medium'].some((k) => changed.has(k))) void this.load()
  }

  private async load(): Promise<void> {
    if (!this.collection) return
    try {
      const h = construct(this.collection, this.n ? { size: num(this.n) } : {})
      const [row] = await h.window(num(this.rank), 1, { medium: this.medium as 'ascii' | 'unicode' | 'latex' })
      this.text = row?.element != null ? String(row.element) : ''
      this.error = row ? '' : `no element at rank ${this.rank}`
      this.ready = true
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      this.ready = true
    }
    // Announce the resolved notation (or error) so a wrapping <enumeratio-assert> can check it. Composed → crosses shadow.
    this.dispatchEvent(
      new CustomEvent('result', { detail: { value: this.error ? null : this.text, error: this.error || null }, bubbles: true, composed: true }),
    )
  }

  render(): TemplateResult {
    if (this.error) return html`<span class="err" title=${this.error}>⚠ ${this.error}</span>`
    if (!this.ready) return html`<span class="hint">…</span>`
    return html`<code class="note">${this.text}</code>`
  }

  static styles = css`
    :host {
      display: inline-block;
    }
    .note {
      font-family: ui-monospace, SFMono-Regular, monospace;
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
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
    'enumeratio-notation': EnumeratioNotation
  }
}
