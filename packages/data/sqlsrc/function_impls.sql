-- requires: identities
-- base_function_impl: the JOIN TABLE replacing base_function's inline sql_fn/ts_export pair (#278 increment 2).
-- The inline columns assumed exactly one pg impl and one TS impl per identity, one-to-one with the curated id.
-- Neither half of that assumption survives contact with the rest of the registry:
--   * MULTIPLE impls per function, at DIFFERENT representations. factorial/factorial_bigint and
--     binomial/binomial_bigint are the concrete case: the exact-numeric form and the native-int8 form are the
--     SAME identity computed two ways, not two identities (the old inline schema forced them apart as separate
--     base_function rows purely because there was nowhere else to put the second sql_fn).
--   * PER-OVERLOAD dispatch. Every generic function realizer.sql resolves via to_regprocedure introspection is
--     radically overloaded — contains_in_fiber has 179 defined overloads across the catalog, fiber_count 98,
--     notation 81, glyph_svg 52 — one per (carrier/fiber) signature. `arg_types` is the axis pg actually
--     dispatches on; a bare `sql_fn` text column had no way to name a specific overload, only a bare proname.
--     (base_function doesn't curate these generic-dispatch functions today — see identities.sql's exclusion
--     note — but the join table is shaped to hold them without a further migration when it does.)
--   * impls with NO pg sibling at all (lcm — no SQL lcm exists in utilities.sql, TS-only) and, symmetrically,
--     room for a future impl with no TS sibling — the old CHECK (sql_fn IS NOT NULL OR ts_export IS NOT NULL)
--     baked "exactly these two slots" into the table shape itself.
--   * the REPRESENTATION axis. pg cannot overload a function on its RETURN type alone (factorial(int)->numeric
--     and a same-arity factorial(int)->bigint can't coexist as overloads) — so factorial_bigint's existence is a
--     representation CHOICE (exact numeric vs native bigint), not a second identity and not a second overload.
--     representation names that choice explicitly instead of leaving it to be inferred from a `_bigint` suffix
--     on impl_ref, which is a naming convention, not a schema fact.
--
-- `engine` will gain its FK to base_engine in engine_grants.sql (#278 increment 2b) — that registry loads after
-- this one, so the constraint is added there via ALTER TABLE rather than moved earlier.
CREATE TABLE base_function_impl (
  function       text NOT NULL REFERENCES base_function,
  engine         text NOT NULL,        -- FK added in engine_grants.sql (loads later); 'pg' | 'ts' | 'wasm'
  impl_ref       text NOT NULL,        -- pg: pg_proc.proname · ts: the @enumeratio/math export name
  arg_types      text[] NOT NULL,      -- pg type names in argument order, e.g. '{int,int}'
  return_type    text NOT NULL,        -- the pg type name of the result
  representation text NOT NULL CHECK (representation IN ('numeric','bigint','float64','i64','text')),
  cost           numeric,              -- NULL = unranked
  note           text,
  PRIMARY KEY (function, engine, impl_ref, arg_types),
  pack           text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);
CREATE TRIGGER base_function_impl_pack_guard BEFORE UPDATE OR DELETE ON base_function_impl FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- 59 impl rows over 28 functions: 29 pg rows (one per identity with a live SQL twin — factorial and binomial
-- contribute a second row each at representation 'bigint') + 30 ts rows (every packages/math export curated
-- above, including lcm's TS-only row and the two bigint TS twins).
--
-- REPRESENTATION IS NOT DECORATION — it is the claim an engine's router believes. pg's rows are 'numeric' because
-- pg's numeric tower really is exact at any magnitude. packages/math's rows are 'float64' because 25 of its 27
-- curated exports return a JS `number`, which is exact only up to 2^53: factorial(25) is 1.55e25 in TS and
-- 15511210043330985984000000 in pg, and calling that row 'numeric' would licence a router to prefer the answer
-- that is silently wrong. The two exports that return a JS bigint (factorial_bigint, binomial_bigint) are the
-- only exact TS rows, and they are second impls of factorial/binomial rather than identities of their own —
-- which is exactly what lets a resolver prefer the exact one. 'i64' stays reserved for a future wasm engine.
INSERT INTO base_function_impl (function, engine, impl_ref, arg_types, return_type, representation, note) VALUES
  ('catalan_number', 'pg', 'catalan_number', '{int}', 'numeric', 'numeric', NULL),
  ('catalan_number', 'ts', 'catalan_number', '{int}', 'numeric', 'float64', NULL),

  ('little_schroder_number', 'pg', 'little_schroder_number', '{term_index}', 'numeric', 'numeric', NULL),
  ('little_schroder_number', 'ts', 'little_schroder_number', '{term_index}', 'numeric', 'float64', NULL),

  ('factorial', 'pg', 'factorial', '{int}', 'numeric', 'numeric', NULL),
  ('factorial', 'pg', 'factorial_bigint', '{int}', 'bigint', 'bigint',
   'exact for n <= 20; 21! overflows int8 and raises rather than losing precision'),
  ('factorial', 'ts', 'factorial', '{int}', 'numeric', 'float64', NULL),
  ('factorial', 'ts', 'factorial_bigint', '{int}', 'bigint', 'bigint', 'JS bigint twin of factorial_bigint'),

  ('binomial', 'pg', 'binomial', '{int,int}', 'numeric', 'numeric', NULL),
  ('binomial', 'pg', 'binomial_bigint', '{int,int}', 'bigint', 'bigint',
   'interleaved product/quotient, no intermediate numeric rounding'),
  ('binomial', 'ts', 'binomial', '{int,int}', 'numeric', 'float64', NULL),
  ('binomial', 'ts', 'binomial_bigint', '{int,int}', 'bigint', 'bigint', 'JS bigint twin of binomial_bigint'),

  ('bell', 'pg', 'bell', '{int}', 'numeric', 'numeric', NULL),
  ('bell', 'ts', 'bell', '{int}', 'numeric', 'float64', NULL),

  ('fubini', 'pg', 'fubini', '{int}', 'numeric', 'numeric', NULL),
  ('fubini', 'ts', 'fubini', '{int}', 'numeric', 'float64', NULL),

  ('stirling_second', 'pg', 'stirling_second', '{int,int}', 'numeric', 'numeric', NULL),
  ('stirling_second', 'ts', 'stirling_second', '{int,int}', 'numeric', 'float64', NULL),

  ('partition_number', 'pg', 'partition_number', '{int}', 'numeric', 'numeric', NULL),
  ('partition_number', 'ts', 'partition_number', '{int}', 'numeric', 'float64', NULL),

  ('gcd', 'pg', 'gcd_int', '{int,int}', 'int', 'numeric', NULL),
  ('gcd', 'ts', 'gcd_int', '{int,int}', 'int', 'float64', NULL),

  ('lcm', 'ts', 'lcm_int', '{int,int}', 'int', 'float64',
   'TS-only — utilities.sql has no SQL lcm implementation'),

  ('pow', 'pg', 'pow_int', '{int,int}', 'numeric', 'numeric', NULL),
  ('pow', 'ts', 'pow_int', '{int,int}', 'numeric', 'float64', NULL),

  ('double_factorial_odd', 'pg', 'double_factorial_odd', '{int}', 'numeric', 'numeric', NULL),
  ('double_factorial_odd', 'ts', 'double_factorial_odd', '{int}', 'numeric', 'float64', NULL),

  ('gaussian_add', 'pg', 'gaussian_add', '{gaussian_integer,gaussian_integer}', 'gaussian_integer', 'numeric', NULL),
  ('gaussian_add', 'ts', 'gaussian_add', '{gaussian_integer,gaussian_integer}', 'gaussian_integer', 'float64', NULL),

  ('gaussian_mul', 'pg', 'gaussian_mul', '{gaussian_integer,gaussian_integer}', 'gaussian_integer', 'numeric', NULL),
  ('gaussian_mul', 'ts', 'gaussian_mul', '{gaussian_integer,gaussian_integer}', 'gaussian_integer', 'float64', NULL),

  ('gaussian_neg', 'pg', 'gaussian_neg', '{gaussian_integer}', 'gaussian_integer', 'numeric', NULL),
  ('gaussian_neg', 'ts', 'gaussian_neg', '{gaussian_integer}', 'gaussian_integer', 'float64', NULL),

  ('gaussian_norm', 'pg', 'gaussian_norm', '{gaussian_integer}', 'int', 'numeric', NULL),
  ('gaussian_norm', 'ts', 'gaussian_norm', '{gaussian_integer}', 'int', 'float64', NULL),

  ('multicomplex_add', 'pg', 'multicomplex_add', '{multicomplex,multicomplex}', 'multicomplex', 'numeric', NULL),
  ('multicomplex_add', 'ts', 'multicomplex_add', '{multicomplex,multicomplex}', 'multicomplex', 'float64', NULL),

  ('multicomplex_mul', 'pg', 'multicomplex_mul', '{multicomplex,multicomplex}', 'multicomplex', 'numeric', NULL),
  ('multicomplex_mul', 'ts', 'multicomplex_mul', '{multicomplex,multicomplex}', 'multicomplex', 'float64', NULL),

  ('multicomplex_neg', 'pg', 'multicomplex_neg', '{multicomplex}', 'multicomplex', 'numeric', NULL),
  ('multicomplex_neg', 'ts', 'multicomplex_neg', '{multicomplex}', 'multicomplex', 'float64', NULL),

  ('multicomplex_conj', 'pg', 'multicomplex_conj', '{multicomplex}', 'multicomplex', 'numeric', NULL),
  ('multicomplex_conj', 'ts', 'multicomplex_conj', '{multicomplex}', 'multicomplex', 'float64', NULL),

  ('multicomplex_popcount', 'pg', 'multicomplex_popcount', '{int}', 'int', 'numeric', NULL),
  ('multicomplex_popcount', 'ts', 'multicomplex_popcount', '{int}', 'int', 'float64', NULL),

  ('composition_from_mask', 'pg', 'composition_from_mask', '{int,bigint}', 'composition', 'numeric', NULL),
  ('composition_from_mask', 'ts', 'composition_from_mask', '{int,bigint}', 'composition', 'float64', NULL),

  ('permutation_unrank', 'pg', 'permutation_unrank_lex', '{int,bigint}', 'permutation', 'numeric', NULL),
  ('permutation_unrank', 'ts', 'permutation_unrank', '{int,bigint}', 'permutation', 'float64', NULL),

  -- #293: both sides now hold the same length-(n-1) array — the always-0 trailing entry is dropped from the
  -- stored permutation_inversion carrier, and packages/math's lehmer_code() drops it too (notation() appends it
  -- back on serialization). So the twin is honest and selfcert-engine differentials pg==ts.
  -- (lehmer_code's 'pg' row moved to packs/permutations-plus/function_impls.permutations-plus.sql — to_inversion
  -- and its permutation_inversion return type are defined in lehmer_codes.sql, a permutations-plus file, #283
  -- phase 3; the identity itself and its 'ts' row — packages/math has no pack split — stay core.)
  ('lehmer_code', 'ts', 'lehmer_code', '{permutation}', 'permutation_inversion', 'float64', NULL),

  ('descents', 'pg', 'perm_descents', '{permutation}', 'int', 'numeric', NULL),
  ('descents', 'ts', 'perm_descents', '{permutation}', 'int', 'float64', NULL),
  ('fixed_points', 'pg', 'perm_fixed_points', '{permutation}', 'int', 'numeric', NULL),
  ('fixed_points', 'ts', 'perm_fixed_points', '{permutation}', 'int', 'float64', NULL),
  ('cycle_count', 'pg', 'perm_cycle_count', '{permutation}', 'int', 'numeric', NULL),
  ('cycle_count', 'ts', 'perm_cycle_count', '{permutation}', 'int', 'float64', NULL),
  ('inversions', 'pg', 'perm_inversions', '{permutation}', 'int', 'numeric', NULL),
  ('inversions', 'ts', 'inversions', '{permutation}', 'int', 'float64', NULL),

  -- (stirling1's 'pg' row moved to the pack too — stirling_first_unsigned is defined in k_cycle_permutations.sql)
  ('stirling1', 'ts', 'stirling1', '{int,int}', 'numeric', 'float64', NULL),

  ('eulerianA', 'pg', 'eulerian_number', '{int,int}', 'numeric', 'numeric', NULL),
  ('eulerianA', 'ts', 'eulerianA', '{int,int}', 'numeric', 'float64', NULL);
-- integer_partition_k_count's impl rows (pg k_part_partition_count / ts twin) moved to the partitions-plus pack
-- (function_impls.partitions-plus.sql, #283) — the concrete function lives in that pack's k_part_partitions.sql.

-- floors, never exact counts (registry self-test convention): every base_function has AT LEAST one impl, and
-- every pg impl_ref actually resolves in pg_proc — the replacement for the old inline-column integrity check.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('base_function_impl', 'every base_function has at least one impl row', 'eq', '0',
   'the floor the inline sql_fn/ts_export CHECK used to enforce — now over the join table', $q$
     SELECT count(*)::text FROM base_function f
      WHERE NOT EXISTS (SELECT 1 FROM base_function_impl i WHERE i.function = f.id) $q$),
  ('base_function_impl', 'every engine=''pg'' impl_ref resolves to a real pg_proc function', 'eq', '0',
   'no FK is possible (impl_ref is plain text, not a DB object reference) — this is the integrity check',$q$
     SELECT count(*)::text FROM base_function_impl WHERE engine = 'pg'
       AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = impl_ref) $q$),
  ('base_function_impl', 'flat/orderless are only assigned to SQL-backed functions of arity >= 2', 'eq', '0',
   'operationalizes the endo-operation curation guideline as a check, not a DB CHECK constraint — rewritten to '
   'join through the pg impl row now that sql_fn is gone',$q$
     SELECT count(*)::text FROM base_function_attribute_manual m
       JOIN base_function_impl i ON i.function = m.function AND i.engine = 'pg'
       JOIN pg_proc p ON p.proname = i.impl_ref
      WHERE m.attribute IN ('flat','orderless') AND p.pronargs < 2 $q$);

-- The representation claim is itself checkable, and this is the floor that keeps it honest: every ts impl is
-- 'float64' or 'bigint', never 'numeric'. packages/math is a JS library — `number` up to 2^53, `bigint` beyond —
-- and a ts row spelled 'numeric' would be claiming pg's exact tower, which is how a router ends up preferring a
-- silently-wrong answer over a correct one.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('base_function_impl', 'no ts impl claims pg''s exact numeric representation', 'eq', '0',
   'packages/math carries float64 or bigint — never numeric; see this file''s seed comment', $q$
     SELECT count(*)::text FROM base_function_impl WHERE engine = 'ts' AND representation = 'numeric' $q$),
  ('base_function_impl', 'every pg impl claims an exact representation', 'eq', '0',
   'the oracle is exact by construction — a pg row spelled float64 would be a real bug in the SQL twin', $q$
     SELECT count(*)::text FROM base_function_impl
      WHERE engine = 'pg' AND representation NOT IN ('numeric', 'bigint', 'text') $q$);
