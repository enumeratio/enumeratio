-- requires: permutations, realizer, utilities
-- k_colored_permutations — the wreath product ℤ_k ≀ S_n: a permutation σ of [n] with a colour c_i ∈ {0,…,k−1} on
-- each position. Graded by (size, colors): fiber (n,k) has kⁿ·n! elements [[OEIS:A319027]]. It GENERALIZES
-- signed_permutations (k=2 = the hyperoctahedral group Bₙ, |Bₙ| = 2ⁿ·n!) to an arbitrary colour count; k=1 is
-- ordinary permutations. New composite carrier + a mixed-radix floor: the underlying permutation (lex, via
-- permutations' shared unrank) is the major digit, the colour vector as a base-k number (position 1 most
-- significant) the minor — the same order the precursor `numbers` used for its rank.
CREATE TYPE colored_permutation AS (image int[], colors int[]);
CREATE FUNCTION notation(x colored_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((x).image, ',') || ':' || array_to_string((x).colors, ',') $$;   -- "2,4,1,3:0,1,0,1" (perm : colours)
CREATE FUNCTION color_sum(x colored_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(c) FROM unnest((x).colors) c), 0)::int $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: cross the permutation (lex order) with every colour vector (base-k ascending, position 1 = most
-- significant digit), perm-major — colour digit at position i is (cr div kⁿ⁻ⁱ) mod k.
CREATE TYPE k_colored_permutations_fiber AS (size natural_number, colors natural_number);   -- axes: size (n), colors (k)
CREATE FUNCTION fiber_elements(f k_colored_permutations_fiber, element_limit int) RETURNS SETOF colored_permutation LANGUAGE sql STABLE AS $$
  SELECT ROW(
           (permutation_unrank_lex((f).size::int, ord)).image,
           ARRAY(SELECT mod(div(cr::numeric, pow_int((f).colors::int, (f).size::int - i)), (f).colors::numeric)::int
                 FROM generate_series(1, (f).size::int) i)
         )::colored_permutation
  FROM generate_series(0, (factorial((f).size::int) - 1)::int) ord,
       generate_series(0, (pow_int((f).colors::int, (f).size::int) - 1)::int) cr
  ORDER BY ord, cr
  LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_colored_permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int((f).colors::int, (f).size::int) * factorial((f).size::int) $$;   -- kⁿ·n!
CREATE FUNCTION contains_in_fiber(f k_colored_permutations_fiber, v colored_permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).image, 1), 0) = (f).size::int
     AND coalesce(array_length((v).colors, 1), 0) = (f).size::int
     AND (SELECT coalesce(array_agg(x ORDER BY x), '{}') FROM unnest((v).image) x) = ARRAY(SELECT generate_series(1, (f).size::int))
     AND NOT EXISTS (SELECT 1 FROM unnest((v).colors) c WHERE c < 0 OR c >= (f).colors::int) $$;
CREATE FUNCTION fiber_symbol(f k_colored_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'ℤ' || to_unicode_subscript((f).colors) || '≀S' || to_unicode_subscript((f).size) $$;   -- ℤ_k ≀ Sₙ

INSERT INTO base_collection VALUES ('k_colored_permutations', 'colored_permutation');
INSERT INTO base_grade VALUES ('k_colored_permutations', 1, 'size', NULL, NULL), ('k_colored_permutations', 2, 'colors', '1', 'g1');   -- colors = k, 1..n by default
SELECT base_realize('k_colored_permutations');

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('k_colored_permutations','color_sum','color_sum','Colour sum','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_colored_permutations','anchor kⁿ·n!: |ℤ₂≀Sₙ| for n=0..3 is 1,2,8,48 = |Bₙ| (signed permutations)','eq','1,2,8,48','k=2 recovers the hyperoctahedral order',$q$
    SELECT string_agg(cardinality(k_colored_permutations(n,2))::text, ',' ORDER BY n) FROM generate_series(0,3) n $q$),
  ('k_colored_permutations','the colour count matters: |ℤ₃≀S₂| = 3²·2! = 18, |ℤ₁≀S₃| = 1·6 = 6','eq','18|6','k=1 collapses to ordinary permutations',$q$
    SELECT cardinality(k_colored_permutations(2,3))::text || '|' || cardinality(k_colored_permutations(3,1))::text $q$),
  ('k_colored_permutations','floor generates 48 elements at (3,2), independent of the accel','eq','48','count the floor directly',$q$
    SELECT count(*)::text FROM elements(k_colored_permutations(3,2)) e $q$),
  ('k_colored_permutations','(1,3) in order: the identity permutation with each of the 3 colours','eq','1:0,1:1,1:2','colour digit ascending',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_colored_permutations(1,3)) e $q$),
  ('k_colored_permutations','(2,2) lex order: perm-major, colours as a base-2 number (position 1 most significant)','eq','1,2:0,0|1,2:0,1|1,2:1,0|1,2:1,1|2,1:0,0|2,1:0,1|2,1:1,0|2,1:1,1','the mixed-radix order',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(k_colored_permutations(2,2)) e $q$),
  ('k_colored_permutations','fiber = (size,colors) typed axes; unrank(k_colored_permutations(3,2),5).fiber','eq','3|2','the two grades',$q$
    SELECT (unrank(k_colored_permutations(3,2),5)).fiber.size::text || '|' || (unrank(k_colored_permutations(3,2),5)).fiber.colors::text $q$),
  ('k_colored_permutations','contains via <@: 1,2,3:0,1,2 ∈ ℤ₃≀S₃; wrong colour range ∉; wrong length ∉','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,2,3],ARRAY[0,1,2])::colored_permutation <@ k_colored_permutations(3,3))::text || '|' ||
           (ROW(ARRAY[1,2,3],ARRAY[0,1,3])::colored_permutation <@ k_colored_permutations(3,3))::text || '|' ||
           (ROW(ARRAY[1,2],ARRAY[0,1])::colored_permutation <@ k_colored_permutations(3,3))::text $q$),
  ('k_colored_permutations','color_sum stat: (2,4,1,3 : 0,1,0,1) has colour sum 2','eq','2','Σ cᵢ',$q$
    SELECT color_sum(ROW(ARRAY[2,4,1,3],ARRAY[0,1,0,1])::colored_permutation)::text $q$);
