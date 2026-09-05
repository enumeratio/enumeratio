-- requires: perfect_matchings, realizer
-- non_crossing_matchings — perfect matchings of {1..2n} into n pairs with NO crossing: no two pairs (a,b),(c,d)
-- with a<c<b<d. Single grade [n], counted by Catalan(n). Realized as a base_restrict of perfect_matchings (04):
-- same perfect_matching carrier (pairs int[], flattened [a1,b1,a2,b2,…], ai<bi, pairs ascending by ai), the floor
-- is the parent's floor filtered to the non-crossing ones (order preserved — the parent floor is already sorted),
-- and contains = parent-contains AND non-crossing. No closed-form accel is wired here (base_restrict only carries
-- one over if the parent has one, and perfect_matchings doesn't provide a sub-accel usable per-restriction), so
-- cardinality counts the filtered floor — that's fine per the realizer's rules.

-- ── the non-crossing predicate on a perfect_matching ─────────────────────────────────────────────────────
-- pairs by index p ranges over 1..(#pairs); pair p = (pairs[2p-1], pairs[2p]). A crossing is any ordered pair of
-- pair-indices (p,q) with a_p < a_q < b_p < b_q — checked both ways round by scanning all (p,q), p<>q included,
-- since the condition itself is asymmetric (swapping p,q gives a different, not-equivalent, inequality chain).
CREATE FUNCTION is_non_crossing_matching(m perfect_matching) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM generate_series(1, coalesce(array_length((m).pairs,1),0) / 2) p,
         generate_series(1, coalesce(array_length((m).pairs,1),0) / 2) q
    WHERE (m).pairs[2*p-1] < (m).pairs[2*q-1]
      AND (m).pairs[2*q-1] < (m).pairs[2*p]
      AND (m).pairs[2*p]   < (m).pairs[2*q]
  ) $$;

-- ── declare as a restriction + realize ───────────────────────────────────────────────────────────────────
SELECT base_restrict('non_crossing_matchings', 'perfect_matchings', 'is_non_crossing_matching');
CREATE FUNCTION fiber_symbol(f non_crossing_matchings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'NCM(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('non_crossing_matchings');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_crossing_matchings','cardinality anchor = Catalan(n) for n=0..4','eq','1,1,2,5,14','base_restrict counts the filtered floor',$q$
    SELECT string_agg(cardinality(non_crossing_matchings(n))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('non_crossing_matchings','the 5 non-crossing matchings of [3] in order','eq','(1,2)(3,4)(5,6),(1,2)(3,6)(4,5),(1,4)(2,3)(5,6),(1,6)(2,3)(4,5),(1,6)(2,5)(3,4)','the filtered floor: crossings like (1,3)(2,4)(5,6) dropped from the 15 of perfect_matchings(3)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(non_crossing_matchings(3)) e $q$),
  ('non_crossing_matchings','every listed matching of [3] is non-crossing','eq','true','structural invariant across the fiber',$q$
    SELECT bool_and(is_non_crossing_matching((e).value))::text FROM elements(non_crossing_matchings(3)) e $q$),
  ('non_crossing_matchings','strict subset of perfect_matchings: 15 − 5 = 10 crossing matchings dropped at n=3','eq','10','(2n-1)!! = 15 vs Catalan(3) = 5',$q$
    SELECT (cardinality(perfect_matchings(3)) - cardinality(non_crossing_matchings(3)))::text $q$),
  ('non_crossing_matchings','element carries a TYPED point fiber (n)','eq','3','unrank(non_crossing_matchings(3),0).fiber.n',$q$
    SELECT (unrank(non_crossing_matchings(3), 0)).fiber.n::text $q$),
  ('non_crossing_matchings','range constructor non_crossing_matchings(0,4): fibers unfold to n = 0,1,2,3,4','eq','0,1,2,3,4','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(non_crossing_matchings(0,4)) f $q$),
  ('non_crossing_matchings','range handle cardinality = sum of Catalan(0..4) = 23','eq','23','1+1+2+5+14 summed over fibers',$q$
    SELECT cardinality(non_crossing_matchings(0,4))::text $q$),
  ('non_crossing_matchings','contains via <@: (1,2)(3,4) non-crossing ∈, (1,3)(2,4) crossing ∉','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,2,3,4])::perfect_matching <@ non_crossing_matchings(2))::text || '|' ||
           (ROW(ARRAY[1,3,2,4])::perfect_matching <@ non_crossing_matchings(2))::text $q$);
