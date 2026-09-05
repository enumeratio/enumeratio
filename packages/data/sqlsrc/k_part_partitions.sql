-- requires: integer_partitions, realizer
-- k_part_partitions — partitions of n into EXACTLY k positive parts, counted by p(n,k). Multi-grade chain
-- [n (ground total), k (number of parts)]; k defaults to its full range 1..n, so k_part_partitions(n) unfolds
-- fibers over k and the global order is (n, k, ordinality). REUSES the existing `integer_partition` carrier
-- and `notation` (see 53-integer-partitions.sql) — this collection is just a k-sliced view
-- over the same partitions-of-n floor (partition_generate), grouped by part-count instead of left ungraded.
--
-- Fiber [n,k] = partitions of n with exactly k parts, in the SAME reverse-lexicographic order that
-- partition_generate emits (largest-part-first): e.g. [6,2] ⇒ 5+1, 4+2, 3+3. count of a fiber is p(n,k), the
-- classic partitions-into-exactly-k-parts recurrence p(n,k) = p(n-1,k-1) + p(n-k,k) (peel off a part of size
-- exactly 1, or subtract 1 from every part of a (n-k,k)-partition), with p(0,0)=1 and p(n,k)=0 out of range.

-- ── new helper: p(n,k) via the standard 2-D DP (an ACCELERATION; agrees with the floor count) ───────────
CREATE FUNCTION k_part_partition_count(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE dp numeric[][]; i int; j int;
  BEGIN
    IF n < 0 OR k < 0 OR k > n THEN RETURN 0; END IF;
    dp := array_fill(0::numeric, ARRAY[n+1, k+1]);   -- dp[i+1][j+1] counts partitions of i into exactly j parts
    FOR i IN 0..n LOOP
      FOR j IN 0..least(i,k) LOOP
        IF i = 0 AND j = 0 THEN dp[1][1] := 1;                          -- p(0,0) = 1: the empty partition
        ELSIF j = 0 THEN dp[i+1][1] := 0;                                -- p(i,0) = 0 for i > 0
        ELSE dp[i+1][j+1] := dp[i][j] + dp[i-j+1][j+1];                  -- p(i-1,j-1) + p(i-j,j)
        END IF;
      END LOOP;
    END LOOP;
    RETURN dp[n+1][k+1];
  END $$;

CREATE TYPE k_part_partitions_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n, k
-- ── the FLOOR: filter partition_generate(n,n) down to exactly k parts, preserving its reverse-lex order ──
CREATE FUNCTION fiber_elements(f k_part_partitions_fiber, element_limit int) RETURNS SETOF integer_partition LANGUAGE sql STABLE AS $$
  SELECT ROW(parts)::integer_partition FROM partition_generate((f).n::int, (f).n::int) parts
   WHERE coalesce(array_length(parts,1), 0) = (f).k::int
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_part_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT k_part_partition_count((f).n::int, (f).k::int) $$;
-- contains: a canonical partition (weakly decreasing, positive parts) of exactly n into exactly k parts
CREATE FUNCTION contains_in_fiber(f k_part_partitions_fiber, v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).parts, 1), 0) = (f).k::int
     AND coalesce((SELECT sum(x) FROM unnest((v).parts) x), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).parts) x WHERE x < 1)
     AND (v).parts IS NOT DISTINCT FROM (SELECT array_agg(x ORDER BY x DESC) FROM unnest((v).parts) x) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('k_part_partitions', 'integer_partition');
INSERT INTO base_grade VALUES
  ('k_part_partitions', 1, 'n', NULL, NULL),
  ('k_part_partitions', 2, 'k', '1', 'g1');                              -- k ranges 1..n by default
CREATE FUNCTION fiber_symbol(f k_part_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'p(' || (f).n::int || ',' || (f).k::int || ')' $$;   -- corpus symbol
SELECT base_realize('k_part_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_part_partitions','p(6,k) anchor for k=1..6: 1,3,3,2,1,1','eq','1,3,3,2,1,1','partitions of 6 by exact part-count, via the accel',$q$
    SELECT string_agg(cardinality(k_part_partitions(6,k))::text, ',' ORDER BY k) FROM generate_series(1,6) k $q$),
  ('k_part_partitions','row sum over k = p(6) = 11','eq','11','sum of p(6,k) for k=1..6 recovers partition_number(6)',$q$
    SELECT (SELECT sum(cardinality(k_part_partitions(6,k))) FROM generate_series(1,6) k)::text $q$),
  ('k_part_partitions','partitions of 6 into exactly 2 parts, reverse-lex order','eq','5+1,4+2,3+3','the realized floor for fiber [6,2]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_part_partitions(6,2)) e $q$),
  ('k_part_partitions','fibers(k_part_partitions(6)) unfold to k = 1..6','eq','1,2,3,4,5,6','the second grade ranges 1..n',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(k_part_partitions(6)) f $q$),
  ('k_part_partitions','multi-grade chain: fiber = (n,k) named axes','eq','6|2','unrank(k_part_partitions(6,2), 0).fiber is (n=6,k=2)',$q$
    SELECT (unrank(k_part_partitions(6,2), 0)).fiber.n::text || '|' || (unrank(k_part_partitions(6,2), 0)).fiber.k::text $q$),
  ('k_part_partitions','every element of fiber [6,3] has exactly 3 parts','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).parts,1) = 3)::text FROM elements(k_part_partitions(6,3)) e $q$),
  ('k_part_partitions','contains via <@: 5+1 ∈ p(6,2); 6 ∉ (one part); 4+1 ∉ (sum 5)','eq','true|false|false','exactly k parts summing to n',$q$
    SELECT (ROW(ARRAY[5,1])::integer_partition <@ k_part_partitions(6,2))::text || '|' ||
           (ROW(ARRAY[6])::integer_partition <@ k_part_partitions(6,2))::text || '|' ||
           (ROW(ARRAY[4,1])::integer_partition <@ k_part_partitions(6,2))::text $q$);
