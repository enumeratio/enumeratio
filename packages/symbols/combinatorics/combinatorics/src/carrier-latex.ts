// StandardForm LaTeX for the carrier constructors: what the engine writes when the text has
// to read back. Display is a different job (a `Render` representation's `latex` medium,
// `2\,3\,1`), and conventional notation doesn't read back on its own:
//
//   2\,3\,1                parses as the number 231
//   (1\,2\,3)              parses as 123: LaTeX parentheses group, they aren't cycles
//   \permutation(2, 3, 1)  parses as the permutation
//
// So each constructor gets a trigger of its own, and a MathLive macro so an editor shows it.

import type { MathJsonExpression } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry, Parser, Serializer } from "@cortex-js/compute-engine/latex-syntax";
import type { Carrier } from "@enumeratio/structures";

/** A carrier constructor's command, its type in camel case: `\permutation`, `\integerPartition`. */
export const commandFor = (carrier: Carrier): string =>
  carrier.type.replace(/_(.)/g, (_, c: string) => c.toUpperCase());

/** The trigger for a carrier constructor, `\permutation`. */
export const triggerFor = (carrier: Carrier): string => `\\${commandFor(carrier)}`;

/** The collection a carrier's operand is, written as the call's arguments: `list<…>` and
 *  `tuple<…>` shapes; any other shape is written as one argument. */
const spread = (carrier: Carrier): "List" | "Tuple" | undefined =>
  carrier.shape.startsWith("list<") ? "List" : carrier.shape.startsWith("tuple<") ? "Tuple" : undefined;

/** One entry per carrier: writes `\trigger(…)` and reads it back into the constructor. */
export function carrierLatex(carriers: readonly Carrier[]): Partial<LatexDictionaryEntry>[] {
  return carriers.map((carrier) => {
    const trigger = triggerFor(carrier);
    const head = spread(carrier);
    return {
      kind: "function" as const,
      name: carrier.name,
      latexTrigger: trigger,
      serialize: (serializer: Serializer, expr: MathJsonExpression): string => {
        const ops = Array.isArray(expr) ? (expr.slice(1) as MathJsonExpression[]) : [];
        const [op] = ops;
        const args =
          ops.length !== 1
            ? undefined
            : head !== undefined && Array.isArray(op) && op[0] === head
              ? (op.slice(1) as MathJsonExpression[])
              : head === undefined
                ? [op!]
                : undefined;
        // Not the shape this trigger reads back (`Permutation(x)`): written as any call is.
        if (args === undefined)
          return `\\operatorname{${carrier.name}}(${ops.map((x) => serializer.serialize(x)).join(", ")})`;
        return `${trigger}(${args.map((x) => serializer.serialize(x)).join(", ")})`;
      },
      parse: (parser: Parser): MathJsonExpression | null => {
        const args = parser.parseArguments("enclosure");
        if (args === null) return null;
        if (head !== undefined) return [carrier.name, [head, ...args]];
        return args.length === 1 ? [carrier.name, args[0]!] : null;
      },
    };
  });
}

/** MathLive macros for the triggers: each shows as its constructor's name. */
export const carrierMacros = (carriers: readonly Carrier[]): Record<string, string> =>
  Object.fromEntries(carriers.map((carrier) => [commandFor(carrier), `\\operatorname{${carrier.name}}`]));
