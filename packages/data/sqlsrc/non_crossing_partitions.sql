-- requires: catalan_numbers, realizer, set_partitions
-- non_crossing_partitions — realized from data. Single grade [n]. A NON-CROSSING partition of {1..n} is a set
-- partition with no crossing pair: no a<b<c<d where a,c share a block and b,d share a DIFFERENT block. Reuses the
-- set_partition RGS carrier (55) + its floor as the generator, filtered by a non-crossing predicate; the count is
-- Catalan(n) (borrowed from 61 — one identity, many roles). The lone crossing partition first appears at n=4:
-- {1,3}/{2,4} = RGS 0101, so Bell(4)=15 drops to Catalan(4)=14.

-- ── the non-crossing predicate on an RGS ─────────────────────────────────────────────────────────────
-- Directly the definition: a crossing is four ascending positions a<b<c<d with rgs[a]=rgs[c], rgs[b]=rgs[d],
-- and the two block ids distinct. n is small on the floor, so the O(n^4) existence scan is fine.
CREATE FUNCTION is_non_crossing(rgs int[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_subscripts(rgs,1) a, generate_subscripts(rgs,1) b,
                  generate_subscripts(rgs,1) c, generate_subscripts(rgs,1) d
    WHERE a < b AND b < c AND c < d AND rgs[a] = rgs[c] AND rgs[b] = rgs[d] AND rgs[a] <> rgs[b]) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- the FLOOR: set_partitions' RGS floor (lex order) filtered to the non-crossing ones. + a Catalan closed-form
-- count accel + a contains engine (valid RGS of the right length AND non-crossing).
CREATE TYPE non_crossing_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows set_partitions' floor)
CREATE FUNCTION fiber_elements(f non_crossing_partitions_fiber, element_limit int) RETURNS SETOF set_partition LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::set_partitions_fiber, 2147483647) v
  WHERE is_non_crossing((v).rgs) ORDER BY (v).rgs LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f non_crossing_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan_number((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f non_crossing_partitions_fiber, v set_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::set_partitions_fiber, v) AND is_non_crossing((v).rgs) $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('non_crossing_partitions', 'set_partition');
INSERT INTO base_grade VALUES ('non_crossing_partitions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f non_crossing_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'NC([' || (f).n::int || '])' $$;   -- corpus symbol
SELECT base_realize('non_crossing_partitions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_crossing_partitions','non-crossing RGS of [4] in lex order (Catalan(4)=14, 0101 dropped)','eq','0000,0001,0010,0011,0012,0100,0102,0110,0111,0112,0120,0121,0122,0123','the floor: all set partitions of [4] minus the one crossing {1,3}/{2,4}',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(non_crossing_partitions(4)) e $q$),
  ('non_crossing_partitions','COUNT anchor: Catalan(n) for n=0..5','eq','1,1,2,5,14,42','cardinality per fiber = Catalan(n) (accel)',$q$
    SELECT string_agg(cardinality(non_crossing_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('non_crossing_partitions','cardinality(non_crossing_partitions(5)) = 42 = Catalan(5)','eq','42','the closed-form count accel',$q$
    SELECT cardinality(non_crossing_partitions(5))::text $q$),
  ('non_crossing_partitions','floor length agrees with the Catalan accel at n=5','eq','true','count of the realized floor = cardinality accel',$q$
    SELECT ((SELECT count(*) FROM elements(non_crossing_partitions(5), 100) e) = cardinality(non_crossing_partitions(5)))::text $q$),
  ('non_crossing_partitions','strict subset of set_partitions: exactly one crossing dropped at n=4','eq','1','Bell(4)=15 − Catalan(4)=14',$q$
    SELECT (cardinality(set_partitions(4)) - cardinality(non_crossing_partitions(4)))::text $q$),
  ('non_crossing_partitions','the crossing {1,3}/{2,4}=0101 is a valid set partition but is excluded here','eq','true|false','contains in set_partitions(4) vs non_crossing_partitions(4)',$q$
    SELECT contains(set_partitions(4), ROW(ARRAY[0,1,0,1])::set_partition)::text || '|' ||
           contains(non_crossing_partitions(4), ROW(ARRAY[0,1,0,1])::set_partition)::text $q$),
  ('non_crossing_partitions','block reading: rank 6 of non_crossing_partitions(4) is 0102 = {1,3}/{2}/{4}','eq','{1,3}/{2}/{4}','RGS ↦ blocks, a nested (non-crossing) partition',$q$
    SELECT set_partition_blocks((unrank(non_crossing_partitions(4), 6)).value) $q$),
  ('non_crossing_partitions','element carries a TYPED point fiber (n)','eq','4','unrank(non_crossing_partitions(4),0).fiber.n',$q$
    SELECT (unrank(non_crossing_partitions(4), 0)).fiber.n::text $q$),
  ('non_crossing_partitions','range constructor non_crossing_partitions(2,4): fibers unfold to n = 2,3,4','eq','2,3,4','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(non_crossing_partitions(2,4)) f $q$),
  ('non_crossing_partitions','range handle cardinality = Catalan(2)+Catalan(3)+Catalan(4) = 21','eq','21','summed over fibers',$q$
    SELECT cardinality(non_crossing_partitions(2,4))::text $q$),
  ('non_crossing_partitions','contains: {0,1,0}∈, malformed {0,2,1}∉, crossing {0,1,0,1}∉','eq','true|false|false','valid non-crossing RGS vs bad RGS vs crossing',$q$
    SELECT contains(non_crossing_partitions(3), ROW(ARRAY[0,1,0])::set_partition)::text || '|' ||
           contains(non_crossing_partitions(3), ROW(ARRAY[0,2,1])::set_partition)::text || '|' ||
           contains(non_crossing_partitions(4), ROW(ARRAY[0,1,0,1])::set_partition)::text $q$),
  ('non_crossing_partitions','the <@ operator: {0,1,2} <@ non_crossing_partitions(3)','eq','true','operator wrapper over contains',$q$
    SELECT (ROW(ARRAY[0,1,2])::set_partition <@ non_crossing_partitions(3))::text $q$);
