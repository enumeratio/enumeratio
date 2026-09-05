-- requires: realizer, utilities
-- permutations — realized from data. Single grade [size]. Provides the floor + count accel + contains engine;
-- base_realize generates handle/fiber/element + constructor (incl. the (lo,hi) range form) + the full surface.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE permutation AS (image int[]);                              -- one-line images; {3,1,2} = 1↦3,2↦1,3↦2
-- bare digit concatenation ('312') is unambiguous only while every image value is a single digit (n ≤ 9); past that
-- (#70) two-digit values collide with digit boundaries ('12 3' vs '1 23' both read '123'), so n > 9 switches to a
-- space-separated form. n ≤ 9 output is untouched — keeps every existing bare-digit golden byte-identical.
CREATE FUNCTION one_line(p permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((p).image, 1), 0) <= 9 THEN array_to_string((p).image, '')
              ELSE array_to_string((p).image, ' ') END $$;
CREATE FUNCTION notation(p permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT one_line(p) $$;   -- canonical serialization for render()

CREATE FUNCTION permutation_unrank_lex(n int, ord bigint) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$   -- Lehmer decode
  DECLARE avail int[] := ARRAY(SELECT generate_series(1,n)); res int[] := '{}'; f numeric; idx int; k int; rem numeric := ord;
  BEGIN
    FOR k IN REVERSE n-1..0 LOOP
      f := CASE WHEN n <= 20 THEN factorial_bigint(k) ELSE factorial(k) END;   -- (#97) 20! fits int8 exactly; native bigint division below
      idx := div(rem, f)::int; rem := mod(rem, f);   -- exact integer division (not the rounding / operator)
      res := res || avail[idx+1]; avail := avail[1:idx] || avail[idx+2:array_length(avail,1)];
    END LOOP; RETURN ROW(res)::permutation;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE permutations_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f permutations_fiber, element_limit int) RETURNS SETOF permutation LANGUAGE sql STABLE AS $$
  SELECT permutation_unrank_lex((f).size::int, ord) FROM generate_series(0, (factorial((f).size::int) - 1)::int) ord LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$   -- (#97) size ≤ 20 fits int8 exactly
  SELECT CASE WHEN (f).size::int <= 20 THEN factorial_bigint((f).size::int)::numeric ELSE factorial((f).size::int) END $$;
CREATE FUNCTION contains_in_fiber(f permutations_fiber, v permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT array_length((v).image,1) = (f).size::int
     AND (SELECT array_agg(x ORDER BY x) FROM unnest((v).image) x) = ARRAY(SELECT generate_series(1, (f).size::int)) $$;

CREATE FUNCTION fiber_symbol(f permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) $$;   -- the symmetric group Sₙ

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f permutations_fiber, rank rank_index) RETURNS permutation LANGUAGE sql IMMUTABLE AS $fu$ SELECT permutation_unrank_lex((f).size::int, rank) $fu$;
INSERT INTO base_collection VALUES ('permutations', 'permutation');
INSERT INTO base_grade VALUES ('permutations', 1, 'size', NULL, NULL);
SELECT base_realize('permutations');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','unrank(permutations(3), 0) = identity 123','eq','123','the r-th element, then its value',$q$
    SELECT one_line((unrank(permutations(3), 0)).value) $q$),
  ('permutations','elements(permutations(3)) in lex order','eq','123,132,213,231,312,321','handle → its one fiber → chunk',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','set_notation: identity of S₄ ↦ 1234 ∈ S₄ (unicode subscript symbol)','eq','1234 ∈ S₄','generic membership rendering',$q$
    SELECT set_notation(unrank(permutations(4), 0)) $q$),
  ('permutations','range constructor permutations(1,3): fibers unfold to sizes 1,2,3','eq','1,2,3','the (lo,hi) range form (gap 1)',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(permutations(1,3)) f $q$),
  ('permutations','cardinality(permutations(4)) = 24 (accel, numeric)','eq','24','closed-form',$q$
    SELECT cardinality(permutations(4))::text $q$),
  ('permutations','range handle: cardinality(permutations(1,3)) = 9','eq','9','1!+2!+3! summed over fibers',$q$
    SELECT cardinality(permutations(1,3))::text $q$),
  ('permutations','element carries a TYPED point fiber + ordinality','eq','4|5','unrank(permutations(4),5)',$q$
    SELECT (unrank(permutations(4), 5)).fiber.size::text || '|' || ordinality(unrank(permutations(4), 5))::text $q$),
  ('permutations','composite element order = global rank across fibers','eq','1|12|21|123|132|213|231|312|321','elements(permutations(1,3)) ORDER BY the element',$q$
    SELECT string_agg(one_line((e).value), '|' ORDER BY e) FROM elements(permutations(1,3)) e $q$),
  ('permutations','unrank crosses fibers (rank 3 = first size-3 perm)','eq','123','ranks 0,1,2 are sizes 1,2,2; rank 3 = size 3',$q$
    SELECT one_line((unrank(permutations(1,3), 3)).value) $q$),
  ('permutations','contains (gap 2): 213 ∈ permutations(3), 21 ∉','eq','true|false','generated from contains_in_fiber',$q$
    SELECT contains(permutations(3), ROW(ARRAY[2,1,3])::permutation)::text || '|' ||
           contains(permutations(3), ROW(ARRAY[2,1])::permutation)::text $q$),
  ('permutations','the <@ operator works too: 231 <@ permutations(3)','eq','true','operator wrapper',$q$
    SELECT (ROW(ARRAY[2,3,1])::permutation <@ permutations(3))::text $q$),
  ('permutations','accelerated unrank at a fiber BOUNDARY: rank 2 = last size-2 perm (21), not into size-3 (#152)','eq','21',
    'exercises the off-by-one at the cum-window edge: prior=1 (|S₁|), run=3 (|S₁|+|S₂|), r=2 ⇒ local ord 1',$q$
    SELECT one_line((unrank(permutations(1,3), 2)).value) $q$),
  ('permutations','accelerated unrank(handle,r) == the naive sequential scan, for every r (#152)','eq','true',
    'differential check: element_at-dispatch (permutations has fiber_unrank) must agree with elements()+OFFSET at every rank of permutations(1,4)',$q$
    SELECT bool_and(
      unrank(permutations(1,4), r) IS NOT DISTINCT FROM (
        SELECT e FROM elements(permutations(1,4), least(r + 1, 2147483647)::int) e
         ORDER BY fiber_address((e).fiber), (e).rank OFFSET r LIMIT 1
      )
    )::text
    FROM generate_series(0, cardinality(permutations(1,4))::int - 1) r $q$);
