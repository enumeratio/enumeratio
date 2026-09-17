// Manipulate-style parameter controls (Wolfram's Manipulate). A pure parser
// turns a control spec -- Wolfram's own `{u, min, max}` tuple syntax -- into
// typed control descriptors with live values; the plot elements render a slider
// (or a choice setter) per control and re-sample the expression as they move.
// Kept dependency-free and unit-tested; the elements do the compute-engine
// substitution and the DOM.

/**
 * Which control draws a parameter, when the author names one -- Wolfram's `ControlType`
 * -- as a trailing symbol in the tuple: `{k, 0, 1, 0.1, VerticalSlider}`,
 * `{k, {1, 2, 3}, PopupMenu}`. Otherwise the kind of range picks, as Manipulate does.
 */
export type ControlType =
  | "Slider"
  | "VerticalSlider"
  | "Animator"
  | "Knob"
  | "SetterBar"
  | "RadioButtonBar"
  | "PopupMenu"
  | "Toggler"
  | "ListPicker"
  | "InputField";

export const CONTROL_TYPES: readonly ControlType[] = [
  "Slider",
  "VerticalSlider",
  "Animator",
  "Knob",
  "SetterBar",
  "RadioButtonBar",
  "PopupMenu",
  "Toggler",
  "ListPicker",
  "InputField",
];

export interface SliderControl {
  kind: "slider";
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  control?: ControlType;
}

export interface ChoiceControl {
  kind: "choice";
  name: string;
  value: number;
  choices: number[];
  control?: ControlType;
}

export type Control = SliderControl | ChoiceControl;

/** Split `s` on top-level `sep`, ignoring separators nested inside `{ }`. */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === sep && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((t) => t.trim()).filter((t) => t.length > 0);
}

const num = (s: string): number => Number(s.trim());

/**
 * Read a number from an attribute that may have been written by Manipulate. Notatio
 * serializes with digit separators (`-2.119_744`), which `Number()` rejects outright —
 * so any element reading a substituted numeric attribute has to strip them first, or
 * silently take its fallback instead of the value the slider is showing.
 */
export function parseNumeric(text: string): number {
  return Number(text.replace(/_/g, "").trim());
}

/** Clamp `v` into `[min, max]` (order-agnostic). */
export function clamp(v: number, min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.max(lo, Math.min(hi, v));
}

/**
 * A control value as shown to a reader: enough places to resolve the step, no more.
 * Eased values land between grid points, so this is display-only — the value itself
 * keeps its full precision.
 */
export function formatValue(v: number, step: number): string {
  const places = Math.min(6, Math.max(0, Math.ceil(-Math.log10(Math.abs(step) || 1))));
  return v.toFixed(places);
}

/**
 * Is this axis discrete — a whole-number step, like an order or a count? Those must
 * stay on their grid even mid-animation; a continuous axis is free to land between
 * steps, which is what makes playback smooth rather than stepped.
 */
export const isDiscrete = (step: number): boolean => Number.isInteger(step) && Math.abs(step) >= 1;

/**
 * Advance playback's continuous position by `dt` milliseconds, covering one `step` per
 * `interval` and wrapping back to the min at the top (Manipulate's looping animation).
 *
 * This is deliberately *unquantised*, and the caller keeps it rather than the displayed
 * value: rounding a discrete axis back onto its grid every frame would throw away the
 * fraction of a step each frame contributes, and at a high refresh rate the axis would
 * never advance at all. Quantise on the way out, with `quantizeValue`.
 */
export function advancePhase(
  phase: number,
  c: SliderControl,
  dt: number,
  interval: number,
): number {
  const span = c.max - c.min;
  if (!(span > 0) || !(dt > 0)) return phase;
  const next = phase + (c.step * dt) / interval;
  return next > c.max + Math.abs(c.step) * 1e-9 ? c.min : next;
}

/**
 * The value to publish for a playback position: snapped to the step grid on a discrete
 * axis, left alone on a continuous one — where landing between steps is the point.
 */
export function quantizeValue(phase: number, step: number): number {
  if (!isDiscrete(step)) return phase;
  return Math.round(phase / step) * step;
}

/**
 * The next value when animating a slider: advance by one step, wrapping back to
 * the min once past the max (Manipulate's default looping animation). Rounds to
 * the step grid so the value stays clean.
 */
export function stepValue(c: SliderControl): number {
  const next = c.value + c.step;
  if (next > c.max + c.step * 1e-9) return c.min;
  // Snapping to the grid still lands on binary noise (0.05 * 34 is 1.7000000000000002),
  // which a slider readout and a substituted expression both show verbatim.
  return Number((Math.round(next / c.step) * c.step).toPrecision(12));
}

/** A round-ish default step: ~100 notches across the range (Manipulate-ish). */
export function defaultStep(min: number, max: number): number {
  const span = Math.abs(max - min);
  if (!(span > 0)) return 1;
  const raw = span / 100;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

/** Does the leading `{` of `s` close only at its very end — i.e. wrap the whole of it? */
function wrapsWhole(s: string): boolean {
  if (!s.startsWith("{") || !s.endsWith("}")) return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i === s.length - 1;
  }
  return false;
}

/**
 * Split a spec into its individual control tuples. Wolfram separates them with `;`,
 * but `,` between tuples is the natural thing to write and used to parse as a single
 * mangled control rather than failing, so both are accepted: a `;` chunk that is not
 * itself one whole tuple is re-split on its top-level commas.
 */
function splitControls(spec: string): string[] {
  const out: string[] = [];
  for (const chunk of splitTop(spec, ";")) {
    if (wrapsWhole(chunk) || !chunk.includes("{")) out.push(chunk);
    else out.push(...splitTop(chunk, ","));
  }
  return out;
}

/**
 * Parse a Manipulate control spec into typed controls. Each control is a
 * Wolfram tuple, controls separated by `;` (or `,`):
 *   `{a, 0, 5}`            slider a in [0,5], starts at min (Manipulate default)
 *   `{a, 0, 5, 0.5}`       + explicit step
 *   `{{a, 2}, 0, 5}`       + explicit initial value
 *   `{k, {2, 3, 5, 7}}`    a choice setter over a discrete list
 * Malformed controls are skipped rather than throwing.
 */
export function parseControls(spec: string): Control[] {
  if (!spec || !spec.trim()) return [];
  const controls: Control[] = [];
  for (const raw of splitControls(spec.trim())) {
    const body = wrapsWhole(raw) ? raw.slice(1, -1) : raw;
    const fields = splitTop(body, ",");
    if (fields.length < 2) continue;

    // The variable spec is either `name` or `{name, init}`.
    let name = fields[0];
    let init: number | undefined;
    if (name.startsWith("{")) {
      const inner = splitTop(name.slice(1, -1), ",");
      name = inner[0];
      init = num(inner[1]);
    }
    name = name.trim();
    if (!name) continue;

    // A trailing control type names the control that draws the parameter.
    const last = fields[fields.length - 1].trim() as ControlType;
    const control = fields.length > 2 && CONTROL_TYPES.includes(last) ? last : undefined;
    if (control !== undefined) fields.pop();

    // `{name, {choices...}}` -> a discrete choice setter.
    if (fields.length === 2 && fields[1].startsWith("{")) {
      const choices = splitTop(fields[1].slice(1, -1), ",").map(num).filter(Number.isFinite);
      if (choices.length === 0) continue;
      const value = init !== undefined && choices.includes(init) ? init : choices[0];
      controls.push({ kind: "choice", name, value, choices, ...(control && { control }) });
      continue;
    }

    const min = num(fields[1]);
    const max = num(fields[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) continue;
    const step = fields[3] !== undefined ? num(fields[3]) : defaultStep(min, max);
    const value = clamp(init ?? min, min, max);
    controls.push({
      kind: "slider",
      name,
      value,
      min,
      max,
      step: step > 0 ? step : 1,
      ...(control && { control }),
    });
  }
  return controls;
}
