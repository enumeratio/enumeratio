// The unit families. A hypercomplex algebra is fixed by two pieces of data per
// generator — what it squares to, and whether it commutes — so that is exactly
// what a family carries. Generators are subscripted symbols (`i_1`, `e_2`), which
// compute-engine's LaTeX parser already reads as single symbols: `1 + 2i_1 - 3i_1i_2`
// parses to ["Add", ["Multiply",-3,"i_1","i_2"], ["Multiply",2,"i_1"], 1] with no
// dictionary entry, so the notation costs nothing.

/** One unit family: a prefix, a square, and a commutation rule. */
export interface Family {
  /** Canonical symbol prefix — generators are `<prefix>_<index>`. */
  readonly prefix: string;
  /** g² for every generator of the family. */
  readonly square: -1 | 0 | 1;
  /** Distinct generators of an anticommuting family satisfy gh = −hg. */
  readonly anticommutes: boolean;
  /** Sort rank, so every blade has one canonical spelling. */
  readonly rank: number;
  readonly title: string;
  /** How the family's algebra is usually named. */
  readonly algebra: string;
}

export const FAMILIES: readonly Family[] = [
  {
    prefix: "i",
    square: -1,
    anticommutes: false,
    rank: 0,
    title: "imaginary",
    algebra: "multicomplex ℂ_n = ℝ[i_1,…,i_n]/(i_k²+1)",
  },
  {
    prefix: "j",
    square: 1,
    anticommutes: false,
    rank: 1,
    title: "split (perplex)",
    algebra: "multi-perplex ℝ[j_1,…,j_n]/(j_k²−1)",
  },
  {
    prefix: "epsilon",
    square: 0,
    anticommutes: false,
    rank: 2,
    title: "nilpotent (dual)",
    algebra: "multi-dual ℝ[ε_1,…,ε_n]/(ε_k²)",
  },
  {
    prefix: "e",
    square: 1,
    anticommutes: true,
    rank: 3,
    title: "Clifford, positive",
    algebra: "Clifford Cl_(n,0)(ℝ) = ℝ⟨e_1,…,e_n⟩/(e_k²−1, e_ke_l+e_le_k)",
  },
  {
    prefix: "f",
    square: -1,
    anticommutes: true,
    rank: 4,
    title: "Clifford, negative",
    algebra: "Clifford Cl_(0,n)(ℝ) — ⟨f_1,f_2⟩ IS the quaternions ℍ",
  },
  {
    prefix: "theta",
    square: 0,
    anticommutes: true,
    rank: 5,
    title: "Grassmann",
    algebra: "exterior algebra Λ(ℝⁿ) = ℝ⟨θ_1,…,θ_n⟩/(θ_k², θ_kθ_l+θ_lθ_k)",
  },
];

// The six families are the whole 3 × 2 grid — square ∈ {−1, 0, +1} crossed with
// commuting / anticommuting — because those two facts are all a generator needs.
// The anticommuting half is where the familiar names live: e_k gives Cl(n,0), f_k
// gives Cl(0,n) (so ⟨f_1, f_2⟩, with f_1f_2 as the third unit, is ℍ), and the
// anticommuting nilpotents θ_k are the fermionic / Grassmann generators, whose blades
// span the exterior algebra. All odd generators anticommute with each other, across
// families, as they must in a superalgebra.

// A LaTeX letter with two spellings parses to two different compute-engine symbols
// (`\epsilon_1` → `epsilon_1` but `\varepsilon_1` → `epsilonSymbol_1`), so alias the
// variants onto the canonical family — otherwise a user who typed the other glyph
// would get a silently distinct generator.
const FAMILY_BY_PREFIX = new Map<string, Family>([
  ...FAMILIES.map((f) => [f.prefix, f] as const),
  ["epsilonSymbol", FAMILIES[2]!],
  ["varepsilon", FAMILIES[2]!],
  ["thetaSymbol", FAMILIES[5]!],
  ["vartheta", FAMILIES[5]!],
]);

/** A single generator: its family and its subscript. */
export interface Generator {
  readonly family: Family;
  readonly index: number;
}

/** The canonical compute-engine symbol for a generator. */
export const generatorSymbol = (g: Generator): string => `${g.family.prefix}_${g.index}`;

/**
 * Total order on generators, so a blade has exactly one spelling.
 *
 * Within a family that order is LEXICOGRAPHIC on the index, not numeric — `e_10`
 * precedes `e_2` — because a blade is spelled as a `Multiply`, and compute-engine
 * sorts a commutative operator's operands lexicographically by symbol. Ordering the
 * blade any other way would have that sort undo it on the way out, and an
 * anticommuting blade read back in a different order is read back with the opposite
 * SIGN. Across families the rank order already agrees with the lexicographic one
 * wherever a sign is at stake (e < f < theta), so only the index needs the care.
 */
export const compareGenerators = (a: Generator, b: Generator): number =>
  a.family.rank - b.family.rank || (`${a.index}` < `${b.index}` ? -1 : a.index === b.index ? 0 : 1);

export const sameGenerator = (a: Generator, b: Generator): boolean =>
  a.family.rank === b.family.rank && a.index === b.index;

/**
 * The generator a symbol names, or `undefined` for every other symbol. Only
 * `<known prefix>_<positive integer>` counts, so ordinary subscripted variables
 * (`x_1`, `a_2`) and the bare letters (`e`, Euler's number; `i`, compute-engine's
 * own complex unit) are left alone.
 */
export function generatorOf(symbol: string | null | undefined): Generator | undefined {
  if (symbol === null || symbol === undefined) return undefined;
  const parts = /^([A-Za-z]+)_(\d+)$/.exec(symbol);
  if (parts === null) return undefined;
  const family = FAMILY_BY_PREFIX.get(parts[1]!);
  if (family === undefined) return undefined;
  const index = Number(parts[2]);
  return index >= 1 ? { family, index } : undefined;
}
