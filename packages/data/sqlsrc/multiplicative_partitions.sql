-- requires: integer_factorizations, realizer
-- multiplicative_partitions — ported from pg-enumeratio-core_old_backup/sqlsrc/multiplicative-partitions.sql.
-- The unordered factorizations of n into factors ≥ 2 (multiplicative partitions of n). Where an ordered
-- factorization counts sequences, this counts multisets: {2,6} and {6,2} are the SAME factorization of 12.
-- |multiplicative_partitions(n)| = A001055(n): 1,1,1,2,1,2,1,3,2,2,1,4,1,2,2,5,1,4,1,4,… (n=1,2,3,…).
-- Single grade [n]. The carrier stores factors in NON-INCREASING order (largest first) — the multiplicative
-- analogue of integer_partition. The floor peels a leading factor d ascending over the divisors of n bounded
-- above by maxf, then recurses on n/d bounded by d (so no later factor exceeds an earlier one — that is what
-- avoids counting reorderings); cardinality is the same divisor recursion, supplied as an acceleration.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE multiplicative_partition AS (factors int[]);              -- non-increasing; e.g. 12 = 3·2·2 ⇒ {3,2,2}
CREATE FUNCTION notation(p multiplicative_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((p).factors, 1), 0) = 0 THEN '1' ELSE array_to_string((p).factors, '·') END $$;

-- product of the factors (empty product = 1); used only to check the defining invariant (contains + examples)
CREATE FUNCTION multiplicative_partition_product(a int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r numeric := 1; x int;
  BEGIN
    FOREACH x IN ARRAY coalesce(a, '{}') LOOP r := r * x; END LOOP;
    RETURN r;
  END $$;

-- A001055(n), bounded by the largest allowed leading factor (an ACCELERATION; agrees with the floor count).
-- g(1, maxf) = 1 (empty product); g(n, maxf) = Σ_{d|n, 2≤d≤min(maxf,n)} g(n/d, d).
CREATE FUNCTION multiplicative_partition_count(n int, maxf int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE total numeric := 0; d int;
  BEGIN
    IF n = 1 THEN RETURN 1; END IF;
    FOR d IN 2..least(maxf, n) LOOP
      IF n % d = 0 THEN total := total + multiplicative_partition_count(n / d, d); END IF;
    END LOOP;
    RETURN total;
  END $$;

-- the FLOOR generator: factorizations of n with leading (and hence every) factor ≤ max_part, emitted by
-- peeling a leading divisor d ascending over 2..min(n,max_part) and prepending it to each factorization of
-- n/d bounded by d in turn. Non-increasing falls out because every later factor is bounded by the one before.
CREATE FUNCTION multiplicative_partition_generate(n int, max_part int) RETURNS SETOF int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE d int; tail int[];
  BEGIN
    IF n = 1 THEN RETURN NEXT '{}'::int[]; RETURN; END IF;
    FOR d IN 2..least(n, max_part) LOOP
      IF n % d = 0 THEN
        FOR tail IN SELECT * FROM multiplicative_partition_generate(n / d, d) LOOP
          RETURN NEXT ARRAY[d] || tail;
        END LOOP;
      END IF;
    END LOOP;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE multiplicative_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f multiplicative_partitions_fiber, element_limit int) RETURNS SETOF multiplicative_partition LANGUAGE sql STABLE AS $$
  SELECT ROW(factors)::multiplicative_partition FROM multiplicative_partition_generate((f).n::int, (f).n::int) factors LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f multiplicative_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT multiplicative_partition_count((f).n::int, (f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f multiplicative_partitions_fiber, v multiplicative_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT multiplicative_partition_product((v).factors) = (f).n::int            -- factors multiply to n
     AND (SELECT coalesce(min(x), 2) FROM unnest((v).factors) x) >= 2            -- every factor ≥ 2
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).factors, 1) i         -- stored non-increasing
                     WHERE i > 1 AND (v).factors[i - 1] < (v).factors[i]) $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('multiplicative_partitions', 'multiplicative_partition');
INSERT INTO base_grade VALUES ('multiplicative_partitions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f multiplicative_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'MP(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('multiplicative_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('multiplicative_partitions', 'A001055 anchor: n = 1,2,4,8,12,16 ⇒ 1,1,2,3,4,5', 'eq', '1,1,2,3,4,5', 'small-n counts via the accel', $q$
    SELECT string_agg(cardinality(multiplicative_partitions(n))::text, ',' ORDER BY ord)
    FROM (VALUES (1,0),(2,1),(4,2),(8,3),(12,4),(16,5)) v(n, ord) $q$),

  ('multiplicative_partitions', '|multiplicative_partitions(36)| = 9', 'eq', '9', 'A001055(36) = 9 (36 = 2²·3²)', $q$
    SELECT cardinality(multiplicative_partitions(36))::text $q$),

  ('multiplicative_partitions', '|multiplicative_partitions(48)| = 12', 'eq', '12', 'A001055(48) = 12 (48 = 2⁴·3)', $q$
    SELECT cardinality(multiplicative_partitions(48))::text $q$),

  ('multiplicative_partitions', 'factorizations of 12 in floor order', 'eq', '3·2·2,4·3,6·2,12', 'ascending leading factor, each factorization non-increasing', $q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e))
    FROM elements(multiplicative_partitions(12)) e $q$),

  ('multiplicative_partitions', 'n = 1 is the empty product', 'eq', '1,1', 'A001055(1) = 1; the single element is the empty factorization, notated 1', $q$
    SELECT cardinality(multiplicative_partitions(1))::text || ',' || notation((unrank(multiplicative_partitions(1), 0)).value) $q$),

  ('multiplicative_partitions', 'every element factors n (product = n, non-increasing, factors ≥ 2), n = 1..24', 'ok', NULL, 'the defining invariant, checked over the floor', $q$
    DO $b$ BEGIN
      IF EXISTS (
        SELECT 1 FROM generate_series(1,24) n, LATERAL elements(multiplicative_partitions(n)) el
        WHERE multiplicative_partition_product(((el).value).factors) <> n
           OR EXISTS (SELECT 1 FROM unnest(((el).value).factors) x WHERE x < 2)
           OR EXISTS (SELECT 1 FROM generate_subscripts(((el).value).factors, 1) i
                      WHERE i > 1 AND ((el).value).factors[i - 1] < ((el).value).factors[i])
      ) THEN RAISE EXCEPTION 'multiplicative partition invariant violated'; END IF;
    END $b$ $q$),

  ('multiplicative_partitions', 'floor count agrees with accel: A001055(60) = 11, counted off the floor', 'eq', '11', 'enumerate fiber [60] and count', $q$
    SELECT count(*)::text FROM elements(multiplicative_partitions(60)) e $q$),

  ('multiplicative_partitions', 'fiber address is [n]: unrank(multiplicative_partitions(12),2) at ordinality 2 = 6·2', 'eq', '6·2,2', 'the r-th element carries a typed point fiber', $q$
    SELECT notation((unrank(multiplicative_partitions(12),2)).value) || ',' || ordinality(unrank(multiplicative_partitions(12),2))::text $q$),

  ('multiplicative_partitions', 'n RANGE: cardinality(multiplicative_partitions(1,16)) unfolds fibers', 'eq', '31', 'Σ A001055(n) for n=1..16 = 1+1+1+2+1+2+1+3+2+2+1+4+1+2+2+5 = 31', $q$
    SELECT cardinality(multiplicative_partitions(1,16))::text $q$),

  ('multiplicative_partitions', 'contains: 3·2·2 ∈ multiplicative_partitions(12); 2·2·3 (increasing) and 4·2 (wrong product) ∉', 'eq', 'true,false,false', 'generated from contains_in_fiber', $q$
    SELECT contains(multiplicative_partitions(12), ROW(ARRAY[3,2,2])::multiplicative_partition)::text || ',' ||
           contains(multiplicative_partitions(12), ROW(ARRAY[2,2,3])::multiplicative_partition)::text || ',' ||
           contains(multiplicative_partitions(12), ROW(ARRAY[4,2])::multiplicative_partition)::text $q$),

  ('multiplicative_partitions', 'the <@ operator works too: 6·2 <@ multiplicative_partitions(12)', 'eq', 'true', 'operator wrapper', $q$
    SELECT (ROW(ARRAY[6,2])::multiplicative_partition <@ multiplicative_partitions(12))::text $q$);
