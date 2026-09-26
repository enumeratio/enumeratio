// Engine wiring for the REPL, browser-safe: one compute-engine with the
// enumeratio heads declared, input-syntax dispatch (LaTeX / MathJSON / Wolfram
// full form / Epsil), a `%` history substitution, and the output-form renderers.
// No Node builtins, no file I/O, no rendering — the graphic side of :plot/:glyph
// is returned as structured data and drawn by whichever adapter runs the core.

import { type BoxedExpression, ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import { declareCollections } from "@enumeratio/collections";
import { declareDomainConstructors, declareDomainTypes, declareMaps, DOMAINS } from "@enumeratio/domains";
import { declareGraphics, exportTo, importFrom } from "@enumeratio/formats";
import { conventionalLatexDictionary } from "@enumeratio/notatio/conventional-latex";
import {
  ALL_STATISTICS,
  declareDistributions,
  declareDistributions2,
  declareDistributions3,
  declareDistributions4,
  declareDistributions5,
  declareStatistics,
} from "@enumeratio/statistics";

export type Syntax = "latex" | "mathjson" | "wolfram" | "epsil";

export interface Classified {
  syntax: Syntax;
  body: string;
}

/** Inline syntax prefixes (`:wl 1+1`) accepted at the head of an eval line. */
const SYNTAX_PREFIX: Record<string, Syntax> = {
  wl: "wolfram",
  wolfram: "wolfram",
  mj: "mathjson",
  json: "mathjson",
  mathjson: "mathjson",
  tex: "latex",
  latex: "latex",
  ep: "epsil",
  epsil: "epsil",
};

/**
 * Decide how to read an input line. An explicit syntax pragma
 * (`:latex|:mathjson|:wolfram|:epsil`, plus short aliases) selects the syntax for
 * that line; otherwise the line uses the session default (Epsil), rendered back
 * as InputForm.
 * LaTeX inside Epsil goes in `$…$` islands, or `:latex` for a whole LaTeX line.
 */
export function classifyInput(src: string, fallback: Syntax = "epsil"): Classified {
  const t = src.trim();
  const pfx = /^:([a-z]+)\s+([\s\S]+)$/.exec(t);
  if (pfx && pfx[1] in SYNTAX_PREFIX) return { syntax: SYNTAX_PREFIX[pfx[1]], body: pfx[2].trim() };
  return { syntax: fallback, body: t };
}

export const FORMS = ["inputform", "tex", "mathjson", "wolfram", "epsil", "numpy", "glsl", "wgsl", "js"] as const;
export type Form = (typeof FORMS)[number];

export const FORM_LABEL: Record<Form, string> = {
  inputform: "InputForm",
  tex: "TeXForm",
  mathjson: "MathJSON",
  wolfram: "WolframFullForm",
  epsil: "Epsil",
  numpy: "NumPy / Python",
  glsl: "GLSL",
  wgsl: "WGSL",
  js: "JavaScript",
};

// A display form is just a @enumeratio/formats export format under a short name.
const FORMAT_OF: Record<Form, string> = {
  inputform: "InputForm",
  tex: "TeX",
  mathjson: "MathJSON",
  wolfram: "WL",
  epsil: "Epsil",
  numpy: "Python",
  glsl: "GLSL",
  wgsl: "WGSL",
  js: "JavaScript",
};

/** Render a boxed expression in the requested output form (via the format registry). */
export function renderForm(expr: BoxedExpression, form: Form): string {
  return String(exportTo(expr, FORMAT_OF[form]));
}

export const SYNTAXES: readonly Syntax[] = ["latex", "mathjson", "wolfram", "epsil"];

// Short aliases accepted anywhere a full name is — documented names are the full
// ones, but the sets are finite so a unique prefix (or a listed alias) resolves.
// Wolfram's *Form symbols land on the form they correspond to (matched case-insensitively).
const FORM_ALIASES: Record<string, Form> = {
  python: "numpy",
  py: "numpy",
  javascript: "js",
  latex: "tex",
  texform: "tex",
  wl: "wolfram",
  fullform: "wolfram",
  wolframfullform: "wolfram",
  wolframlanguage: "wolfram",
  standardform: "inputform",
  outputform: "inputform",
  text: "inputform",
};
const SYNTAX_ALIASES: Record<string, Syntax> = {
  tex: "latex",
  wl: "wolfram",
  mj: "mathjson",
  json: "mathjson",
  ep: "epsil",
};

/** Resolve a name to one of `options` by exact match, a listed alias, or a
 *  unique prefix. Returns undefined when nothing — or more than one thing — matches. */
export function resolveName<T extends string>(
  input: string,
  options: readonly T[],
  aliases: Record<string, T> = {},
): T | undefined {
  const low = input.toLowerCase();
  if ((options as readonly string[]).includes(low)) return low as T;
  if (aliases[low]) return aliases[low];
  const prefix = options.filter((o) => o.startsWith(low));
  return prefix.length === 1 ? prefix[0] : undefined;
}

/** Resolve an output-form name (full, alias, or unique prefix). */
export function resolveForm(input: string): Form | undefined {
  return resolveName(input, FORMS, FORM_ALIASES);
}

/** Resolve an input-syntax name (full, alias, or unique prefix). */
export function resolveSyntax(input: string): Syntax | undefined {
  return resolveName(input, SYNTAXES, SYNTAX_ALIASES);
}

export interface EvalResult {
  n: number;
  input: string;
  syntax: Syntax;
  raw: BoxedExpression;
  expr: BoxedExpression;
}

export interface PlotPoint {
  x: number;
  y: number;
}

export interface SampleOptions {
  variable?: string;
  from?: number;
  to?: number;
  steps?: number;
}

/** Session-wide defaults a host may supply (flags, a config file, …). */
export interface SessionDefaults {
  form?: Form;
  syntax?: Syntax;
  /** Working precision in significant digits for numeric evaluation. */
  precision?: number;
}

export interface Parsed {
  syntax: Syntax;
  body: string;
  raw: BoxedExpression;
}

/** Each carrier type mapped to the head that constructs it -- what `declareMaps` wraps with. */
const CONSTRUCTOR_FOR: Readonly<Record<string, string>> = Object.fromEntries(DOMAINS.map((d) => [d.type, d.name]));

/**
 * Carrier name to minted type, for the statistics. SetPartition is held back: domains treats
 * a set_partition as a restricted growth string while every set-partition definition works in
 * BLOCKS, so typing those heads over the carrier would be a wrong answer rather than a type
 * error. See `packages/symbols/combinatorics/statistics/scripts/carriers.ts`.
 */
const DOMAIN_TYPES: Readonly<Record<string, string>> = Object.fromEntries(
  DOMAINS.filter((d) => d.name !== "SetPartition").map((d) => [d.name, d.type]),
);

export class Session {
  readonly ce: ComputeEngine;
  readonly history: EvalResult[] = [];
  readonly vars = new Map<string, BoxedExpression>();
  form: Form = "inputform";
  defaultSyntax: Syntax = "epsil";
  private counter = 0;

  constructor(defaults: SessionDefaults = {}) {
    this.ce = new ComputeEngine({
      latexSyntax: new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] }),
    });
    // Carrier TYPES first: everything below declares heads over these minted types, so they
    // have to exist before a signature can name one. The carrier NAMES (declareDomainConstructors)
    // come after declareCollections instead -- a carrier and its collection are the same head
    // now (Permutations, SetPartitions, ...), so collections has to declare that name first and
    // domains' own constructor layers onto it, rather than the two colliding over who's first.
    declareDomainTypes(this.ce);
    // A combinatorial statistic is a function of a carrier, so that is what these heads take.
    // The ones that are ALSO plain list functions -- they compare entries with each other
    // rather than with their positions -- accept a bare list too; see `Definition.alsoOnList`.
    declareCollections(this.ce, { permutationType: "permutation" });
    declareDomainConstructors(this.ce);
    // Collections owns the fast permutation heads under the same names, so those are skipped
    // here -- one head, one owner.
    declareStatistics(this.ce, ALL_STATISTICS, { skipDeclared: true, domainTypes: DOMAIN_TYPES });
    declareDistributions(this.ce);
    declareDistributions2(this.ce);
    declareDistributions3(this.ce);
    declareDistributions4(this.ce);
    declareDistributions5(this.ce);
    declareMaps(this.ce, CONSTRUCTOR_FOR);
    // The heads that draw stay inert, so a `Plot` or a `Slider` survives evaluation as
    // the picture (or the control) it names, for a host that can show one.
    declareGraphics(this.ce);
    this.declareHistory();
    this.configure(defaults);
  }

  /** Apply defaults; undefined fields leave the current value alone. */
  configure(defaults: SessionDefaults): void {
    if (defaults.form) this.form = defaults.form;
    if (defaults.syntax) this.defaultSyntax = defaults.syntax;
    if (defaults.precision !== undefined) this.ce.precision = defaults.precision;
  }

  /**
   * `Out(n)`, `In(n)` and `InString(n)` over this session's history, as Wolfram has them:
   * `Out` is the RESULT, already evaluated, and `%n` is its shorthand; `In` is the input,
   * RE-EVALUATED at the point it is asked for (Wolfram assigns it a delayed value, so
   * `In[1]` of a random draw gives a new draw); `InString` is the line as it was typed.
   * A negative index counts back from the last line, so `Out(-1)` is `%`.
   */
  private declareHistory(): void {
    const at = (ops: readonly BoxedExpression[], what: string): EvalResult => {
      const n = ops[0]?.re;
      if (n === undefined || !Number.isInteger(n) || n === 0) throw new Error(`${what} takes a line number`);
      const res = n > 0 ? this.history[n - 1] : this.history.at(n);
      if (!res) throw new Error(`no line ${n}`);
      return res;
    };
    this.ce.declare("Out", {
      signature: "(number) -> any",
      evaluate: (ops) => at(ops, "Out").expr,
    });
    this.ce.declare("In", {
      signature: "(number) -> any",
      evaluate: (ops) => at(ops, "In").raw.evaluate(),
    });
    this.ce.declare("InString", {
      signature: "(number) -> string",
      evaluate: (ops) => this.ce.string(at(ops, "InString").input),
    });
  }

  /** Parse a line (syntax pragma, `%` substitution) without evaluating or recording it. */
  parse(input: string): Parsed {
    const { syntax, body } = classifyInput(input, this.defaultSyntax);
    return { syntax, body, raw: this.box(syntax, this.substitute(body, syntax)) };
  }

  /** Parse + evaluate a line, recording it as the next `Out[n]`. */
  evaluate(input: string): EvalResult {
    const { syntax, raw } = this.parse(input);
    const expr = raw.evaluate();
    const res: EvalResult = { n: ++this.counter, input, syntax, raw, expr };
    this.history.push(res);
    return res;
  }

  /** Record an already-parsed MathJSON value as the next result (e.g. an import). */
  evaluateJson(json: unknown, input = "(import)"): EvalResult {
    const raw = this.ce.box(json as Parameters<ComputeEngine["box"]>[0]);
    const res: EvalResult = {
      n: ++this.counter,
      input,
      syntax: "mathjson",
      raw,
      expr: raw.evaluate(),
    };
    this.history.push(res);
    return res;
  }

  /** `name = expr` — evaluate, bind on the engine, and remember for `:vars`. */
  assign(name: string, input: string): EvalResult {
    const res = this.evaluate(input);
    this.ce.assign(name, res.expr);
    this.vars.set(name, res.expr);
    return res;
  }

  render(expr: BoxedExpression, form: Form = this.form): string {
    try {
      const out = renderForm(expr, form);
      return out === "" ? `(no ${FORM_LABEL[form]} for this expression)` : out;
    } catch (err) {
      return `(${FORM_LABEL[form]} unavailable: ${(err as Error).message})`;
    }
  }

  /** Numerically sample a one-variable expression — points for a line plot. */
  sample(input: string, opts: SampleOptions = {}): PlotPoint[] {
    const { syntax, body } = classifyInput(input, this.defaultSyntax);
    return this.sampleBoxed(this.box(syntax, this.substitute(body, syntax)), opts);
  }

  /** Sample an already-parsed body -- a `Plot` head's first argument. */
  sampleJson(json: unknown, opts: SampleOptions = {}): PlotPoint[] {
    return this.sampleBoxed(this.ce.box(json as Parameters<ComputeEngine["box"]>[0]), opts);
  }

  private sampleBoxed(expr: BoxedExpression, opts: SampleOptions): PlotPoint[] {
    const variable = opts.variable ?? "x";
    const from = opts.from ?? -5;
    const to = opts.to ?? 5;
    const steps = Math.max(2, opts.steps ?? 120);
    const points: PlotPoint[] = [];
    for (let i = 0; i < steps; i++) {
      const x = from + ((to - from) * i) / (steps - 1);
      const y = expr.subs({ [variable]: x }).N().re;
      points.push({ x, y });
    }
    return points;
  }

  private box(syntax: Syntax, body: string): BoxedExpression {
    switch (syntax) {
      case "latex": {
        const expr = this.ce.parse(body);
        if (!expr) throw new Error("could not parse LaTeX");
        return expr;
      }
      case "wolfram":
        return this.ce.box(importFrom(body, "WL") as Parameters<ComputeEngine["box"]>[0]);
      case "mathjson":
        return this.ce.box(importFrom(body, "MathJSON") as Parameters<ComputeEngine["box"]>[0]);
      case "epsil":
        return this.ce.box(importFrom(body, "Epsil", { ce: this.ce }) as Parameters<ComputeEngine["box"]>[0]);
    }
  }

  /**
   * Replace `%`, `%%`, `%n` with a prior result -- in Wolfram syntax only, where they are
   * Wolfram's own. In Epsil `%` is `Mod` and in LaTeX a comment; there, `Out(n)`.
   */
  private substitute(body: string, syntax: Syntax): string {
    if (syntax !== "wolfram") return body;
    return body.replace(/%(\d+)|%+/g, (tok) => {
      const numbered = /^%(\d+)$/.exec(tok);
      const ref = numbered ? this.history[Number(numbered[1]) - 1] : this.history[this.history.length - tok.length];
      if (!ref) throw new Error(`no result for ${tok}`);
      return this.serialize(ref.expr, syntax);
    });
  }

  private serialize(expr: BoxedExpression, syntax: Syntax): string {
    switch (syntax) {
      case "latex":
        return `\\left(${expr.latex}\\right)`;
      case "wolfram":
        return String(exportTo(expr, "WL"));
      case "mathjson":
        return String(exportTo(expr, "MathJSON"));
      case "epsil":
        return `(${String(exportTo(expr, "Epsil"))})`;
    }
  }
}
