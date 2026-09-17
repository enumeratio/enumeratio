import { defineControl } from "./controls.ts";
import { NotatioSetterBar } from "./notatio-setter-bar.ts";

/**
 * `<notatio-radio-button-bar name="k" values="1|2|3">` -- Wolfram's `RadioButtonBar`: a
 * `<notatio-setter-bar>` whose entries are radio buttons, one of which is on. The
 * entries, the arrows and the binding are the setter bar's.
 */
export class NotatioRadioButtonBar extends NotatioSetterBar {
  protected override get look(): "setter" | "radio" {
    return "radio";
  }
}

defineControl("notatio-radio-button-bar", NotatioRadioButtonBar);
