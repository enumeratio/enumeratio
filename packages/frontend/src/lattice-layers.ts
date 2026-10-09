// The layers of a `Show` that are not figure frames: `LatticeTiles` of a quadratic ring or a radix
// system, and `ArrayPlot` of a multiplication table. Their libraries load on first use (they are
// heavy and a page may draw none), or a host that has them already hands them over; either way
// `layerOf` is then synchronous, so lowering a `Show` to a `GraphicsBox` is too.

import type * as RadixLattice from "@enumeratio/complex-numerals/lattice";
import type * as QuadraticLattice from "@enumeratio/number-theory/lattice";
import type * as ResidueTable from "@enumeratio/residues/table";
import { argsOf, headOf, type Json } from "./frame-json.ts";
import { splitOptions } from "./graphics-rules.ts";
import type { LatticeView, Vec2 } from "./lattice.ts";
import { numberOf, radixSettingsOf, type ShowTiles, stringOf } from "./show-spec.ts";
import type { TileLayer } from "./tiles-canvas.ts";

/** A layer of tiles as Show draws it: the tiles, plus its frame and how to label it. */
export interface ShowLayer extends TileLayer {
  /** The grid `GridLines -> Automatic` draws, when the layer has one of its own. */
  readonly autoGrid?: readonly [number, number];
  /** Where its grid lines are anchored, in lattice coordinates: between a table's cells. */
  readonly gridOffset?: Vec2;
  readonly title: string;
  readonly grid: readonly [Vec2, Vec2];
  gridLabel(axis: 0 | 1, k: number): string;
  home?(): LatticeView;
  summary(): readonly (readonly [string, string])[];
  describe(i: number, j: number): { title: string; rows: readonly (readonly [string, string])[] };
}

/** The libraries a lattice layer is made from, once loaded. */
export interface LatticeModules {
  readonly numberTheory?: typeof QuadraticLattice;
  readonly residues?: typeof ResidueTable;
  readonly complexNumerals?: typeof RadixLattice;
}

let modules: LatticeModules = {};

/** Hand over libraries a host already holds (a terminal that has them linked in). */
export function registerLatticeModules(loaded: LatticeModules): void {
  modules = { ...modules, ...loaded };
}

/** Load the libraries `tiles` is made from; a figure frame needs none. */
export async function loadLatticeModules(tiles: ShowTiles | undefined): Promise<void> {
  if (tiles?.head === "ArrayPlot") {
    if (!modules.residues) registerLatticeModules({ residues: await import("@enumeratio/residues/table") });
  } else if (tiles?.head === "LatticeTiles" && headOf(tiles.data) === "RadixExpansions") {
    if (!modules.complexNumerals)
      registerLatticeModules({ complexNumerals: await import("@enumeratio/complex-numerals/lattice") });
  } else if (tiles?.head === "LatticeTiles" && !modules.numberTheory) {
    registerLatticeModules({ numberTheory: await import("@enumeratio/number-theory/lattice") });
  }
}

/** Start loading the libraries `json`'s layers are made from, before its scope has bound them. */
export function prefetchLayers(json: Json): void {
  for (const layer of argsOf(json)) {
    const head = headOf(layer);
    const data = argsOf(layer)[0];
    if (head === "ArrayPlot") void loadLatticeModules({ head, data });
    else if (head === "LatticeTiles") void loadLatticeModules({ head, data });
  }
}

/** The modulus of `QuotientRing(Integers, n)` (or its old spelling `IntegerModRing(n)`). */
function modulusOf(ring: Json): number {
  if (headOf(ring) === "QuotientRing" && argsOf(ring)[0] === "Integers") return numberOf(argsOf(ring)[1], Number.NaN);
  if (headOf(ring) === "IntegerModRing") return numberOf(argsOf(ring)[0], Number.NaN);
  return Number.NaN;
}

/**
 * `AlgebraicIntegers(Sqrt(n))` and `AlgebraicOrder(Sqrt(n))` as the quadratic rings they are:
 * `QuadraticIntegers(n)` and ℤ[√n], `QuadraticOrder(4n)`. Read here, unevaluated, since a Show's
 * layers are held.
 */
export function quadraticRingOf(ring: Json): Json {
  const [root] = argsOf(ring);
  if (headOf(root) !== "Sqrt") return ring;
  const n = numberOf(argsOf(root)[0], Number.NaN);
  if (headOf(ring) === "AlgebraicIntegers") return ["QuadraticIntegers", n];
  if (headOf(ring) === "AlgebraicOrder") return ["QuadraticOrder", 4 * n];
  return ring;
}

const MISSING = "Its library is not loaded.";

/**
 * A tiled layer's tiles: `LatticeTiles` of `QuadraticIntegers(d)`, `QuadraticOrder(D)`,
 * `GaussianIntegers` or `EisensteinIntegers`; `ArrayPlot` of `AdditionTable` or `MultiplicationTable(QuotientRing(Integers, n))`.
 * The libraries are those `loadLatticeModules` loaded.
 */
export function latticeLayerOf(
  tiles: Pick<ShowTiles, "head" | "data" | "embedding">,
  aspect: "Uniform" | "True",
): ShowLayer | string {
  if (tiles.head === "ArrayPlot") {
    // `AdditionTable(ring, ElementOrder -> Adic)`, or `MultiplicationTable`: how rows and columns list the ring.
    const table = splitOptions(tiles.data, new Set(["ElementOrder"]));
    const head = headOf(tiles.data);
    const n = head === "MultiplicationTable" || head === "AdditionTable" ? modulusOf(table.positional[0]) : Number.NaN;
    if (!Number.isInteger(n))
      return "ArrayPlot needs a table: AdditionTable(QuotientRing(Integers, n)) or MultiplicationTable(QuotientRing(Integers, n)).";
    const listed = stringOf(table.options.get("ElementOrder"));
    const order = listed === "ChineseRemainder" || listed === "Adic" ? listed : "Natural";
    if (!modules.residues) return MISSING;
    const made =
      head === "AdditionTable"
        ? modules.residues.additionTable(n, order)
        : modules.residues.multiplicationTable(n, order);
    return made ?? `ℤ/${n} is too large to tabulate, or not a ring with a table.`;
  }
  if (headOf(tiles.data) === "RadixExpansions") {
    const settings = radixSettingsOf(tiles.data);
    if (!settings) return "RadixExpansions needs a ring (GaussianIntegers or EisensteinIntegers) and a base.";
    if (!modules.complexNumerals) return MISSING;
    return modules.complexNumerals.radixExpansions(settings);
  }
  const ring = quadraticRingOf(tiles.data);
  // QuadraticOrder(D) by its discriminant; the rest by d.
  const order = headOf(ring) === "QuadraticOrder" ? numberOf(argsOf(ring)[0], Number.NaN) : undefined;
  const d =
    ring === "GaussianIntegers"
      ? -1
      : ring === "EisensteinIntegers"
        ? -3
        : headOf(ring) === "QuadraticIntegers"
          ? numberOf(argsOf(ring)[0], Number.NaN)
          : (order ?? Number.NaN);
  if (!Number.isInteger(d))
    return "LatticeTiles needs a ring: QuadraticIntegers(d), QuadraticOrder(D), GaussianIntegers or EisensteinIntegers.";
  const logarithmic = tiles.embedding === "Logarithmic";
  if (!modules.numberTheory) return MISSING;
  const layer = modules.numberTheory.quadraticLattice(d, {
    scale: aspect === "True" ? "geometric" : "uniform",
    ...(order === undefined ? {} : { discriminant: order }),
    ...(logarithmic ? { embedding: "logarithmic" as const } : {}),
  });
  if (layer) return layer;
  if (logarithmic && d < 0) return "The logarithmic embedding is a real field's: an imaginary one has a single |σ|.";
  return order === undefined
    ? `ℚ(√${d}) is not a quadratic field: ${d} is a square.`
    : `${d} is no quadratic discriminant: one is 0 or 1 mod 4, and not a square.`;
}
