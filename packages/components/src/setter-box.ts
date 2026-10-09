import { defineControl } from "./define.ts";
import { NotatioSetterBar } from "./setter-bar-box.ts";

/**
 * `<setter-box name="k" values="3">` -- Wolfram's `SetterBox`: one button, down when the variable
 * holds its entry. A bar of them is a `<setter-bar-box>`; this is a bar of one.
 */
export class NotatioSetterBox extends NotatioSetterBar {}

defineControl("setter-box", NotatioSetterBox);
