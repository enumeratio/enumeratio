import { type BoxedExpression, type ComputeEngine, isDictionary } from "@cortex-js/compute-engine";

/** `About`'s entries, in order, from the dictionary it evaluated to. */
export function entriesOf(dictionary: BoxedExpression): [string, BoxedExpression][] {
  if (!isDictionary(dictionary)) return [];
  return [...dictionary.keys].flatMap((key) => {
    const value = dictionary.get(key);
    return value === undefined ? [] : [[key, value] as [string, BoxedExpression]];
  });
}

/** A dictionary of `entries`, evaluated as `About` assembles its own. */
export const dictionaryOf = (ce: ComputeEngine, entries: readonly [string, BoxedExpression][]): BoxedExpression =>
  ce
    .function(
      "Dictionary",
      entries.map(([key, value]) => ce.function("KeyValuePair", [ce.string(key), value])),
    )
    .evaluate();
