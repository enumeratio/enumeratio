// The terminal's pager over a table's rows (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid, §3):
// the visible rows only, a page as tall as the terminal, and a status line that says how much of
// the count is known. A `Driver` like the control strip, so the same hosts feed it keys; it holds
// the one `RowSource` and asks it for a range per move. Rows arrive asynchronously, so a key
// changes the state at once and the frame is drawn when its rows are in (`idle` waits for that).

import { type Box, describeCount, type RowBatch, type RowCount, type RowSource } from "@enumeratio/boxes";
import { parseIndex, statusText } from "@enumeratio/frontend";
import { dim } from "./ansi.ts";
import type { DriveScreen, Driver, Key } from "./drive.ts";
import { headersOf, ruled, skipOf } from "./table.ts";

type Json = ReturnType<Driver["pinned"]>;

/** What the pager needs of a terminal. */
export type PagerScreen = Pick<DriveScreen, "write" | "color" | "columns"> & {
  /** The terminal's height in rows; 24 when the host cannot say. */
  height?(): number;
};

export interface Pager extends Driver {
  /** Resolves once the rows the last key asked for are drawn. */
  idle(): Promise<void>;
  /** The page as last drawn without the key hints: the table and its status line. */
  text(): string;
}

const HINT = "j/k row · space/b page · g/G first/last · : jump · q quit";
/** Lines under the grid: the status and the hints. */
const CHROME = 2;
/** A ruled grid is a rule above each row but the first and the header: `2n + 1` lines for `n` rows. */
const rowsFitting = (height: number): number => Math.max(1, Math.floor((height - CHROME - 1) / 2));

/** A line cut to `width` cells, with `…` where it was cut. */
export function clip(line: string, width: number): string {
  const cells = Array.from(line);
  if (cells.length <= width) return line;
  // A rule has nothing to elide; text gets the ellipsis.
  const kept = cells.slice(0, Math.max(0, width - 1)).join("");
  return /^[\s─│┼]*$/.test(cells.slice(width - 1).join("")) ? kept : `${kept}…`;
}

const bigMax = (a: bigint, b: bigint): bigint => (a > b ? a : b);

export function pager(source: RowSource, screen: PagerScreen, expr?: Json): Pager {
  const skip = skipOf(source);
  const headers = headersOf(source);
  const height = (): number => screen.height?.() ?? 24;
  const width = (): number => Math.max(20, screen.columns());

  let top = 1n;
  let batch: RowBatch | undefined;
  let count: RowCount = source.count();
  let message = "";
  let jump: string | undefined;
  let body = "";
  let lines = 0;
  let loading = 0;
  let pending: Promise<void> = Promise.resolve();
  let stopped = false;

  const page = (): number => rowsFitting(height());
  /** The first row of the last full page, when the count says where the rows end. */
  const lastTop = (): bigint | undefined =>
    count.kind === "exact" ? bigMax(1n, count.n - BigInt(page()) + 1n) : undefined;

  /** The table and its status, clipped to the width so a line never wraps. */
  const compose = (b: RowBatch): string => {
    const rows: Box[][] = b.rows.map((row, i) => [String(b.start + BigInt(i)), ...row]);
    const grid =
      rows.length === 0
        ? ""
        : ruled(headers, rows)
            .split("\n")
            .map((l) => clip(l, width()))
            .join("\n");
    const total = describeCount(count);
    const last = b.start + BigInt(rows.length) - 1n;
    const status = rows.length === 0 ? `no rows from ${b.start} · of ${total}` : statusText(b.start, last, total);
    const fitted = status.length <= width() ? status : statusText(b.start, last, total, true);
    return `${grid}${grid === "" ? "" : "\n"}${clip(fitted, width())}`;
  };

  const frame = (): string => {
    const hint =
      jump !== undefined ? `jump to row: ${jump}▏ · enter: go · esc: cancel` : message === "" ? HINT : message;
    return `${body}\n${dim(clip(hint, width()), screen.color)}`;
  };

  const paint = (): void => {
    const lead = lines > 0 ? `\x1b[${lines}A\x1b[J` : "";
    const out = frame();
    screen.write(`${lead}${out}\n`);
    lines = out.split("\n").length;
  };

  const load = async (): Promise<void> => {
    const mine = ++loading;
    const asked = top;
    try {
      const got = await source.rows([asked, asked + BigInt(page())], [skip, source.columns.length]);
      if (mine !== loading || stopped) return;
      count = got.count;
      if (got.rows.length === 0 && asked > 1n && got.declined === undefined) {
        // Past the end of a source whose count was not known: stay on the page shown.
        top = batch?.start ?? 1n;
        message = "the last row";
        return paint();
      }
      batch = got;
      if (got.declined !== undefined) message = got.declined;
      body = compose(got);
      paint();
    } catch (error) {
      if (mine !== loading || stopped) return;
      message = error instanceof Error ? error.message : String(error);
      paint();
    }
  };

  const refresh = (): void => {
    pending = load();
  };

  /** Show the page starting at `to`, held inside the rows the count allows. */
  const go = (to: bigint): void => {
    const end = lastTop();
    let next = bigMax(1n, to);
    if (end !== undefined && next > end) next = end;
    if (next === top && batch !== undefined) {
      message = to < top ? "the first row" : "the last row";
      return paint();
    }
    top = next;
    refresh();
  };

  const toLast = (): void => {
    const end = lastTop();
    if (end !== undefined) return go(end);
    message = count.kind === "infinite" ? "G: the rows have no end" : "G: the row count is not known yet";
    paint();
  };

  const submitJump = (): void => {
    const target = parseIndex(jump ?? "");
    jump = undefined;
    if (target === undefined) {
      message = "not a row number";
      return paint();
    }
    if (count.kind === "exact" && target > count.n) message = `only ${describeCount(count)} rows`;
    go(target);
  };

  const keyJump = (key: Key): boolean => {
    const ch = key.sequence ?? key.name ?? "";
    if (key.name === "return") submitJump();
    else if (key.name === "escape" || (key.ctrl === true && key.name === "c")) {
      jump = undefined;
      paint();
    } else if (key.name === "backspace") {
      jump = (jump ?? "").slice(0, -1);
      paint();
    } else if (/^[\d,_]$/.test(ch)) {
      jump = (jump ?? "") + ch;
      paint();
    }
    return false;
  };

  return {
    draw: refresh,
    idle: () => pending,
    text: () => body,
    data: () => undefined,
    pinned: () => expr as Json,
    stop: () => {
      stopped = true;
      loading++;
      if (lines > 0) screen.write(`\x1b[${lines}A\x1b[J`);
      lines = 0;
    },
    key: (key) => {
      if (jump !== undefined) return keyJump(key);
      message = "";
      const ch = key.sequence ?? key.name ?? "";
      if (key.ctrl === true && key.name === "c") return true;
      const step = BigInt(page());
      switch (key.name) {
        case "q":
        case "escape":
          return true;
        case "j":
        case "down":
        case "return":
          go(top + 1n);
          break;
        case "k":
        case "up":
          go(top - 1n);
          break;
        case "space":
        case "pagedown":
        case "f":
          go(top + step);
          break;
        case "b":
        case "pageup":
          go(top - step);
          break;
        case "home":
          go(1n);
          break;
        case "end":
          toLast();
          break;
        case "g":
          if (key.shift === true) toLast();
          else go(1n);
          break;
        default:
          if (ch === ":") {
            jump = "";
            paint();
          }
      }
      return false;
    },
  };
}
