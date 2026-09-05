-- requires: realizer, utilities, debug
-- subsets — the subsets of [n], graded by n ALONE: subsets(n) is one fiber holding all 2ⁿ subsets in (k, colex)
-- order (cardinality ascending, colex within each). Carrier `finset`; base_realize generates the surface. This is
-- the single-graded powerset 2^[n] (aligns with numbers' subsets~size/n). The k-graded refinement (split by
-- cardinality k) is the sibling collection `k_subsets`, order-isomorphic to this via the identity on the carrier.

-- The UNIFIED finset carrier (finset α): a finite set of positive integers + its ground n. n is the SIZE of α:
--   • n finite  ⇒ α = Fin n  (a subset of [n]; the `subsets` family) — members ⊆ [n].
--   • n IS NULL ⇒ α = ℕ       (an unbounded finite set; the `finsets` collection) — members any positives.
-- One carrier, two α (Dean's finset-α mold); everything below is shared. (Alphabets = a finite α with a labelling.)
CREATE TYPE finset AS (members int[], n int);                         -- sorted ascending; n = |α| (finite) or NULL (ℕ). e.g. ({1,3}, 4) = {1,3} ⊆ [4]
-- notation follows α: a length-n bit REGISTER when the ground is finite (encodes ground-awareness), set BRACES for ℕ.
CREATE FUNCTION notation(s finset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (s).n IS NULL
    THEN '{' || array_to_string((s).members, ',') || '}'                                                                        -- α = ℕ
    ELSE coalesce((SELECT string_agg((i = ANY((s).members))::int::text, '' ORDER BY i) FROM generate_series(1, (s).n) i), '')   -- α = Fin n: register
  END $$;

CREATE FUNCTION subset_unrank_colex(n int, k int, ord bigint) RETURNS finset LANGUAGE plpgsql IMMUTABLE AS $$   -- combinatorial number system
  DECLARE res int[] := '{}'; x numeric := ord; i int; c int;
    dbg boolean := debug_enabled('enumeratio:data:unrank');   -- ONCE, before the loop (debug.sql's hot-loop pattern)
  BEGIN   -- x tracks the (bigint-sized) rank; binomial is numeric
    IF dbg THEN RAISE NOTICE '[enumeratio:data:unrank] subset_unrank_colex n=% k=% ord=%', n, k, ord; END IF;
    IF n <= 61 THEN   -- (#97) n=61 is the largest ground where every binomial_bigint(m,i), m<=n, stays int8-safe THROUGHOUT (the interleaved
                      -- product/quotient can overflow on an intermediate step even when the final value would fit); n=62 already raises
      FOR i IN REVERSE k..1 LOOP
        c := i-1; WHILE binomial_bigint(c+1, i) <= x LOOP
          c := c+1;
          IF dbg THEN RAISE NOTICE '[enumeratio:data:unrank]   i=% c=%', i, c; END IF;
        END LOOP;
        res := res || (c+1); x := x - binomial_bigint(c, i);
      END LOOP;
    ELSE
      FOR i IN REVERSE k..1 LOOP
        c := i-1; WHILE binomial(c+1, i) <= x LOOP
          c := c+1;
          IF dbg THEN RAISE NOTICE '[enumeratio:data:unrank]   i=% c=%', i, c; END IF;
        END LOOP;
        res := res || (c+1); x := x - binomial(c, i);
      END LOOP;
    END IF;
    RETURN ROW(ARRAY(SELECT unnest(res) ORDER BY 1), n)::finset;
  END $$;

CREATE TYPE subsets_fiber AS (n natural_number);   -- single grade: the ground size (all 2ⁿ subsets, not split by k)
-- the FLOOR: every finset of [n] in (k ascending, colex within) order; + a closed-form count (2ⁿ)
CREATE FUNCTION fiber_elements(f subsets_fiber, element_limit int) RETURNS SETOF finset LANGUAGE sql STABLE AS $$
  SELECT subset_unrank_colex((f).n::int, k, ord)
    FROM generate_series(0, (f).n::int) k, LATERAL generate_series(0, binomial((f).n::int, k)::int - 1) ord
   ORDER BY k, ord LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f subsets_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT trunc(2::numeric ^ (f).n::int) $$;   -- 2ⁿ
CREATE FUNCTION contains_in_fiber(f subsets_fiber, s finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- ground-aware: same n, ⊆ [n], distinct sorted
  SELECT (s).n = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((s).members) m WHERE m < 1 OR m > (f).n::int)
     AND coalesce((s).members, '{}') = coalesce((SELECT array_agg(DISTINCT m ORDER BY m) FROM unnest((s).members) m), '{}') $$;

CREATE FUNCTION fiber_symbol(f subsets_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '2^[' || (f).n::int || ']' $$;   -- the powerset 2^[n]

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('subsets', 'finset');
INSERT INTO base_grade VALUES ('subsets', 1, 'n', NULL, NULL);
SELECT base_realize('subsets');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('subsets','|subsets(n)| = 2ⁿ for n=0..5','eq','1,2,4,8,16,32','one fiber per n = the powerset',$q$
    SELECT string_agg(cardinality(subsets(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('subsets','subsets(3) = all 8 subsets of [3] as bit registers, (k, colex) order','eq','000,100,010,001,110,101,011,111','length-3 indicator; cardinality ascending, colex within',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(subsets(3)) e $q$),
  ('subsets','single grade ⇒ ONE fiber per n: fibers(subsets(3)) = 1','eq','1','graded by n alone',$q$
    SELECT count(*)::text FROM fibers(subsets(3)) $q$),
  ('subsets','cardinality(subsets(4)) = 16 = 2^4','eq','16','the closed-form count',$q$
    SELECT cardinality(subsets(4))::text $q$),
  ('subsets','contains via <@: {1,3} ∈ subsets(4), {1,5} ∉ subsets(4)','eq','true|false','⊆ [n], any cardinality',$q$
    SELECT (ROW(ARRAY[1,3], 4)::finset <@ subsets(4))::text || '|' || (ROW(ARRAY[1,5], 4)::finset <@ subsets(4))::text $q$),
  ('subsets','fiber address AS an omega_ordinal: the single axis n=3 ↦ 3 (a finite omega_ordinal)','eq','3','fiber_address is a typed omega_ordinal; here one axis',$q$
    SELECT notation(fiber_address((unrank(subsets(3), 0)).fiber)) $q$),
  ('subsets','set_notation renders the element in its ambient set: rank 4 of subsets(3) ↦ 110 ∈ 2^[3]','eq','110 ∈ 2^[3]','generic <element> ∈ <fiber symbol>',$q$
    SELECT set_notation(unrank(subsets(3), 4)) $q$);
