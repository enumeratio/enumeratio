-- requires-tag: collection
-- requires: realizer
-- Examples for the row-half surface the realizer generates on every collection (see the query-view design):
--   fibers(h, fiber_limit)          — streaming fibers, so an OPEN handle's counting sequence reads without elements
--   <axis>(e) / rank(e)             — grade axes and the within-fiber rank straight off an element (the view's columns)
--   elements(h, rank_index_range)   — a window as a first-class slice over the handle's global index
-- Assertions are membership/equality on small fixed prefixes, never registry counts.

INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('handle-windows','fibers stream on an open handle','eq','0,1,2,3,4,5,6,7',
   'fibers(permutations(), 8): the odometer walk yields sizes 0..7 where fibers(permutations()) yields nothing',
   $q$ SELECT string_agg((f).size::text, ',' ORDER BY fiber_address(f)) FROM fibers(permutations(), 8) f $q$),
  ('handle-windows','fibers(h, n) on a closed handle = fibers(h)','eq','2,3,4',
   'a bounded band takes the plain unfold, capped',
   $q$ SELECT string_agg((f).size::text, ',' ORDER BY fiber_address(f)) FROM fibers(permutations(2, 4), 100) f $q$),
  ('handle-windows','fibers(h, n) walks a second axis','eq','{3,0},{3,1},{3,2},{3,3}',
   'k_subsets(3) leaves k free: the four (3,k) fibers in address order',
   $q$ SELECT string_agg(fiber_address(f)::text, ',' ORDER BY fiber_address(f)) FROM fibers(k_subsets(3), 10) f $q$),
  ('handle-windows','fibers(h, n) on an ungraded collection is the unit fiber','eq','1',
   'prime_numbers has no axes: exactly one fiber whatever the limit',
   $q$ SELECT count(*)::text FROM fibers(prime_numbers(), 5) f $q$),
  ('handle-windows','counting sequence off streamed fibers','eq','1,1,2,6,24,120',
   'cardinality(f) over fibers(permutations(), 6): the factorials, no element materialized',
   $q$ SELECT string_agg(cardinality(f)::text, ',' ORDER BY fiber_address(f)) FROM fibers(permutations(), 6) f $q$),

  ('handle-windows','rank(e) is the within-fiber position','eq','true',
   'rank(e) = lower((e).rank) = ordinality(e) on every element',
   $q$ SELECT bool_and(rank(e) = lower((e).rank) AND rank(e) = ordinality(e))::text FROM elements(permutations(0, 3)) e $q$),
  ('handle-windows','axis accessors read the fiber off the element','eq','true',
   'size(e) on permutations; n(e), k(e) on k_subsets — equal to the fiber fields',
   $q$ SELECT ((SELECT bool_and(size(e) = ((e).fiber).size) FROM elements(permutations(0, 3)) e)
          AND (SELECT bool_and(n(e) = ((e).fiber).n AND k(e) = ((e).fiber).k) FROM elements(k_subsets(3)) e))::text $q$),
  ('handle-windows','the four positions hang together: address(e) = address(fiber) ⊕ rank(e); omega_ordinality(e) is its CNF reading','eq','true',
   'rank within the fiber, the compound address, and the ordinal are one datum three ways',
   $q$ SELECT bool_and(address(e) = address((e).fiber) || rank(e)
                   AND omega_ordinality(e) = (fiber_address((e).fiber) || rank(e)::numeric)::omega_ordinal)::text
         FROM elements(k_subsets(4)) e $q$),
  ('handle-windows','the compound address spelled: k_subsets(4,2) rank 1 is 4.2.1, read ω²·4 + ω·2 + 1','eq','4.2.1|ω^2·4 + ω·2 + 1',
   'address(e) as text and omega_ordinality(e) as Cantor normal form',
   $q$ SELECT array_to_string(address(e), '.') || '|' || notation(omega_ordinality(e)) FROM elements(k_subsets(4, 2)) e WHERE rank(e) = 1 $q$),
  ('handle-windows','ordinality is a property of a RESULT, not of an element: under a WHERE it renumbers while rank stays canonical','eq','1,2,3|5,7,11',
   'row_number() over the filtered rows vs the elements'' own ranks',
   $q$ SELECT string_agg(o::text, ',' ORDER BY o) || '|' || string_agg(r::text, ',' ORDER BY o) FROM (
         SELECT row_number() OVER (ORDER BY rank(e)) AS o, rank(e) AS r FROM elements(permutations(4)) e WHERE perm_descents((e).value) >= 2 LIMIT 3) t $q$),
  ('handle-windows','axis accessor by functional notation','eq','3,3,3,3,3,3',
   'e.size resolves to size(e)',
   $q$ SELECT string_agg(e.size::text, ',' ORDER BY rank(e)) FROM elements(permutations(3)) e $q$),

  ('handle-windows','slice on a closed handle = OFFSET/LIMIT over the global order','eq','true',
   'elements(permutations(0,4), [5,12)) vs the sequential walk',
   $q$ SELECT ((SELECT string_agg(render(e), ',' ORDER BY fiber_address((e).fiber), rank(e)) FROM elements(permutations(0, 4), rank_index_range(5, 12, '[)')) e)
            = (SELECT string_agg(r, ',') FROM (SELECT render(e) r FROM elements(permutations(0, 4)) e ORDER BY fiber_address((e).fiber), rank(e) OFFSET 5 LIMIT 7) t))::text $q$),
  ('handle-windows','slice on an OPEN handle crosses fibers','eq','312,321,1234,1243',
   'global index: sizes 0,1 (1 each), 2 (2), 3 (6) ⇒ [8,12) straddles size 3 and 4',
   $q$ SELECT string_agg(render(e), ',' ORDER BY fiber_address((e).fiber), rank(e)) FROM elements(permutations(), rank_index_range(8, 12, '[)')) e $q$),
  ('handle-windows','slice keeps the canonical rank','eq','4,5,0,1',
   'the elements in [8,12) carry their within-fiber ranks, not slice positions',
   $q$ SELECT string_agg(rank(e)::text, ',' ORDER BY fiber_address((e).fiber), rank(e)) FROM elements(permutations(), rank_index_range(8, 12, '[)')) e $q$),
  ('handle-windows','slice takes the scan path without fiber_unrank','eq','true',
   'derangements has a count accel but no unrank: elements(h, slice) still equals the sequential walk',
   $q$ SELECT ((SELECT string_agg(render(e), ',' ORDER BY fiber_address((e).fiber), rank(e)) FROM elements(derangements(0, 5), rank_index_range(3, 9, '[)')) e)
            = (SELECT string_agg(r, ',') FROM (SELECT render(e) r FROM elements(derangements(0, 5)) e ORDER BY fiber_address((e).fiber), rank(e) OFFSET 3 LIMIT 6) t))::text $q$),
  ('handle-windows','slice on an ungraded infinite collection','eq','7,11,13',
   'prime_numbers is one unbounded fiber: [3,6) is the 4th..6th prime',
   $q$ SELECT string_agg(render(e), ',' ORDER BY rank(e)) FROM elements(prime_numbers(), rank_index_range(3, 6, '[)')) e $q$),
  ('handle-windows','inclusive slice bounds','eq','3',
   '[3,5] has three positions',
   $q$ SELECT count(*)::text FROM elements(permutations(4), rank_index_range(3, 5, '[]')) e $q$),
  ('handle-windows','slice past the end is truncated','eq','312,321',
   'permutations(3) has 6 elements: [4,100) yields the last two',
   $q$ SELECT string_agg(render(e), ',' ORDER BY rank(e)) FROM elements(permutations(3), rank_index_range(4, 100, '[)')) e $q$),
  ('handle-windows','empty slice','eq','0','',
   $q$ SELECT count(*)::text FROM elements(permutations(3), rank_index_range(2, 2, '[)')) e $q$),

  -- #254: an open walk whose fibers run barren has no next element in the handle's own fiber_address order, so it
  -- must stop rather than ride the iteration backstop for 20s. Both element windows carry the barren-fiber budget.
  ('handle-windows','an open walk over a barren ray terminates','eq','1',
   'singleton_species is nonempty only at n=1: the walk yields that one element and stops instead of raying on empty fibers',
   $q$ SELECT count(*)::text FROM elements(singleton_species(), 100) e $q$),
  ('handle-windows','a slice over a barren ray terminates too','eq','1',
   'the same budget on elements(h, slice), where a fiber is barren when it adds nothing to the running index',
   $q$ SELECT count(*)::text FROM elements(singleton_species(), rank_index_range(0, 5, '[)')) e $q$),
  ('handle-windows','the budget never truncates a productive walk','eq','100',
   'permutations yields on every fiber, so the barren counter never advances and the element limit still binds',
   $q$ SELECT count(*)::text FROM elements(permutations(), 100) e $q$);
