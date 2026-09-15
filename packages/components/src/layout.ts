// The base of the layout components -- `Row`, `Column`, `Grid`, `Panel` -- which
// arrange whatever is inside them and render nothing of their own. Light DOM: the
// children are the author's (or the renderer's), the shared stylesheet lays them out.

import { LitElement, nothing } from "lit";
import { ensureStyles } from "./styles.ts";

export abstract class Layout extends LitElement {
  constructor() {
    super();
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override render(): unknown {
    return nothing;
  }
}
