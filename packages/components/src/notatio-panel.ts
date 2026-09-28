import { Layout } from "./layout.ts";

/** `<notatio-panel>` -- its children in a framed box, Wolfram's `Panel`. */
export class NotatioPanel extends Layout {}

if (!customElements.get("notatio-panel")) customElements.define("notatio-panel", NotatioPanel);
