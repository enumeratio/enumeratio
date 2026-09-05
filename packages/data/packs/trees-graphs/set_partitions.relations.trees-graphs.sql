-- requires: set_partitions.relations, non_crossing_partitions
-- trees-graphs half of sqlsrc/set_partitions.relations.sql (#283 phase 3 extraction) — the refinement order Π_n's
-- restriction to the non-crossing partition lattice NC_n. non_crossing_partitions is this pack's own collection,
-- so base_element_relation's FK on collection would fail loading core alone.

-- ── cover (restricted): non_crossing_partitions, the non-crossing partition lattice NC_n ─────────────────────────
-- NC_n is graded by n − #blocks, the same rank function as Π_n (classical fact), so every NC_n-cover changes block
-- count by exactly one — hence is itself a two-block merge. And any two-block merge is already a Π_n-cover (nothing
-- of Π_n sits strictly between p and it), so it is a fortiori an NC_n-cover whenever the merge stays non-crossing.
-- Filtering set_partition_refinement_covers by is_non_crossing therefore gives exactly NC_n's covers.
CREATE FUNCTION non_crossing_partition_refinement_covers(p set_partition) RETURNS SETOF set_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT c FROM set_partition_refinement_covers(p) c WHERE is_non_crossing((c).rgs) $$;

INSERT INTO base_element_relation (collection, rel_id, kind, forward_fn, title, findstat) VALUES
  ('non_crossing_partitions', 'refinement', 'cover', 'non_crossing_partition_refinement_covers',
   'the non-crossing partition lattice NC_n — refinement order restricted to non-crossing partitions', NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partitions_relations', 'both relations registered under kind cover, keyed on their own collections',
   'eq', 'non_crossing_partitions/refinement,set_partitions/refinement', 'the two rows',$q$
    SELECT string_agg(collection || '/' || rel_id, ',' ORDER BY collection)
      FROM base_element_relation WHERE rel_id = 'refinement' $q$),
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
