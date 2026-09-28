import type { ComputeEngine } from "@cortex-js/compute-engine";

// The structures a generic head can require (design/structures.md), as compute-engine
// protocols. compute-engine has no refinement, so `refines` is ours: `conform` makes a type
// that claims a protocol claim its parents too.
//
// A member becomes a head that dispatches on its first argument's type, so every member name
// here is free: one named like an existing head (`Floor`, `Join`, `Infimum`) is shadowed by
// that head and never dispatches.

export interface Protocol {
  readonly name: string;
  readonly refines: readonly string[];
  /** Member name to signature, in compute-engine's type grammar. */
  readonly members: Readonly<Record<string, string>>;
  /** What Mathlib calls the same structure, where it has one. */
  readonly mathlib?: string;
}

export const PROTOCOLS = [
  {
    name: "PartialOrder",
    refines: [],
    // -1, 0 or 1; NaN when the two are incomparable.
    members: { Compare: "(Self, Self) -> number" },
    mathlib: "PartialOrder",
  },
  { name: "LinearOrder", refines: ["PartialOrder"], members: {}, mathlib: "LinearOrder" },
  {
    name: "Lattice",
    refines: ["PartialOrder"],
    members: { GreatestLowerBound: "(Self, Self) -> Self", LeastUpperBound: "(Self, Self) -> Self" },
    mathlib: "Lattice",
  },
  {
    name: "FloorOrder",
    refines: ["PartialOrder"],
    // The greatest tick at or below, the least at or above: the two adjoints of the ticks' inclusion.
    members: { LowerTick: "(Self) -> Self", UpperTick: "(Self) -> Self" },
    mathlib: "FloorSemiring",
  },
  { name: "MidpointOrder", refines: ["FloorOrder"], members: { Midpoint: "(Self, Self) -> Self" } },
  { name: "TickParity", refines: ["FloorOrder"], members: { IsEvenTick: "(Self) -> boolean" } },
  {
    name: "ProductOrder",
    refines: ["PartialOrder"],
    // `WithCoordinates(x, parts)` is a value shaped like `x` with those parts: the receiver
    // picks the implementation, since a bare list can't.
    members: { Coordinates: "(Self) -> list", WithCoordinates: "(Self, list) -> Self" },
  },
] as const satisfies readonly Protocol[];

export type ProtocolName = (typeof PROTOCOLS)[number]["name"];

const BY_NAME: ReadonlyMap<string, Protocol> = new Map(PROTOCOLS.map((p) => [p.name, p]));

export const protocol = (name: ProtocolName): Protocol => BY_NAME.get(name)!;

/** `name` and everything it refines, parents first. */
export function ancestry(name: ProtocolName): ProtocolName[] {
  const out: ProtocolName[] = [];
  const visit = (n: ProtocolName) => {
    for (const parent of protocol(n).refines as readonly ProtocolName[]) visit(parent);
    if (!out.includes(n)) out.push(n);
  };
  visit(name);
  return out;
}

/** Declare every protocol on `ce`, once -- asking the engine, since a package's dist and
 *  another's source can both load this module. */
export function ensureProtocols(ce: ComputeEngine): void {
  if (ce.lookupDefinition("Compare") !== undefined) return;
  for (const { name, members } of PROTOCOLS) ce.declareProtocol(name, { functions: { ...members } });
}
