// The common ground of every control over a LIST of entries -- a setter bar, a bar of
// togglers, a popup menu, a list picker: the entries are parsed once (`a|b -> B|c`),
// typeset once, and what is selected binds by value, as MathJSON, alone or as a `List`.
// The subclass decides how many may be selected and how the entries are drawn.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { LitElement, type PropertyValues } from "lit";
import { entryMarkup } from "./choice-menu.ts";
import { emitControl } from "./controls.ts";
import { ensureStyles } from "./styles.ts";
import { type Choice, choiceBinding, parseChoices, parseEntries } from "./tangle.ts";

export abstract class ChoiceControl extends LitElement {
  static properties = {
    /** The binding this control drives: `name="a"` fills the wildcard `_a`. */
    name: { type: String, reflect: true },
    /** The entries, `|`-separated, each optionally `value -> label`. */
    values: { type: String },
    /** The entry (or, for a multiple selection, the `|`-separated entries) selected at first. */
    value: { type: String },
    _selected: { state: true },
    _markup: { state: true },
  };

  declare name: string;
  declare values: string;
  declare value: string;
  declare _selected: number[];
  declare _markup: string[];

  #choices: Choice[] = [];
  #typesetFrom = "";

  /** May more than one entry be selected? */
  abstract get multiple(): boolean;

  constructor() {
    super();
    this.name = "";
    this.values = "";
    this.value = "";
    this._selected = [];
    this._markup = [];
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  get choices(): readonly Choice[] {
    return this.#choices;
  }

  /** The selected entry's index, or the first of several; -1 for none. */
  get index(): number {
    return this._selected[0] ?? -1;
  }

  isSelected(index: number): boolean {
    return this._selected.includes(index);
  }

  /** The bound value: one entry's, or a `List` of the selected entries' in list order. */
  get binding(): MathJsonExpression {
    const of = (i: number): MathJsonExpression => choiceBinding(this.#choices[i], i);
    if (!this.multiple) return this.index < 0 ? "Null" : of(this.index);
    return ["List", ...[...this._selected].sort((a, b) => a - b).map(of)] as MathJsonExpression;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("values") || changed.has("value")) {
      this.#choices = parseChoices(this.values);
      this._selected = this.#initial();
      void this.#typeset();
    }
  }

  /** Where `value` points: entries by value or label, or by index. */
  #initial(): number[] {
    const wanted = this.multiple ? parseEntries(this.value) : [this.value.trim()];
    const found = wanted
      .map((w) => {
        const at = this.#choices.findIndex((c) => c.value === w || c.label === w);
        if (at >= 0) return at;
        const n = Number(w);
        return Number.isInteger(n) && n >= 0 && n < this.#choices.length ? n : -1;
      })
      .filter((i) => i >= 0);
    if (found.length > 0) return this.multiple ? [...new Set(found)] : [found[0]];
    return this.multiple || this.#choices.length === 0 ? [] : [0];
  }

  async #typeset(): Promise<void> {
    const key = this.#choices.map((c) => c.label).join("|");
    if (key === this.#typesetFrom) return;
    this.#typesetFrom = key;
    this._markup = await Promise.all(this.#choices.map((c) => entryMarkup(c.label)));
  }

  /** Make `index` the selection (single), or toggle it in and out (multiple). */
  protected choose(index: number): void {
    if (index < 0 || index >= this.#choices.length) return;
    const next = this.multiple
      ? this.isSelected(index)
        ? this._selected.filter((i) => i !== index)
        : [...this._selected, index]
      : [index];
    if (next.length === this._selected.length && next.every((i, k) => i === this._selected[k])) {
      return;
    }
    this._selected = next;
    emitControl(this, { name: this.name, value: this.binding, index: this.index });
  }

  /** Step the single selection by `delta`, clamped -- arrow keys on a bar or a menu. */
  protected step(delta: number): void {
    const n = this.#choices.length;
    if (n === 0) return;
    this.choose(Math.max(0, Math.min(n - 1, this.index + delta)));
  }
}
