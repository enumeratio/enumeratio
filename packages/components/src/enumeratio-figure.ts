import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { construct } from '@enumeratio/client'
import { num } from './num'
import './figures/svg-figure'

// <enumeratio-figure collection="…" n="…" rank="…"> — a client-backed component that RESOLVES an element's page-space
// figure from the db (the client's handle.glyphSvg → pg's glyph_svg) and hands the SVG string to the generic
// <svg-figure> to render. The full figures-as-data round-trip: geometry computed in SQL, resolved by the client,
// injected by a generic web component — no per-glyph TS. null (no glyph_svg overload for the carrier) → a quiet hint.
@customElement('enumeratio-figure')
export class EnumeratioFigure extends LitElement {
  @property({ type: String }) collection = ''
  @property({ type: Number }) n = 0
  @property({ type: Number }) rank = 0

  @state() private svg = ''
  @state() private error = ''
  @state() private ready = false

  /** `'ok'` once a figure resolved, `null` while pending/errored — a coarse "did it render?" signal for
   *  <enumeratio-assert>. (A figure has no scalar value to check; whether the db produced an SVG is the useful bit.) */
  get value(): string | null {
    return this.ready && !this.error && this.svg ? 'ok' : null
  }

  connectedCallback(): void {
    super.connectedCallback()
    void this.load()
  }

  updated(changed: Map<string, unknown>): void {
    if (['collection', 'n', 'rank'].some((k) => changed.has(k))) void this.load()
  }

  private async load(): Promise<void> {
    if (!this.collection) return
    try {
      const h = construct(this.collection, this.n ? { size: num(this.n) } : {})
      const svg = await h.glyphSvg(num(this.rank))
      this.svg = svg ?? ''
      this.error = svg == null ? `no svg glyph for ${this.collection}` : ''
      this.ready = true
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e)
      this.ready = true
    }
    // Announce whether a figure resolved (value = 'ok' | null) so a wrapping <enumeratio-assert> can flag failures.
    this.dispatchEvent(
      new CustomEvent('result', { detail: { value: this.value, error: this.error || null }, bubbles: true, composed: true }),
    )
  }

  render(): TemplateResult {
    if (this.error) return html`<span class="err" title=${this.error}>⚠</span>`
    if (!this.ready) return html`<span class="hint">…</span>`
    return html`<svg-figure .svg=${this.svg}></svg-figure>`
  }

  static styles = css`
    :host {
      display: inline-block;
      vertical-align: middle;
    }
    .err {
      color: var(--p-red-500, #dc2626);
    }
    .hint {
      opacity: 0.5;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-figure': EnumeratioFigure
  }
}
