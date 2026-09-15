// One clock for the page.
//
// Animated figures each running their own timer is not merely wasteful — it is wrong. Two
// figures showing the same motion drift apart, and pausing one leaves the others running, so a
// reader who stops to look at something is still being moved past. A page of figures about the
// SAME parameter should advance together, and one pause should stop all of them.
//
// The clock is a module singleton stashed on `globalThis`, which is deliberate: bundling can
// hand two elements two copies of this module, and two copies would be two clocks. It is
// page-wide rather than per-engine because there is one compute-engine per page
// (`loadEngine`) — if that ever stops being true, this is the seam that grows a key.
//
// It runs only while something is watching AND it is playing, so a page with no animated
// figure on it schedules no frames at all.

/** A moment: the time in seconds, and the phase of the current cycle. */
export interface Tick {
  /** Seconds since the clock started, not counting time spent paused. */
  readonly time: number;
  /** Where we are in the current cycle, in `[0, 1)` — what a looping figure actually wants. */
  readonly phase: number;
}

type Listener = (tick: Tick) => void;

const WINDOW = globalThis as typeof globalThis & { __notatioClock?: Clock };

/** Seconds for one full cycle. Slow enough to follow a strand around a knot by eye. */
const DEFAULT_PERIOD = 12;

export class Clock {
  #time = 0;
  #period = DEFAULT_PERIOD;
  #playing = true;
  #last: number | undefined;
  #frame: number | undefined;
  #listeners = new Set<Listener>();

  get time(): number {
    return this.#time;
  }

  get phase(): number {
    const turns = this.#time / this.#period;
    return turns - Math.floor(turns);
  }

  get playing(): boolean {
    return this.#playing;
  }

  /** Seconds per cycle. Changing it holds the current PHASE rather than the current time, so a
   *  figure does not jump when the speed is changed under it. */
  get period(): number {
    return this.#period;
  }

  set period(seconds: number) {
    const next = Math.max(0.25, Number(seconds) || DEFAULT_PERIOD);
    const phase = this.phase;
    this.#period = next;
    this.#time = phase * next;
    this.#announce();
  }

  play(): void {
    if (this.#playing) return;
    this.#playing = true;
    this.#last = undefined;
    this.#announce();
    this.#schedule();
  }

  pause(): void {
    if (!this.#playing) return;
    this.#playing = false;
    this.#stop();
    this.#announce();
  }

  toggle(): void {
    if (this.#playing) this.pause();
    else this.play();
  }

  /** Jump to a phase in `[0, 1)` — what a scrubber writes. */
  seek(phase: number): void {
    const wrapped = (((Number(phase) || 0) % 1) + 1) % 1;
    this.#time = wrapped * this.#period;
    this.#announce();
  }

  /** Watch the clock. The returned function stops watching, and the last one to stop also
   *  stops the frames. */
  watch(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#tick());
    this.#schedule();
    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#stop();
    };
  }

  #tick(): Tick {
    return { time: this.#time, phase: this.phase };
  }

  #announce(): void {
    const tick = this.#tick();
    for (const listener of this.#listeners) listener(tick);
  }

  #schedule(): void {
    if (this.#frame !== undefined || !this.#playing || this.#listeners.size === 0) return;
    if (typeof requestAnimationFrame !== "function") return; // server-side: nothing moves
    this.#frame = requestAnimationFrame((now) => {
      this.#frame = undefined;
      // The first frame after a pause has no previous stamp, so it advances by nothing —
      // otherwise the whole paused interval arrives at once and every figure jumps.
      if (this.#last !== undefined) this.#time += (now - this.#last) / 1000;
      this.#last = now;
      this.#announce();
      this.#schedule();
    });
  }

  #stop(): void {
    if (this.#frame !== undefined && typeof cancelAnimationFrame === "function")
      cancelAnimationFrame(this.#frame);
    this.#frame = undefined;
    this.#last = undefined;
  }
}

/**
 * The page's clock.
 *
 * Starts paused when the reader has asked for reduced motion: a figure that moves on its own is
 * exactly what that setting is about, and the play button is still there for anyone who wants
 * it. Everything else starts running, because a still figure gives no hint that it would move.
 */
export function pageClock(): Clock {
  if (!WINDOW.__notatioClock) {
    const clock = new Clock();
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) clock.pause();
    WINDOW.__notatioClock = clock;
  }
  return WINDOW.__notatioClock;
}
