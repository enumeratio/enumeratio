// The arithmetic of playback: how an iteration through a span treats its ends (the
// `loop`), how far a continuous sweep moves in a frame, how a sweep is paced. Pure, and
// shared by every control that plays; the frame loops that drive it live with the
// components (`notatio-lit/src/sweep.ts`).

/** A whole sweep in about this long, whatever the step count... */
export const SWEEP_MS = 4000;
/** ...but never faster than a reader can see a value change, or slower than a clock. */
export const MIN_TICK_MS = 60;
export const MAX_TICK_MS = 1000;

/** Milliseconds per step so that `steps` of them take about one sweep. */
export function sweepInterval(steps: number): number {
  if (!(steps > 0)) return MAX_TICK_MS;
  return Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, SWEEP_MS / steps));
}

/**
 * How an iteration through a span treats its ends -- the `loop` attribute: `cycle`
 * wraps, `reflect` turns round, `none` stops there. Wolfram's `AnimationDirection` and
 * `AnimationRepetitions` in one word, since the same word has to serve a click on a
 * toggler as well.
 */
export type Loop = "cycle" | "reflect" | "none";
export const LOOPS: readonly Loop[] = ["cycle", "reflect", "none"];

export type Direction = 1 | -1;

/** The rates the speed menu offers, as multipliers on a control's interval. */
export const RATES: readonly number[] = [0.25, 0.5, 1, 2, 4];

export interface Span {
  min: number;
  max: number;
  step: number;
}

export interface Iterated {
  value: number;
  direction: Direction;
  /** The iteration has reached an end it does not pass: a `once` is over. */
  done: boolean;
}

/** Kill the binary noise a stepped add leaves behind (0.1 thirty times is 3.0000000000000004). */
const clean = (v: number): number => (v === 0 ? 0 : Number(v.toPrecision(12)));

/**
 * Move `steps` places through a span the way its loop says.
 *
 * With a `direction` the move is IMPLICIT -- a click on a toggler, a tick of playback
 * -- and the loop owns the ends: `cycle` wraps, `reflect` turns the direction round,
 * `none` stops. Without one the move is EXPLICIT -- an arrow key -- and only `cycle`
 * wraps; the other two clamp, since pressing the other arrow *is* the reflection and
 * an arrow past the end of a play-through has nowhere it could honestly go.
 *
 * `steps` is a count of `span.step`s, signed for an explicit move; an implicit one
 * takes its sign from the direction.
 */
export function iterate(
  value: number,
  steps: number,
  span: Span,
  loop: Loop,
  direction?: Direction,
): Iterated {
  const { min, max, step } = span;
  // The last grid point at or under the max: a span that is not a whole number of
  // steps ends on the grid, not past it.
  const count = Math.max(0, Math.floor((max - min) / step + 1e-9));
  const at = (i: number): number => clean(min + i * step);
  let i = Math.round((value - min) / step);
  const n = count + 1;
  if (n <= 1 || steps === 0) return { value, direction: direction ?? 1, done: loop === "none" };

  if (direction === undefined) {
    const to = i + steps;
    if (loop === "cycle") return { value: at(((to % n) + n) % n), direction: 1, done: false };
    const clamped = Math.max(0, Math.min(count, to));
    return { value: at(clamped), direction: 1, done: loop === "none" && clamped !== to };
  }

  let dir = direction;
  for (let k = 0; k < Math.abs(steps); k++) {
    const to = i + dir;
    if (to >= 0 && to <= count) {
      i = to;
      continue;
    }
    if (loop === "cycle") i = ((to % n) + n) % n;
    else if (loop === "reflect") {
      dir = -dir as Direction;
      i = Math.max(0, Math.min(count, i + dir));
    } else return { value: at(i), direction: dir, done: true };
  }
  return { value: at(i), direction: dir, done: false };
}

/**
 * The continuous counterpart of `iterate`, for a slider that interpolates between
 * steps while it plays (see Manipulate's `advancePhase`): advance `phase` by `dt`
 * milliseconds at one step per `interval`, and treat the ends the way the loop says.
 * The overshoot past an end is carried round (loop) or folded back (reflect), so a
 * frame that lands past the end does not stall there.
 */
export function advancePlayback(
  phase: number,
  span: Span,
  dt: number,
  interval: number,
  loop: Loop,
  direction: Direction,
): { phase: number; direction: Direction; done: boolean } {
  const { min, max, step } = span;
  const width = max - min;
  if (!(width > 0) || !(dt > 0)) return { phase, direction, done: false };
  const next = phase + (direction * (Math.abs(step) * dt)) / interval;
  const eps = Math.abs(step) * 1e-9;
  if (next >= min - eps && next <= max + eps) return { phase: next, direction, done: false };
  if (loop === "none") return { phase: direction > 0 ? max : min, direction, done: true };
  if (loop === "cycle") {
    return { phase: min + ((((next - min) % width) + width) % width), direction, done: false };
  }
  // Reflect: unfold the travel onto a line of period 2w that runs up the span and back
  // down it, take it modulo that period, and read the position and the heading off.
  const t = direction > 0 ? next - min : width + (max - next);
  const m = ((t % (2 * width)) + 2 * width) % (2 * width);
  return m <= width
    ? { phase: min + m, direction: 1, done: false }
    : { phase: max - (m - width), direction: -1, done: false };
}

/** Where a `loop="none"` playback begins from `value`: the far end, if it is already at the near one. */
export function rewindFor(value: number, span: Span, loop: Loop, direction: Direction): number {
  if (loop !== "none") return value;
  const end = direction > 0 ? span.max : span.min;
  return Math.abs(value - end) < Math.abs(span.step) / 2
    ? direction > 0
      ? span.min
      : span.max
    : value;
}
