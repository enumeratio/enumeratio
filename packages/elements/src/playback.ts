// Playback for an inline control: a frame loop that fires `tick` once per interval
// and nothing in between. A knob in prose plays on its own grid -- one step, then the
// next -- because a readout that showed the values between steps would grow a place
// and jitter the sentence. (The Manipulate sliders interpolate; see `advancePhase`.)

import { LongPress } from "./popover.ts";

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

export class Playback {
  #frame: number | undefined;
  #last = 0;
  #owed = 0;

  constructor(
    private readonly tick: () => void,
    private readonly interval: () => number,
  ) {}

  get playing(): boolean {
    return this.#frame !== undefined;
  }

  start(): void {
    if (this.playing) return;
    this.#last = performance.now();
    this.#owed = 0;
    this.#frame = requestAnimationFrame(this.#step);
  }

  stop(): void {
    if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
    this.#frame = undefined;
  }

  toggle(): void {
    if (this.playing) this.stop();
    else this.start();
  }

  #step = (now: number): void => {
    // A backgrounded tab owes at most one tick on return, not the whole absence.
    this.#owed += Math.min(now - this.#last, 250);
    this.#last = now;
    const interval = this.interval();
    if (this.#owed >= interval) {
      this.#owed = Math.min(this.#owed - interval, interval);
      this.tick();
    }
    if (this.#frame !== undefined) this.#frame = requestAnimationFrame(this.#step);
  };
}

/** What a host with named sliders lends `SliderPlayback`: the spans, and a way in. */
export interface SliderHost {
  /** The span and current value of a named slider, or nothing if it is not one. */
  slider: (name: string) => (Span & { value: number }) | undefined;
  /** Apply a value to a slider. Quantised already; the host writes it where it keeps it. */
  set: (name: string, value: number) => void;
  /** The loop in force for this host's sliders. */
  loop: () => Loop;
  /** The panel changed the loop: keep it (an attribute, usually). */
  setLoop: (loop: Loop) => void;
  /** Milliseconds per step at rate 1. */
  interval: number;
  /**
   * `continuous` moves through the values between steps -- a target that redraws
   * within a frame looks smooth that way; `grid` lands on one step per interval, for a
   * target whose redraw is worth rationing.
   */
  motion: "continuous" | "grid";
  /** Something moved: re-render. */
  update: () => void;
}

/**
 * Playback for a panel of sliders -- Manipulate's, a plot's, a worksheet's -- with one
 * frame loop for all of them and, per slider, a direction, a rate and the long press
 * that opens its speed-and-loop panel. The host keeps the values; this keeps the
 * motion, so four elements with a play button share one idea of what playing is.
 */
export class SliderPlayback {
  readonly playing = new Set<string>();
  #phase = new Map<string, number>();
  #owed = new Map<string, number>();
  #direction = new Map<string, Direction>();
  #rate = new Map<string, number>();
  #press = new Map<string, LongPress>();
  #frame: number | undefined;
  #tickAt = 0;

  constructor(
    private readonly host: SliderHost,
    private readonly openMenu: (options: {
      anchor: HTMLElement;
      settings: { rate: number; loop: Loop };
      onChange: (settings: { rate: number; loop: Loop }) => void;
    }) => unknown,
    private readonly longPressMs: number,
  ) {}

  has(name: string): boolean {
    return this.playing.has(name);
  }

  rate(name: string): number {
    return this.#rate.get(name) ?? 1;
  }

  /** Start or stop one slider. A `none` that already ran to its end starts over. */
  toggle = (name: string): void => {
    if (this.playing.has(name)) {
      this.stop(name);
    } else {
      const c = this.host.slider(name);
      if (c === undefined) return;
      let from = c.value;
      const dir = this.#direction.get(name) ?? 1;
      const rewound = rewindFor(c.value, c, this.host.loop(), dir);
      if (rewound !== from) {
        from = rewound;
        this.host.set(name, from);
      }
      this.playing.add(name);
      this.#phase.set(name, from);
      this.#owed.set(name, 0);
      this.#run();
    }
    this.host.update();
  };

  stop(name?: string): void {
    if (name === undefined) {
      this.playing.clear();
      this.#phase.clear();
    } else {
      this.playing.delete(name);
      this.#phase.delete(name);
    }
    if (this.playing.size === 0 && this.#frame !== undefined) {
      cancelAnimationFrame(this.#frame);
      this.#frame = undefined;
    }
  }

  /** The long press on a slider's play button, made on demand and kept. */
  press = (name: string): LongPress => {
    let press = this.#press.get(name);
    if (press === undefined) {
      press = new LongPress(this.longPressMs, (anchor) => {
        if (this.playing.has(name)) this.toggle(name);
        this.openMenu({
          anchor,
          settings: { rate: this.rate(name), loop: this.host.loop() },
          onChange: ({ rate, loop }) => {
            this.#rate.set(name, rate);
            this.host.setLoop(loop);
          },
        });
      });
      this.#press.set(name, press);
    }
    return press;
  };

  #run(): void {
    if (this.#frame !== undefined) return;
    this.#tickAt = performance.now();
    this.#frame = requestAnimationFrame(this.#tick);
  }

  #tick = (now: number): void => {
    this.#frame = undefined;
    const dt = Math.min(now - this.#tickAt, 250); // a backgrounded tab must not leap
    this.#tickAt = now;
    const loop = this.host.loop();
    for (const name of this.playing) {
      const c = this.host.slider(name);
      if (c === undefined) {
        this.stop(name);
        continue;
      }
      const interval = this.host.interval / this.rate(name);
      const direction = this.#direction.get(name) ?? 1;
      if (this.host.motion === "continuous") {
        const next = advancePlayback(
          this.#phase.get(name) ?? c.value,
          c,
          dt,
          interval,
          loop,
          direction,
        );
        this.#phase.set(name, next.phase);
        this.#direction.set(name, next.direction);
        this.host.set(name, quantizeOnGrid(next.phase, c.step));
        if (next.done) this.stop(name);
      } else {
        const owed = (this.#owed.get(name) ?? 0) + dt;
        if (owed < interval) {
          this.#owed.set(name, owed);
          continue;
        }
        this.#owed.set(name, Math.min(owed - interval, interval));
        const next = iterate(c.value, 1, c, loop, direction);
        this.#direction.set(name, next.direction);
        this.host.set(name, next.value);
        if (next.done) this.stop(name);
      }
    }
    if (this.playing.size > 0) this.#frame = requestAnimationFrame(this.#tick);
    this.host.update();
  };
}

/** A continuous phase as published: on the grid for a whole-number step, as is otherwise. */
function quantizeOnGrid(phase: number, step: number): number {
  if (!(Number.isInteger(step) && Math.abs(step) >= 1)) return phase;
  return Math.round(phase / step) * step;
}
