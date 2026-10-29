// The shared control panel for Manipulate parameters, used by the plot elements and
// `<notatio-manipulate>`: one control per parameter, drawn by the control components
// (a slider, a bar, a menu, ...) and chosen the way Wolfram's Manipulate chooses --
// a range is a slider, a short list a setter bar, a long one a popup menu -- unless the
// parameter names its `ControlType`. Pure view: the host owns the state and the
// animation timer and passes handlers in.

import { html, type TemplateResult } from "lit";
import "./animator-box.ts";
import "./checkbox-box.ts";
import "./input-field-box.ts";
import "./knob-box.ts";
import "./list-picker-box.ts";
import "./popup-menu-box.ts";
import "./radio-button-bar-box.ts";
import "./setter-bar-box.ts";
import "./slider-2d-box.ts";
import "./slider-box.ts";
import "./toggler-box.ts";
import type { LongPress } from "./popover.ts";
import { type Control, type ControlChange, formatValue } from "@enumeratio/frontend/core";

export interface ControlHandlers {
  /** Set a control's value from a raw input string. */
  set: (name: string, raw: string) => void;
  /** Start/stop animating a slider. */
  toggle: (name: string) => void;
  /**
   * The long press on a slider's play button that opens its speed-and-loop panel.
   * Optional: a host without one has a play button that only plays.
   */
  press?: (name: string) => LongPress | undefined;
}

/** How many choices a bar can show before a menu reads better -- Manipulate's own cut. */
const BAR_LIMIT = 5;

/** The tag that draws a control: the author's `ControlType`, else the range's default. */
export function tagFor(c: Control): string {
  switch (c.control) {
    case "VerticalSlider":
      return "slider-box";
    case "Animator":
      return "animator-box";
    case "Knob":
      return "knob-box";
    case "SetterBar":
      return "setter-bar-box";
    case "RadioButtonBar":
      return "radio-button-bar-box";
    case "PopupMenu":
      return "popup-menu-box";
    case "Toggler":
      return "toggler-box";
    case "ListPicker":
      return "list-picker-box";
    case "InputField":
      return "input-field-box";
    case "Slider":
      return "slider-box";
    case "Checkbox":
      return "checkbox-box";
    case "Slider2D":
      return "slider-2d-box";
    default:
      switch (c.kind) {
        case "slider":
          return "slider-box";
        case "toggle":
          return "checkbox-box";
        case "point":
          return "slider-2d-box";
        case "text":
          return "input-field-box";
        default:
          return c.choices.length <= BAR_LIMIT ? "setter-bar-box" : "popup-menu-box";
      }
  }
}

/** The raw string a control's change is handed to the host as: what `Control` reads back in. */
export function rawOf(c: Control, change: ControlChange): string {
  switch (c.kind) {
    case "toggle":
      return change.value === "True" ? "True" : "False";
    case "point":
      return `${change.re},${change.im}`;
    case "text":
      return typeof change.value === "string" ? change.value.replace(/^'(.*)'$/s, "$1") : JSON.stringify(change.value);
    default:
      return String(change.re);
  }
}

/**
 * Render the Manipulate controls; `playing` names the sliders now animating. `fps`,
 * when given, appends a frame-rate readout — the host passes it only while something
 * is actually moving, since an idle rate is meaningless.
 */
export function controlsTemplate(
  controls: readonly Control[],
  playing: ReadonlySet<string>,
  h: ControlHandlers,
  fps?: number,
): TemplateResult | null {
  if (controls.length === 0) return null;
  // The controls are the shared components; their changes arrive as one event, and
  // stop here so a host that also owns a prose panel does not hear them twice.
  const onChange = (e: CustomEvent<ControlChange>): void => {
    e.stopPropagation();
    const c = controls.find((k) => k.name === e.detail.name);
    h.set(e.detail.name, c === undefined ? String(e.detail.re) : rawOf(c, e.detail));
  };
  return html`<div class="notatio-controls" role="group" aria-label="parameters" @notatio-control-change=${onChange}>
    ${controls.map((c) =>
      c.kind === "slider"
        ? html`<label class="notatio-control"
            ><button
              type="button"
              class="notatio-play"
              aria-label=${playing.has(c.name) ? "pause" : "play"}
              title=${h.press ? "play; hold for speed and loop" : "play"}
              @pointerdown=${h.press?.(c.name)?.down}
              @pointerup=${h.press?.(c.name)?.up}
              @pointercancel=${h.press?.(c.name)?.cancel}
              @pointerleave=${h.press?.(c.name)?.cancel}
              @contextmenu=${h.press?.(c.name)?.contextmenu}
              @click=${(e: Event) => {
                if (!h.press?.(c.name)?.click(e)) h.toggle(c.name);
              }}
            >
              ${playing.has(c.name) ? "⏸" : "▶"}</button
            ><span class="notatio-control-name">${c.name}</span>${sliderControl(c)}<span class="notatio-control-val"
              >${formatValue(c.value, c.step)}</span
            ></label
          >`
        : html`<label class="notatio-control"
            ><span class="notatio-control-name">${c.name}</span>${valueControl(c)}</label
          >`,
    )}${fps ? html`<span class="notatio-control-fps">${fps} fps</span>` : null}
  </div>`;
}

/** A range parameter as its control; the live value is pushed in as a property. */
function sliderControl(c: Extract<Control, { kind: "slider" }>): TemplateResult {
  const value = String(c.value);
  switch (tagFor(c)) {
    case "knob-box":
      return html`<knob-box name=${c.name} .value=${value} min=${c.min} max=${c.max} step=${c.step}></knob-box>`;
    case "input-field-box":
      return html`<input-field-box name=${c.name} .value=${value} type="number"></input-field-box>`;
    case "animator-box":
      return html`<animator-box
        name=${c.name}
        .value=${value}
        min=${c.min}
        max=${c.max}
        step=${c.step}
        .readout=${false}
      ></animator-box>`;
    default:
      return html`<slider-box
        name=${c.name}
        axis=${c.control === "VerticalSlider" ? "y" : "x"}
        .value=${value}
        min=${c.min}
        max=${c.max}
        step=${c.step}
      ></slider-box>`;
  }
}

/** Any parameter but a range as its control. */
function valueControl(c: Exclude<Control, { kind: "slider" }>): TemplateResult {
  switch (c.kind) {
    case "toggle":
      return html`<checkbox-box name=${c.name} .value=${c.value ? "True" : "False"}></checkbox-box>`;
    case "point":
      return html`<slider-2d-box
        name=${c.name}
        complex
        .value=${`${c.value},${c.im}`}
        min="-2,-2"
        max="2,2"
        step="0.05"
        readout
      ></slider-2d-box>`;
    case "text":
      return html`<input-field-box name=${c.name} .value=${`'${c.value}'`}></input-field-box>`;
    default:
      return choiceControl(c);
  }
}

/** A list parameter as its control: a bar for a few entries, a menu for many. */
function choiceControl(c: Extract<Control, { kind: "choice" }>): TemplateResult {
  const values = c.choices.join("|");
  const value = String(c.value);
  switch (tagFor(c)) {
    case "radio-button-bar-box":
      return html`<radio-button-bar-box name=${c.name} values=${values} .value=${value}></radio-button-bar-box>`;
    case "popup-menu-box":
      return html`<popup-menu-box name=${c.name} values=${values} .value=${value}></popup-menu-box>`;
    case "toggler-box":
      return html`<toggler-box name=${c.name} values=${values} .value=${value}></toggler-box>`;
    case "list-picker-box":
      return html`<list-picker-box name=${c.name} values=${values} .value=${value} single></list-picker-box>`;
    default:
      return html`<setter-bar-box name=${c.name} values=${values} .value=${value}></setter-bar-box>`;
  }
}
