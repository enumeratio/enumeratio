-- requires: realizer, utilities
-- core_partitions — the k-core partitions of length n (a FindStat collection; sage Cores(k, n)). A partition is a
-- k-CORE iff none of its hook lengths is divisible by k; its LENGTH is the number of cells with hook length < k (= the
-- size of the corresponding (k-1)-bounded partition — verified against sage, so no abacus bijection is needed, just
-- hook lengths). A 2-parameter family (k, length), carried as the core partition (parts), rendered comma-separated.
-- count from the floor: enumerate partitions up to a size bound (n(n+1)/2, the k=2 staircase worst case) and keep the
-- k-cores of length n. (Named core_partitionS, not the too-generic "core", to survive the shared global namespace.)

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE core_partition AS (parts int[]);                        -- the k-core partition, non-increasing
CREATE FUNCTION notation(c core_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((c).parts, ',') $$;

-- the hook length of every cell (i,j): (arm) + (leg) + 1 = (λ_i − j) + (λ'_j − i) + 1, λ' the conjugate
CREATE FUNCTION partition_hook_lengths(parts int[]) RETURNS SETOF int LANGUAGE sql IMMUTABLE AS $$
  SELECT (parts[i] - j) + (SELECT count(*)::int FROM unnest(parts) x WHERE x >= j) - i + 1
  FROM generate_subscripts(parts,1) i, LATERAL generate_series(1, parts[i]) j $$;
-- every partition with sum ≤ maxsum (parts positive, non-increasing)
CREATE FUNCTION partitions_upto(maxsum int) RETURNS SETOF int[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE p AS (
    SELECT ARRAY[]::int[] AS parts, 0 AS s
    UNION ALL
    SELECT p.parts || v, p.s + v
      FROM p, LATERAL generate_series(1, least(coalesce(p.parts[array_length(p.parts,1)], maxsum), maxsum - p.s)) v
     WHERE p.s < maxsum
  )
  SELECT parts FROM p $$;

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE core_partitions_fiber AS (k natural_number, length natural_number);   -- typed fiber; axes: k, length
CREATE FUNCTION fiber_elements(f core_partitions_fiber, element_limit int) RETURNS SETOF core_partition LANGUAGE sql STABLE AS $$
  SELECT ROW(parts)::core_partition
    FROM partitions_upto((f).length::int * ((f).length::int + 1) / 2) parts               -- size bound: the k=2 staircase of length n
   WHERE NOT EXISTS (SELECT 1 FROM partition_hook_lengths(parts) h WHERE h % (f).k::int = 0)          -- a k-core
     AND (SELECT count(*) FROM partition_hook_lengths(parts) h WHERE h < (f).k::int) = (f).length::int     -- of length n
   ORDER BY parts
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f core_partitions_fiber, v core_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parts,1) i WHERE i > 1 AND (v).parts[i-1] < (v).parts[i])   -- non-increasing
     AND NOT EXISTS (SELECT 1 FROM unnest((v).parts) x WHERE x < 1)                                                     -- positive parts
     AND NOT EXISTS (SELECT 1 FROM partition_hook_lengths((v).parts) h WHERE h % (f).k::int = 0)                        -- a k-core
     AND (SELECT count(*) FROM partition_hook_lengths((v).parts) h WHERE h < (f).k::int) = (f).length::int $$;               -- of length n

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('core_partitions', 'core_partition');
INSERT INTO base_grade VALUES ('core_partitions', 1, 'k', NULL, NULL), ('core_partitions', 2, 'length', '0', 'g1');   -- the core parameter k; the length
SELECT base_realize('core_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('core_partitions','the 3-cores of length 4: 4,2 / 3,1,1 / 2,2,1,1','eq','2,2,1,1,3,1,1,4,2','no hook length divisible by 3, four cells with hook < 3',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(core_partitions(3,4)) e $q$),
  ('core_partitions','the 2-cores are the staircases: core_partitions(2, n) for n=1..4 has cardinality 1 each','eq','1,1,1,1','the only 2-core of each length is the staircase',$q$
    SELECT string_agg(cardinality(core_partitions(2, n))::text, ',' ORDER BY n) FROM generate_series(1,4) n $q$),
  ('core_partitions','the 2-core of length 4 is the staircase 4,3,2,1','eq','4,3,2,1','δ_4',$q$
    SELECT render(unrank(core_partitions(2,4), 0)) $q$),
  ('core_partitions','|core_partitions(4, n)| for n=1..4 is 1,2,3,4','eq','1,2,3,4','the 4-cores by length',$q$
    SELECT string_agg(cardinality(core_partitions(4, n))::text, ',' ORDER BY n) FROM generate_series(1,4) n $q$),
  ('core_partitions','contains via <@: the 3-core 4,2 ∈ core_partitions(3,4); a non-core 3 (hook 3) ∉','eq','true|false','3 has a hook of length 3',$q$
    SELECT (ROW(ARRAY[4,2])::core_partition <@ core_partitions(3,4))::text || '|' || (ROW(ARRAY[3])::core_partition <@ core_partitions(3,4))::text $q$),
  ('core_partitions','every element of core_partitions(3,4) is a 3-core (no hook divisible by 3)','eq','true','the defining invariant',$q$
    SELECT bool_and(NOT EXISTS (SELECT 1 FROM partition_hook_lengths(((e).value).parts) h WHERE h % 3 = 0))::text FROM elements(core_partitions(3,4)) e $q$);
