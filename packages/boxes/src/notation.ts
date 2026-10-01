// A head's traditional notation, as a rule `makeBoxes` consults before writing it `f(x)`.
// The package that owns a head owns its notation: it exports a `Notation` and registers it on
// the engine it declares into, so whatever renders that engine's values finds it.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import { type Box, row, subscript } from "./box.ts";

/** Writes a rule's arguments, as `makeBoxes` writes anything. */
export interface Writer {
  /** An argument's boxes. */
  box(json: MathJsonExpression): Box;
  /** An argument as a base: fenced unless it binds as tightly as a symbol does. */
  tight(json: MathJsonExpression): Box;
  /** `name(args…)`, the way a call is written. */
  call(name: Box, args: readonly MathJsonExpression[]): Box;
}

/** A head's boxes, or `undefined` to write it as a call. */
export type NotationRule = (args: readonly MathJsonExpression[], write: Writer) => Box | undefined;
export type Notation = Readonly<Record<string, NotationRule>>;

export const isList = (x: MathJsonExpression): boolean => Array.isArray(x) && x[0] === "List";

/** `rule`, except that a call with a literal list argument stays a call: a head threaded over
 *  a list (`Fibonacci([1, 2, 3])`) reads worse as `F_{[1,2,3]}`. */
export const scalars =
  (rule: NotationRule): NotationRule =>
  (args, write) =>
    args.some(isList) ? undefined : rule(args, write);

/** `symbol(args)`, for exactly `arity` arguments. */
export const named =
  (symbol: Box, arity: number): NotationRule =>
  (args, write) =>
    args.length === arity ? write.call(symbol, args) : undefined;

/** `symbol_n`, or `symbol_n(x)` given a second argument. */
export const indexed =
  (symbol: Box): NotationRule =>
  ([n, x, ...rest], write) => {
    if (n === undefined || rest.length > 0) return undefined;
    const base = subscript(symbol, write.box(n));
    return x === undefined ? base : write.call(base, [x]);
  };

/** `symbol_k(args)`: the first of `arity` arguments an index, the rest the call. */
export const subscripted =
  (symbol: Box, arity: number): NotationRule =>
  ([k, ...args], write) =>
    k === undefined || args.length !== arity - 1 ? undefined : write.call(subscript(symbol, write.box(k)), args);

/** `open body close`, as one row. */
export const fence = (open: string, body: readonly Box[], close: string): Box => row([open, ...body, close]);

const registered = new WeakMap<object, Notation>();

/** Add `notation` to what renders `owner`'s values (an engine); later entries win. */
export function registerNotation(owner: object, notation: Notation): void {
  registered.set(owner, { ...registered.get(owner), ...notation });
}

/** The notation registered on `owner`. */
export const notationOf = (owner: object): Notation => registered.get(owner) ?? {};

/** A package's notation, as its `./notation` entry exports it (`notation`): what a host loads
 *  for every catalogued package before it builds an engine, whose LaTeX dictionary is fixed
 *  at construction. Light: no definitions, nothing beyond boxes and compute-engine types. */
export interface PackageNotation {
  /** TraditionalForm: box rules for `makeBoxes`. */
  readonly traditional?: Notation;
  /** StandardForm: LaTeX dictionary entries, each a parse and serialise pair. */
  readonly latex?: readonly Partial<LatexDictionaryEntry>[];
  /** MathLive macros for the LaTeX commands `latex` introduces, by command name. */
  readonly macros?: Readonly<Record<string, string>>;
}

/** Several packages' notation as one, in order: later rules and macros win. */
export function combineNotation(packages: readonly PackageNotation[]): Required<PackageNotation> {
  const traditional: Record<string, NotationRule> = {};
  const latex: Partial<LatexDictionaryEntry>[] = [];
  const macros: Record<string, string> = {};
  for (const p of packages) {
    Object.assign(traditional, p.traditional);
    latex.push(...(p.latex ?? []));
    Object.assign(macros, p.macros);
  }
  return { traditional, latex, macros };
}
