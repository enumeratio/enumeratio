-- requires: integer_partitions, realizer
-- partition_numbers — the partition-number sequence p(n) as a first-class UNBOUNDED numeric collection (A000041):
-- 1,1,2,3,5,7,11,15,22,30,42,… Sibling of integer_partitions (whose fiber cardinalities these are). Reuses the
-- existing partition_number(n) helper. Ported from old-backup more-sequences.sql. No closed-form inverse ⇒ contains scans the monotonic floor until ≥ v.
CREATE TYPE partition_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f partition_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT partition_number(r) FROM generate_series(0, element_limit - 1) r $$;
CREATE FUNCTION contains_in_fiber(f partition_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- scan the monotonic floor until ≥ v
  WITH RECURSIVE t(k, val) AS (SELECT 0, partition_number(0) UNION ALL SELECT k+1, partition_number(k+1) FROM t WHERE val < v)
  SELECT EXISTS (SELECT 1 FROM t WHERE val = v) $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f partition_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT partition_number(rank::int) $fu$;
INSERT INTO base_collection VALUES ('partition_numbers', 'numeric', true);
SELECT base_realize('partition_numbers');
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('partition_numbers','first eleven p(0..10) — A000041','eq','1,1,2,3,5,7,11,15,22,30,42','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(partition_numbers(), 11) e $q$),
  ('partition_numbers','unrank(10) = p(10) = 42','eq','42','off the floor',$q$
    SELECT (unrank(partition_numbers(), 10)).value::text $q$),
  ('partition_numbers','cardinality = infinity','eq','Infinity','unbounded sequence',$q$
    SELECT cardinality(partition_numbers())::text $q$),
  ('partition_numbers','contains via <@: 42 ∈ (p(10)), 43 ∉','eq','true|false','floor-scan membership',$q$
    SELECT (42::numeric <@ partition_numbers())::text || '|' || (43::numeric <@ partition_numbers())::text $q$);
