// The scrub arithmetic behind the Tangle-style inline controls (Bret Victor's Tangle:
// a number you drag inside a sentence, with the prose around it re-deriving itself).
//
// Everything here is pure, so the interesting decisions -- how far a pixel moves a
// value, what a value looks like once it stops being editable text -- are testable
// without a browser. The DOM, the pointer capture and the typesetting live in
// `notatio-knob.ts`.

import { clamp, formatValue } from "./manipulate.ts";

/** How far the pointer travels for one step. Tangle's own feel is a few pixels. */
export const DEFAULT_PIXELS_PER_STEP = 8;

export interface ScrubRange {
  min: number;
  max: number;
  step: number;
}

/**
 * The GEAR a gesture is in. Every way of moving a control -- a drag, an arrow key, a
 * held arrow key -- goes through one of three: `normal` moves by the author's `step`,
 * `coarse` by ten of them, `fine` by a tenth. Shift and PageUp/PageDown reach coarse,
 * Alt reaches fine, and a drag that wanders off its own axis climbs the ladder (up is
 * coarse, down is fine). One concept, so what you learn at the keyboard holds under
 * the pointer and on a phone.
 */
export type Gear = "fine" | "normal" | "coarse";

export const GEAR_FACTOR: Record<Gear, number> = { fine: 0.1, normal: 1, coarse: 10 };

/** The gear the modifier keys on an event ask for, if any. Shift wins over Alt. */
export function modifierGear(event: { shiftKey: boolean; altKey: boolean }): Gear | undefined {
  if (event.shiftKey) return "coarse";
  if (event.altKey) return "fine";
  return undefined;
}

/** How far off its axis a drag has to wander before it changes gear. */
export const LADDER_BAND_PX = 40;

/**
 * The gear a drag's off-axis travel selects. Positive is UP the ladder (screen-up for a
 * horizontal knob), so up is coarse and down is fine -- the same order Houdini's value
 * ladder and every log axis put their magnitudes in.
 */
export function ladderGear(offAxisPx: number, band: number = LADDER_BAND_PX): Gear {
  if (offAxisPx >= band) return "coarse";
  if (offAxisPx <= -band) return "fine";
  return "normal";
}

/** What a gear does to a scrub: the quantum it lands on and the travel one quantum costs. */
export interface Gearing {
  step: number;
  pixelsPerStep: number;
}

/**
 * Put a step and a sensitivity into gear.
 *
 * A real knob in fine gear lands on tenths of its step and each costs the same travel;
 * an integer knob cannot -- there is nothing between 3 and 4 -- so its fine gear keeps
 * the quantum at one and asks ten times the travel for it instead. Either way the
 * value per pixel is a tenth of normal, which is the property "fine" names.
 */
export function gearing(step: number, pixelsPerStep: number, gear: Gear, integer: boolean): Gearing {
  const factor = GEAR_FACTOR[gear];
  const per = Math.abs(pixelsPerStep) || DEFAULT_PIXELS_PER_STEP;
  const geared = clean(step * factor);
  if (!integer) return { step: geared, pixelsPerStep: per };
  // Never finer than the author's own step: a knob over even numbers stays even.
  const quantum = Math.max(step, Math.round(geared));
  return { step: quantum, pixelsPerStep: clean((quantum * per) / (step * factor)) };
}

/**
 * Steps per press for an arrow key held down `repeats` autorepeats deep. Ramps 1, 2, 5,
 * 10 every ten repeats -- the 1-2-5 sequence, so the value never lurches -- and stops
 * at ten, which is one gear up. Holding longer than that is what Shift is for.
 */
export function holdMultiplier(repeats: number): number {
  const ramp = [1, 2, 5, 10];
  return ramp[Math.min(ramp.length - 1, Math.max(0, Math.floor(repeats / 10)))];
}

/**
 * Kill the binary noise a stepped add leaves behind: 0.1 added thirty times is
 * 3.0000000000000004, and a scrubber shows every digit of it.
 */
const clean = (v: number): number => (v === 0 ? 0 : Number(v.toPrecision(12)));

/**
 * The value a drag of `deltaPx` from `start` lands on.
 *
 * POSITION-based, not rate-based: the value is a function of where the pointer *is*,
 * so letting go and dragging back returns you to where you were. A rate-based scrub
 * (further left = falling faster) cannot be undone by reversing the gesture, which is
 * the property that makes a draggable number feel like a value rather than a throttle.
 * Right/up raises, left/down lowers.
 */
export function scrubValue(
  start: number,
  deltaPx: number,
  range: ScrubRange,
  pixelsPerStep: number = DEFAULT_PIXELS_PER_STEP,
): number {
  const per = Math.abs(pixelsPerStep) || DEFAULT_PIXELS_PER_STEP;
  const steps = Math.round(deltaPx / per);
  return clean(clamp(start + steps * range.step, range.min, range.max));
}

/** The same drag over a discrete list: an index, clamped to the ends rather than wrapped. */
export function scrubIndex(
  start: number,
  deltaPx: number,
  length: number,
  pixelsPerStep: number = DEFAULT_PIXELS_PER_STEP,
): number {
  if (length <= 0) return 0;
  const per = Math.abs(pixelsPerStep) || DEFAULT_PIXELS_PER_STEP;
  return clamp(Math.round(start + deltaPx / per), 0, length - 1);
}

/** Step `index` by `delta` places, wrapping — what clicking a toggler does. */
export function cycleIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

/**
 * A scrubbed number as LaTeX.
 *
 * The place count comes from the step and never from the value, so the readout keeps a
 * fixed width while it is being dragged. A number that reflows the sentence on every
 * frame is unreadable, and reading it is the whole point.
 */
export const numberLatex = (v: number, step: number): string => formatValue(v, displayStep(v, step));

/**
 * The step whose places a value should be printed to: the knob's own, or a tenth of it
 * once a fine drag or a typed value has left the value OFF the step's grid. Printing
 * 3.05 as "3.1" on a half-step knob would be a readout lying about where it is.
 */
export function displayStep(v: number, step: number): number {
  if (!Number.isFinite(step) || step === 0) return step;
  const ratio = v / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9 ? step : step / 10;
}

/**
 * A scrubbed complex number as LaTeX, both parts always shown. `3 + 0.0i` rather than
 * `3` for the same reason: the imaginary axis is still draggable when it reads zero,
 * and an affordance that vanishes at zero is one the reader cannot find again.
 */
export function complexLatex(re: number, im: number, step: number): string {
  const sign = im < 0 || Object.is(im, -0) ? "-" : "+";
  // Both parts share one place count, so a fine drag on one axis widens the other too
  // and the two stay aligned.
  const shown = Math.min(displayStep(re, step), displayStep(im, step));
  return `${formatValue(re, shown)} ${sign} ${formatValue(Math.abs(im), shown)}i`;
}

/** Split a `|`-separated author list. Commas belong to the prose, so `|` is the separator. */
export function parseEntries(raw: string): string[] {
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * One entry of a choice list: what it binds and what it shows. Wolfram's `v -> label`
 * form gives the two separately; a bare entry is both.
 */
export interface Choice {
  value: string;
  label: string;
}

/** Parse `a|b -> B|c`: entries split on `|`, an arrow inside one splits value from label. */
export function parseChoices(raw: string): Choice[] {
  return parseEntries(raw).map((entry) => {
    const arrow = entry.indexOf("->");
    if (arrow < 0) return { value: entry, label: entry };
    return { value: entry.slice(0, arrow).trim(), label: entry.slice(arrow + 2).trim() };
  });
}

/**
 * What a choice binds, as MathJSON: a number when it is one; a quoted value as that
 * string (a Toggler written as an expression over strings); `True`/`False` and any
 * labelled value as the symbol it names (the author separated a value from its label
 * precisely to bind the value); a bare word as its index, which is the only thing a
 * word in prose can contribute to an expression.
 */
export function choiceBinding(choice: Choice | undefined, index: number): number | string | { str: string } {
  if (choice === undefined) return index;
  const quoted = /^"(.*)"$/.exec(choice.value);
  if (quoted) return { str: quoted[1]! };
  const numeric = Number(choice.value);
  if (choice.value !== "" && Number.isFinite(numeric)) return numeric;
  if (choice.value === "True" || choice.value === "False") return choice.value;
  if (choice.value !== choice.label && /^[A-Za-z_][\w]*$/.test(choice.value)) return choice.value;
  return index;
}

/** A `re + im i` pair read from an author's `value`: `2`, `-1.5`, `3+2i`, `-i`. */
export function parseComplex(raw: string): { re: number; im: number } | undefined {
  const text = raw.replace(/[\s_]/g, "");
  if (!text) return undefined;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)?)(?:([+-](?:\d+\.?\d*|\.\d+)?)i)?$/.exec(text);
  // A bare imaginary (`2i`, `-i`) has no real part to match above; take it separately.
  if (m === null) {
    const bare = /^([+-]?(?:\d+\.?\d*|\.\d+)?)i$/.exec(text);
    if (bare === null) return undefined;
    return { re: 0, im: signedNumber(bare[1]) };
  }
  if (m[1] === "" && m[2] === undefined) return undefined;
  return { re: m[1] === "" ? 0 : Number(m[1]), im: m[2] === undefined ? 0 : signedNumber(m[2]) };
}

/** `+` / `-` / `` with no digits mean ±1 — the coefficient `i` carries on its own. */
function signedNumber(text: string): number {
  if (text === "" || text === "+") return 1;
  if (text === "-") return -1;
  return Number(text);
}

/**
 * Should this entry be typeset, or set as prose?
 *
 * A scrubbable list holds either values (`2`, `Sin(x)`, `\pi`) or words ("a few",
 * "several"). Running the words through the math typesetter would italicise them and
 * space them as a product of variables, so anything without a digit, an operator or a
 * LaTeX command is left as plain text.
 */
export function looksLikeMath(entry: string): boolean {
  return /[\d\\^_{}+\-*/=<>()]/.test(entry);
}

/**
 * Does a knob step by whole numbers?
 *
 * An explicit positive `step` settles it. With none, the answer comes from HOW THE
 * VALUE WAS WRITTEN: `4` is a count and steps by one, `4.0` is a measurement and does
 * not. The distinction is real and it is the author's — a ground-set size, a
 * permutation index and a number of cookies are all written without a point precisely
 * because there is nothing between their values, and a knob that says 4 and lands on
 * 4.05 when you nudge it is reporting a quantity nobody meant it to have.
 */
export function isIntegerKnob(raw: string, step: number | undefined): boolean {
  if (step !== undefined && Number.isFinite(step) && step > 0) return Number.isInteger(step);
  if (raw.includes(".")) return false;
  const parsed = parseComplex(raw);
  return parsed !== undefined && Number.isInteger(parsed.re) && Number.isInteger(parsed.im);
}

/**
 * The number a discrete control binds: the ENTRY when the entry is a number — so
 * `choices="2|3|5|7"` binds 5, not 2 — and otherwise its index, which is the only
 * thing a word can contribute to an expression.
 */
export function boundEntry(entry: string | undefined, index: number): number {
  const numeric = entry === undefined ? Number.NaN : Number(entry);
  return entry !== undefined && entry !== "" && Number.isFinite(numeric) ? numeric : index;
}
