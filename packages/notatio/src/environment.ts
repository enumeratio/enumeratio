// An environment is a record of what the place a rendering lands can do -- whether an
// engine is there when the reader looks, what it can draw, how it can be touched --
// and `reduce` (reduce.ts) closes the gap between what an expression asks for and
// what the record allows, in the expression. Nothing here touches a DOM or a TTY:
// the detectors take what they need as arguments. See design/rendering-environments.md.

/** How the reader can act on a rendering. Not ordered: a phone has touch and no hover. */
export type Interaction = "links" | "keys" | "pointer" | "touch";

/** What the environment can draw on. `gpu` is the compute shader a `ComplexPlot` wants. */
export type Surface = "dom" | "gpu" | "vector" | "raster" | "text";

/** One frame; a sequence of frames the host can page or play; a loop with an engine behind it. */
export type Time = "static" | "frames" | "live";

/** Flow of a page; paged for print; a grid of character cells; one narrow column. */
export type Layout = "flow" | "paged" | "grid" | "compact";

export type Colour = "mono" | "16" | "256" | "true";

/** What a control becomes when nothing can drive it. */
export type Reading = "pin" | "sample";

export interface StaticPolicy {
  /** The default reading of a control with no engine behind it. */
  readonly controls: Reading;
  /** How many values a sampled control takes at most. */
  readonly samples: number;
  /** Columns of the grid a sampled control lays its values out in. */
  readonly columns: number;
}

export interface Environment {
  readonly name: string;
  /** Is a compute engine present when the reader looks? Decides everything else. */
  readonly engine: boolean;
  readonly interaction: readonly Interaction[];
  readonly time: Time;
  readonly surface: readonly Surface[];
  /** The `*Form` the leaves typeset in, when the environment has a say. */
  readonly form: string;
  readonly layout: Layout;
  readonly colour: Colour;
  readonly theme: "light" | "dark";
  readonly static: StaticPolicy;
}

const STATIC: StaticPolicy = { controls: "sample", samples: 6, columns: 3 };

export const WEB: Environment = {
  name: "web",
  engine: true,
  interaction: ["pointer", "touch", "links"],
  time: "live",
  surface: ["dom", "gpu", "vector", "raster"],
  form: "StandardForm",
  layout: "flow",
  colour: "true",
  theme: "light",
  static: STATIC,
};

/** Paper, and a PDF, which differs from paper by links and never by an engine. */
export const PRINT: Environment = {
  name: "print",
  engine: false,
  interaction: ["links"],
  time: "static",
  surface: ["vector", "raster"],
  form: "TraditionalForm",
  layout: "paged",
  colour: "true",
  theme: "light",
  static: STATIC,
};

/** A terminal with someone at it: an engine, keys, and (on a good day) inline images. */
export const TTY: Environment = {
  name: "tty",
  engine: true,
  interaction: ["keys"],
  time: "live",
  surface: ["text"],
  form: "AsciiMathForm",
  layout: "grid",
  colour: "256",
  theme: "dark",
  static: STATIC,
};

/** Standard output going somewhere else: text, once, no one to ask. */
export const PIPE: Environment = {
  ...TTY,
  name: "pipe",
  engine: false,
  interaction: [],
  time: "static",
  colour: "mono",
  static: { ...STATIC, controls: "pin" },
};

/** A phone: everything the web has, in one column, with no hover. */
export const COMPACT: Environment = {
  ...WEB,
  name: "compact",
  interaction: ["touch", "links"],
  layout: "compact",
};

export const ENVIRONMENTS: readonly Environment[] = [WEB, PRINT, TTY, PIPE, COMPACT];

/** What a Node process can tell about its stdout, without reading globals here. */
export interface NodeSignals {
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
}

/** The terminal environment for a process: a TTY, one with images, or a pipe. */
export function nodeEnvironment({ isTTY, env }: NodeSignals): Environment {
  if (!isTTY) return PIPE;
  const images =
    env.TERM?.includes("kitty") === true ||
    env.KITTY_WINDOW_ID !== undefined ||
    env.TERM_PROGRAM === "iTerm.app" ||
    env.TERM_PROGRAM === "WezTerm" ||
    env.LC_TERMINAL === "iTerm2";
  const colour: Colour =
    env.COLORTERM === "truecolor" || env.COLORTERM === "24bit"
      ? "true"
      : env.TERM?.includes("256color") === true
        ? "256"
        : "16";
  return { ...TTY, surface: images ? ["raster", "text"] : ["text"], colour };
}

/** What a browser's media queries can tell, without reading `window` here. */
export interface MediaSignals {
  readonly print?: boolean;
  readonly hover?: boolean;
  readonly coarse?: boolean;
  readonly dark?: boolean;
  readonly narrow?: boolean;
  readonly gpu?: boolean;
}

/** The environment a page is in: the web, a print of it, or a phone's column. */
export function browserEnvironment(signals: MediaSignals): Environment {
  const theme = signals.dark === true ? "dark" : "light";
  if (signals.print === true) return { ...PRINT, theme: "light" };
  const compact = signals.narrow === true || (signals.coarse === true && signals.hover !== true);
  const base = compact ? COMPACT : WEB;
  const surface = signals.gpu === false ? base.surface.filter((s) => s !== "gpu") : base.surface;
  return { ...base, theme, surface };
}

/** Reads the browser's media queries into signals; `matchMedia` is injected so this is testable. */
export function mediaSignals(matchMedia: (query: string) => { matches: boolean }): MediaSignals {
  const q = (query: string): boolean => matchMedia(query).matches;
  return {
    print: q("print"),
    hover: q("(hover: hover)"),
    coarse: q("(pointer: coarse)"),
    dark: q("(prefers-color-scheme: dark)"),
    narrow: q("(max-width: 640px)"),
  };
}

export const can = {
  draw: (env: Environment, surface: Surface): boolean => env.surface.includes(surface),
  interact: (env: Environment, how: Interaction): boolean => env.interaction.includes(how),
  /** A control can be driven: an engine to re-evaluate, and some way to move it. */
  drive: (env: Environment): boolean => env.engine && env.interaction.some((i) => i !== "links"),
  /** Something can move over time on its own. */
  animate: (env: Environment): boolean => env.time === "live",
};
