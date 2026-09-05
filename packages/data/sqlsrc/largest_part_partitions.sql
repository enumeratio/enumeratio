-- requires: integer_partitions, realizer
-- largest_part_partitions — the MULTI-GRADE showcase: partitions of n graded by (n, largest part m), i.e. the
-- partitions of n whose LARGEST part is EXACTLY m. Grade chain [n, m] with m ranging 1..n (lo=1, hi=g1). Reuses
-- the integer_partition carrier + its notation + partition_generate + partition_number from 53-integer-partitions
-- (loads first): "many roles for one identity". The fibers over m=1..n partition all partitions of n, so
-- cardinality(largest_part_partitions(n)) = p(n). (n=0 is degenerate — largest part undefined — so kept out of
-- the m∈[1,n] regime; the constructor is only exercised for n≥1.)

-- the FLOOR for fiber [n,m]: a partition of n with largest part exactly m is m prepended to a partition of (n-m)
-- into parts ≤ m. partition_generate emits those tails in descending-lex order, so the fiber is fixed-order too.
-- (m>n ⇒ partition_generate over a negative target yields nothing ⇒ an empty fiber, correctly.)
CREATE TYPE largest_part_partitions_fiber AS (n natural_number, m natural_number);   -- typed fiber; axes: n, m
CREATE FUNCTION fiber_elements(f largest_part_partitions_fiber, element_limit int) RETURNS SETOF integer_partition LANGUAGE sql STABLE AS $$
  SELECT ROW(ARRAY[(f).m::int] || tail)::integer_partition
  FROM partition_generate((f).n::int - (f).m::int, (f).m::int) tail LIMIT element_limit $$;

-- count acceleration: #{partitions of n, largest part = m} = #{partitions of (n-m) into parts ≤ m}
CREATE FUNCTION partition_count_max_part(target int, cap int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE dp numeric[]; part int; j int;
  BEGIN
    IF target < 0 THEN RETURN 0; END IF;
    dp := array_fill(0::numeric, ARRAY[target+1]);   -- dp[i+1] = partitions of i into parts ≤ cap
    dp[1] := 1;
    FOR part IN 1..least(cap, target) LOOP
      FOR j IN part..target LOOP dp[j+1] := dp[j+1] + dp[j-part+1]; END LOOP;
    END LOOP;
    RETURN dp[target+1];
  END $$;
CREATE FUNCTION fiber_count(f largest_part_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).m::int < 1 OR (f).m::int > (f).n::int THEN 0
              ELSE partition_count_max_part((f).n::int - (f).m::int, (f).m::int) END $$;

CREATE FUNCTION contains_in_fiber(f largest_part_partitions_fiber, v integer_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT coalesce(sum(x), 0) FROM unnest((v).parts) x) = (f).n::int           -- sums to n
     AND coalesce((v).parts[1], 0) = (f).m::int                                       -- largest part (the first, non-increasing) = m
     AND (SELECT coalesce(min(x), 1) FROM unnest((v).parts) x) >= 1                    -- every part positive
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parts,1) i                 -- stored non-increasing
                     WHERE i > 1 AND (v).parts[i-1] < (v).parts[i]) $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('largest_part_partitions', 'integer_partition');
INSERT INTO base_grade VALUES ('largest_part_partitions', 1, 'n', NULL, NULL), ('largest_part_partitions', 2, 'm', '1', 'g1');   -- m ranges 1..n
SELECT base_realize('largest_part_partitions');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('largest_part_partitions','the m-fibers partition p(n): cardinality for n=1..6 = 1,2,3,5,7,11','eq','1,2,3,5,7,11','Σ over m=1..n of |max-part-exactly-m| = p(n) (A000041)',$q$
    SELECT string_agg(cardinality(largest_part_partitions(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('largest_part_partitions','and it agrees with partition_number(n) from 53 (n=1..6)','eq','true','one identity, many roles',$q$
    SELECT bool_and(cardinality(largest_part_partitions(n)) = partition_number(n))::text FROM generate_series(1,6) n $q$),
  ('largest_part_partitions','partitions of 5 with largest part exactly 3 = 3+2, 3+1+1 (count 2)','eq','3+2,3+1+1','the realized floor for fiber [5,3]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(largest_part_partitions(5,3)) e $q$),
  ('largest_part_partitions','cardinality(largest_part_partitions(5,3)) = 2 (accel)','eq','2','closed-form fiber count',$q$
    SELECT cardinality(largest_part_partitions(5,3))::text $q$),
  ('largest_part_partitions','multi-grade chain: fiber = (n,m) named axes','eq','5|3','the r-th element carries a typed point fiber',$q$
    SELECT (unrank(largest_part_partitions(5,3), 1)).fiber.n::text || '|' || (unrank(largest_part_partitions(5,3), 1)).fiber.m::text $q$),
  ('largest_part_partitions','fibers(largest_part_partitions(4)) unfold to m = 1,2,3,4','eq','1,2,3,4','the second grade ranges 1..n',$q$
    SELECT string_agg((f).m::text, ',' ORDER BY (f).m) FROM fibers(largest_part_partitions(4)) f $q$),
  ('largest_part_partitions','global order = (n,m,ordinality): all of largest_part_partitions(3)','eq','1+1+1,2+1,3','m ascending, descending-lex within',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY e) FROM elements(largest_part_partitions(3)) e $q$),
  ('largest_part_partitions','floor count agrees with the accel across every fiber (n=1..6)','eq','true','enumerate each [n,m] and count vs closed form',$q$
    SELECT bool_and(cardinality(largest_part_partitions(n,m)) = (SELECT count(*) FROM elements(largest_part_partitions(n,m)) e))::text
    FROM generate_series(1,6) n, generate_series(1,n) m $q$),
  ('largest_part_partitions','contains via <@: 3+2 ∈ (5,3), 2+2+1 ∉ (5,3) [max part 2], 3+2 ∉ (5,2) [wrong m]','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[3,2])::integer_partition <@ largest_part_partitions(5,3))::text || '|' ||
           (ROW(ARRAY[2,2,1])::integer_partition <@ largest_part_partitions(5,3))::text || '|' ||
           (ROW(ARRAY[3,2])::integer_partition <@ largest_part_partitions(5,2))::text $q$);
