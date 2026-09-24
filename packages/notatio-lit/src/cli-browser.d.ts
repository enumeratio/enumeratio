// Ambient types for @enumeratio/cli/browser. The CLI ships no declaration files
// (its build reaches into sibling source, which would litter dts), so this mirrors
// the small browser surface the terminal element consumes. Keep in sync with
// packages/cli/src/browser.ts.
declare module "@enumeratio/cli/browser" {
  import type { Environment } from "@enumeratio/notatio";

  export type GlyphKind = "permutation" | "partition" | "composition" | "subset" | "dyck";

  export interface PlotPoint {
    x: number;
    y: number;
  }

  export type Graphic =
    | { kind: "plot"; expr: string; points: PlotPoint[] }
    | { kind: "glyph"; glyph: GlyphKind; values: number[]; caption: string };

  export interface LineOutput {
    text: string;
    graphic?: Graphic;
    clear?: boolean;
    exit?: boolean;
  }

  export interface ReplOptions {
    color?: boolean;
    commands?: Record<string, (repl: Repl, arg: string) => LineOutput>;
  }

  export class Repl {
    constructor(opts?: ReplOptions);
    color: boolean;
    readonly lineNo: number;
    prompt(): string;
    banner(): string;
    eval(line: string): LineOutput;
    formatOut(n: number, body: string): string;
  }

  export interface Demo {
    id: string;
    title: string;
    description?: string;
    category: string;
    lines: string[];
    tags?: readonly string[];
    highlight?: boolean;
  }

  export const DEMOS: readonly Demo[];
  export const CLI_DEMOS: readonly Demo[];
  export const HIGHLIGHTED: readonly Demo[];
  export function demosByCategory(): { category: string; demos: Demo[] }[];
  export function cliDemosByCategory(): { category: string; demos: Demo[] }[];

  export interface CommandResult {
    stdout: string;
    stderr: string;
    code: number;
  }
  export interface Key {
    name?: string;
    shift?: boolean;
    ctrl?: boolean;
    sequence?: string;
  }
  export interface DriveScreen {
    show(expr: unknown): string;
    write(text: string): void;
    color: boolean;
    mouse: boolean;
    cursorRow(): number;
    columns(): number;
  }
  export interface Driver {
    draw(): void;
    key(key: Key): boolean;
    data(chunk: string): void;
    pinned(): unknown;
    stop(): void;
  }
  export function keysOf(chunk: string): Key[];
  export interface Presented {
    echo: string;
    out: string;
    driver?: Driver;
    settle(pinned: unknown): string;
  }
  export function present(
    input: string,
    env: Environment,
    screen: Omit<DriveScreen, "show" | "color">,
  ): Presented;
  export function resumeHint(color: boolean): string;

  export function runCommand(argv: readonly string[], stdin?: string): CommandResult;
  export function splitArgs(line: string): string[];
  export function stripAnsi(s: string): string;
  export function dim(s: string, on?: boolean): string;
  export function red(s: string, on?: boolean): string;
}
