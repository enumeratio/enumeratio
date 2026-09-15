import { Layout } from "./layout.ts";

/**
 * `<notatio-grid columns="2">` -- its children in rows of `columns`, Wolfram's `Grid`.
 * `Grid([[a, b], [c, d]])` draws as one of these with the cells in reading order.
 */
export class NotatioGrid extends Layout {
  static properties = {
    /** How many children make a row. */
    columns: { type: Number, reflect: true },
  };

  declare columns: number;

  constructor() {
    super();
    this.columns = 1;
  }

  protected override updated(): void {
    this.style.gridTemplateColumns = `repeat(${Math.max(1, this.columns)}, auto)`;
  }
}

if (!customElements.get("notatio-grid")) customElements.define("notatio-grid", NotatioGrid);
