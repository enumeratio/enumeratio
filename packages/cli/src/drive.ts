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

/** `k = 2   ◂━━━●━━━━━━━━━▸  0 … 5`, or the entries with the chosen one marked. */
function strip(d: Driven, focused: boolean, color: boolean): string {
  const name = focused ? bold(cyan(d.decl.name, color), color) : d.decl.name;
  const raw = `  ${name} = ${text(d.value)}`;
  // Pad by what shows, not by the escape codes around the focused name.
  const label = raw + " ".repeat(Math.max(2, 20 - stripAnsi(raw).length));
  if (d.range !== undefined) {
    const v = numOf(d.value) ?? d.range.min;
    const at = Math.round(((v - d.range.min) / (d.range.max - d.range.min || 1)) * WIDTH);
    const bar = "━".repeat(at) + "●" + "━".repeat(Math.max(0, WIDTH - at));
    return `${label}◂${bar}▸  ${dim(`${d.range.min} … ${d.range.max}`, color)}`;
  }
  if (d.entries !== undefined) {
    const choices = d.entries.map((e) =>
      text(e) === text(d.value) ? bold(`[${text(e)}]`, color) : dim(text(e), color),
    );
    return `${label}${choices.join("  ")}`;
  }
  return label;
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

  const draw = (): void => {
    if (lines > 0) stdout.write(`\x1b[${lines}A\x1b[J`);
    const body = host.show(pinnedNow());
    const out = [
      ...controls.map((d, i) => strip(d, i === focus, color)),
      dim("  ←/→ move · shift: coarse · tab: next · space: play · enter: done", color),
      "",
      ...body.split("\n"),
    ];
    stdout.write(out.join("\n") + "\n");
    lines = out.length;
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

    const finish = (): void => {
      stop();
      stdin.off("keypress", onKey);
      if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
      for (const l of held) stdin.on("keypress", l);
      resolve(pinnedNow());
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
    draw();
  });
}
