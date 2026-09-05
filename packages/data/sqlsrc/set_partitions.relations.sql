-- requires: element_relations, set_partitions
-- set_partitions — element relations (issue #237, group 4): the refinement order Π_n on set partitions (kind cover:
-- covers merge two blocks into one). Reuses the RGS carrier `set_partition` (set_partitions.sql).
-- Design: docs/design/element-relations.md. Its restriction to the non-crossing partition lattice NC_n moved to
-- packs/trees-graphs/set_partitions.relations.trees-graphs.sql — non_crossing_partitions is that pack's own
-- collection, so base_element_relation's FK on collection would fail loading core alone, #283 phase 3.

-- ── the refinement predicate (used only to brute-check forward_fn below — not registered as related_fn) ─────────
-- p refines q iff every pair of positions in the same block of p is also in the same block of q.
CREATE FUNCTION set_partition_refines(p set_partition, q set_partition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_subscripts((p).rgs, 1) i, generate_subscripts((p).rgs, 1) j
     WHERE (p).rgs[i] = (p).rgs[j] AND (q).rgs[i] <> (q).rgs[j]) $$;

-- ── cover (same fiber): set_partitions, refinement order Π_n ────────────────────────────────────────────────────
-- Merge two blocks i<j into one: positions in block j move to block i, every label above j shifts down by one to
-- close the gap (blocks stay numbered in first-appearance order, so the result is still a valid RGS). This is the
-- classical fact that Π_n's covers are EXACTLY the two-block merges (Π_n is a graphic/geometric lattice).
CREATE FUNCTION set_partition_refinement_covers(p set_partition) RETURNS SETOF set_partition LANGUAGE sql IMMUTABLE AS $$
  WITH blocks AS (SELECT DISTINCT unnest((p).rgs) AS b)
  SELECT ROW(ARRAY(
           SELECT CASE WHEN x = hi.b THEN lo.b WHEN x > hi.b THEN x - 1 ELSE x END
             FROM unnest((p).rgs) WITH ORDINALITY AS u(x, ord)
            ORDER BY ord))::set_partition
    FROM blocks lo, blocks hi
   WHERE lo.b < hi.b $$;

-- (non_crossing_partition_refinement_covers + its registry row + the NC_n examples moved to
-- packs/trees-graphs/set_partitions.relations.trees-graphs.sql, #283 phase 3)

-- ── the registry row ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_element_relation (collection, rel_id, kind, forward_fn, title, findstat) VALUES
  ('set_partitions', 'refinement', 'cover', 'set_partition_refinement_covers',
   'refinement order Π_n — covers merge two blocks into one', NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  -- (the "both relations registered" example moved to packs/trees-graphs/set_partitions.relations.trees-graphs.sql
  -- — it checks the non_crossing_partitions row too, #283 phase 3)

  -- Π_n: refinement order ------------------------------------------------------------------------------------
  ('set_partitions_relations', 'refinement covers of the discrete partition 012 (n=3): merge any of its 3 pairs of singletons',
   'eq', '001,010,011', 'up-covers of a concrete partition',$q$
    SELECT string_agg(notation(c), ',' ORDER BY notation(c)) FROM set_partition_refinement_covers(ROW(ARRAY[0,1,2])::set_partition) c $q$),
  ('set_partitions_relations', 'up-cover count of a partition with k blocks = C(k,2) = k(k−1)/2, set_partitions(n) n=1..4',
   'eq', 'true', 'choosing 2 of k blocks to merge',$q$
    SELECT bool_and(covers = (blocks * (blocks - 1)) / 2)::text FROM (
      SELECT (SELECT count(DISTINCT x) FROM unnest(((e).value).rgs) x) blocks,
             (SELECT count(*) FROM set_partition_refinement_covers((e).value)) covers
        FROM generate_series(1,4) n, LATERAL elements(set_partitions(n)) e) t $q$),
  ('set_partitions_relations', 'every computed cover is a genuine Hasse edge: nothing in set_partitions(4) refines strictly between p and c',
   'eq', 'true', 'brute-checked against the whole fiber, mirrors the dominance-cover check in integer_partitions.dominance.sql',$q$
    SELECT bool_and(
      NOT EXISTS (
        SELECT 1 FROM elements(set_partitions(4)) z
         WHERE set_partition_refines((e).value, (z).value) AND set_partition_refines((z).value, c)
           AND notation((z).value) NOT IN (notation((e).value), notation(c))
      ))::text
    FROM elements(set_partitions(4)) e, LATERAL set_partition_refinement_covers((e).value) c $q$),
  ('set_partitions_relations', 'refinement is antisymmetric on set_partitions(4): mutual refinement forces equality',
   'eq', 'true', 'no two distinct partitions of [4] refine each other both ways',$q$
    SELECT (NOT EXISTS (
      SELECT 1 FROM elements(set_partitions(4)) a, elements(set_partitions(4)) b
       WHERE notation((a).value) <> notation((b).value)
         AND set_partition_refines((a).value, (b).value) AND set_partition_refines((b).value, (a).value)
    ))::text $q$),
  ('set_partitions_relations', 'refinement has a UNIQUE maximum: exactly one partition of [n] has no up-cover (the single block), n=1..4',
   'eq', 'true', 'lattice top is unique',$q$
    SELECT bool_and(tops = 1)::text FROM (
      SELECT n, count(*) tops FROM generate_series(1,4) n, LATERAL elements(set_partitions(n)) e
       WHERE NOT EXISTS (SELECT 1 FROM set_partition_refinement_covers((e).value)) GROUP BY n) t $q$),
  ('set_partitions_relations', 'refinement has a UNIQUE minimum: exactly one partition of [n] is covered by nothing (the discrete partition), n=1..4',
   'eq', 'true', 'lattice bottom is unique',$q$
    SELECT bool_and(bottoms = 1)::text FROM (
      SELECT n, count(*) bottoms FROM generate_series(1,4) n, LATERAL elements(set_partitions(n)) e
       WHERE NOT EXISTS (SELECT 1 FROM elements(set_partitions(n)) u
                          WHERE (e).value IN (SELECT c FROM set_partition_refinement_covers((u).value) c))
       GROUP BY n) t $q$),
  ('set_partitions_relations', 'refinement rank-GF over set_partitions(4) = 1,6,7,1 (rank = n − #blocks; the reversed Stirling row S(4,4..1))',
   'eq', '1,6,7,1', 'GROUP BY rank(refinement) is the #203 distribution kernel',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT 4 - (SELECT count(DISTINCT x) FROM unnest(((e).value).rgs) x) k, count(*) c
        FROM elements(set_partitions(4)) e GROUP BY 1) t $q$);
  -- (the NC_n non-crossing-partition-lattice examples moved to
  -- packs/trees-graphs/set_partitions.relations.trees-graphs.sql, #283 phase 3)
