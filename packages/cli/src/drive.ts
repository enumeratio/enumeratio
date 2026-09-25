// Driving controls at a terminal. A TTY has an engine and keys, so a `Slider` or a
// `Manipulate` is a real control here, only keyed rather than pointed: the declarations
// draw as a strip of text sliders, arrows move the focused one (Shift for the coarse
// gear, the same convention as the knob), Tab moves focus, Space plays an Animator,
// Enter or q keeps the state and returns to the prompt. The body under the strip is the
// expression PINNED at the current values (`pin`), evaluated and rendered by the
// session -- the same rewrite `reduce` uses for print, run once per keypress instead
// of once. This is the base's `Rendering` mounted on a cell grid; nothing of lit here.

import { serializeNotatio } from "@enumeratio/formats/notatio";
import { iterate } from "../../notatio/src/playback.ts";
import { type Declaration, declarations, pinValue, pin, sampleValues } from "../../notatio/src/reduce.ts";
import { numOf, strOf, tupleOf } from "../../notatio/src/symbols.ts";
import { bold, cyan, dim, stripAnsi } from "./ansi.ts";

type Json = Parameters<typeof pin>[0];

export interface Key {
  name?: string;
  shift?: boolean;
  ctrl?: boolean;
  sequence?: string;
}

/** One control's state at the keyboard: its declaration, its value, and how it steps. */
interface Driven {
  readonly decl: Declaration;
  value: Json;
  /** The entries a listed control cycles, if it is one. */
  readonly entries?: readonly Json[];
  /** The range a ranged control moves in, if it is one. */
  readonly range?: { min: number; max: number; step: number };
  /** The box a point control (Slider2D, Locator) moves in, and its step per axis. */
  readonly plane?: { step: [number, number]; min?: [number, number]; max?: [number, number] };
}

/** `(x, y)` as numbers, if that is what the node is. */
function pairOf(node: Json | undefined): [number, number] | undefined {
  const [x, y, ...rest] = tupleOf(node)?.map(numOf) ?? [];
  return x === undefined || y === undefined || rest.length > 0 ? undefined : [x, y];
}

// A string shows bare (it is a choice's label); anything else as notatio, `(1, 0.5)`.
const text = (node: Json): string => strOf(node) ?? serializeNotatio(node as never);

function driven(decl: Declaration): Driven | undefined {
  const value = pinValue(decl);
  if (value === undefined) return undefined;
  if (decl.kind === "ranged") {
    const parts = tupleOf(decl.spec)?.map(numOf) ?? [];
    const [min, max, step] = parts;
    if (min === undefined || max === undefined) return { decl, value };
    // No step: a hundred positions across the range, the slider's own default.
    return { decl, value, range: { min, max, step: step ?? (max - min) / 100 } };
  }
  if (decl.kind === "planar" || decl.kind === "locator") {
    if (pairOf(value) === undefined) return { decl, value };
    // A Slider2D has corners; a Locator takes its plot's, which the driver does not see,
    // so it steps by a tenth and is not held in.
    const [min, max] = (tupleOf(decl.spec) ?? []).map(pairOf);
    if (min === undefined || max === undefined) return { decl, value, plane: { step: [0.1, 0.1] } };
    const step: [number, number] = [(max[0] - min[0]) / 100, (max[1] - min[1]) / 100];
    return { decl, value, plane: { step, min, max } };
  }
  const entries = sampleValues(decl, Number.POSITIVE_INFINITY);
  return entries === undefined ? { decl, value } : { decl, value, entries };
}

const WIDTH = 24;
const LABEL_COLS = 20;

/**
 * One control as a line, with where its parts landed so a click can be read back:
 * `track` is the 0-based column of the first cell of a slider's bar, `spans` the
 * columns each entry of a choice occupies.
 */
interface Strip {
  text: string;
  track?: number;
  spans?: { from: number; to: number; index: number }[];
}

/** `k = 2   ◂━━━●━━━━━━━━━▸  0 … 5`, or the entries with the chosen one marked. */
function strip(d: Driven, focused: boolean, color: boolean): Strip {
  const name = focused ? bold(cyan(d.decl.name, color), color) : d.decl.name;
  const raw = `  ${name} = ${text(d.value)}`;
  // Pad by what shows, not by the escape codes around the focused name.
  const shown = stripAnsi(raw).length;
  const label = raw + " ".repeat(Math.max(2, LABEL_COLS - shown));
  const at0 = Math.max(shown, LABEL_COLS - 2) + 2;
  if (d.range !== undefined) {
    const v = numOf(d.value) ?? d.range.min;
    const at = Math.round(((v - d.range.min) / (d.range.max - d.range.min || 1)) * WIDTH);
    const bar = "━".repeat(at) + "●" + "━".repeat(Math.max(0, WIDTH - at));
    return {
      text: `${label}◂${bar}▸  ${dim(`${d.range.min} … ${d.range.max}`, color)}`,
      track: at0 + 1,
    };
  }
  if (d.plane !== undefined) {
    const { min, max } = d.plane;
    const box = min && max ? `  (${min.join(", ")}) … (${max.join(", ")})` : "";
    return { text: `${label}${dim(`←/→ x · ↑/↓ y${box}`, color)}` };
  }
  if (d.entries !== undefined) {
    const spans: { from: number; to: number; index: number }[] = [];
    let col = at0;
    const choices = d.entries.map((e, index) => {
      const chosen = text(e) === text(d.value);
      const shape = chosen ? `[${text(e)}]` : text(e);
      spans.push({ from: col, to: col + shape.length - 1, index });
      col += shape.length + 2;
      return chosen ? bold(shape, color) : dim(shape, color);
    });
    return { text: `${label}${choices.join("  ")}`, spans };
  }
  return { text: label };
}

/** Put a ranged control at a fraction of its span, snapped to the step grid. */
function seek(d: Driven, fraction: number): void {
  if (d.range === undefined) return;
  const { min, max, step } = d.range;
  const raw = min + Math.min(1, Math.max(0, fraction)) * (max - min);
  const snapped = min + Math.round((raw - min) / step) * step;
  d.value = Number(Math.min(max, Math.max(min, snapped)).toPrecision(12)) as Json;
}

/** Move a control by `steps` grid positions (negative for back), gear already applied. */
function move(d: Driven, steps: number): void {
  if (d.range !== undefined) {
    const v = numOf(d.value) ?? d.range.min;
    const next = Math.min(d.range.max, Math.max(d.range.min, v + steps * d.range.step));
    d.value = Number(next.toPrecision(12)) as Json;
    return;
  }
  if (d.entries !== undefined && d.entries.length > 0) {
    const i = d.entries.findIndex((e) => text(e) === text(d.value));
    const n = d.entries.length;
    d.value = d.entries[((((i < 0 ? 0 : i) + steps) % n) + n) % n]!;
  }
}

/** Move a point control by grid steps along each axis, held inside its box if it has one. */
function shift(d: Driven, dx: number, dy: number): void {
  const at = pairOf(d.value);
  if (d.plane === undefined || at === undefined) return;
  const { step, min, max } = d.plane;
  const axis = (i: 0 | 1, by: number): number => {
    const v = at[i] + by * step[i];
    const held = min && max ? Math.min(max[i], Math.max(min[i], v)) : v;
    return Number(held.toPrecision(12));
  };
  d.value = ["Tuple", axis(0, dx), axis(1, dy)] as unknown as Json;
}

/** One playback tick for an Animator: the next grid value, cycling. */
function tick(d: Driven): void {
  if (d.range === undefined) return move(d, 1);
  const v = numOf(d.value) ?? d.range.min;
  const { value } = iterate(v, 1, d.range, "cycle", 1);
  d.value = Number(value.toPrecision(12)) as Json;
}

// SGR mouse reporting (1006) with button-event tracking (1002), so a press, a drag and
// a wheel all arrive as `ESC [ < b ; x ; y M|m`. Every terminal worth driving speaks it.
const MOUSE_ON = "\x1b[?1000h\x1b[?1002h\x1b[?1006h";
const MOUSE_OFF = "\x1b[?1006l\x1b[?1002l\x1b[?1000l";
// ESC assembled from its code point, as in ansi.ts, so the source carries no control character.
const MOUSE_EVENT = new RegExp(`${String.fromCharCode(27)}\\[<(\\d+);(\\d+);(\\d+)([Mm])`, "g");

interface MouseEvent {
  button: number;
  x: number;
  y: number;
  press: boolean;
}

/** Every mouse report in a chunk of input. */
function mouseEvents(chunk: string): MouseEvent[] {
  const out: MouseEvent[] = [];
  MOUSE_EVENT.lastIndex = 0;
  for (let m = MOUSE_EVENT.exec(chunk); m !== null; m = MOUSE_EVENT.exec(chunk)) {
    out.push({
      button: Number(m[1]),
      x: Number(m[2]),
      y: Number(m[3]),
      press: m[4] === "M",
    });
  }
  return out;
}

/** Where a driver draws: the host's terminal, whatever carries it. */
export interface DriveScreen {
  /** Evaluate a pinned expression and render it as the session would. */
  show(expr: Json): string;
  write(text: string): void;
  color: boolean;
  /** Whether mouse reports can arrive; the hint and the reporting mode follow it. */
  mouse: boolean;
  /** The 1-based row the cursor is on -- the line just below the frame. */
  cursorRow(): number;
  /** The terminal's width, so a line that wraps is counted as the rows it takes. */
  columns(): number;
}

/** A keyboard loop over the controls of one expression, fed by whichever host has the keys. */
export interface Driver {
  draw(): void;
  /** One key; true when the reader is done. */
  key(key: Key): boolean;
  /** Raw input that may carry mouse reports. */
  data(chunk: string): void;
  /** The expression pinned where the controls are now. */
  pinned(): Json;
  /** Stop playback and mouse reporting. */
  stop(): void;
}

/** Whether an expression has anything to drive. */
export const drivable = (expr: Json): boolean => declarations(expr).length > 0;

/** The driver for `expr`'s controls, or `undefined` when it has none to move. */
export function driver(expr: Json, screen: DriveScreen): Driver | undefined {
  const controls = declarations(expr)
    .map(driven)
    .filter((d): d is Driven => d !== undefined);
  if (controls.length === 0) return undefined;
  const values = (): Map<string, Json> => new Map(controls.map((d) => [d.decl.name, d.value]));
  const pinned = (): Json => pin(expr, values());

  let focus = 0;
  let lines = 0;
  let playing: ReturnType<typeof setInterval> | undefined;
  const { color, mouse } = screen;
  // Where the strips landed last draw, so a mouse report can be read back onto them.
  let strips: Strip[] = [];

  const draw = (): void => {
    const lead = lines > 0 ? `\x1b[${lines}A\x1b[J` : mouse ? MOUSE_ON : "";
    const body = screen.show(pinned());
    strips = controls.map((d, i) => strip(d, i === focus, color));
    const out = [
      ...strips.map((s) => s.text),
      dim(
        mouse
          ? "  drag or click a slider · ←/→ move · shift: coarse · tab: next · space: play · enter: done"
          : "  ←/→ move · shift: coarse · tab: next · space: play · enter: done",
        color,
      ),
      "",
      ...body.split("\n"),
    ];
    screen.write(lead + out.join("\n") + "\n");
    const cols = Math.max(1, screen.columns());
    lines = out.reduce((n, l) => n + Math.max(1, Math.ceil(stripAnsi(l).length / cols)), 0);
  };

  /** The control a mouse row lands on: the frame ends on the row above the cursor. */
  const controlAt = (row: number): number | undefined => {
    const i = row - (screen.cursorRow() - lines);
    return i >= 0 && i < controls.length ? i : undefined;
  };

  const onMouse = (e: MouseEvent): boolean => {
    const wheel = (e.button & 64) !== 0;
    const i = controlAt(e.y) ?? (wheel ? undefined : focus);
    if (i === undefined) return false;
    const d = controls[i]!;
    if (wheel) {
      move(d, e.button === 64 ? 1 : -1);
      focus = i;
      return true;
    }
    if (!e.press && (e.button & 32) === 0) return false;
    focus = i;
    const s = strips[i];
    if (d.range !== undefined && s?.track !== undefined) {
      seek(d, (e.x - 1 - s.track) / WIDTH);
      return true;
    }
    const span = s?.spans?.find((p) => e.x - 1 >= p.from && e.x - 1 <= p.to);
    if (span !== undefined && d.entries !== undefined) {
      d.value = d.entries[span.index]!;
      return true;
    }
    return true;
  };

  const halt = (): void => {
    if (playing !== undefined) clearInterval(playing);
    playing = undefined;
  };

  return {
    draw,
    pinned,
    stop: () => {
      halt();
      if (mouse) screen.write(MOUSE_OFF);
    },
    data: (chunk) => {
      if (!mouse) return;
      let moved = false;
      for (const e of mouseEvents(chunk)) moved = onMouse(e) || moved;
      if (moved) draw();
    },
    key: (key) => {
      const gear = key.shift === true ? 10 : 1;
      const d = controls[focus]!;
      switch (key.name) {
        case "return":
        case "q":
        case "escape":
          return true;
        case "c":
          if (key.ctrl === true) return true;
          return false;
        case "tab":
          focus = (focus + (key.shift === true ? controls.length - 1 : 1)) % controls.length;
          break;
        // A point control takes ↑/↓ as its y; for the rest they move focus.
        case "down":
        case "j":
          if (d.plane !== undefined) shift(d, 0, -gear);
          else focus = (focus + 1) % controls.length;
          break;
        case "up":
        case "k":
          if (d.plane !== undefined) shift(d, 0, gear);
          else focus = (focus - 1 + controls.length) % controls.length;
          break;
        case "right":
        case "l":
          if (d.plane !== undefined) shift(d, gear, 0);
          else move(d, gear);
          break;
        case "left":
        case "h":
          if (d.plane !== undefined) shift(d, -gear, 0);
          else move(d, -gear);
          break;
        case "space":
          if (playing !== undefined) halt();
          else playing = setInterval(() => (tick(d), draw()), 120);
          break;
        default:
          return false;
      }
      draw();
      return false;
    },
  };
}

// The sequences a terminal sends for the keys the driver reads, for a host with no
// readline to name them (xterm's `onData`). ESC is built from its code point, as above.
const ESC = String.fromCharCode(27);
const SEQUENCES: Record<string, Key> = {
  [`${ESC}[A`]: { name: "up" },
  [`${ESC}[B`]: { name: "down" },
  [`${ESC}[C`]: { name: "right" },
  [`${ESC}[D`]: { name: "left" },
  [`${ESC}[1;2A`]: { name: "up", shift: true },
  [`${ESC}[1;2B`]: { name: "down", shift: true },
  [`${ESC}[1;2C`]: { name: "right", shift: true },
  [`${ESC}[1;2D`]: { name: "left", shift: true },
  [`${ESC}[Z`]: { name: "tab", shift: true },
  "\t": { name: "tab" },
  "\r": { name: "return" },
  " ": { name: "space" },
  [ESC]: { name: "escape" },
  [String.fromCharCode(3)]: { name: "c", ctrl: true },
};

/** Name the keys in a chunk of raw terminal input; mouse reports are left to `data`. */
export function keysOf(chunk: string): Key[] {
  const rest = chunk.replace(MOUSE_EVENT, "");
  const known = SEQUENCES[rest];
  if (known !== undefined) return [{ ...known, sequence: rest }];
  // Typed characters: one key each, uppercase as the shifted letter.
  if (rest.startsWith(ESC)) return [];
  return Array.from(rest, (ch) => ({
    ...(SEQUENCES[ch] ?? { name: ch.toLowerCase(), shift: ch !== ch.toLowerCase() }),
    sequence: ch,
  }));
}
