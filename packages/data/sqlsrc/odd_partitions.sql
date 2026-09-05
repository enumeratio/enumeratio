-- requires: integer_partitions, distinct_partitions, realizer
-- odd_partitions — integer partitions of n all of whose parts are ODD, realized as a base_restrict of
-- integer_partitions. By Euler's theorem these are equinumerous with partitions into DISTINCT parts: A000009
-- (1,1,1,2,2,3,4,5,6,8,10,...). Same carrier (integer_partition) + single grade [n] as the parent; the floor
-- filters the parent's descending-lex floor by "every part is odd" and the realizer re-ranks.

CREATE FUNCTION is_odd_partition(v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) x WHERE x % 2 = 0) $$;   -- vacuously true for the empty partition

-- accel hook (#89): the parent's cardinality is p(n) (partition_number); ours genuinely DIFFERS — q(n)=A000009, the
-- distinct-part count (Euler: odd-part = distinct-part). count_fn is on the PARENT fiber; base_restrict wires it as the
-- child's fiber_count so cardinality is this closed form, not a scan of the filtered floor.
CREATE FUNCTION odd_partition_count(f integer_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT distinct_partition_number((f).n::int) $$;

SELECT base_restrict('odd_partitions', 'integer_partitions', 'is_odd_partition', count_fn => 'odd_partition_count');

CREATE FUNCTION fiber_symbol(f odd_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'OP(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('odd_partitions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('odd_partitions','cardinality anchor for n=0..10 = 1,1,1,2,2,3,4,5,6,8,10 (A000009)','eq','1,1,1,2,2,3,4,5,6,8,10','q(n) closed form via the #89 count_fn accel hook, not a floor scan',$q$
    SELECT string_agg(cardinality(odd_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,10) n $q$),
  ('odd_partitions','accel hook (#89) is HONORED: the count_fn synthesized odd_partitions'' own fiber_count','eq','true','base_restrict wired the closed-form q(n); cardinality no longer counts the filtered floor',$q$
    SELECT (to_regprocedure('fiber_count(odd_partitions_fiber)') IS NOT NULL)::text $q$),
  ('odd_partitions','the hook delegates to q(n): fiber_count(odd_partitions [7]) = 5 = distinct_partition_number(7)','eq','5|5','the child fiber_count IS the attached count_fn, not the parent p(7)=15',$q$
    SELECT fiber_count(ROW(7)::odd_partitions_fiber)::int::text || '|' || distinct_partition_number(7)::int::text $q$),
  ('odd_partitions','Euler''s theorem: odd-part count = distinct-part count for n=0..8','eq','1,1,1,2,2,3,4,5,6|1,1,1,2,2,3,4,5,6','odd_partitions(n) vs distinct_partition_number(n), side by side',$q$
    SELECT string_agg(cardinality(odd_partitions(n))::text, ',' ORDER BY n) || '|' ||
           string_agg(distinct_partition_number(n)::text, ',' ORDER BY n)
    FROM generate_series(0,8) n $q$),
  ('odd_partitions','partitions of 5 into odd parts, in order','eq','5,3+1+1,1+1+1+1+1','the filtered floor for fiber [5]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(odd_partitions(5)) e $q$),
  ('odd_partitions','every part is odd across a fiber (n=7)','eq','true','structural invariant, checked over the whole fiber',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) x WHERE x % 2 = 0))::text
    FROM elements(odd_partitions(7)) e $q$),
  ('odd_partitions','the empty partition (n=0) qualifies vacuously','eq','1|0','fiber [0] has one element, empty parts',$q$
    SELECT cardinality(odd_partitions(0))::text || '|' || coalesce(array_length(((unrank(odd_partitions(0), 0)).value).parts, 1), 0)::text $q$),
  ('odd_partitions','fibers() unfold + fiber.address over a range: odd_partitions(1,4)','eq','1,2,3,4','n=1..4, one fiber per grade point',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(odd_partitions(1,4)) f $q$),
  ('odd_partitions','contains via <@: 3+1+1 ∈ odd_partitions(5); 3+2 (even part) and 2+2+1 (even parts) ∉','eq','true|false|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[3,1,1])::integer_partition <@ odd_partitions(5))::text || '|' ||
           (ROW(ARRAY[3,2])::integer_partition <@ odd_partitions(5))::text || '|' ||
           (ROW(ARRAY[2,2,1])::integer_partition <@ odd_partitions(5))::text $q$);
