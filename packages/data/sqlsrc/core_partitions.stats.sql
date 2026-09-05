-- requires: core_partitions, integer_partitions, realizer, utilities
-- core_partitions statistics & maps — a k-core IS an integer partition, so the classic partition invariants apply
-- (size, number of parts, largest part, distinct parts, Durfee square). CONJUGATE is special here: the multiset of
-- hook lengths is transpose-invariant, so the conjugate of a k-core is again a k-core of the SAME length — conjugate
-- is an involution ON each fiber core_partitions(k, n). Both maps land in integer_partitions.

-- ── statistics (carrier: core_partition(parts int[]), non-increasing, positive) ──────────────────────────
CREATE FUNCTION core_partition_size(x core_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(p) FROM unnest((x).parts) p), 0)::int $$;                    -- total cells |λ|
CREATE FUNCTION core_partition_number_of_parts(x core_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((x).parts, 1), 0) $$;                                       -- rows of the diagram
CREATE FUNCTION core_partition_largest_part(x core_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((x).parts[1], 0) $$;                                                     -- non-increasing ⇒ first is max
CREATE FUNCTION core_partition_distinct_parts(x core_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT p)::int FROM unnest((x).parts) p $$;                               -- number of distinct part sizes
CREATE FUNCTION core_partition_durfee(x core_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).parts, 1) i WHERE (x).parts[i] >= i $$;  -- side of the Durfee square

-- ── maps → integer_partitions ───────────────────────────────────────────────────────────────────────────
-- forgetful embedding: a k-core IS a partition; ship its parts as an integer_partition.
CREATE FUNCTION core_partition_to_partition(x core_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((x).parts)::integer_partition $$;
-- conjugate (transpose of the Young diagram): c[i] = #{ parts >= i } for i = 1 .. largest part. Hook lengths are
-- transpose-invariant, so the conjugate of a k-core is again a k-core of the same length (an involution per fiber).
CREATE FUNCTION core_partition_conjugate(x core_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (SELECT count(*)::int FROM unnest((x).parts) part WHERE part >= i)
    FROM generate_series(1, coalesce((x).parts[1], 0)) i ORDER BY i))::integer_partition $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('core_partitions','size','core_partition_size','Size','natural_numbers'),
  ('core_partitions','number_of_parts','core_partition_number_of_parts','Number of parts','natural_numbers'),
  ('core_partitions','largest_part','core_partition_largest_part','Largest part','natural_numbers'),
  ('core_partitions','distinct_parts','core_partition_distinct_parts','Number of distinct parts','natural_numbers'),
  ('core_partitions','durfee_square','core_partition_durfee','Durfee square size','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('core_partitions','to_partition','core_partition_to_partition','integer_partitions','To partition',NULL),
  ('core_partitions','conjugate','core_partition_conjugate','integer_partitions','Conjugate',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- The 3-cores of length 4, in rank order (array order): 2,2,1,1 / 3,1,1 / 4,2 (from core-partitions.sql).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('core_partitions','size of 4,2 is 6 and of 3,1,1 is 5','eq','6|5','|λ| = Σ parts',$q$
    SELECT core_partition_size(ROW(ARRAY[4,2])::core_partition)::text || '|' ||
           core_partition_size(ROW(ARRAY[3,1,1])::core_partition)::text $q$),
  ('core_partitions','size distribution over the 3-cores of length 4 is 1,2 (sizes 5,6,6)','eq','1,2','one core of size 5, two of size 6',$q$
    SELECT string_agg(c::text, ',' ORDER BY v)
      FROM (SELECT core_partition_size((e).value) v, count(*) c FROM elements(core_partitions(3,4)) e GROUP BY 1) t(v,c) $q$),
  ('core_partitions','the 2-core of length 4 is the staircase δ_4, size 4·5/2 = 10','eq','10','the only 2-core of length n is δ_n, size n(n+1)/2',$q$
    SELECT core_partition_size((unrank(core_partitions(2,4),0)).value)::text $q$),
  ('core_partitions','largest part along the 3-cores of length 4 (rank order) is 2,3,4','eq','2,3,4','max row of 2,2,1,1 / 3,1,1 / 4,2',$q$
    SELECT string_agg(core_partition_largest_part((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(core_partitions(3,4)) e $q$),
  ('core_partitions','number of parts sums to 9 over the 3-cores of length 4 (4+3+2)','eq','9','rows of 2,2,1,1 / 3,1,1 / 4,2',$q$
    SELECT sum(core_partition_number_of_parts((e).value))::text FROM elements(core_partitions(3,4)) e $q$),
  ('core_partitions','the staircase 2-core of length 4 has 4 parts and largest part 4','eq','4|4','δ_4 = 4,3,2,1',$q$
    SELECT core_partition_number_of_parts((unrank(core_partitions(2,4),0)).value)::text || '|' ||
           core_partition_largest_part((unrank(core_partitions(2,4),0)).value)::text $q$),
  ('core_partitions','number of distinct part sizes of 5,3,3,1 is 3','eq','3','{5,3,1}',$q$
    SELECT core_partition_distinct_parts(ROW(ARRAY[5,3,3,1])::core_partition)::text $q$),
  ('core_partitions','every 3-core of length 4 has exactly 2 distinct part sizes','eq','2,2,2','{2,1},{3,1},{4,2}',$q$
    SELECT string_agg(core_partition_distinct_parts((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(core_partitions(3,4)) e $q$),
  ('core_partitions','Durfee square size along the 3-cores of length 4 (rank order) is 2,1,2','eq','2,1,2','max d with λ_d ≥ d',$q$
    SELECT string_agg(core_partition_durfee((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(core_partitions(3,4)) e $q$),
  ('core_partitions','to_partition ships a core as an integer partition: 4,2 ↦ 4+2','eq','4+2','the forgetful embedding',$q$
    SELECT notation(core_partition_to_partition(ROW(ARRAY[4,2])::core_partition)) $q$),
  ('core_partitions','to_partition of 2,2,1,1 renders in the codomain form 2+2+1+1','eq','2+2+1+1','render_value on an integer_partition image',$q$
    SELECT render_value(core_partition_to_partition(ROW(ARRAY[2,2,1,1])::core_partition)) $q$),
  ('core_partitions','conjugate: 4,2 ↦ 2+2+1+1, and 3,1,1 is self-conjugate','eq','2+2+1+1|3+1+1','transpose of the Young diagram',$q$
    SELECT notation(core_partition_conjugate(ROW(ARRAY[4,2])::core_partition)) || '|' ||
           notation(core_partition_conjugate(ROW(ARRAY[3,1,1])::core_partition)) $q$),
  ('core_partitions','conjugate permutes each fiber: the 3-cores of length 4 map to 4+2,3+1+1,2+2+1+1','eq','4+2,3+1+1,2+2+1+1','conjugate is an involution on core_partitions(k,n)',$q$
    SELECT string_agg(render_value(core_partition_conjugate((e).value)), ',' ORDER BY ordinality(e)) FROM elements(core_partitions(3,4)) e $q$),
  ('core_partitions','conjugate is an involution: conj(conj(4,2)) = 4+2','eq','4+2','applying conjugate twice is the identity',$q$
    SELECT notation(core_partition_conjugate(ROW((core_partition_conjugate(ROW(ARRAY[4,2])::core_partition)).parts)::core_partition)) $q$);