import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import type { AssertStatus } from './enumeratio-assert'

// <enumeratio-assert-summary> — a page-level scoreboard for every <enumeratio-assert> on the page. Each assert
// broadcasts a composed `enumeratio-assert` event on status change; this element listens at the window and tallies by
// assert id, so it always reflects the live pass/fail/pending counts of the whole "test run". Drop one at the top of a
// kitchen-sink page. Purely observational — it drives nothing, it just counts.
@customElement('enumeratio-assert-summary')
export class EnumeratioAssertSummary extends LitElement {
  /** Optional heading shown before the counts. */
  @property({ type: String }) label = 'assertions'

  @state() private counts: Record<AssertStatus, number> = { pending: 0, pass: 0, fail: 0, error: 0, neutral: 0 }
  private readonly seen = new Map<string, AssertStatus>()

  connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener('enumeratio-assert', this.onAssert as EventListener)
  }

  disconnectedCallback(): void {
    window.removeEventListener('enumeratio-assert', this.onAssert as EventListener)
    super.disconnectedCallback()
  }

  private onAssert = (ev: CustomEvent<{ id: string; status: AssertStatus }>): void => {
    const { id, status } = ev.detail ?? {}
    if (!id) return
    this.seen.set(id, status)
    this.recount()
  }

  private recount(): void {
    const c: Record<AssertStatus, number> = { pending: 0, pass: 0, fail: 0, error: 0, neutral: 0 }
    for (const s of this.seen.values()) c[s]++
    this.counts = c
  }

  render(): TemplateResult {
    const { pass, fail, error, pending, neutral } = this.counts
    const total = pass + fail + error + pending + neutral
    const bad = fail + error
    const verdict =
      total === 0 ? 'no assertions yet'
      : bad > 0 ? `${bad} failing`
      : pending > 0 ? 'running…'
      : neutral > 0 ? 'edited' : 'all passing'
    return html`
      <div class="sum ${bad > 0 ? 'bad' : pending > 0 ? 'run' : total > 0 ? 'good' : ''}">
        <span class="verdict">${verdict}</span>
        <span class="counts">
          <span class="pass">${pass} ✓</span>
          ${bad > 0 ? html`<span class="fail">${bad} ✗</span>` : ''}
          ${neutral > 0 ? html`<span class="neutral">${neutral} ✎</span>` : ''}
          ${pending > 0 ? html`<span class="pending">${pending} …</span>` : ''}
          <span class="of">/ ${total} ${this.label}</span>
        </span>
      </div>
    `
  }

  static styles = css`
    :host {
      display: block;
      position: sticky;
      top: 0.5rem;
      z-index: 5;
      margin: 1rem 0;
    }
    .sum {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding: 0.5rem 0.8rem;
      border-radius: 8px;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      background: var(--p-content-background, var(--vp-c-bg-soft, transparent));
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 0.9rem;
    }
    .sum.good {
      border-color: var(--p-green-400, #4ade80);
    }
    .sum.bad {
      border-color: var(--p-red-400, #f87171);
    }
    .verdict {
      font-weight: 700;
    }
    .sum.good .verdict {
      color: var(--p-green-600, #15803d);
    }
    .sum.bad .verdict {
      color: var(--p-red-600, #b91c1c);
    }
    .counts {
      display: inline-flex;
      gap: 0.6rem;
      align-items: baseline;
    }
    .pass {
      color: var(--p-green-500, #16a34a);
    }
    .fail {
      color: var(--p-red-500, #dc2626);
    }
    .pending,
    .neutral,
    .of {
      color: var(--enumeratio-muted, var(--p-text-muted-color, currentColor));
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-assert-summary': EnumeratioAssertSummary
  }
}
