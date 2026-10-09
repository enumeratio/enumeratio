import { defineControl } from "./define.ts";
import { NotatioRadioButtonBar } from "./radio-button-bar-box.ts";

/**
 * `<radio-button-box name="k" values="3">` -- Wolfram's `RadioButtonBox`: one radio button, on when
 * the variable holds its entry. A row of them is a `<radio-button-bar-box>`; this is a bar of one.
 */
export class NotatioRadioButtonBox extends NotatioRadioButtonBar {}

defineControl("radio-button-box", NotatioRadioButtonBox);
