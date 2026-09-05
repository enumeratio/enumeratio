import { LitElement, html, css, svg, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

// <fullscreen-button> — the shared corner-overlay control every figure panel reuses to toggle itself fullscreen
// (issue #162). Drop it into a panel's overlay next to the reset/recenter button; by default it fullscreens the
// figure it lives in (the shadow host), so no wiring is needed inside a web component. Pass `.target` to fullscreen
// a different element (e.g. a Vue panel wrapping the figure). The icon reflects state — expand when windowed,
// contract when fullscreen — driven off the document `fullscreenchange` event.
@customElement('fullscreen-button')
export class FullscreenButton extends LitElement {
  // element to fullscreen; defaults to this button's own figure panel (the shadow host, else the parent element)
  @property({ attribute: false }) target: HTMLElement | null = null

  @state() private active = false

  private onFsChange = () => this.sync()

  connectedCallback(): void {
    super.connectedCallback()
    document.addEventListener('fullscreenchange', this.onFsChange)
    this.sync()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener('fullscreenchange', this.onFsChange)
  }

  private resolveTarget(): HTMLElement | null {
    if (this.target) return this.target
    const host = (this.getRootNode() as ShadowRoot).host as HTMLElement | undefined
    return host ?? this.parentElement
  }

  private sync(): void {
    this.active = !!document.fullscreenElement && document.fullscreenElement === this.resolveTarget()
  }

  private async toggle(): Promise<void> {
    const el = this.resolveTarget()
    if (!el) return
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen()
      else await el.requestFullscreen()
    } catch {
      /* fullscreen can be blocked (permissions / not user-gesture) — ignore, the icon stays in sync via the event */
    }
  }

  render(): TemplateResult {
    // expand = enter fullscreen (windowed); contract = exit (fullscreen)
    const icon = this.active
      ? svg`<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />`
      : svg`<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />`
    return html`
      <button
        class="vbtn"
        title=${this.active ? 'exit fullscreen' : 'fullscreen'}
        aria-label=${this.active ? 'exit fullscreen' : 'fullscreen'}
        aria-pressed=${this.active}
        @click=${this.toggle}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${icon}
        </svg>
      </button>
    `
  }

  static styles = css`
    :host {
      display: inline-flex;
    }
    .vbtn {
      width: 1.9rem;
      height: 1.9rem;
      padding: 0;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      border-radius: 4px;
      background: var(--p-content-hover-background, transparent);
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .vbtn svg {
      width: 1rem;
      height: 1rem;
    }
    .vbtn:hover {
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'fullscreen-button': FullscreenButton
  }
}
