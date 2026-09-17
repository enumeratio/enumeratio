// Ambient types for @enumeratio/cli/browser. The CLI ships no declaration files
// (its build reaches into sibling source, which would litter dts), so this mirrors
// the small browser surface the terminal element consumes. Keep in sync with
// packages/cli/src/browser.ts.
declare module "@enumeratio/cli/browser" {
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
  export function runCommand(argv: readonly string[], stdin?: string): CommandResult;
  export function splitArgs(line: string): string[];
  export function stripAnsi(s: string): string;
  export function dim(s: string, on?: boolean): string;
  export function red(s: string, on?: boolean): string;
}
