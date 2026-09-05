// Provisional file→pack map for the core/packs split (#283, wiki Core-And-Packs §5).
// Purely advisory until the files actually move: `pack-lint.mts` reads it to report the cross-pack
// `requires:` edges the split would create. Ordered — FIRST MATCH WINS — and anything unmatched is core.
// Matched against the file BASENAME without `.sql` (the same name `-- requires:` uses).

export type PackName =
  | 'core' | 'refs' | 'number-sets' | 'paths' | 'permutations-plus' | 'partitions-plus'
  | 'tableaux' | 'trees-graphs' | 'words-plus' | 'compositions-plus' | 'polytopes'

/** Declared pack dependencies (§5). A cross-pack edge X→Y is a violation unless Y ∈ closure(deps[X]). */
export const PACK_DEPS: Record<PackName, PackName[]> = {
  'core': [],
  'number-sets': ['core'],
  'paths': ['core'],
  'permutations-plus': ['core'],
  'partitions-plus': ['core'],
  'compositions-plus': ['core'],
  'words-plus': ['core'],
  'trees-graphs': ['core', 'paths'],
  'tableaux': ['core', 'partitions-plus'],
  'polytopes': ['core', 'trees-graphs', 'permutations-plus'],
  'refs': ['core', 'number-sets', 'paths', 'permutations-plus', 'partitions-plus',
           'compositions-plus', 'words-plus', 'trees-graphs', 'tableaux', 'polytopes'],
}

/** Glyph SQL travels with its carrier's pack (O.4) — this marks the LAYER, it is not a pack. */
export const GLYPH_LAYER = /_glyph$|^hasse_svg$|^glyph_kinds$/

export const PACK_MAP: [PackName, RegExp][] = [
  ['refs', /^(oeis|oeis-refs|oeis-refs\.backfill|findstat-refs|findstat-refs\.maps|sage-refs|sympy-refs|matlab-refs|wolfram-refs|find_stat|distribution_match|examples\.golden_parity|seed\.render_corpus|examples\.render_corpus|bfile_export|example-tiers\.refs|examples\.map_compose|examples\.representations)$/],

  // core, stated explicitly so the broad pack patterns below can't claim them (§4.2–4.3):
  // the ~25 named counting sequences …
  ['core', /^(catalan_numbers|fibonacci|lucas_numbers|pell_numbers|jacobsthal_numbers|tribonacci_numbers|padovan_sequence|perrin_sequence|bell_numbers|fubini_numbers|motzkin_numbers|schroeder_numbers|little_schroder_numbers|narayana_numbers|central_delannoy_numbers|factorial_numbers|double_factorial_numbers|partition_numbers|powers_of_two|all_ones|stern_diatomic_sequence|primorial_numbers|triangular_numbers|square_numbers|cube_numbers)$/],
  // … and the number domains + number machinery
  ['core', /^(natural_numbers|integer_numbers|rational_numbers|fractional_numbers|gaussian_integers|gaussian_rationals|gaussian_fractionals|multicomplex_numbers|cardinal_numbers|omega_ordinals|modular_residues|number-theory|number-gradings|number-predicates|number\.stats|aliquot|padic_notation|radix_notation|residue_notation|integer_factorizations)$/],

  ['number-sets', /^(.*_numbers|.*_primes|prime_gaps|collatz_trajectories|pythagorean_triples|sums_of_two_squares|goldbach_partitions|square_decompositions|egyptian_fractions|farey_sequences(\.maps)?|continued_fractions|calkin_wilf_paths|stern_brocot_paths|squarefree_semiprimes|k_almost_primes|zeckendorf_representations|hyperbinary_representations(\.stats)?)$/],
  ['paths', /^(motzkin_paths|schroeder_paths|schroeder_triangle|delannoy|fine_|lukasiewicz|riordan|k_dyck|k_motzkin|colored_motzkin|rational_dyck|grand_dyck|dyck_paths_by_height|little_schroder_triangle|ballot_sequences)/],
  ['permutations-plus', /^(pattern_avoiding|baxter|grassmannian|cograssmannian|simple_perm|smooth_perm|connected_perm|boolean_perm|alternating_perm|cyclic_perm|k_colored|k_cycle|k_descent|k_inversion|affine_perm|decorated_perm|signed_perm|arrangements|permutations\.(stats2|stats3|findstat|denert|rsk_shape|equivalences|relations)|permutation_maps|orbit_maps_permutations_subsets|symmetry_orbit_maps|lehmer_codes|subexcedant_seqs|endofunctions|surjections|surjections_onto_k|parking_functions|non_decreasing_parking|non_crossing_perm|tournaments)/],
  ['partitions-plus', /^(distinct_partitions|odd_partitions|self_conjugate|core_partitions|bounded_part|box_confined|boxed_plane|k_part_partitions|largest_part|skew_partitions|plane_partitions|square_partitions|triangular_partitions|multiplicative_partitions|prime_partition|partitions_restrictions|integer_partitions\.(cores_quotients|dominance|frobenius_abacus|rank_crank|relations)|ordered_factorizations|partition_algebra|total_partitions)/],
  ['tableaux', /^(semistandard|shifted_standard|skew_standard|syt_|gelfand_tsetlin|standard_tableau_pairs|standard_tableaux\.(demotion|evacuation|promotion|reading_word|findstat)|alternating_sign|rook_placements)/],
  ['trees-graphs', /^(ordered_trees|plane_trees|labeled_trees|labeled_forests|k_ary_trees|increasing_binary|recursive_trees|phylogenetic|non_crossing_trees|rooted_unlabeled|unlabeled_free|prufer|labeled_graphs|connected_labeled|independent_sets|dissections|non_crossing_matchings|non_nesting_matchings|perfect_matchings|non_crossing_partitions|non_nesting_partitions)/],
  ['words-plus', /^(binary_necklaces|lyndon|gray_codes|ternary_gray|thue_morse|fib_strings|lucas_strings|binary_palindromes|primitive_binary|k_ary_word|ascent_sequences|tri_strings|binary_words_by_weight|restricted_growth_strings|words\.stats|binary_words\.stats)/],
  ['compositions-plus', /^(carlitz|dyadic_comp|fibonacci_comp|odd_comp|palindromic_comp|prime_comp|proper_comp|step_comp|tetra_comp|tri_comp|triangular_comp|zigzag_comp|k_bounded_comp|weak3|compositions_into_k|weak_compositions_into_k|composition_maps|signed_set_comp|set_compositions\.stats|integer_compositions\.stats)/],
  ['polytopes', /^(polytope-collections|simplex|identities\.polytopes|traits\.polytopes|tags\.polytopes|examples\.representations\.polytopes)$/],
]

/** The pack that would own `name` (basename, no extension). */
export function packOf(name: string): PackName {
  for (const [pack, re] of PACK_MAP) if (re.test(name)) return pack
  return 'core'
}

export function isGlyphLayer(name: string): boolean {
  return GLYPH_LAYER.test(name)
}

/**
 * Resolve a `<carrier>_glyph` file's carrier (O.4 — glyph SQL travels with its carrier's pack): strip the
 * trailing `_glyph`, try the carrier name then carrier+'s', else fall back to the first `-- requires:` entry
 * that resolves to a real file. Returns null for a non-glyph name, or an unresolved glyph (caller's choice how
 * to report/fall back). `allNames` is every known basename; `requiresOf` reads a file's `-- requires:` list —
 * kept pure by taking both as arguments rather than touching the filesystem here.
 */
export function carrierOfGlyph(name: string, allNames: Set<string>, requiresOf: (name: string) => string[]): string | null {
  const m = /^(.*)_glyph$/.exec(name)
  if (!m) return null
  const stem = m[1]
  if (allNames.has(stem) && stem !== name) return stem
  if (allNames.has(stem + 's')) return stem + 's'
  for (const dep of requiresOf(name)) {
    if (allNames.has(dep)) return dep
  }
  return null
}

/**
 * The pack that would own `name`, resolving a glyph file to its carrier's pack first (O.4) so glyph->carrier
 * edges don't misreport as cross-pack (glyph basenames don't match the domain regexes in PACK_MAP). Falls back
 * to plain `packOf(name)` for non-glyph names and for glyphs whose carrier can't be resolved.
 */
export function packOfFile(name: string, allNames: Set<string>, requiresOf: (name: string) => string[]): PackName {
  const carrier = carrierOfGlyph(name, allNames, requiresOf)
  return packOf(carrier ?? name)
}

/** Transitive `requires-pack` closure of `pack`, including itself. */
export function packClosure(pack: PackName): Set<PackName> {
  const seen = new Set<PackName>([pack])
  const stack = [...PACK_DEPS[pack]]
  while (stack.length) {
    const p = stack.pop()!
    if (seen.has(p)) continue
    seen.add(p)
    stack.push(...PACK_DEPS[p])
  }
  return seen
}

/**
 * Packs that have actually been materialized as `packs/<name>/` directories. The split lands one lane at a
 * time (#283 §10 phase 3), so at any commit most packs are still notional: their files sit in `sqlsrc/` and
 * load as core. This list is what makes the difference — `pack-migrate.mts` and its `--check` lint read
 * `placementOf`, not `packOf`, so both are correct mid-split. A lane lands by adding its name here and
 * re-running the codemod.
 */
export const EXTRACTED_PACKS: PackName[] = ['polytopes', 'refs']

/**
 * The extracted set in effect. `ENUMERATIO_PACKS_OVERRIDE=a,b` substitutes for `EXTRACTED_PACKS` so a lane can be
 * rehearsed (`--dry-run`, `--check`) before its name is committed to the array. Guarded for non-node consumers.
 */
export function extractedPacks(): PackName[] {
  const env = typeof process !== 'undefined' ? process.env?.ENUMERATIO_PACKS_OVERRIDE : undefined
  return env ? (env.split(',').map(s => s.trim()).filter(Boolean) as PackName[]) : EXTRACTED_PACKS
}

/** Where the file lives TODAY: its pack once that pack is extracted, otherwise `core` (i.e. `sqlsrc/`). */
export function placementOf(name: string): PackName {
  const pack = packOf(name)
  return extractedPacks().includes(pack) ? pack : 'core'
}

/** Directory (relative to `packages/data/`) a file belongs in right now. */
export function dirOf(name: string): string {
  const pack = placementOf(name)
  return pack === 'core' ? 'sqlsrc' : `packs/${pack}`
}
