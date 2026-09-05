-- requires: realizer
-- integer_partitions — partitions of n (multisets of positive parts, stored non-increasing), realized from data.
-- Single grade [n]. The floor is a recursive generator emitting the partitions of n in reverse-lexicographic
-- order (largest-part-first, descending-lex on the part sequence): 4, 3+1, 2+2, 2+1+1, 1+1+1+1. cardinality is
-- the partition number p(n) (A000041: 1,1,2,3,5,7,11,…), supplied as a closed-form-ish DP acceleration.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE integer_partition AS (parts int[]);                       -- descending; e.g. {3,1} = 3+1
CREATE FUNCTION notation(p integer_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(nullif(array_to_string((p).parts, '+'), ''), '0') $$;   -- the empty partition (n=0) prints as 0

-- p(n) by the standard coin-change DP over part sizes 1..n (an ACCELERATION; agrees with the floor count)
CREATE FUNCTION partition_number(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE dp numeric[]; part int; j int;
  BEGIN
    IF n < 0 THEN RETURN 0; END IF;
    dp := array_fill(0::numeric, ARRAY[n+1]);   -- dp[i+1] counts partitions of i, indices 0..n
    dp[1] := 1;
    FOR part IN 1..n LOOP
      FOR j IN part..n LOOP dp[j+1] := dp[j+1] + dp[j-part+1]; END LOOP;
    END LOOP;
    RETURN dp[n+1];
  END $$;

-- the FLOOR generator: partitions of n with every part ≤ max_part, in descending-lex order. Recurses by peeling
-- a leading part p from min(n,max_part) down to 1 and prepending it to each partition of (n-p) with parts ≤ p.
CREATE FUNCTION partition_generate(n int, max_part int) RETURNS SETOF int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE p int; tail int[];
  BEGIN
    IF n = 0 THEN RETURN NEXT '{}'::int[]; RETURN; END IF;
    FOR p IN REVERSE least(n, max_part)..1 LOOP
      FOR tail IN SELECT * FROM partition_generate(n - p, p) LOOP
        RETURN NEXT ARRAY[p] || tail;
      END LOOP;
    END LOOP;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE integer_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f integer_partitions_fiber, element_limit int) RETURNS SETOF integer_partition LANGUAGE sql STABLE AS $$
  SELECT ROW(parts)::integer_partition FROM partition_generate((f).n::int, (f).n::int) parts LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f integer_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT partition_number((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f integer_partitions_fiber, v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT coalesce(sum(x), 0) FROM unnest((v).parts) x) = (f).n::int           -- sums to n
     AND (SELECT coalesce(min(x), 1) FROM unnest((v).parts) x) >= 1                    -- every part positive
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parts,1) i                  -- stored non-increasing
                     WHERE i > 1 AND (v).parts[i-1] < (v).parts[i]) $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('integer_partitions', 'integer_partition');
INSERT INTO base_grade VALUES ('integer_partitions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f integer_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'p(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('integer_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_partitions','p(n) anchor: cardinality for n=0..6 = 1,1,2,3,5,7,11 (A000041)','eq','1,1,2,3,5,7,11','the partition numbers via the accel',$q$
    SELECT string_agg(cardinality(integer_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('integer_partitions','partitions of 5 in reverse-lex order','eq','5,4+1,3+2,3+1+1,2+2+1,2+1+1+1,1+1+1+1+1','the realized floor for fiber [5]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(integer_partitions(5)) e $q$),
  ('integer_partitions','p(0) = 1: the empty partition','eq','{}','fiber [0] has one element, empty parts',$q$
    SELECT ((unrank(integer_partitions(0), 0)).value).parts::text $q$),
  ('integer_partitions','every element is non-increasing and sums to n (n=0..7)','ok',NULL,'the defining invariant, checked over the floor',$q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(0,7) n, LATERAL elements(integer_partitions(n)) el
        WHERE (SELECT coalesce(sum(x),0) FROM unnest(((el).value).parts) x) <> n
           OR EXISTS (SELECT 1 FROM generate_subscripts(((el).value).parts,1) i
                      WHERE i > 1 AND ((el).value).parts[i-1] < ((el).value).parts[i])
      ) THEN RAISE EXCEPTION 'partition invariant violated'; END IF;
    END $b$ $q$),
  ('integer_partitions','floor count agrees with accel: p(10) = 42, counted off the floor','eq','42','enumerate fiber [10] and count',$q$
    SELECT count(*)::text FROM elements(integer_partitions(10)) e $q$),
  ('integer_partitions','fiber address is [n]: unrank(integer_partitions(5),2) at ordinality 2 = 3+2','eq','3+2|2','the r-th element carries a typed point fiber',$q$
    SELECT notation((unrank(integer_partitions(5),2)).value) || '|' || ordinality(unrank(integer_partitions(5),2))::text $q$),
  ('integer_partitions','n RANGE: cardinality(integer_partitions(1,4)) = 11 = p(1)+p(2)+p(3)+p(4)','eq','11','fibers unfold over n=1..4',$q$
    SELECT cardinality(integer_partitions(1,4))::text $q$),
  ('integer_partitions','global order = (n, ordinality): unrank crosses fibers (rank 3 of integer_partitions(1,4) = 3)','eq','3','ranks 0..2 are n=1,2,2; rank 3 = first n=3 partition',$q$
    SELECT notation((unrank(integer_partitions(1,4), 3)).value) $q$),
  ('integer_partitions','contains: 3+1 ∈ integer_partitions(4); 1+3 (ascending) and 2+1 (wrong sum) ∉','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT contains(integer_partitions(4), ROW(ARRAY[3,1])::integer_partition)::text || '|' ||
           contains(integer_partitions(4), ROW(ARRAY[1,3])::integer_partition)::text || '|' ||
           contains(integer_partitions(4), ROW(ARRAY[2,1])::integer_partition)::text $q$),
  ('integer_partitions','the <@ operator works too: 2+2 <@ integer_partitions(4)','eq','true','operator wrapper',$q$
    SELECT (ROW(ARRAY[2,2])::integer_partition <@ integer_partitions(4))::text $q$),
  ('integer_partitions','cardinality(integer_partitions()) = ∞, not 0 (#151)','eq','Infinity',
    'same open-WHOLE-handle bug as integer_compositions: n unbounded ⇒ fibers() cannot unfold it',$q$
    SELECT cardinality(integer_partitions())::text $q$);
