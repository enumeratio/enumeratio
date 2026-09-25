// `Render(value, "cycle")` and `ParseAs("(1 2 3)", "permutation", "cycle")`.
//
// Both are typed by carrier: `Render` reads the carrier off the VALUE, so it cannot be asked
// to write a permutation as a partition, and `ParseAs` returns a constructed carrier value
// rather than a bare list.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/boxed";
import { ALL_REPRESENTATIONS, canonicalFor, type Medium, type Representation } from "./representation.ts";

const intsOf = (expr: BoxedExpression | undefined): number[] =>
  operandsOf(expr).map((operand) => Math.trunc(Number(operand.re)));

const stringOf = (expr: BoxedExpression | undefined): string | undefined => {
  const direct = (expr as { string?: unknown } | undefined)?.string;
  if (typeof direct === "string") return direct.replace(/^'(.*)'$/s, "$1");
  const json = expr?.json;
  return typeof json === "string" ? json.replace(/^'(.*)'$/s, "$1") : undefined;
};

/**
 * Declare `Render` and `ParseAs`.
 *
 * `constructorFor` maps a carrier type to its constructor head, as `declareMaps` takes it.
 */
export function declareRendering(
  ce: ComputeEngine,
  constructorFor: Readonly<Record<string, string>>,
  representations: readonly Representation[] = ALL_REPRESENTATIONS,
): void {
  const find = (carrier: string, name: string, medium: Medium): Representation | undefined =>
    representations.find((r) => r.on === carrier && r.name === name && r.medium === medium);

  ce.declare("Render", {
    signature: "(any, string?, string?) -> string",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [value, which, wanted] = ops;
      if (value === undefined) return undefined;
      const carrier = String(value.type);
      const medium = (stringOf(wanted) ?? "ascii") as Medium;
      // No name given: the canonical representation, which is what a bare value should show.
      const name = which === undefined ? canonicalFor(carrier, medium)?.name : stringOf(which);
      if (name === undefined) return undefined;
      const representation = find(carrier, name, medium);
      if (representation === undefined) return undefined;
      return ce.string(representation.render(intsOf(operandsOf(value)[0])));
    },
  });

  ce.declare("ParseAs", {
    signature: "(string, string, string?) -> any",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const [text, carrierName, which] = ops;
      const source = stringOf(text);
      const carrier = stringOf(carrierName);
      if (source === undefined || carrier === undefined) return undefined;
      // Parsing is an ascii affair: the latex representations are display-only.
      const name = which === undefined ? canonicalFor(carrier)?.name : stringOf(which);
      const representation = name === undefined ? undefined : find(carrier, name, "ascii");
      const parse = representation?.parse;
      if (parse === undefined) return undefined;
      const contents = parse(source);
      const wrap = constructorFor[carrier];
      if (contents === undefined || wrap === undefined) return undefined;
      return ce
        .function(wrap, [
          ce.function(
            "List",
            contents.map((entry) => ce.number(entry)),
          ),
        ])
        .evaluate();
    },
  });
}
