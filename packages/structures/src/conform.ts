import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { symbolNameOf } from "@enumeratio/engine";
import { ancestry, ensureProtocols, PROTOCOLS, type ProtocolName, protocol } from "./protocols.ts";

/** A member's implementation: the receiver first. `undefined` when it has no answer, which
 *  leaves the call unevaluated. */
export type Member = (...args: BoxedExpression[]) => BoxedExpression | undefined;

/** The protocols a type conforms to, each with its members' implementations. */
export type Conformance = Partial<Record<ProtocolName, Readonly<Record<string, Member>>>>;

/**
 * Make `type` conform to every protocol in `conformance`. Refinement is checked here, since
 * compute-engine doesn't know it: claiming `Lattice` without `PartialOrder` is an error, not a
 * type that sorts by a `Compare` it never gave.
 */
export function conform(ce: ComputeEngine, type: string, conformance: Conformance): void {
  ensureProtocols(ce);
  for (const name of Object.keys(conformance) as ProtocolName[]) {
    for (const parent of ancestry(name))
      if (conformance[parent] === undefined) throw new Error(`structures: ${type} claims ${name} but not ${parent}`);
    const missing = Object.keys(protocol(name).members).filter((m) => conformance[name]![m] === undefined);
    if (missing.length > 0) throw new Error(`structures: ${type} as ${name} lacks ${missing.join(", ")}`);
  }
  // Parents first, the order PROTOCOLS lists them in.
  for (const { name } of PROTOCOLS) {
    const functions = conformance[name];
    if (functions === undefined) continue;
    // A member with no answer leaves the call as written, as a head without a rule does,
    // rather than compute-engine's `Nothing`.
    const answering = Object.fromEntries(
      Object.entries(functions).map(([m, f]) => [
        m,
        (...args: BoxedExpression[]) => f(...args) ?? ce.function(m, args),
      ]),
    );
    ce.declareProtocolImplementation(type, name, { functions: answering });
  }
}

/**
 * Call a protocol member, through compute-engine's dispatch -- so a conformance declared in
 * Epsil answers too. `undefined` when the value's type doesn't conform or the member has no
 * answer for these arguments.
 */
export function member(ce: ComputeEngine, name: string, args: readonly BoxedExpression[]): BoxedExpression | undefined {
  const result = ce.function(name, [...args]).evaluate();
  if (result.operator === name || result.operator === "Error" || symbolNameOf(result) === "Nothing") return undefined;
  return result;
}

/** `Compare(a, b)` as -1, 0 or 1; `undefined` when incomparable or not ordered at all. */
export function compare(ce: ComputeEngine, a: BoxedExpression, b: BoxedExpression): -1 | 0 | 1 | undefined {
  const c = member(ce, "Compare", [a, b])?.re;
  return c === -1 || c === 0 || c === 1 ? c : undefined;
}
