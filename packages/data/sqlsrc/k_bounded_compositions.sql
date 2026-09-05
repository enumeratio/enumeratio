-- requires: integer_compositions, realizer, subsets, utilities
-- k_bounded_compositions — ported from pg-enumeratio-core_old_backup/sqlsrc/k-bounded-compositions.sql.
-- Ordered sequences of POSITIVE parts summing to n, using AT MOST k parts (k = 'max_parts'). Multi-grade
-- chain [n (ground total), max_parts]; unlike the exact-k siblings (compositions_into_k_parts,
-- weak_compositions_into_k_parts) the max_parts fibers are NESTED, not disjoint — a composition with 2 parts
-- lives in the max_parts=2 fiber AND the max_parts=3 fiber AND so on. Summing fibers over a range would double
-- count, so max_parts defaults to a SINGLE point (n itself — "no bound", i.e. every composition of n) rather
-- than unfolding a range; the old backup handled this the same way, dispatching the unbound case straight to
-- integer_compositions_count. Reuses the `composition` carrier + notation from integer_compositions,
-- composition_from_mask's gap-cut bijection, binomial from subsets, and binary_popcount from utilities.
--
-- Fiber [n, m] = compositions of n with <= m parts. A composition of n corresponds to a gap-cut mask over the
-- n-1 gaps between n unit cells (see integer_compositions); its number of parts is popcount(mask)+1, so
-- "<= m parts" is exactly "popcount(mask) <= m-1". Order = mask ascending (same canonical order as
-- integer_compositions, just filtered) — e.g. n=4, m=2 ⇒ 4, 1+3, 2+2, 3+1. count of a fiber =
-- sum_{i=1}^{min(m,n)} C(n-1, i-1); n=0 is the single empty composition (0 parts, <= any m >= 0), independent
-- of m — mirrors the old formula's unconditional "n = 0 THEN 1".

-- ── the FLOOR: reuse integer_compositions' mask enumeration, filtered to popcount(mask) <= max_parts - 1 ──────
CREATE TYPE k_bounded_compositions_fiber AS (n natural_number, max_parts natural_number);   -- typed fiber; axes: n, max_parts
CREATE FUNCTION fiber_elements(f k_bounded_compositions_fiber, element_limit int) RETURNS SETOF composition LANGUAGE sql STABLE AS $$
  SELECT composition_from_mask((f).n::int, m)
    FROM generate_series(0::bigint, (1::bigint << greatest((f).n::int - 1, 0)) - 1) m
   WHERE (f).n::int = 0 OR binary_popcount(m::numeric) <= (f).max_parts::int - 1
   ORDER BY m
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_bounded_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int = 0 THEN 1::numeric
              ELSE (SELECT coalesce(sum(binomial((f).n::int - 1, i - 1)), 0)
                      FROM generate_series(1, least((f).max_parts::int, (f).n::int)) i)::numeric
         END $$;
CREATE FUNCTION contains_in_fiber(f k_bounded_compositions_fiber, v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).parts, 1), 0) <= (f).max_parts::int          -- at most max_parts parts
     AND coalesce((SELECT sum(p) FROM unnest((v).parts) p), 0) = (f).n::int      -- summing to n
     AND NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p <= 0) $$;         -- all positive

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
-- max_parts defaults to the point n (unbound ⇒ no bound at all, i.e. every composition of n): nested fibers
-- can't be summed over a range the way disjoint exact-k fibers can, so there is no meaningful "full unfold".
INSERT INTO base_collection VALUES ('k_bounded_compositions', 'composition');
INSERT INTO base_grade VALUES
  ('k_bounded_compositions', 1, 'n', NULL, NULL),
  ('k_bounded_compositions', 2, 'max_parts', 'g1', 'g1');
CREATE FUNCTION fiber_symbol(f k_bounded_compositions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'C' || to_unicode_subscript((f).max_parts) || '(' || (f).n::int || ')' $$;   -- corpus symbol

-- direct unrank: the floor is masks 0..2^(n-1)-1 filtered to popcount(mask) <= max_parts-1, in mask (numeric)
-- ascending order — a standard MSB-to-LSB digit DP. count_le(bits,budget) = #masks of `bits` bits with popcount
-- <= budget = Σ_{j=0}^{min(bits,budget)} C(bits,j); at each bit (MSB first) try 0 before 1 (0 is numerically
-- smaller), spending one unit of budget when a bit is set.
CREATE FUNCTION k_bounded_composition_count_le(bits int, budget int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN budget < 0 THEN 0::numeric
    ELSE coalesce((SELECT sum(binomial(bits, j)) FROM generate_series(0, least(bits, budget)) j), 0) END $$;
CREATE FUNCTION k_bounded_composition_unrank_mask(len int, budget int, ord bigint) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE mask bigint := 0; x numeric := ord; i int; b int := budget; cnt0 numeric;
  BEGIN
    FOR i IN REVERSE (len-1)..0 LOOP
      cnt0 := k_bounded_composition_count_le(i, b);            -- completions if bit i = 0 (budget unchanged)
      IF x < cnt0 THEN NULL;                                    -- bit i = 0
      ELSE x := x - cnt0; mask := mask | (1::bigint << i); b := b - 1; END IF;   -- bit i = 1
    END LOOP;
    RETURN mask;
  END $$;
CREATE FUNCTION fiber_unrank(f k_bounded_compositions_fiber, rank rank_index) RETURNS composition LANGUAGE sql IMMUTABLE AS $fu$
  SELECT composition_from_mask((f).n::int,
    k_bounded_composition_unrank_mask(greatest((f).n::int - 1, 0), (f).max_parts::int - 1, rank::bigint)) $fu$;
SELECT base_realize('k_bounded_compositions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_bounded_compositions','compositions of 4 with at most 2 parts, in mask order','eq','4,1+3,2+2,3+1','the realized floor for fiber [4,2] (anchor)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_bounded_compositions(4,2)) e $q$),
  ('k_bounded_compositions','anchor |compositions of 4 with at most 2 parts| = 4','eq','4','1 (1-part) + 3 (2-part, C(3,1)) = 4',$q$
    SELECT cardinality(k_bounded_compositions(4,2))::text $q$),
  ('k_bounded_compositions','fiber counts for n=5, max_parts=1..5: 1,5,11,15,16','eq','1,5,11,15,16','cumulative, not disjoint — each includes the previous',$q$
    SELECT string_agg(cardinality(k_bounded_compositions(5,m))::text, ',' ORDER BY m) FROM generate_series(1,5) m $q$),
  ('k_bounded_compositions','unbound max_parts defaults to the point n: matches integer_compositions(4) = 8','eq','8','no bound at all ⇒ every composition of 4',$q$
    SELECT cardinality(k_bounded_compositions(4))::text $q$),
  ('k_bounded_compositions','multi-grade chain: fiber = (n,max_parts) named axes','eq','4|2','unrank(...).fiber is (n=4,max_parts=2)',$q$
    SELECT (unrank(k_bounded_compositions(4,2), 0)).fiber.n::text || '|' || (unrank(k_bounded_compositions(4,2), 0)).fiber.max_parts::text $q$),
  ('k_bounded_compositions','every element of fiber [6,3] has <= 3 positive parts summing to 6','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).parts,1) <= 3
                AND (SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 6
                AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p <= 0))::text
      FROM elements(k_bounded_compositions(6,3)) e $q$),
  ('k_bounded_compositions','n=0 edge case: the empty composition counts for any max_parts >= 0','eq','1|1','0 parts is <= any bound',$q$
    SELECT cardinality(k_bounded_compositions(0,0))::text || '|' || cardinality(k_bounded_compositions(0,3))::text $q$),
  ('k_bounded_compositions','contains via <@: 1+3 ∈ (4,2), 1+1+2 ∉ (4,2) (3 parts), 4 ∈ (4,2)','eq','true|false|true','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,3])::composition <@ k_bounded_compositions(4,2))::text || '|' ||
           (ROW(ARRAY[1,1,2])::composition <@ k_bounded_compositions(4,2))::text || '|' ||
           (ROW(ARRAY[4])::composition <@ k_bounded_compositions(4,2))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_bounded_compositions','fiber_unrank(k_bounded_compositions(6,3), 0..) are all members (accel floor)','eq','true','the popcount-bounded mask-unrank digit DP lands inside the fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(k_bounded_compositions(6,3)) f), ord::rank_index) <@ k_bounded_compositions(6,3))::text
      FROM generate_series(0, cardinality(k_bounded_compositions(6,3))::int - 1) ord $q$);
