import type { ComputeEngine } from "@cortex-js/compute-engine";

interface SigArg {
  readonly type: unknown;
}
interface SimpleSignature {
  kind: "signature";
  args?: SigArg[];
  optArgs?: SigArg[];
  variadicArg?: SigArg;
  variadicMin?: number;
  result: unknown;
  typeParams?: unknown[];
}

const isSimpleSignature = (t: unknown): t is SimpleSignature =>
  typeof t === "object" &&
  t !== null &&
  (t as SimpleSignature).kind === "signature" &&
  !(t as SimpleSignature).typeParams?.length;

/** The union of two types, collapsed when one already covers the other. */
function unionType(ce: ComputeEngine, a: unknown, b: unknown): unknown {
  if (ce.type(b as never).matches(ce.type(a as never))) return a;
  if (ce.type(a as never).matches(ce.type(b as never))) return b;
  const parts = [a, b].flatMap((t) =>
    typeof t === "object" && t !== null && (t as { kind?: string }).kind === "union"
      ? (t as { types: unknown[] }).types
      : [t],
  );
  return { kind: "union", types: parts };
}

/**
 * A signature admitting everything `current` and `requested` each admit: parameters join
 * positionally (a position only one side has becomes optional), results join by union.
 * `undefined` when either isn't a plain signature (generic, intersection).
 */
function joinWide(ce: ComputeEngine, current: unknown, requested: unknown): SimpleSignature | undefined {
  if (!isSimpleSignature(current) || !isSimpleSignature(requested)) return undefined;
  const sides = [current, requested];
  const fixed = (s: SimpleSignature): SigArg[] => [...(s.args ?? []), ...(s.optArgs ?? [])];
  const variadic = (s: SimpleSignature): unknown => s.variadicArg?.type;
  const join = (types: unknown[]): unknown => types.reduce((acc, t) => unionType(ce, acc, t));
  const at = (i: number): unknown =>
    join(sides.map((s) => fixed(s)[i]?.type ?? variadic(s)).filter((t) => t !== undefined));

  const count = Math.max(...sides.map((s) => fixed(s).length));
  const required = Math.min(...sides.map((s) => s.args?.length ?? 0));
  const hasVariadic = sides.some((s) => variadic(s) !== undefined);
  const args: SigArg[] = [];
  const optArgs: SigArg[] = [];
  // A variadic head can't also carry optionals, so a position past `required` folds into it.
  const rest: unknown[] = sides.map(variadic).filter((t) => t !== undefined);
  for (let i = 0; i < count; i++) {
    if (i < required) args.push({ type: at(i) });
    else if (hasVariadic) rest.push(at(i));
    else optArgs.push({ type: at(i) });
  }
  const merged: SimpleSignature = { kind: "signature", result: join(sides.map((s) => s.result)) };
  if (args.length) merged.args = args;
  if (optArgs.length) merged.optArgs = optArgs;
  if (rest.length) {
    merged.variadicArg = { type: join(rest) };
    // Explicit: an unset minimum prints as `+`.
    merged.variadicMin = sides.every((s) => variadic(s) !== undefined)
      ? Math.min(...sides.map((s) => s.variadicMin ?? 0))
      : 0;
  }
  return merged;
}

/** The signature admitting everything `current` and `requested` admit, as a type string; `requested` when they can't be joined. */
export function widenedSignature(ce: ComputeEngine, current: string, requested: string): string {
  const merged = joinWide(ce, ce.type(current as never).type, ce.type(requested as never).type);
  return merged === undefined ? requested : String(ce.type(merged as never));
}
