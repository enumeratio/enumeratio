import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { Overload } from "./types.ts";

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// compute-engine resolves a call against the most specific admissible overload whatever
// order they're written in, but keeps the order it was given and breaks a tie by it. So the
// manifest orders a head's overloads itself: most specific first -- every parameter
// position a subtype of the other's -- then by printed type and package, so the order is
// the same however the records list them. A type the bare engine can't parse (one naming a
// nominal type a package declares) or an intersection of arms is compared by print alone.

interface Arm {
  readonly at: (i: number) => BoxedType | undefined;
  readonly min: number;
  readonly max: number;
}
type BoxedType = ReturnType<ComputeEngine["type"]>;

function armOf(typing: ComputeEngine, arms: Map<string, Arm | undefined>, type: string | undefined): Arm | undefined {
  if (type === undefined) return undefined;
  if (arms.has(type)) return arms.get(type);
  let arm: Arm | undefined;
  try {
    const ast = typing.type(type).type as unknown as {
      kind: string;
      args?: { type: unknown }[];
      optArgs?: { type: unknown }[];
      variadicArg?: { type: unknown };
      variadicMin?: number;
    };
    if (ast.kind === "signature") {
      const fixed = [...(ast.args ?? []), ...(ast.optArgs ?? [])].map((a) => typing.type(a.type as never));
      const rest = ast.variadicArg === undefined ? undefined : typing.type(ast.variadicArg.type as never);
      arm = {
        at: (i) => fixed[i] ?? rest,
        min: (ast.args ?? []).length + (ast.variadicMin ?? 0),
        max: rest === undefined ? fixed.length : Number.POSITIVE_INFINITY,
      };
    }
  } catch {
    arm = undefined;
  }
  arms.set(type, arm);
  return arm;
}

/** Every call `a` admits, `b` admits too, position by position. */
function narrower(a: Arm, b: Arm): boolean {
  if (a.min < b.min || a.max > b.max) return false;
  const positions = Number.isFinite(a.max) ? a.max : a.min + 1;
  for (let i = 0; i < positions; i++) {
    const pa = a.at(i);
    const pb = b.at(i);
    if (pa === undefined || pb === undefined || !pa.matches(pb)) return false;
  }
  return true;
}

/** `overloads`, most specific first, ties and the incomparable by printed type then package. */
export function canonicalOrder(overloads: readonly Overload[], typing: ComputeEngine): Overload[] {
  const arms = new Map<string, Arm | undefined>();
  const specificity = (o: Overload): number => {
    const a = armOf(typing, arms, o.type);
    if (a === undefined) return 0;
    return overloads.filter((other) => {
      const b = armOf(typing, arms, other.type);
      return other !== o && b !== undefined && narrower(a, b) && !narrower(b, a);
    }).length;
  };
  const scored = overloads.map((o) => ({ o, score: specificity(o) }));
  return scored
    .toSorted((x, y) => y.score - x.score || cmp(x.o.type ?? "", y.o.type ?? "") || cmp(x.o.package, y.o.package))
    .map(({ o }) => o);
}
