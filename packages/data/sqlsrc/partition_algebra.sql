-- requires: set_partitions, realizer, utilities
-- partition_algebra — the set-partition diagram basis: the elements are the set partitions of [n], Bell(n) of them,
-- read as the basis diagrams of the partition monoid on one row of n points (blocks = which points are wired
-- together). BORROWS the set_partitions carrier + floor + count verbatim (RGS, lex order); this is the ALGEBRA
-- reading of that same data. (The full diagram partition algebra P_k has a basis indexed by set partitions of a 2k
-- point set — Bell(2k); that two-row carrier is a follow-up. Here the borrow is the one-row set-partition basis.)

-- ── borrow the set_partitions engines verbatim (all Bell(n) partitions, RGS lex order) ──────────────────
CREATE TYPE partition_algebra_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows set_partitions' floor)
CREATE FUNCTION fiber_elements(f partition_algebra_fiber, element_limit int) RETURNS SETOF set_partition LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::set_partitions_fiber, element_limit) v LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f partition_algebra_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fiber_count(ROW((f).n)::set_partitions_fiber) $$;
CREATE FUNCTION contains_in_fiber(f partition_algebra_fiber, v set_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::set_partitions_fiber, v) $$;

INSERT INTO base_collection VALUES ('partition_algebra', 'set_partition');
INSERT INTO base_grade VALUES ('partition_algebra', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f partition_algebra_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'P(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('partition_algebra');

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('partition_algebra','blocks','setpart_blocks','Number of blocks (wired groups)','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('partition_algebra','basis size = Bell(n) for n=0..5','eq','1,1,2,5,15,52','set-partition diagrams on one row of n points',$q$
    SELECT string_agg(cardinality(partition_algebra(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('partition_algebra','the 5 basis diagrams of P(3), as blocks','eq','{1,2,3}|{1,2}/{3}|{1,3}/{2}|{1}/{2,3}|{1}/{2}/{3}','Bell(3)=5, RGS lex order',$q$
    SELECT string_agg(set_partition_blocks((e).value), '|' ORDER BY ordinality(e)) FROM elements(partition_algebra(3)) e $q$),
  ('partition_algebra','block-count distribution over P(4) is the Stirling-2 row','eq','1,7,6,1','S(4,k) for k=1..4 (blocks = wired groups)',$q$
    SELECT string_agg(c::text, ',' ORDER BY b) FROM (
      SELECT setpart_blocks((e).value) b, count(*) c FROM elements(partition_algebra(4)) e GROUP BY 1) s $q$),
  ('partition_algebra','same objects as set_partitions, rank-for-rank (the algebra reading)','eq','true','borrowed floor ⇒ identical enumeration',$q$
    SELECT bool_and((a).value = (b).value) FROM elements(partition_algebra(4)) a JOIN elements(set_partitions(4)) b ON ordinality(a) = ordinality(b) $q$),
  ('partition_algebra','contains via <@: 0,1,2 ∈ P(3) (all-singletons), malformed 0,2,1 ∉','eq','true|false','borrowed contains engine (valid RGS)',$q$
    SELECT (ROW(ARRAY[0,1,2])::set_partition <@ partition_algebra(3))::text || '|' || (ROW(ARRAY[0,2,1])::set_partition <@ partition_algebra(3))::text $q$);
