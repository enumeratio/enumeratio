// The shared control panel for Manipulate parameters, used by the plot elements and
// `<notatio-manipulate>`: one control per parameter, drawn by the control components
// (a slider, a bar, a menu, ...) and chosen the way Wolfram's Manipulate chooses --
// a range is a slider, a short list a setter bar, a long one a popup menu -- unless the
// parameter names its `ControlType`. Pure view: the host owns the state and the
// animation timer and passes handlers in.

import { html, type TemplateResult } from "lit";
import "./notatio-animator.ts";
import "./notatio-input-field.ts";
import "./notatio-knob.ts";
import "./notatio-list-picker.ts";
import "./notatio-popup-menu.ts";
import "./notatio-radio-button-bar.ts";
import "./notatio-setter-bar.ts";
import "./notatio-slider.ts";
import "./notatio-toggler.ts";
import "./notatio-vertical-slider.ts";
import type { LongPress } from "./popover.ts";
import { type Control, type ControlChange, formatValue } from "@enumeratio/notatio";

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
      return "notatio-vertical-slider";
    case "Animator":
      return "notatio-animator";
    case "Knob":
      return "notatio-knob";
    case "SetterBar":
      return "notatio-setter-bar";
    case "RadioButtonBar":
      return "notatio-radio-button-bar";
    case "PopupMenu":
      return "notatio-popup-menu";
    case "Toggler":
      return "notatio-toggler";
    case "ListPicker":
      return "notatio-list-picker";
    case "InputField":
      return "notatio-input-field";
    case "Slider":
      return "notatio-slider";
    default:
      return c.kind === "slider"
        ? "notatio-slider"
        : c.choices.length <= BAR_LIMIT
          ? "notatio-setter-bar"
          : "notatio-popup-menu";
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
  return html`<div
    class="notatio-controls"
    role="group"
    aria-label="parameters"
    @notatio-control-change=${onChange}
  >
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
            ><span class="notatio-control-name">${c.name}</span>${sliderControl(c)}<span
              class="notatio-control-val"
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
    case "notatio-input-field":
      return html`<notatio-input-field
        name=${c.name}
        .value=${value}
        type="number"
      ></notatio-input-field>`;
    case "notatio-vertical-slider":
      return html`<notatio-vertical-slider
        name=${c.name}
        .value=${value}
        min=${c.min}
        max=${c.max}
        step=${c.step}
      ></notatio-vertical-slider>`;
    case "notatio-animator":
      return html`<notatio-animator
        name=${c.name}
        .value=${value}
        min=${c.min}
        max=${c.max}
        step=${c.step}
        .readout=${false}
      ></notatio-animator>`;
    default:
      return html`<notatio-slider
        name=${c.name}
        .value=${value}
        min=${c.min}
        max=${c.max}
        step=${c.step}
      ></notatio-slider>`;
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
    case "notatio-popup-menu":
      return html`<notatio-popup-menu
        name=${c.name}
        values=${values}
        .value=${value}
      ></notatio-popup-menu>`;
    case "notatio-toggler":
      return html`<notatio-toggler
        name=${c.name}
        values=${values}
        .value=${value}
      ></notatio-toggler>`;
    case "notatio-list-picker":
      return html`<notatio-list-picker
        name=${c.name}
        values=${values}
        .value=${value}
        single
      ></notatio-list-picker>`;
    default:
      return html`<notatio-setter-bar
        name=${c.name}
        values=${values}
        .value=${value}
      ></notatio-setter-bar>`;
  }
}
