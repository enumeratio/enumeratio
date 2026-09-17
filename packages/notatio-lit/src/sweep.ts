// The frame loops behind everything that plays: one control's (`Playback`, `Sweep`),
// and a panel of sliders' (`SliderPlayback`). The arithmetic they step by is the base
// package's `playback.ts`; this is the part that owns a `requestAnimationFrame` and a
// long press.

import {
  advancePlayback,
  type Direction,
  iterate,
  type Loop,
  rewindFor,
  type Span,
} from "@enumeratio/notatio";
import { LongPress } from "./popover.ts";

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

/** What a single control lends `Sweep`: where its value is, and the settings the panel edits. */
export interface SweepHost {
  /** The value now, on the span (an index for a list). */
  at: () => number;
  /** Apply a value playback landed on. */
  set: (value: number) => void;
  span: () => Span;
  loop: () => Loop;
  setLoop: (loop: Loop) => void;
  rate: () => number;
  setRate: (rate: number) => void;
  /** Milliseconds per step at rate 1. */
  interval: () => number;
  /** Playing started or stopped: re-render. */
  onState: () => void;
}

/**
 * Playback for one control -- a knob, a slider, a toggler, a pinned input -- stepping on
 * the grid the way its loop says, at its rate, with the long press that opens the
 * speed-and-loop panel. `SliderPlayback` is the same thing for a panel of many.
 */
export class Sweep {
  #playing = false;
  #direction: Direction = 1;
  readonly press: LongPress;
  #playback: Playback;

  constructor(
    private readonly host: SweepHost,
    openMenu: (options: {
      anchor: HTMLElement;
      settings: { rate: number; loop: Loop };
      onChange: (settings: { rate: number; loop: Loop }) => void;
    }) => unknown,
    longPressMs: number,
  ) {
    this.#playback = new Playback(
      () => this.#advance(),
      () => host.interval() / (host.rate() > 0 ? host.rate() : 1),
    );
    this.press = new LongPress(longPressMs, (anchor) => {
      this.stop();
      openMenu({
        anchor,
        settings: { rate: host.rate(), loop: host.loop() },
        onChange: ({ rate, loop }) => {
          host.setRate(rate);
          host.setLoop(loop);
        },
      });
    });
  }

  get playing(): boolean {
    return this.#playing;
  }

  toggle(): void {
    if (this.#playing) this.stop();
    else this.start();
  }

  /** Start; a play-through that already reached its end starts over. */
  start(): void {
    if (this.#playing) return;
    const at = this.host.at();
    const from = rewindFor(at, this.host.span(), this.host.loop(), this.#direction);
    if (from !== at) this.host.set(from);
    this.#playback.start();
    this.#playing = true;
    this.host.onState();
  }

  stop(): void {
    if (!this.#playing) return;
    this.#playback.stop();
    this.#playing = false;
    this.host.onState();
  }

  /** One implicit advance along the span -- also what a toggler's click is. */
  advance(): boolean {
    const next = iterate(this.host.at(), 1, this.host.span(), this.host.loop(), this.#direction);
    this.#direction = next.direction;
    this.host.set(next.value);
    return !next.done;
  }

  #advance(): void {
    if (!this.advance()) this.stop();
  }
}
