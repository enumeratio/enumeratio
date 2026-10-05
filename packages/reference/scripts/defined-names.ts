// Shared between collect-defined-names.ts (the generator) and defined-names.test.ts (the
// currency check) so the two can never drift onto two different notions of "defined" — see
// collect-defined-names.ts for what this set is for.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJSON } from "@enumeratio/oracle";

/** Every bare (unquoted) string symbol anywhere in `expr` — head positions included, since a
 * head passed as a value (`Fold(Add, 0, xs)`) is exactly the kind of name this matters for. */
export function symbolsIn(expr: MathJSON, into: Set<string>): void {
  if (typeof expr === "string") {
    if (!/^'.*'$/s.test(expr)) into.add(expr);
    return;
  }
  if (Array.isArray(expr)) for (const item of expr) symbolsIn(item as MathJSON, into);
}

// A `lookupDefinition` hit alone isn't "not free": compute-engine auto-declares a definition
// shell for a bare name the moment it's boxed, before any real evidence about it exists — and
// records that in the definition's OWN provenance, not just as a heuristic of ours. `m`/`s`/
// `A`/`C` are the clearest case: present on a totally pristine `new ComputeEngine()`, before a
// single reference example ever runs, because compute-engine's own construction-time self-
// checks box sample expressions that happen to name them — not a units or placeholder
// CONVENTION, just auto-declare firing early. `z`/`w`/any other untouched name stays undefined
// on that same pristine engine, confirming it (verified directly: #499).
//
// compute-engine marks exactly this on the definition itself: a `BoxedValueDefinition`'s
// `_typeProvenance` is a log of every write to its type, and a write of kind `'auto-declared'`
// — "the binding was *created* as a side effect of boxing a free symbol... before any
// evidence" (its own doc, types-definitions.d.ts) — is the authoritative marker. An entry only
// ever gets appended (an auto-declared symbol later INFERRED from use gets a second entry, not
// a replaced first one), so checking for that entry ANYWHERE in the log, not just first, is
// still exactly "was this one ever a bare auto-declare".
//
// Used THROUGH the engine, not by guessing at a type: a domain (`Primes`, `GaussianIntegers`) or
// a real constant (`NaN`, `ImaginaryUnit`) has no auto-declared entry, because both were actually
// declared, just not by auto-declare.
//
// A declared number with no value that is not a constant is still a free variable, only a
// reserved one, so an external system reads it as an unknown too.
export function isDefinedName(ce: ComputeEngine, name: string): boolean {
  const def = ce.lookupDefinition(name) as unknown as
    | {
        operator?: unknown;
        value?: {
          isConstant?: boolean;
          value?: unknown;
          type?: { matches?: (type: string) => boolean };
          _typeProvenance?: readonly { readonly kind?: string }[];
        };
      }
    | undefined;
  if (def === undefined) return false;
  if ("operator" in def) return true;
  const provenance = def.value?._typeProvenance;
  if (provenance?.some((entry) => entry.kind === "auto-declared") ?? false) return false;
  const { isConstant, value, type } = def.value ?? {};
  return isConstant === true || value !== undefined || type?.matches?.("number") !== true;
}
