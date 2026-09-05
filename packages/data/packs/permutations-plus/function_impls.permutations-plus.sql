-- requires: function_impls, lehmer_codes, k_cycle_permutations
-- permutations-plus half of sqlsrc/function_impls.sql (#283 phase 3 extraction) — the 'pg' engine impl rows for
-- two core-curated math identities (lehmer_code, stirling1) whose pg implementation happens to live in a
-- permutations-plus collection file. The identity rows themselves, and their 'ts' (packages/math) impls, stay
-- core — packages/math has no pack split, and the identity concept isn't permutations-plus-specific.
INSERT INTO base_function_impl (function, engine, impl_ref, arg_types, return_type, representation, note) VALUES
  ('lehmer_code', 'pg', 'to_inversion', '{permutation}', 'permutation_inversion', 'numeric', NULL),
  ('stirling1', 'pg', 'stirling_first_unsigned', '{int,int}', 'numeric', 'numeric', NULL);
