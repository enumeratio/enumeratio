// Registering a control's tag and dispatching its change: the DOM half of the control
// contract, whose shape is the base package's `controls.ts`.

import {
  CONTROL_EVENT,
  type BoundControl,
  type ControlChange,
  numericParts,
} from "@enumeratio/notatio";

/** What a scope reads off a control element. */
export interface ControlElement extends HTMLElement, BoundControl {}

/** Every registered control tag, for a scope's `querySelectorAll`. */
export const CONTROL_TAGS = new Set<string>();

/** Define a control's custom element and record its tag. Idempotent. */
export function defineControl(tag: string, ctor: CustomElementConstructor): void {
  CONTROL_TAGS.add(tag);
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

/** The selector that finds every control under an element. */
export const controlSelector = (): string => [...CONTROL_TAGS].join(", ");

/** Dispatch a change from `el`, filling the numeric shorthand from the value when it is one. */
export function emitControl(
  el: HTMLElement,
  detail: Omit<ControlChange, "re" | "im"> & { re?: number; im?: number },
): void {
  const { value } = detail;
  el.dispatchEvent(
    new CustomEvent<ControlChange>(CONTROL_EVENT, {
      bubbles: true,
      composed: true,
      detail: { ...detail, value, ...numericParts(value, detail.re, detail.im) },
    }),
  );
}
