// Our packages as a library hierarchy: each one a library extension over a small base. What
// a package extends is what the resolver declares before it (`plan`'s requirements), and the
// only packages its code may import, with the infrastructure. Placements are data: moving a
// package is one edit here, and `tests/hierarchy.test.ts` holds the code to it.

/** Where a package sits.
 *  - `infra`: plumbing under everything (engine, compute-engine patches, the records' readers).
 *  - `base`: what every extension builds on.
 *  - `extension`: a symbol package, extending base or other extensions.
 *  - `presentation`: writing and showing; may import any library, and is never one's parent.
 *  - `tooling`: tests, oracles and data; imports anything, and nothing ships importing it. */
export type Layer = "infra" | "base" | "extension" | "presentation" | "tooling";

export interface Placement {
  readonly layer: Layer;
  /** The libraries it extends: declared before it, and all it may import besides infra. */
  readonly extends: readonly string[];
  /** The family it belongs to, where one is settled. */
  readonly area?: "arithmetic" | "analysis" | "algebras" | "combinatorics";
}

const infra: Placement = { layer: "infra", extends: [] };
const tooling: Placement = { layer: "tooling", extends: [] };

/** Each package by manifest name. An entry point placed apart from its package is keyed
 *  `package/subpath` (boxes' serialisers). */
export const HIERARCHY: Readonly<Record<string, Placement>> = {
  engine: infra,
  "ce-patches": infra,
  manifest: infra,
  entry: infra,
  // Libraries' sampleable families import it, so it is not tooling.
  plausible: infra,

  boxes: { layer: "base", extends: [] },
  structures: { layer: "base", extends: ["boxes"] },
  evaluation: { layer: "base", extends: [] },

  residues: { layer: "extension", area: "arithmetic", extends: ["structures"] },
  numerals: { layer: "extension", area: "arithmetic", extends: ["residues"] },
  "number-theory": { layer: "extension", area: "arithmetic", extends: ["numerals"] },
  adeles: { layer: "extension", area: "arithmetic", extends: ["number-theory"] },

  analytic: { layer: "extension", area: "analysis", extends: ["structures"] },

  hypercomplex: { layer: "extension", area: "algebras", extends: ["structures"] },
  geometric: { layer: "extension", area: "algebras", extends: ["hypercomplex"] },
  diagram: { layer: "extension", area: "algebras", extends: ["structures"] },
  groupalgebra: { layer: "extension", area: "algebras", extends: ["structures"] },
  hecke: { layer: "extension", area: "algebras", extends: ["structures"] },
  hopf: { layer: "extension", area: "algebras", extends: ["structures"] },
  incidence: { layer: "extension", area: "algebras", extends: ["structures"] },
  quiver: { layer: "extension", area: "algebras", extends: ["structures"] },

  // The numeric sets (`PrimeNumbers`) are combinatorics' families over residues' sieve. It sits
  // above groupalgebra for `Cycles(CycleDecomposition(…))`, a constructor overload on the head
  // groupalgebra declares.
  combinatorics: {
    layer: "extension",
    area: "combinatorics",
    extends: ["structures", "residues", "groupalgebra"],
  },
  statistics: { layer: "extension", area: "combinatorics", extends: [] },
  polytope: { layer: "extension", area: "combinatorics", extends: [] },

  modular: { layer: "extension", extends: ["structures", "residues"] },
  braid: { layer: "extension", extends: ["structures", "diagram"] },

  "boxes/render": { layer: "presentation", extends: ["boxes"] },
  formats: { layer: "presentation", extends: ["boxes"] },
  // Declaring its carriers (`GlyphKind`) needs structures; its plots import analytic's
  // kernels and shaders, which a call that draws one brings on its own.
  frontend: { layer: "presentation", extends: ["structures"] },
  components: { layer: "presentation", extends: [] },
  cli: { layer: "presentation", extends: [] },
  wolfram: { layer: "presentation", extends: [] },
  raster: { layer: "presentation", extends: [] },

  bench: tooling,
  catalog: tooling,
  census: tooling,
  oracle: tooling,
  reference: tooling,
  utils: tooling,
};

/** Each package's requirements for `plan`: what it extends. */
export const PACKAGES: Readonly<Record<string, { readonly requires: readonly string[] }>> = Object.fromEntries(
  Object.entries(HIERARCHY).map(([name, placement]) => [name, { requires: placement.extends }]),
);
