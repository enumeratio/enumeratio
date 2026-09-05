import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

// <enumeratio-assert expect="…"> — a tiny test-harness WRAPPER. Slot a value-bearing component inside it (any element
// that emits a composed `result` CustomEvent { value, error } — e.g. <enumeratio-expression>, <enumeratio-notation>,
// <enumeratio-figure>), give it the `expect`ed rendered value, and it checks the two against each other. It is the
// glue that lets a demo double as a browser unit test: on a match it stays quiet (a small ✓, or the live value with
// `reveal`); on a mismatch or error it lights up red and shows expected-vs-actual plus an optional failure `message`.
//
// It also broadcasts every status change as a bubbling+composed `enumeratio-assert` event (detail { id, status,
// label }), which <enumeratio-assert-summary> tallies into a page-level pass/fail scoreboard — so a whole page of
// assertions reads as one test run.
//
//   <enumeratio-assert expect="5/6" label="add unlike denominators">
//     <enumeratio-expression carrier="rational_number" expr="1/2 + 1/3"></enumeratio-expression>
//   </enumeratio-assert>

// `neutral` = not being checked, so we just show the live value uncoloured: either no `expect` was given (a pure
// reflector) or the wrapped control was edited away from its default (the recorded expectation no longer applies).
export type AssertStatus = 'pending' | 'pass' | 'fail' | 'error' | 'neutral'

let nextId = 0

@customElement('enumeratio-assert')
export class EnumeratioAssert extends LitElement {
  /** The expected rendered value the slotted component should evaluate to. */
  @property({ type: String }) expect = ''
  /** Optional label for the row (also shown in the summary). */
  @property({ type: String }) label = ''
  /** Optional message shown on failure, in place of the generic "expected X, got Y". */
  @property({ type: String }) message = ''
  /** When to show the actual value: `fail` (default — only on mismatch), `always`, or `never` (just the ✓/✗). */
  @property({ type: String }) reveal: 'fail' | 'always' | 'never' = 'fail'
  /** Suppress the built-in reset button (e.g. when the host provides its own). */
  @property({ type: Boolean, attribute: 'no-reset' }) noReset = false

  @state() private status: AssertStatus = 'pending'
  @state() private actual: string | null = null
  @state() private resettable = false
  @state() private dirty = false

  /** No expectation given → this is a pure reflector: show the value, never pass/fail. */
  private get hasExpect(): boolean {
    return this.expect.trim() !== ''
  }

  private readonly assertId = `assert-${nextId++}`

  connectedCallback(): void {
    super.connectedCallback()
    // composed child `result` events bubble up to here; catch them without knowing the child's type.
    this.addEventListener('result', this.onResult as EventListener)
    this.report()
  }

  disconnectedCallback(): void {
    this.removeEventListener('result', this.onResult as EventListener)
    super.disconnectedCallback()
  }

  private onResult = (
    ev: CustomEvent<{ value: string | null; error: string | null; dirty?: boolean; resettable?: boolean }>,
  ): void => {
    const { value, error, dirty, resettable } = ev.detail ?? { value: null, error: null }
    this.resettable = !!resettable
    this.dirty = !!dirty
    if (!this.hasExpect || dirty) {
      // Not being checked (no expectation, or the control was edited off its default) — just reflect the value.
      // Errors are still surfaced (with a ⚠), but they don't count as a test failure.
      this.actual = error ? `⚠ ${error}` : value
      this.status = 'neutral'
    } else if (error) {
      this.actual = error
      this.status = 'error'
    } else if (value == null) {
      this.actual = null
      this.status = 'pending'
    } else {
      this.actual = value
      this.status = value.trim() === this.expect.trim() ? 'pass' : 'fail'
    }
    this.report()
  }

  /** Restore the wrapped control to its default (calls the slotted child's reset(), if it has one). */
  private reset = (): void => {
    for (const el of Array.from(this.children)) {
      const r = (el as unknown as { reset?: () => void }).reset
      if (typeof r === 'function') r.call(el)
    }
  }

  /** Broadcast the current status for the page-level summary to tally. */
  private report(): void {
    this.dispatchEvent(
      new CustomEvent('enumeratio-assert', {
        detail: { id: this.assertId, status: this.status, label: this.label || this.expect },
        bubbles: true,
        composed: true,
      }),
    )
  }

  private badge(): TemplateResult {
    switch (this.status) {
      case 'pass':
        return html`<span class="badge pass" title="pass">✓</span>`
      case 'fail':
        return html`<span class="badge fail" title="fail">✗</span>`
      case 'error':
        return html`<span class="badge fail" title="error">⚠</span>`
      case 'neutral':
        return html`<span class="badge neutral" title="not checked — reflecting the value">✎</span>`
      default:
        return html`<span class="badge pending" title="pending">…</span>`
    }
  }

  render(): TemplateResult {
    const failed = this.status === 'fail' || this.status === 'error'
    const neutral = this.status === 'neutral'
    const showValue = neutral || (this.reveal === 'always' && this.status === 'pass')
    return html`
      <span class="assert ${this.status}" part="assert">
        <span class="host"><slot></slot></span>
        ${this.badge()}
        ${showValue && this.actual != null ? html`<span class="got">= ${this.actual}</span>` : ''}
        ${neutral && this.dirty && this.resettable && !this.noReset
          ? html`<button class="reset" title="restore the default" aria-label="reset" @click=${this.reset}>↺</button>`
          : ''}
        ${failed
          ? html`<span class="detail">
              ${this.message ? html`<span class="msg">${this.message}</span>` : ''}
              <span class="cmp"
                >expected <code class="exp">${this.expect}</code> · got
                <code class="act">${this.actual ?? '—'}</code></span
              >
            </span>`
          : ''}
      </span>
    `
  }

  static styles = css`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
    .assert {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
      border: 1px solid transparent;
    }
    .assert.fail,
    .assert.error {
      border-color: var(--p-red-400, #f87171);
      background: color-mix(in srgb, var(--p-red-500, #dc2626) 8%, transparent);
    }
    .host {
      display: inline-flex;
      align-items: center;
    }
    .badge {
      font-weight: 700;
      font-size: 0.85em;
      width: 1.2em;
      text-align: center;
    }
    .badge.pass {
      color: var(--p-green-500, #16a34a);
    }
    .badge.fail {
      color: var(--p-red-500, #dc2626);
    }
    .badge.pending,
    .badge.neutral {
      color: var(--enumeratio-muted, var(--enumeratio-muted, var(--p-text-muted-color, currentColor)));
      opacity: 0.6;
    }
    .reset {
      font: inherit;
      font-size: 0.95em;
      line-height: 1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5em;
      height: 1.5em;
      border-radius: 50%;
      border: 1px solid var(--enumeratio-border, var(--p-content-border-color, currentColor));
      background: transparent;
      color: var(--enumeratio-muted, var(--enumeratio-muted, var(--p-text-muted-color, currentColor)));
    }
    .reset:hover {
      color: var(--enumeratio-text, var(--p-text-color, currentColor));
      border-color: var(--enumeratio-accent, var(--p-primary-color, currentColor));
    }
    .detail {
      display: inline-flex;
      flex-direction: column;
      gap: 0.1rem;
      font-size: 0.82em;
    }
    .msg {
      color: var(--p-red-600, #b91c1c);
    }
    .cmp {
      color: var(--enumeratio-muted, var(--enumeratio-muted, var(--p-text-muted-color, currentColor)));
    }
    code {
      font-family: ui-monospace, SFMono-Regular, monospace;
    }
    .exp {
      color: var(--p-green-600, #15803d);
    }
    .act {
      color: var(--p-red-600, #b91c1c);
    }
    .got {
      color: var(--enumeratio-muted, var(--enumeratio-muted, var(--p-text-muted-color, currentColor)));
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 0.85em;
    }
  `
}

declare global {
  interface HTMLElementTagNameMap {
    'enumeratio-assert': EnumeratioAssert
  }
}
