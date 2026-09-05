-- requires: integer_partitions, realizer
-- distinct_partitions — integer partitions of n all of whose parts are DISTINCT, realized as a base_restrict of
-- integer_partitions (#90). By Euler's theorem these are equinumerous with partitions into ODD parts: A000009
-- (1,1,1,2,2,3,4,5,6,8,10,...). Same carrier (integer_partition) + single grade [n] as the parent; the floor
-- filters the parent's descending-lex floor by "no two adjacent parts equal" (parts are stored non-increasing, so
-- equal parts are always adjacent) and the realizer re-ranks.

CREATE FUNCTION is_distinct_partition(v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parts,1) i
                      WHERE i > 1 AND (v).parts[i-1] = (v).parts[i]) $$;   -- vacuously true for the empty partition

-- q(n) by 0/1-knapsack DP over part sizes 1..n (an ACCELERATION; agrees with the floor count). Each part size may
-- be used at most once, so j runs DESCENDING to avoid reusing a part within the same pass.
CREATE FUNCTION distinct_partition_number(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE dp numeric[]; part int; j int;
  BEGIN
    IF n < 0 THEN RETURN 0; END IF;
    dp := array_fill(0::numeric, ARRAY[n+1]);   -- dp[i+1] counts distinct-part partitions of i, indices 0..n
    dp[1] := 1;
    FOR part IN 1..n LOOP
      FOR j IN REVERSE n..part LOOP dp[j+1] := dp[j+1] + dp[j-part+1]; END LOOP;
    END LOOP;
    RETURN dp[n+1];
  END $$;

-- accel hook (#89): the parent's cardinality is p(n) (partition_number); ours genuinely DIFFERS — q(n)=A000009.
-- count_fn is on the PARENT fiber; base_restrict wires it as the child's fiber_count so cardinality is this closed
-- form, not a scan of the filtered floor.
CREATE FUNCTION distinct_partition_count(f integer_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT distinct_partition_number((f).n::int) $$;

SELECT base_restrict('distinct_partitions', 'integer_partitions', 'is_distinct_partition', count_fn => 'distinct_partition_count');

CREATE FUNCTION fiber_symbol(f distinct_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'q(' || (f).n::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('distinct_partitions');


-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('distinct_partitions','q(n) anchor: cardinality for n=0..9 = 1,1,1,2,2,3,4,5,6,8 (A000009)','eq','1,1,1,2,2,3,4,5,6,8','the distinct-partition numbers via the #89 count_fn accel hook, not a floor scan',$q$
    SELECT string_agg(cardinality(distinct_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,9) n $q$),
  ('distinct_partitions','accel hook (#89) is HONORED: the count_fn synthesized distinct_partitions'' own fiber_count','eq','true','base_restrict wired the closed-form q(n); cardinality no longer counts the filtered floor',$q$
    SELECT (to_regprocedure('fiber_count(distinct_partitions_fiber)') IS NOT NULL)::text $q$),
  ('distinct_partitions','distinct partitions of 6 in reverse-lex order','eq','6,5+1,4+2,3+2+1','the filtered floor for fiber [6]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(distinct_partitions(6)) e $q$),
  ('distinct_partitions','q(0) = 1: the empty partition','eq','{}','fiber [0] has one element, empty parts',$q$
    SELECT ((unrank(distinct_partitions(0), 0)).value).parts::text $q$),
  ('distinct_partitions','every element has strictly decreasing (no repeated) parts and sums to n (n=0..9)','ok',NULL,'the defining invariant, checked over the floor',$q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(0,9) n, LATERAL elements(distinct_partitions(n)) el
        WHERE (SELECT coalesce(sum(x),0) FROM unnest(((el).value).parts) x) <> n
           OR EXISTS (SELECT 1 FROM generate_subscripts(((el).value).parts,1) i
                      WHERE i > 1 AND ((el).value).parts[i-1] <= ((el).value).parts[i])
      ) THEN RAISE EXCEPTION 'distinct partition invariant violated'; END IF;
    END $b$ $q$),
  ('distinct_partitions','floor count agrees with accel: q(20) = 64, counted off the floor','eq','64','enumerate fiber [20] and count',$q$
    SELECT count(*)::text FROM elements(distinct_partitions(20), 1000) e $q$),
  ('distinct_partitions','fiber address is [n]: unrank(distinct_partitions(7),3) at ordinality 3 = 4+3','eq','4+3|3','the r-th element carries a typed point fiber (order: 7,6+1,5+2,4+3,4+2+1)',$q$
    SELECT notation((unrank(distinct_partitions(7),3)).value) || '|' || ordinality(unrank(distinct_partitions(7),3))::text $q$),
  ('distinct_partitions','n RANGE: cardinality(distinct_partitions(1,4)) = 6 = q(1)+q(2)+q(3)+q(4)','eq','6','fibers unfold over n=1..4',$q$
    SELECT cardinality(distinct_partitions(1,4))::text $q$),
  ('distinct_partitions','global order = (n, ordinality): unrank crosses fibers (rank 4 of distinct_partitions(1,4) = 4)','eq','4','ranks 0..3 are n=1,2,3,3(2+1); rank 4 = first n=4 partition',$q$
    SELECT notation((unrank(distinct_partitions(1,4), 4)).value) $q$),
  ('distinct_partitions','contains: 3+2 ∈ distinct_partitions(5); 2+3 (ascending) and 3+1+1 (repeated part) ∉','eq','true|false|false','derived membership = parent ∧ predicate',$q$
    SELECT contains(distinct_partitions(5), ROW(ARRAY[3,2])::integer_partition)::text || '|' ||
           contains(distinct_partitions(5), ROW(ARRAY[2,3])::integer_partition)::text || '|' ||
           contains(distinct_partitions(5), ROW(ARRAY[3,1,1])::integer_partition)::text $q$),
  ('distinct_partitions','the <@ operator works too: 4+1 <@ distinct_partitions(5)','eq','true','operator wrapper',$q$
    SELECT (ROW(ARRAY[4,1])::integer_partition <@ distinct_partitions(5))::text $q$);
