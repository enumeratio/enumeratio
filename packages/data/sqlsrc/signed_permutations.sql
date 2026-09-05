-- requires: permutations, realizer, utilities
-- signed_permutations — ported from pg-enumeratio's old-backup sqlsrc/48-signed_permutations.sql (+
-- 57-signed_permutations-engines.sql). The hyperoctahedral group B_n: a permutation of [n] with a sign ±1 on
-- each position. |B_n| = 2^n·n! [[OEIS:A000165]]. The old carrier was a COMPOSITE (permutation, subset); here
-- the carrier collapses to the simpler shape the port hint calls out — one signed one-line window, each entry
-- a signed integer whose absolute values are a permutation of [n]. Single grade [size]. The floor reuses
-- permutations' lex unrank (permutation_unrank_lex, loaded by permutations.sql) for the perm half and enumerates
-- the sign half as the mixed-radix low digits — exactly the old engine's "(perm lex rank)·2^n + sign binary
-- rank", with bit (i-1) of the sign word = position i (bit 0 = position 1), so this floor's order matches the
-- old C-ext's rank_lex exactly (checked against its own worked example below).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
-- image[i] = the signed entry at position i; e.g. {-2,1,-3} = position 1 ↦ -2, position 2 ↦ 1, position 3 ↦ -3.
-- Signed ints already print with their own '-', so the canonical "-2,1,-3" window is a bare array_to_string —
-- no separate perm/signs fields, no bespoke codec.
CREATE TYPE signed_permutation AS (image int[]);
CREATE FUNCTION notation(x signed_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((x).image, ',') $$;

CREATE FUNCTION negatives_count(x signed_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((x).image) v WHERE v < 0 $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: cross the underlying permutation (lex order, via the shared permutation_unrank_lex/factorial) with
-- every sign pattern (ascending binary value, bit i-1 = position i), perm-major — the same mixed-radix order
-- the old engine used for rank_lex. Emitted in that (ord, sgn) order, LIMIT rank_window.
CREATE TYPE signed_permutations_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f signed_permutations_fiber, element_limit int) RETURNS SETOF signed_permutation LANGUAGE sql STABLE AS $$
  SELECT ROW(ARRAY(
           SELECT (permutation_unrank_lex((f).size::int, ord)).image[i]
                  * CASE WHEN ((sgn >> (i - 1)) & 1) = 1 THEN -1 ELSE 1 END
           FROM generate_series(1, (f).size::int) i
         ))::signed_permutation
  FROM generate_series(0, (factorial((f).size::int) - 1)::int) ord,
       generate_series(0, (pow_int(2, (f).size::int) - 1)::int) sgn
  ORDER BY ord, sgn
  LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f signed_permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int(2, (f).size::int) * factorial((f).size::int) $$;   -- 2^n · n!

-- v ∈ fiber [n] iff it has exactly n entries whose absolute values are a permutation of 1..n.
CREATE FUNCTION contains_in_fiber(f signed_permutations_fiber, v signed_permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).image, 1), 0) = (f).size::int
     AND (SELECT coalesce(array_agg(abs(x) ORDER BY abs(x)), '{}') FROM unnest((v).image) x)
         = ARRAY(SELECT generate_series(1, (f).size::int)) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('signed_permutations', 'signed_permutation');
INSERT INTO base_grade VALUES ('signed_permutations', 1, 'size', NULL, NULL);
SELECT base_realize('signed_permutations');

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('signed_permutations','negatives_count','negatives_count','Number of negatives','natural_numbers');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('signed_permutations','anchor |B_2|=8, |B_3|=48 (2^n·n!, accel)','eq','8|48','the hyperoctahedral group order',$q$
    SELECT cardinality(signed_permutations(2))::text || '|' || cardinality(signed_permutations(3))::text $q$),
  ('signed_permutations','floor generates 48 elements at n=3 (independent of the accel)','eq','48','count the floor directly',$q$
    SELECT count(*)::text FROM elements(signed_permutations(3)) e $q$),
  ('signed_permutations','n=1 in order: +1 before -1','eq','1,-1','the trivial permutation, sign bit ascending',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(signed_permutations(1)) e $q$),
  ('signed_permutations','n=2 lex order (perm-major, then sign bit 0 = position 1)','eq','1,2|-1,2|1,-2|-1,-2|2,1|-2,1|2,-1|-2,-1','the mixed-radix order: perm rank·2^n + sign rank',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(signed_permutations(2)) e $q$),
  ('signed_permutations','unrank(signed_permutations(3), 5) = -1,2,-3 (matches the old C-ext''s own worked example)','eq','-1,2,-3','rank 5 = perm 123 (rank 0) · sign pattern 101',$q$
    SELECT notation((unrank(signed_permutations(3), 5)).value) $q$),
  ('signed_permutations','every element of n=3 has abs-values a permutation of 1..3','eq','true','the defining B_3 invariant',$q$
    SELECT bool_and(
        (SELECT array_agg(abs(x) ORDER BY abs(x)) FROM unnest(((e).value).image) x) = ARRAY[1,2,3]
      )::text FROM elements(signed_permutations(3)) e $q$),
  ('signed_permutations','element carries a TYPED point fiber + ordinality','eq','3|5','unrank(signed_permutations(3),5)',$q$
    SELECT (unrank(signed_permutations(3), 5)).fiber.size::text || '|' || ordinality(unrank(signed_permutations(3), 5))::text $q$),
  ('signed_permutations','range handle: cardinality(signed_permutations(0,2)) = 11 = 1+2+8','eq','11','2^0·0! + 2^1·1! + 2^2·2! summed over fibers',$q$
    SELECT cardinality(signed_permutations(0,2))::text $q$),
  ('signed_permutations','fibers(signed_permutations(0,2)) unfold to n = 0,1,2','eq','0,1,2','the grade range',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(signed_permutations(0,2)) f $q$),
  ('signed_permutations','contains via <@: -1,2,-3 ∈ B_3; 1,2,4 ∉ (wrong ground set); -1,2 ∉ (wrong length)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[-1,2,-3])::signed_permutation <@ signed_permutations(3))::text || '|' ||
           (ROW(ARRAY[1,2,4])::signed_permutation <@ signed_permutations(3))::text || '|' ||
           (ROW(ARRAY[-1,2])::signed_permutation <@ signed_permutations(3))::text $q$),
  ('signed_permutations','negatives_count(-2,1,-3) = 2 (matches the old C-ext stat anchor)','eq','2','',$q$
    SELECT negatives_count(ROW(ARRAY[-2,1,-3])::signed_permutation)::text $q$),
  ('signed_permutations','n=0 => the single empty signed permutation','eq','1|','2^0·0! = 1, the empty word',$q$
    SELECT cardinality(signed_permutations(0))::text || '|' || notation((unrank(signed_permutations(0), 0)).value) $q$);
