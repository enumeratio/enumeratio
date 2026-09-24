// The contract every control keeps -- a knob in a sentence, a slider in a Manipulate
// strip, a bar of togglers, a menu -- so that a scope (`<notatio-dynamic-module>`,
// `<notatio-manipulate>`) can bind any of them without knowing which it has.
//
// A control has a `name`, publishes a MathJSON `binding` (a number, `True`, a `List`, an
// expression) and dispatches `notatio-control-change` when it moves. This is the shape
// of that, with nothing of the DOM in it; registering a tag and dispatching the event
// are the components' (`notatio-lit/src/define.ts`).

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";

export const CONTROL_EVENT = "notatio-control-change";

/** What a control publishes when it moves. */
export interface ControlChange {
  name: string;
  /** The bound value, as MathJSON. */
  value: MathJsonExpression;
  /** The real part, when the value is a number -- what a template most often wants. */
  re: number;
  /** The imaginary part of a complex value, else 0. */
  im: number;
  /** The chosen index, for a control over a list of entries. */
  index?: number;
  /** True when playback moved it rather than the reader. */
  played?: boolean;
}

/** What a scope reads off a control: its name and its bound value. (`Control` is the Manipulate spec.) */
export interface BoundControl {
  name: string;
  /** The bound value as MathJSON. */
  readonly binding: MathJsonExpression;
}

/** MathJSON for a real or complex number. */
export function numberJson(re: number, im = 0): MathJsonExpression {
  return im === 0 ? re : (["Complex", re, im] as MathJsonExpression);
}

/** The numeric shorthand of a change, filled from the value when it is a number. */
export function numericParts(
  value: MathJsonExpression,
  re?: number,
  im?: number,
): { re: number; im: number } {
  if (re !== undefined) return { re, im: im ?? 0 };
  if (typeof value === "number") return { re: value, im: 0 };
  if (Array.isArray(value) && value[0] === "Complex") {
    return { re: Number(value[1]), im: Number(value[2]) };
  }
  return { re: 0, im: 0 };
}
