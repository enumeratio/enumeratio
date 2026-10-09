import { NotatioSetterBar } from "./setter-box.ts";
import { defineControl } from "./define.ts";

/**
 * `<RadioButtonBar name="k" values="1|2|3">` -- Wolfram's `RadioButtonBar`: a
 * `<SetterBar>` whose entries are radio buttons, one of which is on. The
 * entries, the arrows and the binding are the setter bar's.
 */
export class NotatioRadioButtonBar extends NotatioSetterBar {
  protected override get look(): "setter" | "radio" {
    return "radio";
  }
}

defineControl("notatio-radio-button-bar", NotatioRadioButtonBar);
