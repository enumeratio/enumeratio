import {
  clampRank,
  type ControlChange,
  elementText,
  exprAt,
  glyphSvg,
  rankBounds,
  showJson,
} from "@enumeratio/frontend/core";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { countOf, type Evaluate, evaluateText } from "./distribution-client.ts";
import "./slider-box.ts";
import "./stepper-box.ts";
import { ensureStyles } from "./styles.ts";

/** What a pick says: the element, and where in its collection it is. */
export interface ElementPick {
  readonly size: number;
  readonly rank: number;
  readonly count: number;
  /** The element, as MathJSON. */
  readonly element: unknown;
}

/** The event a pick is announced by. */
export const ELEMENT_PICK_EVENT = "notatio-element-pick";

/**
 * `<notatio-element-picker template="SymmetricGroup({size})" size-max="8" glyph="permutation">`
 * -- pick one element of a carrier: a size stepper, then a rank slider over the collection at
 * that size, and the element it lands on drawn as its glyph and as text. The element is
 * `At(collection(size), rank)`, asked of the page's kernel; the rank runs from 1 to the
 * collection's count. Nothing is announced until the reader moves a control: then
 * `notatio-element-pick` carries the element, and the host decides what to do with it. Both
 * controls are keyboard operable (arrows step, Home and End on the slider go to its ends), and the
 * slider's `aria-valuetext` is the element.
 */
export class NotatioElementPicker extends LitElement {
  static properties = {
    /** The collection with its size as `{size}`: `SymmetricGroup({size})`. */
    template: { type: String },
    /** What the elements are, for the labels: `Permutation`. */
    carrier: { type: String },
    /** The glyph kind that draws an element: `permutation`, `partition`, `dyck`, … Empty for none. */
    glyph: { type: String },
    /** The size shown. */
    size: { type: Number, reflect: true },
    /** The smallest size offered. */
    sizeMin: { type: Number, attribute: "size-min" },
    /** The largest size offered. */
    sizeMax: { type: Number, attribute: "size-max" },
    /** The rank (1-based) of the element in the collection at `size`. */
    rank: { type: Number, reflect: true },
    /** Seam for the kernel: the page's by default. Hosts and tests swap it; not for authors. */
    evaluate: { attribute: false },
    _count: { state: true },
    _element: { state: true },
    _failure: { state: true },
  };

  declare template: string;
  declare carrier: string;
  declare glyph: string;
  declare size: number;
  declare sizeMin: number;
  declare sizeMax: number;
  declare rank: number;
  declare evaluate: Evaluate | undefined;
  declare _count: number | undefined;
  declare _element: { readonly json: unknown } | undefined;
  declare _failure: string | undefined;

  /** Whether the reader has moved a control: until then the page's own start value stands. */
  #touched = false;
  #asked = 0;

  constructor() {
    super();
    this.template = "";
    this.carrier = "";
    this.glyph = "";
    this.size = 4;
    this.sizeMin = 1;
    this.sizeMax = 6;
    this.rank = 1;
    this.evaluate = undefined;
    this._count = undefined;
    this._element = undefined;
    this._failure = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("size") || changed.has("rank") || changed.has("template")) void this.#load();
  }

  /** The collection's count at the size, then the element at the rank; announced once the reader has moved a control. */
  async #load(): Promise<void> {
    if (this.template === "") return;
    const asked = ++this.#asked;
    const ask = this.evaluate ?? evaluateText;
    const collection = exprAt(this.template, this.size);
    const count = await countOf(collection, ask);
    if (asked !== this.#asked) return;
    const bounds = count === undefined ? undefined : rankBounds(count);
    if (bounds === undefined) {
      this._count = undefined;
      this._element = undefined;
      this._failure = `${collection} has no elements to pick from`;
      return;
    }
    this._count = bounds.max;
    const rank = clampRank(this.rank, bounds.max);
    if (rank !== this.rank) {
      this.rank = rank; // a fresh load, at the rank that fits
      return;
    }
    this._failure = undefined;
    if (!this.#touched) return;
    try {
      const json = await ask(elementText(this.template, this.size, rank));
      if (asked !== this.#asked) return;
      this._element = { json };
      this.dispatchEvent(
        new CustomEvent<ElementPick>(ELEMENT_PICK_EVENT, {
          bubbles: true,
          composed: true,
          detail: { size: this.size, rank, count: bounds.max, element: json },
        }),
      );
    } catch (err) {
      if (asked === this.#asked) this._failure = err instanceof Error ? err.message : String(err);
    }
  }

  #onControl = (event: Event): void => {
    const { name, re } = (event as CustomEvent<ControlChange>).detail;
    if (name !== "size" && name !== "rank") return;
    event.stopPropagation();
    this.#touched = true;
    if (name === "size") this.size = Math.min(Math.max(this.sizeMin, re ?? this.size), this.sizeMax);
    else this.rank = re ?? this.rank;
  };

  protected override render(): unknown {
    const label = this.carrier || "element";
    const shown = this._element === undefined ? undefined : showJson(this._element.json);
    const svg = this._element === undefined ? undefined : glyphSvg(this.glyph || undefined, this._element.json);
    return html`<div
      class="element-picker"
      role="group"
      aria-label=${`Pick a ${label}`}
      @notatio-control-change=${this.#onControl}
    >
      <label
        >Size
        <stepper-box name="size" .value=${this.size} min=${this.sizeMin} max=${this.sizeMax}></stepper-box>
      </label>
      <label
        >Rank
        <slider-box
          name="rank"
          .value=${String(this.rank)}
          min="1"
          max=${this._count ?? 1}
          step="1"
          .valuetext=${shown === undefined ? `${this.rank} of ${this._count ?? "?"}` : shown}
          readout
        ></slider-box>
        ${this._count === undefined ? nothing : html`<span class="element-picker-count">of ${this._count}</span>`}
      </label>
      ${
        svg === undefined
          ? nothing
          : html`<span class="element-picker-glyph" role="img" aria-label=${`${label}, ${shown}`}
              >${unsafeHTML(svg)}</span
            >`
      }
      ${shown === undefined ? nothing : html`<code class="element-picker-value" aria-live="polite">${shown}</code>`}
      ${this._failure === undefined ? nothing : html`<span class="element-picker-count" role="status">${this._failure}</span>`}
    </div>`;
  }
}

if (!customElements.get("notatio-element-picker"))
  customElements.define("notatio-element-picker", NotatioElementPicker);
