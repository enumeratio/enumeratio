// A head's function view: the plot a numeric function is drawn as, over one of its arguments,
// with the rest as controls. Pure, from the typed signature alone (plus an optional `plot:` hint
// from the record), so a page can build it at build time and a test can hold every head to it.
// The plot's choice is `inferPlotOver`'s (real -> Plot, complex -> ComplexPlot, integer ->
// DiscretePlot), in Wolfram's names; the other arguments are `inferControl`s.

import {
  controllableType,
  inferControl,
  inferPlotOver,
  typeBounds,
  numericDomainOf,
  paramsOf,
  type HeadSignature,
  type NumericDomain,
  type PlotHead,
} from "./infer-controls.ts";

/** What a record says about how its head is drawn (`ReferenceEntry.plot`). */
export interface PlotHints {
  /** The parameter to plot over, by name. */
  readonly axis?: string;
  /** `[min, max]` for a real or integer axis, `[reMin, reMax, imMin, imMax]` for a complex one. */
  readonly window?: readonly number[];
}

export interface FunctionViewContext {
  /** Whether the complex emitter can lower a call of this head; default every head does. */
  readonly lowers?: (head: string) => boolean;
}

/** A head's signature with its result type, the part `HeadSignature` leaves out. */
export interface FunctionSignature extends HeadSignature {
  /** The result type (`number`); a head with no numeric result has no function view. */
  readonly returns?: string;
}

export interface FunctionViewPlot {
  readonly head: PlotHead;
  /** The symbol the plot ranges over. */
  readonly variable: string;
  /** The range tuple, as Epsil: `{z, -4 - 4*I, 4 + 4*I}`. */
  readonly window: string;
  /** The head applied, over the variable and the control names. */
  readonly body: string;
  readonly note?: string;
}

export interface FunctionView {
  /** The argument plotted over: its position in the call, and the symbol standing for it. */
  readonly axis: { readonly name: string; readonly position: number };
  readonly axisDomain: NumericDomain;
  /** The axis range: `[min, max]`, or `[reMin, reMax, imMin, imMax]` for a complex axis. */
  readonly window: readonly number[];
  /** The plots to offer, first the default; none when `reason` says why. */
  readonly views: readonly FunctionViewPlot[];
  /** The head applied, over the axis symbol and the control names. */
  readonly body: string;
  /** The controls for the other arguments, as `<notatio-manipulate params>`. */
  readonly params: string;
  /** Why the view is not the whole story: the plot it was meant to be is missing or reduced. */
  readonly reason?: string;
}

/** The result type of a function type, `(x: integer, any?) time -> number` giving `number`. */
export function returnTypeOf(signature: string): string | undefined {
  let depth = 0;
  for (let i = 0; i < signature.length; i++) {
    const c = signature[i];
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) {
      const rest = /^\s*\w*\s*->\s*(.*)$/s.exec(signature.slice(i + 1));
      return rest?.[1]?.trim();
    }
  }
  return undefined;
}

const AXIS_LETTER: Readonly<Record<NumericDomain, string>> = { real: "x", complex: "z", integer: "n" };
const COMPLEX_WINDOW = [-4, 4, -4, 4] as const;
const REAL_WINDOW = [-10, 10] as const;
const INTEGER_SPAN = 20;

/** The default range over an axis of `type`: ±10, ±4(1+i), or the first 20 integers, kept inside the type's own bounds. */
function windowOf(domain: NumericDomain, type: string): readonly number[] {
  if (domain === "complex") return COMPLEX_WINDOW;
  const { lo, hi } = typeBounds(type);
  const reach = domain === "integer" ? INTEGER_SPAN : REAL_WINDOW[1];
  // One bound set: reach from it. None: symmetric about zero.
  const min = lo ?? (hi === undefined ? REAL_WINDOW[0] : hi - reach);
  const max = hi ?? (lo === undefined ? REAL_WINDOW[1] : lo + reach);
  return [min, max];
}

const num = (n: number): string => String(n);

/** An axis range as the plot's range tuple. */
function rangeTuple(variable: string, domain: NumericDomain, w: readonly number[]): string {
  if (domain !== "complex") return `{${variable}, ${num(w[0]!)}, ${num(w[1]!)}}`;
  const corner = (re: number, im: number): string => `${num(re)} ${im < 0 ? "-" : "+"} ${Math.abs(im)}*I`;
  return `{${variable}, ${corner(w[0]!, w[2]!)}, ${corner(w[1]!, w[3]!)}}`;
}

/** A hint's window if it fits the axis's domain (two ends, four for a complex axis), else the default. */
function chosenWindow(hint: readonly number[] | undefined, domain: NumericDomain, dflt: readonly number[]) {
  const ok =
    hint !== undefined &&
    hint.length === (domain === "complex" ? 4 : 2) &&
    hint.every(Number.isFinite) &&
    hint[0]! < hint[1]! &&
    (domain !== "complex" || hint[2]! < hint[3]!);
  return ok ? hint : dflt;
}

/**
 * The function view of a head: the plot of its (numeric) result over one numeric argument, the
 * others controls. The axis is the last required numeric parameter, unless `record.plot.axis`
 * names one; the window is the record's, else the default for the axis's domain.
 *
 * Undefined for a head with no numeric result or no numeric argument (nothing to plot). A head
 * that has both but cannot be drawn (an argument no control draws, the named axis missing)
 * comes back with no views and a `reason`.
 */
export function functionViewOf(
  signature: FunctionSignature,
  record?: { readonly plot?: PlotHints },
  ctx: FunctionViewContext = {},
): FunctionView | undefined {
  if (signature.returns === undefined || numericDomainOf(signature.returns) === undefined) return undefined;
  const params = signature.parameters.map((p, i) => ({
    ...p,
    name: p.name !== undefined && /^\p{Ll}\w*$/u.test(p.name) ? p.name : `p${i + 1}`,
    position: i,
    domain: p.variadic ? undefined : numericDomainOf(p.type),
  }));
  const numeric = params.filter((p) => p.domain !== undefined);
  if (numeric.length === 0) return undefined;

  const wanted = record?.plot?.axis;
  const chosen =
    wanted === undefined
      ? (numeric.filter((p) => !p.optional).at(-1) ?? numeric.at(-1))
      : numeric.find((p) => p.name === wanted || signature.parameters[p.position]?.name === wanted);
  const stub = (reason: string): FunctionView => ({
    axis: { name: "", position: -1 },
    axisDomain: "real",
    window: [],
    views: [],
    body: "",
    params: "",
    reason,
  });
  if (chosen === undefined)
    return stub(
      wanted === undefined ? "no numeric argument to plot over" : `plot.axis ${wanted} is not a numeric argument`,
    );
  const domain = chosen.domain as NumericDomain;
  const axisName = AXIS_LETTER[domain];

  // The other arguments, left to right: required ones become controls (names the axis symbol
  // already uses are renamed), optional ones are left out of the call.
  const taken = new Set([axisName]);
  const callArgs: string[] = [];
  const tuples: string[] = [];
  let blocked: string | undefined;
  for (const p of params) {
    if (p === chosen) {
      callArgs.push("\0");
      continue;
    }
    if (p.optional || p.variadic) continue;
    const type = controllableType(p.type);
    // A text box is no way to move a function's argument.
    if (type === undefined || type === "string") {
      blocked ??= `argument ${p.name} of type ${p.type} has no control`;
      continue;
    }
    const name = taken.has(p.name) ? `p${p.position + 1}` : p.name;
    taken.add(name);
    // A complex side argument is moved along the real line: a 2-D pad per argument is no way to scrub.
    const drawn = numericDomainOf(type) === "complex" ? "real" : type;
    const spec = inferControl(name, { hints: { [name]: { type: drawn } } });
    const tuple = paramsOf(spec);
    if (tuple === undefined) {
      blocked ??= `argument ${p.name} of type ${p.type} has no control`;
      continue;
    }
    callArgs.push(name);
    tuples.push(tuple);
  }
  const bodyOver = (variable: string): string =>
    `${signature.head}(${callArgs.map((a) => (a === "\0" ? variable : a)).join(", ")})`;

  const window = chosenWindow(record?.plot?.window, domain, windowOf(domain, chosen.type));
  const base = {
    axis: { name: axisName, position: chosen.position },
    axisDomain: domain,
    window,
    body: bodyOver(axisName),
    params: tuples.join("; "),
  };
  if (blocked !== undefined) return { ...base, views: [], reason: blocked };

  const choice = inferPlotOver([axisName], { types: { [axisName]: domain } });
  if (choice === undefined) return { ...base, views: [], reason: `no plot over a ${domain} axis` };
  const main: FunctionViewPlot = {
    head: choice.head,
    variable: axisName,
    window: rangeTuple(axisName, domain, window),
    body: base.body,
  };
  if (domain !== "complex") return { ...base, views: [main] };

  // The real line through a complex axis: the real part of the head at `x` over the same reach.
  const slice: FunctionViewPlot = {
    head: "Plot",
    variable: "x",
    window: rangeTuple("x", "real", [window[0]!, window[1]!]),
    body: `Re(${bodyOver("x")})`,
    note: "real slice",
  };
  return ctx.lowers?.(signature.head) === false
    ? { ...base, views: [slice], reason: `the complex plot cannot lower ${signature.head}` }
    : { ...base, views: [main, slice] };
}

/** One drawn plot of a function view, as a page lays it out. */
export interface FunctionViewPanel {
  /** The plot head, or its note (`real slice`) when that says more. */
  readonly label: string;
  /** What a screen reader hears for the plot: `Plot of Gamma(z) over the complex plane`. */
  readonly aria: string;
  /** `<notatio-manipulate params>`: the controls for the other arguments. */
  readonly params: string;
  /** The plot as Epsil over the control slots (`_n`), for a `<dynamic-box value>`. */
  readonly value: string;
}

const AXIS_PHRASE: Readonly<Record<NumericDomain, string>> = {
  real: "the real line",
  complex: "the complex plane",
  integer: "the integers",
};

/** The control names of a view: the body's arguments other than the axis symbol. */
function controlNames(view: FunctionView): string[] {
  const args = /^[^(]+\((.*)\)$/s.exec(view.body)?.[1]?.split(",") ?? [];
  return args.map((a) => a.trim()).filter((a) => a !== "" && a !== view.axis.name);
}

/** The plots of a view as panels, each over the same controls; none when the view has no plot. */
export function viewPanels(view: FunctionView): FunctionViewPanel[] {
  const names = controlNames(view);
  const slot = (source: string): string =>
    names.length === 0 ? source : source.replace(new RegExp(`\\b(${names.join("|")})\\b`, "g"), "_$1");
  return view.views.map((plot) => {
    const domain = plot.note === undefined ? view.axisDomain : "real";
    return {
      label: plot.note ?? plot.head,
      aria: `Plot of ${plot.body} over ${AXIS_PHRASE[domain]}`,
      params: view.params,
      value: `${plot.head}(${slot(plot.body)}, ${plot.window})`,
    };
  });
}

/** What a page's Plot section shows: the plots, and the reason when it has one; undefined (no section) for a head with nothing to say. */
export function plotSectionOf(
  view: FunctionView | undefined,
): { readonly panels: FunctionViewPanel[]; readonly reason?: string } | undefined {
  if (view === undefined) return undefined;
  const panels = viewPanels(view);
  if (panels.length === 0 && view.reason === undefined) return undefined;
  return { panels, ...(view.reason === undefined ? {} : { reason: view.reason }) };
}
