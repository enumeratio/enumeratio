import { html, LitElement, nothing } from "lit";
import "./notatio-out.ts";
import { ensureStyles } from "./styles.ts";

/** `VerificationTest`'s outcome (`@enumeratio/aestimatio`'s `Outcome`). */
type Outcome = "Success" | "Failure" | "Error" | "Aborted" | "";

const BADGE: Readonly<Record<Exclude<Outcome, "">, { symbol: string; label: string }>> = {
  Success: { symbol: "✓", label: "Success" },
  Failure: { symbol: "≠", label: "Failure" },
  Error: { symbol: "!", label: "Error" },
  Aborted: { symbol: "∅", label: "Aborted" },
};

/**
 * `<notatio-test-result-object>` -- `VerificationTest`'s `TestResultObject`
 * (design/aestimatio.md §4): the held input as an In row, the actual output as an Out
 * row, and a badge for the outcome (Success ✓ / Failure ≠, expected shown / Error ! /
 * Aborted ∅), plus the time used and, when set, the TestID. Reuses `<notatio-out>`
 * (`label`/`label-menu`) for both rows rather than re-typesetting anything itself.
 */
export class NotatioTestResultObject extends LitElement {
  static properties = {
    /** The held input, as notatio source. */
    input: { type: String },
    /** The evaluated result, as notatio source; absent on Error/Aborted. */
    actual: { type: String },
    /** What it was compared against, as notatio source; absent when there was none. */
    expected: { type: String },
    /** `Success`, `Failure`, `Error` or `Aborted`. */
    outcome: { type: String, reflect: true },
    /** `AbsoluteTimeUsed`, in seconds. */
    time: { type: Number },
    /** `TestID`, when the test named one. */
    testId: { type: String, attribute: "test-id" },
  };

  declare input: string;
  declare actual: string;
  declare expected: string;
  declare outcome: Outcome;
  declare time: number | undefined;
  declare testId: string;

  constructor() {
    super();
    this.input = "";
    this.actual = "";
    this.expected = "";
    this.outcome = "";
    this.time = undefined;
    this.testId = "";
    ensureStyles();
    ensureTestResultStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  #badge(): unknown {
    const info = this.outcome ? BADGE[this.outcome as Exclude<Outcome, "">] : undefined;
    if (!info) return nothing;
    return html`<span class="ntr-badge is-${this.outcome.toLowerCase()}" title=${info.label}
      >${info.symbol}
      ${info.label}${
        this.outcome === "Failure" && this.expected
          ? html` <span class="ntr-expected">expected <code>${this.expected}</code></span>`
          : nothing
      }</span
    >`;
  }

  #foot(): unknown {
    const parts: unknown[] = [];
    if (this.time !== undefined) {
      parts.push(html`<span class="ntr-time">${this.time.toFixed(3)}s</span>`);
    }
    if (this.testId) parts.push(html`<span class="ntr-id">${this.testId}</span>`);
    return parts.length === 0 ? nothing : html`<div class="ntr-foot">${parts}</div>`;
  }

  protected override render(): unknown {
    return html`<div class="ntr">
      <div class="ntr-head">${this.#badge()}${this.#foot()}</div>
      <notatio-out format="notatio" .value=${this.input} label="In" label-menu></notatio-out>
      ${
        this.outcome === "Error" || this.outcome === "Aborted"
          ? nothing
          : html`<notatio-out format="notatio" .value=${this.actual} label="Out" label-menu> </notatio-out>`
      }
    </div>`;
  }
}

let stylesInjected = false;

// Same light-DOM, page-level pattern as `<notatio-collection-table>`: one shared
// stylesheet, injected once.
function ensureTestResultStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.id = "notatio-test-result-object";
  style.textContent = CSS;
  document.head.append(style);
}

const CSS = `
notatio-test-result-object { display: block; margin: 0.75rem 0; }
.ntr {
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 10px;
  background: var(--notatio-bg, var(--vp-c-bg, #fff));
  padding: 0.6rem 0.8rem;
  font-size: 0.85rem;
}
.ntr-head { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 0.35rem; }
.ntr-badge {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
}
.ntr-badge.is-success { background: rgba(46, 160, 67, 0.14); color: #2ea043; }
.ntr-badge.is-failure { background: var(--notatio-fail-bg, rgba(192, 57, 43, 0.12)); color: var(--vp-c-danger-1, #c0392b); }
.ntr-badge.is-error { background: var(--notatio-diag-bg, rgba(217, 147, 26, 0.14)); color: var(--notatio-diag, #b7791f); }
.ntr-badge.is-aborted { background: var(--vp-c-bg-soft, #f2f2f2); color: var(--vp-c-text-3, #888); }
.ntr-expected { font-weight: 400; opacity: 0.85; }
.ntr-expected code { font-family: var(--notatio-mono, ui-monospace, monospace); }
.ntr-foot { margin-left: auto; display: flex; gap: 0.6rem; color: var(--vp-c-text-3, #888); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.ntr-id { font-family: var(--notatio-mono, ui-monospace, monospace); }
`;

// Last: `define` upgrades any matching elements already in the DOM SYNCHRONOUSLY,
// which would run the constructor (and so `ensureTestResultStyles`) before
// `stylesInjected`/`CSS` above are initialized if this came first (a TDZ crash for
// pre-existing markup, as opposed to one Vue creates after this module has finished).
if (!customElements.get("notatio-test-result-object")) {
  customElements.define("notatio-test-result-object", NotatioTestResultObject);
}
