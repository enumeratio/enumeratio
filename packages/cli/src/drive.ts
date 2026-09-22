// Driving controls at a terminal. A TTY has an engine and keys, so a `Slider` or a
// `Manipulate` is a real control here, only keyed rather than pointed: the declarations
// draw as a strip of text sliders, arrows move the focused one (Shift for the coarse
// gear, the same convention as the knob), Tab moves focus, Space plays an Animator,
// Enter or q keeps the state and returns to the prompt. The body under the strip is the
// expression PINNED at the current values (`pin`), evaluated and rendered by the
// session -- the same rewrite `reduce` uses for print, run once per keypress instead
// of once. This is the base's `Rendering` mounted on a cell grid; nothing of lit here.

import { emitKeypressEvents } from "node:readline";
import { iterate } from "../../notatio/src/playback.ts";
import {
  type Declaration,
  declarations,
  pinValue,
  pin,
  sampleValues,
} from "../../notatio/src/reduce.ts";
import { numOf, strOf, tupleOf } from "../../notatio/src/symbols.ts";
import { bold, cyan, dim, stripAnsi } from "./ansi.ts";

type Json = Parameters<typeof pin>[0];

interface Key {
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
}

const text = (node: Json): string => strOf(node) ?? String(numOf(node) ?? JSON.stringify(node));

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

export interface DriveHost {
  /** Evaluate a pinned expression and render it as the session would. */
  show(expr: Json): string;
  color: boolean;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
}

/** Whether an expression has anything to drive. */
export const drivable = (expr: Json): boolean => declarations(expr).length > 0;

/**
 * Drive the controls of `expr` until the reader is done; resolves with the pinned
 * expression they left it at. Takes over the keypress stream while it runs.
 */
export function drive(expr: Json, host: DriveHost): Promise<Json> {
  const controls = declarations(expr)
    .map(driven)
    .filter((d): d is Driven => d !== undefined);
  const values = (): Map<string, Json> => new Map(controls.map((d) => [d.decl.name, d.value]));
  const pinnedNow = (): Json => pin(expr, values());
  if (controls.length === 0) return Promise.resolve(pinnedNow());

  let focus = 0;
  let lines = 0;
  let playing: NodeJS.Timeout | undefined;
  const { stdin, stdout, color } = host;
  // Where the strips landed last draw, so a mouse report can be read back onto them:
  // the rows counted UP from the line below the frame, which is where the cursor sits.
  let strips: Strip[] = [];
  const mouse = stdin.isTTY === true;

  const draw = (): void => {
    if (lines > 0) stdout.write(`\x1b[${lines}A\x1b[J`);
    const body = host.show(pinnedNow());
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
    stdout.write(out.join("\n") + "\n");
    lines = out.length;
  };

  /** The control a mouse row lands on: the strips sit `lines` rows above the cursor. */
  const controlAt = (row: number): number | undefined => {
    const bottom = stdout.rows ?? 24;
    const first = bottom - lines + 1;
    const i = row - first;
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

  const stop = (): void => {
    if (playing !== undefined) clearInterval(playing);
    playing = undefined;
  };

  return new Promise((resolve) => {
    emitKeypressEvents(stdin);
    // readline owns the keypress stream; hold its listeners while the strip does.
    const held = stdin.listeners("keypress") as ((...args: unknown[]) => void)[];
    for (const l of held) stdin.off("keypress", l);
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    if (mouse) stdout.write(MOUSE_ON);

    const finish = (): void => {
      stop();
      stdin.off("keypress", onKey);
      stdin.off("data", onData);
      if (mouse) stdout.write(MOUSE_OFF);
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      for (const l of held) stdin.on("keypress", l);
      resolve(pinnedNow());
    };

    // Mouse reports arrive as raw bytes; keypress sees them too, and ignores them.
    const onData = (chunk: Buffer | string): void => {
      if (!mouse) return;
      let moved = false;
      for (const e of mouseEvents(String(chunk))) moved = onMouse(e) || moved;
      if (moved) draw();
    };

    const onKey = (_: string, key: Key = {}): void => {
      const gear = key.shift === true ? 10 : 1;
      const d = controls[focus]!;
      switch (key.name) {
        case "return":
        case "q":
        case "escape":
          return finish();
        case "c":
          if (key.ctrl === true) return finish();
          break;
        case "tab":
        case "down":
          focus = (focus + 1) % controls.length;
          break;
        case "up":
          focus = (focus - 1 + controls.length) % controls.length;
          break;
        case "right":
        case "l":
          move(d, gear);
          break;
        case "left":
        case "h":
          move(d, -gear);
          break;
        case "space":
          if (playing !== undefined) stop();
          else playing = setInterval(() => (tick(d), draw()), 120);
          break;
        default:
          return;
      }
      draw();
    };
    stdin.on("keypress", onKey);
    if (mouse) stdin.on("data", onData);
    draw();
  });
}
