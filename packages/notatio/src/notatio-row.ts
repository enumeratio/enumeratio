import { Layout } from "./layout.ts";

/**
 * `<notatio-row>` -- its children side by side, Wolfram's `Row`. Nothing of its own:
 * put controls, readouts and pictures inside and they sit in a line, which is how an
 * expression `Row([Slider(k, (0, 5)), Dynamic(k^2)])` draws.
 */
export class NotatioRow extends Layout {}

if (!customElements.get("notatio-row")) customElements.define("notatio-row", NotatioRow);
