-- requires: element_relations, set_partitions, non_crossing_partitions
-- set_partitions / non_crossing_partitions — element relations (issue #237, group 4): the refinement order Π_n on
-- set partitions (kind cover: covers merge two blocks into one) and its restriction to the non-crossing partition
-- lattice NC_n. Both reuse the RGS carrier `set_partition` (set_partitions.sql). Design: docs/design/element-relations.md.

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

-- ── cover (restricted): non_crossing_partitions, the non-crossing partition lattice NC_n ─────────────────────────
-- NC_n is graded by n − #blocks, the same rank function as Π_n (classical fact), so every NC_n-cover changes block
-- count by exactly one — hence is itself a two-block merge. And any two-block merge is already a Π_n-cover (nothing
-- of Π_n sits strictly between p and it), so it is a fortiori an NC_n-cover whenever the merge stays non-crossing.
-- Filtering set_partition_refinement_covers by is_non_crossing therefore gives exactly NC_n's covers.
CREATE FUNCTION non_crossing_partition_refinement_covers(p set_partition) RETURNS SETOF set_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT c FROM set_partition_refinement_covers(p) c WHERE is_non_crossing((c).rgs) $$;

-- ── the registry rows ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_element_relation (collection, rel_id, kind, forward_fn, title, findstat) VALUES
  ('set_partitions', 'refinement', 'cover', 'set_partition_refinement_covers',
   'refinement order Π_n — covers merge two blocks into one', NULL),
  ('non_crossing_partitions', 'refinement', 'cover', 'non_crossing_partition_refinement_covers',
   'the non-crossing partition lattice NC_n — refinement order restricted to non-crossing partitions', NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  -- registry shape
  ('set_partitions_relations', 'both relations registered under kind cover, keyed on their own collections',
   'eq', 'non_crossing_partitions/refinement,set_partitions/refinement', 'the two new rows',$q$
    SELECT string_agg(collection || '/' || rel_id, ',' ORDER BY collection)
      FROM base_element_relation WHERE rel_id = 'refinement' $q$),

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
        FROM elements(set_partitions(4)) e GROUP BY 1) t $q$),

  -- NC_n: non-crossing partition lattice --------------------------------------------------------------------
  ('set_partitions_relations', 'NC refinement covers of the discrete partition 012 (n=3): all 3 merges stay non-crossing',
   'eq', '001,010,011', 'at n=3 every Π_3 cover is already non-crossing (the first crossing appears at n=4)',$q$
    SELECT string_agg(notation(c), ',' ORDER BY notation(c)) FROM non_crossing_partition_refinement_covers(ROW(ARRAY[0,1,2])::set_partition) c $q$),
  ('set_partitions_relations', 'every NC refinement cover is also a Π_n refinement cover of the same element (the restriction claim), non_crossing_partitions(n) n=1..4',
   'eq', 'true', 'brute-checked: NC covers ⊆ Π_n covers',$q$
    SELECT bool_and(
      NOT EXISTS (
        SELECT 1 FROM non_crossing_partition_refinement_covers((e).value) c
         WHERE notation(c) NOT IN (SELECT notation(c2) FROM set_partition_refinement_covers((e).value) c2)
      ))::text
    FROM generate_series(1,4) n, LATERAL elements(non_crossing_partitions(n)) e $q$),
  ('set_partitions_relations', 'NC_n is graded by n − #blocks, same as Π_n: every NC cover increases rank by exactly one, n=1..4',
   'eq', 'true', 'the classical fact grounding the induced-cover argument in the header comment',$q$
    SELECT bool_and(
      (n - (SELECT count(DISTINCT x) FROM unnest((c).rgs) x))
        = (n - (SELECT count(DISTINCT x) FROM unnest(((e).value).rgs) x)) + 1
    )::text
    FROM generate_series(1,4) n, LATERAL elements(non_crossing_partitions(n)) e,
         LATERAL non_crossing_partition_refinement_covers((e).value) c $q$),
  ('set_partitions_relations', 'NC refinement has a UNIQUE maximum (the single block) and UNIQUE minimum (the discrete partition), n=1..4',
   'eq', 'true', 'lattice bounds carry over from Π_n (both are already non-crossing)',$q$
    SELECT bool_and(tops = 1 AND bottoms = 1)::text FROM (
      SELECT n,
             (SELECT count(*) FROM elements(non_crossing_partitions(n)) e
               WHERE NOT EXISTS (SELECT 1 FROM non_crossing_partition_refinement_covers((e).value))) tops,
             (SELECT count(*) FROM elements(non_crossing_partitions(n)) e
               WHERE NOT EXISTS (SELECT 1 FROM elements(non_crossing_partitions(n)) u
                                  WHERE (e).value IN (SELECT c FROM non_crossing_partition_refinement_covers((u).value) c))) bottoms
        FROM generate_series(1,4) n) t $q$);
