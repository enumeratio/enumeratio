import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { unsafeHTML } from 'lit/directives/unsafe-html.js'

// <svg-figure svg="<svg…/>"> — the GENERIC figure renderer: it injects a ready-made SVG string verbatim, so the
// geometry can be authored ANYWHERE (notably emitted by pg's glyph_svg — figures as data; see render-assets) rather
// than hardcoded in a per-glyph TS element. The `*-glyph` elements are the built-in defaults; this is the fallback
// for db-authored / custom representations. The injected SVG references the shared --enumeratio-* styling hooks,
// which inherit through the shadow boundary, so it themes with the rest of the surface.
//
// Default is an inline glyph (`display:inline-block`, sized to the text). Set the boolean `fullscreenable` attribute
// to render it as a self-contained block PANEL with a fullscreen toggle in the corner (issue #162) — for a standalone
// figure worth blowing up to full screen, rather than an inline glyph in prose.
@customElement('svg-figure')
export class SvgFigure extends LitElement {
  @property({ type: String }) svg = ''
  @property({ type: Boolean, reflect: true }) fullscreenable = false

  render(): TemplateResult {
    if (!this.svg) return html``
    if (!this.fullscreenable) return html`${unsafeHTML(this.svg)}`
    return html`
      <div class="pv">
        ${unsafeHTML(this.svg)}
        <div class="overlay"><fullscreen-button></fullscreen-button></div>
      </div>
    `
  }

  // Inline: height-driven sizing (the SVG carries a viewBox, no width/height) keeps a glyph in step with the text.
  // Panel (`fullscreenable`): a block box the figure fills, with a corner overlay; fullscreen centers it large.
  static styles = css`
    :host {
      display: inline-block;
      vertical-align: middle;
    }
    svg {
      height: 2.5em;
      width: auto;
      max-width: 100%;
      overflow: visible;
    }
    :host([fullscreenable]) {
      display: block;
      vertical-align: initial;
    }
    :host([fullscreenable]) .pv {
      position: relative;
    }
    :host([fullscreenable]) svg {
      display: block;
      height: auto;
      width: 100%;
      max-height: 70vh;
    }
    :host([fullscreenable]) .overlay {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
    }
    :host(:fullscreen) {
      background: var(--enumeratio-bg, var(--p-content-background, #fff));
      display: flex;
      align-items: center;
      justify-content: center;
    }
    :host(:fullscreen) .pv {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    :host(:fullscreen) svg {
      width: auto;
      height: auto;
      max-width: 100vw;
      max-height: 100vh;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'svg-figure': SvgFigure
  }
}
