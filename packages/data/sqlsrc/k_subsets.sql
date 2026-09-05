-- requires: subsets, realizer
-- k_subsets — the k-element subsets of [n], graded by (n, k): k_subsets(n,k) is the C(n,k) subsets of size k in
-- colex order, and k_subsets(n) unfolds fibers over k = 0..n. Same carrier (finset) as `subsets` — this is the
-- k-graded REFINEMENT of it (subsets grades by n alone; here each n is split by cardinality k). Order-isomorphic to
-- subsets via the identity on the shared carrier: both enumerate [n]'s subsets in (k, colex) order.
CREATE TYPE k_subsets_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n, k
-- the FLOOR: one fiber (n,k) = the k-subsets in colex order; + the binomial count acceleration
CREATE FUNCTION fiber_elements(f k_subsets_fiber, element_limit int) RETURNS SETOF finset LANGUAGE sql STABLE AS $$
  SELECT subset_unrank_colex((f).n::int, (f).k::int, ord) FROM generate_series(0, binomial((f).n::int, (f).k::int)::int - 1) ord LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_subsets_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT binomial((f).n::int, (f).k::int)::numeric $$;
CREATE FUNCTION contains_in_fiber(f k_subsets_fiber, s finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- ground-aware: same n, ⊆ [n], |s| = k, distinct sorted
  SELECT (s).n = (f).n::int
     AND coalesce(array_length((s).members,1), 0) = (f).k
     AND NOT EXISTS (SELECT 1 FROM unnest((s).members) m WHERE m < 1 OR m > (f).n)
     AND coalesce((s).members, '{}') = coalesce((SELECT array_agg(DISTINCT m ORDER BY m) FROM unnest((s).members) m), '{}') $$;

CREATE FUNCTION fiber_symbol(f k_subsets_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'C(' || (f).n::int || ',' || (f).k::int || ')' $$;   -- the C(n,k) k-subsets

-- direct unrank (capability layer 3): the combinatorial number system gives the ord-th k-subset directly.
CREATE FUNCTION fiber_unrank(f k_subsets_fiber, rank rank_index) RETURNS finset LANGUAGE sql IMMUTABLE AS $$ SELECT subset_unrank_colex((f).n::int, (f).k::int, rank) $$;
INSERT INTO base_collection VALUES ('k_subsets', 'finset');
INSERT INTO base_grade VALUES ('k_subsets', 1, 'n', NULL, NULL), ('k_subsets', 2, 'k', '0', 'g1');   -- k ranges 0..n
SELECT base_realize('k_subsets');

-- order-isomorphic sibling of subsets: the identity on the shared carrier (same elements, coarser grading)
CREATE FUNCTION subset_id(s finset) RETURNS finset LANGUAGE sql IMMUTABLE AS $$ SELECT s $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('k_subsets', 'finset', 'subset_id', 'subsets', 'As a single-graded finset', NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_subsets','2-subsets of {1..4} in colex order (bit registers)','eq','1100,1010,0110,1001,0101,0011','realized fiber (4,2)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_subsets(4,2)) e $q$),
  ('k_subsets','multi-grade chain: fiber = (n,k) named axes','eq','4|2','unrank(k_subsets(4,2), 3).fiber is (n=4,k=2)',$q$
    SELECT (unrank(k_subsets(4,2), 3)).fiber.n::text || '|' || (unrank(k_subsets(4,2), 3)).fiber.k::text $q$),
  ('k_subsets','cardinality(k_subsets(4,2)) = 6 = C(4,2) (accel)','eq','6','realized cardinality via the accel',$q$
    SELECT cardinality(k_subsets(4,2))::text $q$),
  ('k_subsets','cardinality(k_subsets(40,20)) = C(40,20) = 137846528820','eq','137846528820','binomial returns numeric — the exact count exceeds int4 max',$q$
    SELECT cardinality(k_subsets(40,20))::text $q$),
  ('k_subsets','big fiber: element_at at rank C(40,20)-1 = 137846528819 (past int4) is a valid member','eq','true','rank_index is bigint; subset_unrank_colex widened to unrank past 2^31',$q$
    SELECT ((element_at((SELECT f FROM fibers(k_subsets(40,20)) f), 137846528819::rank_index)).value <@ k_subsets(40,20))::text $q$),
  ('k_subsets','(#97) n=64 is past the binomial_bigint int8 guard (n<=61): unrank still succeeds via the numeric fallback','eq','true','regression — binomial_bigint(62,31) overflows int8 mid-product, so n=64 must route through binomial(), not crash',$q$
    SELECT ((unrank(k_subsets(64,32), 0)).value <@ k_subsets(64,32))::text $q$),
  ('k_subsets','k RANGE: cardinality(k_subsets(4)) = 16 = Σ C(4,k) = 2^4','eq','16','fibers unfold over k=0..4',$q$
    SELECT cardinality(k_subsets(4))::text $q$),
  ('k_subsets','fibers(k_subsets(4)) unfold to k = 0,1,2,3,4','eq','0,1,2,3,4','the second grade ranges',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(k_subsets(4)) f $q$),
  ('k_subsets','order-isomorphic to subsets(3): same elements in the same order','eq','true','the shared carrier + (k,colex) order',$q$
    SELECT (ARRAY(SELECT notation((e).value) FROM elements(k_subsets(3)) e ORDER BY e)
          = ARRAY(SELECT notation((e).value) FROM elements(subsets(3)) e ORDER BY e))::text $q$),
  ('k_subsets','contains via <@: {1,3} ∈ k_subsets(4,2), ∉ k_subsets(4,3), and {1,5} ∉ k_subsets(4,2)','eq','true|false|false','|s|=k and ⊆ [n]',$q$
    SELECT (ROW(ARRAY[1,3], 4)::finset <@ k_subsets(4,2))::text || '|' || (ROW(ARRAY[1,3], 4)::finset <@ k_subsets(4,3))::text || '|' || (ROW(ARRAY[1,5], 4)::finset <@ k_subsets(4,2))::text $q$),
  ('k_subsets','a fiber address AS an omega_ordinal < ω^ω: (n=4,k=2) ↦ ω·4 + 2','eq','ω·4 + 2','fiber_address is a typed omega_ordinal; notation renders the CNF',$q$
    SELECT notation(fiber_address((unrank(k_subsets(4,2), 0)).fiber)) $q$),
  ('k_subsets','set_notation: first 2-finset of {1..4} ↦ 1100 ∈ C(4,2)','eq','1100 ∈ C(4,2)','the fiber symbol carries both grades',$q$
    SELECT set_notation(unrank(k_subsets(4,2), 0)) $q$);
