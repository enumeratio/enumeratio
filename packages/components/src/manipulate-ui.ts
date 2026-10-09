// The shared control panel for Manipulate parameters, used by the plot elements and
// `<notatio-manipulate>`: one control per parameter, drawn by the control components
// (a slider, a bar, a menu, ...) and chosen the way Wolfram's Manipulate chooses --
// a range is a slider, a short list a setter bar, a long one a popup menu -- unless the
// parameter names its `ControlType`. Pure view: the host owns the state and the
// animation timer and passes handlers in.

import { html, type TemplateResult } from "lit";
import "./animator-box.ts";
import "./input-field-box.ts";
import "./notatio-knob.ts";
import "./notatio-list-picker.ts";
import "./popup-menu-box.ts";
import "./notatio-radio-button-bar.ts";
import "./setter-box.ts";
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
      return "notatio-knob";
    case "SetterBar":
      return "setter-box";
    case "RadioButtonBar":
      return "notatio-radio-button-bar";
    case "PopupMenu":
      return "popup-menu-box";
    case "Toggler":
      return "toggler-box";
    case "ListPicker":
      return "notatio-list-picker";
    case "InputField":
      return "input-field-box";
    case "Slider":
      return "slider-box";
    default:
      return c.kind === "slider" ? "slider-box" : c.choices.length <= BAR_LIMIT ? "setter-box" : "popup-menu-box";
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
    h.set(e.detail.name, String(e.detail.re));
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
            ><span class="notatio-control-name">${c.name}</span>${choiceControl(c)}</label
          >`,
    )}${fps ? html`<span class="notatio-control-fps">${fps} fps</span>` : null}
  </div>`;
}

/** A range parameter as its control; the live value is pushed in as a property. */
function sliderControl(c: Extract<Control, { kind: "slider" }>): TemplateResult {
  const value = String(c.value);
  switch (tagFor(c)) {
    case "notatio-knob":
      return html`<notatio-knob
        name=${c.name}
        .value=${value}
        min=${c.min}
        max=${c.max}
        step=${c.step}
      ></notatio-knob>`;
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

/** A list parameter as its control: a bar for a few entries, a menu for many. */
function choiceControl(c: Extract<Control, { kind: "choice" }>): TemplateResult {
  const values = c.choices.join("|");
  const value = String(c.value);
  switch (tagFor(c)) {
    case "notatio-radio-button-bar":
      return html`<notatio-radio-button-bar
        name=${c.name}
        values=${values}
        .value=${value}
      ></notatio-radio-button-bar>`;
    case "popup-menu-box":
      return html`<popup-menu-box name=${c.name} values=${values} .value=${value}></popup-menu-box>`;
    case "toggler-box":
      return html`<toggler-box name=${c.name} values=${values} .value=${value}></toggler-box>`;
    case "notatio-list-picker":
      return html`<notatio-list-picker name=${c.name} values=${values} .value=${value} single></notatio-list-picker>`;
    default:
      return html`<setter-box name=${c.name} values=${values} .value=${value}></setter-box>`;
  }
}
