// The contract every control keeps -- a knob in a sentence, a slider in a Manipulate
// strip, a bar of togglers, a menu -- so that a scope (`<notatio-tangle>`,
// `<notatio-manipulate>`) can bind any of them without knowing which it has.
//
// A control has a `name`, publishes a MathJSON `binding` (a number, `True`, a `List`, an
// expression) and dispatches `notatio-control-change` when it moves. Its tag is in
// `CONTROL_TAGS`, which is how a scope finds the controls it owns.

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

/** What a scope reads off a control element. */
export interface ControlElement extends HTMLElement {
  name: string;
  /** The bound value as MathJSON. */
  readonly binding: MathJsonExpression;
}

/** Every registered control tag, for a scope's `querySelectorAll`. */
export const CONTROL_TAGS = new Set<string>();

/** Define a control's custom element and record its tag. Idempotent. */
export function defineControl(tag: string, ctor: CustomElementConstructor): void {
  CONTROL_TAGS.add(tag);
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/** The selector that finds every control under an element. */
export const controlSelector = (): string => [...CONTROL_TAGS].join(", ");

/** MathJSON for a real or complex number. */
export function numberJson(re: number, im = 0): MathJsonExpression {
  return im === 0 ? re : (["Complex", re, im] as MathJsonExpression);
}

/** Dispatch a change from `el`, filling the numeric shorthand from the value when it is one. */
export function emitControl(
  el: HTMLElement,
  detail: Omit<ControlChange, "re" | "im"> & { re?: number; im?: number },
): void {
  const { value } = detail;
  let re = detail.re ?? 0;
  let im = detail.im ?? 0;
  if (detail.re === undefined) {
    if (typeof value === "number") re = value;
    else if (Array.isArray(value) && value[0] === "Complex") {
      re = Number(value[1]);
      im = Number(value[2]);
    }
  }
  el.dispatchEvent(
    new CustomEvent<ControlChange>(CONTROL_EVENT, {
      bubbles: true,
      composed: true,
      detail: { ...detail, value, re, im },
    }),
  );
}
