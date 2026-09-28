import { Layout } from "./layout.ts";

/** `<notatio-column>` -- its children one under another, Wolfram's `Column`. */
export class NotatioColumn extends Layout {}

if (!customElements.get("notatio-column")) customElements.define("notatio-column", NotatioColumn);
