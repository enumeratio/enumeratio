// A control box on character cells, by its intent (`CONTROL_INTENT`): a number is a track with a
// marker, a point its coordinates, a choice its entries with the chosen one bracketed, a toggle its
// state. This is the drawing `layout` reserves a leaf for; the keyboard driver (`drive.ts`) moves
// the same controls. Pure: a control and its value in, one line of text out.

import { serializeExpression } from "@enumeratio/formats/expression";
import { type BoxControl, numOf, type pin, strOf, tupleOf } from "@enumeratio/frontend";

type Json = Parameters<typeof pin>[0];

const TRACK = 12;

// A string shows bare (it is a choice's label); anything else as Epsil, `(1, 0.5)`.
const show = (node: Json): string => strOf(node) ?? serializeExpression(node as never);

/** `━━●━━━━━━━━━` with the marker where `value` sits in `[min, max]`. */
function track(value: number, min: number, max: number): string {
  const at = Math.round(Math.min(1, Math.max(0, (value - min) / (max - min || 1))) * (TRACK - 1));
  return "━".repeat(at) + "●" + "━".repeat(TRACK - 1 - at);
}

/** The entries of a choice, with the chosen one bracketed. */
const choices = (entries: readonly Json[], value: Json): string =>
  entries.map((e) => (show(e) === show(value) ? `[${show(e)}]` : show(e))).join("  ");

/** `━━●━━●━━━━━━` with a marker at each end of the interval. */
function span(lo: number, hi: number, min: number, max: number): string {
  const at = (v: number) => Math.round(Math.min(1, Math.max(0, (v - min) / (max - min || 1))) * (TRACK - 1));
  const [a, b] = [at(lo), at(hi)];
  return (
    "━".repeat(a) +
    "●" +
    "━".repeat(Math.max(0, b - a - 1)) +
    (b > a ? "●" : "") +
    "━".repeat(TRACK - 1 - Math.max(a, b))
  );
}

/** One control as a line of text: `k ━━●━━━━━━━━━ 2`. */
export function controlLine(control: BoxControl, value: Json | undefined): string {
  const name = control.name;
  const shown = value === undefined ? "?" : show(value);
  switch (control.intent) {
    case "continuous":
    case "playback": {
      const [min, max] = tupleOf(control.domain)?.map(numOf) ?? [];
      const v = numOf(value);
      if (min === undefined || max === undefined || v === undefined) return `${name} = ${shown}`;
      const prefix = control.intent === "playback" ? "▶ " : "";
      return `${prefix}${name} ${track(v, min, max)} ${shown}`;
    }
    case "interval": {
      const [min, max] = tupleOf(control.domain)?.map(numOf) ?? [];
      const [lo, hi] = tupleOf(value)?.map(numOf) ?? [];
      if (min === undefined || max === undefined || lo === undefined || hi === undefined) return `${name} = ${shown}`;
      return `${name} ${span(lo, hi, min, max)} ${shown}`;
    }
    case "planar":
      return `${name} ⌖ ${shown}`;
    case "color":
      return `${name} ■ ${shown}`;
    case "toggle": {
      const entries = control.head === "TogglerBox" ? tupleOf(control.domain) : undefined;
      if (entries !== undefined && value !== undefined) return `${name} ⇄ ${choices(entries, value)}`;
      return `${name} [${shown === "True" ? "x" : " "}]`;
    }
    case "choice": {
      const entries = tupleOf(control.domain);
      if (entries === undefined || value === undefined) return `${name} = ${shown}`;
      // A toggler bar holds a list: each entry in it is down.
      const down = control.bar === "TogglerBar" ? tupleOf(value) : undefined;
      if (down !== undefined) {
        const on = new Set(down.map(show));
        return `${name} ${entries.map((e) => (on.has(show(e)) ? `[${show(e)}]` : show(e))).join("  ")}`;
      }
      return `${name} ${choices(entries, value)}`;
    }
    default:
      return `${name} [${shown}]`;
  }
}
