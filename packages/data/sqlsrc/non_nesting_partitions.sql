-- requires: catalan_numbers, realizer, set_partitions
-- non_nesting_partitions — the set partitions of [n] with no NESTING pair: no a<b<c<d where a,d share a block and
-- b,c share a DIFFERENT block (the arc b–c nested inside a–d). The nesting-dual of non_crossing_partitions; also
-- counted by Catalan(n). Reuses the set_partition RGS carrier + floor, filtered by the non-nesting predicate.
-- nesting is defined on ARCS (i → the NEXT element in the same block), not arbitrary same-block pairs: two arcs
-- (a,a') and (b,b') nest when a < b < b' < a'. (Any-pair would over-flag — it disagrees with Sage's is_nonnesting.)
CREATE FUNCTION is_non_nesting(rgs int[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH arc AS (
    SELECT i, (SELECT min(j) FROM generate_subscripts(rgs,1) j WHERE j > i AND rgs[j] = rgs[i]) AS j
    FROM generate_subscripts(rgs,1) i
  ), arcs AS (SELECT i, j FROM arc WHERE j IS NOT NULL)
  SELECT NOT EXISTS (SELECT 1 FROM arcs x, arcs y WHERE x.i < y.i AND y.j < x.j) $$;   -- arc y strictly inside arc x

CREATE TYPE non_nesting_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows set_partitions' floor)
CREATE FUNCTION fiber_elements(f non_nesting_partitions_fiber, element_limit int) RETURNS SETOF set_partition LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::set_partitions_fiber, 2147483647) v
  WHERE is_non_nesting((v).rgs) ORDER BY (v).rgs LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f non_nesting_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan_number((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f non_nesting_partitions_fiber, v set_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::set_partitions_fiber, v) AND is_non_nesting((v).rgs) $$;

INSERT INTO base_collection VALUES ('non_nesting_partitions', 'set_partition');
INSERT INTO base_grade VALUES ('non_nesting_partitions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f non_nesting_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'NN([' || (f).n::int || '])' $$;
SELECT base_realize('non_nesting_partitions');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_nesting_partitions','COUNT anchor: Catalan(n) for n=0..5','eq','1,1,2,5,14,42','the nesting-dual of non_crossing; also Catalan',$q$
    SELECT string_agg(cardinality(non_nesting_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('non_nesting_partitions','the lone nesting drops at n=4: {1,4}/{2,3} = RGS 0110 excluded','eq','false','0110 nests 2–3 inside 1–4',$q$
    SELECT (ROW(ARRAY[0,1,1,0])::set_partition <@ non_nesting_partitions(4))::text $q$),
  ('non_nesting_partitions','while its crossing cousin 0101 = {1,3}/{2,4} IS non-nesting','eq','true','crossing ≠ nesting: 0101 survives here, 0110 there',$q$
    SELECT (ROW(ARRAY[0,1,0,1])::set_partition <@ non_nesting_partitions(4))::text $q$);
