-- requires: integer_partitions, integer_partitions.dominance, element_relations
-- integer_partitions — element-relations batch 3 of #237 ("Partitions" group): dominance order, registered WITHIN
-- a fiber (partitions of the same n). Reuses partition_dominates (issue #230, integer_partitions.dominance.sql),
-- which was left unregistered on purpose for this ticket to pick up. Unlike Young's lattice (element_relations.sql,
-- crossing fibers, a clean single-cell-add cover), dominance order's COVER relation has no simple closed form — its
-- Brylawski box-move characterization needs rank-adjacency bookkeeping that's awkward as a plain forward_fn — so it
-- registers via related_fn, the general comparator, exactly as docs/design/element-relations.md's crux (b) names
-- dominance (alongside strong Bruhat) as the intended related_fn example.
INSERT INTO base_element_relation (collection, rel_id, kind, related_fn, title, findstat) VALUES
  ('integer_partitions', 'dominance', 'cover', 'partition_dominates',
   'dominance order — λ dominates μ iff every prefix sum of λ is at least the corresponding prefix sum of μ; a partial order within a fiber, total only through n=5', NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('element_relations', 'integer_partitions/dominance registers as a cover relation via related_fn=partition_dominates, and that predicate reproduces the known n=6 Hasse covers (6⋗5+1, 5+1⋗4+2) plus the classic incomparable pair (3+3, 4+1+1)',
   'eq', 'true', 'registration wiring checked against the classical dominance facts (#230)',$q$
    SELECT (
      (SELECT kind || ':' || related_fn FROM base_element_relation
        WHERE collection = 'integer_partitions' AND rel_id = 'dominance') = 'cover:partition_dominates'
      AND partition_dominates(ROW(ARRAY[6])::integer_partition, ROW(ARRAY[5,1])::integer_partition)
      AND partition_dominates(ROW(ARRAY[5,1])::integer_partition, ROW(ARRAY[4,2])::integer_partition)
      AND NOT partition_dominates(ROW(ARRAY[3,3])::integer_partition, ROW(ARRAY[4,1,1])::integer_partition)
      AND NOT partition_dominates(ROW(ARRAY[4,1,1])::integer_partition, ROW(ARRAY[3,3])::integer_partition)
    )::text $q$);

-- poset_mobius (core finalizer) skips a related_fn-only cover relation: dominance names only a pair predicate, so
-- there are no successors to walk and the finalizer generates no ≤/interval/μ trio. Lives here, not in the core
-- poset_mobius.sql file, because it names dominance — a partitions-plus relation absent from a core-only run (#340).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('poset_mobius','a relation with no forward_fn is skipped, not failed','eq','true',
   'integer_partitions'' dominance order names only a pair predicate — no successors to walk',$q$
    SELECT (EXISTS (SELECT 1 FROM base_element_relation
                     WHERE collection = 'integer_partitions' AND rel_id = 'dominance' AND forward_fn IS NULL)
        AND NOT EXISTS (SELECT 1 FROM base_poset_order
                         WHERE collection = 'integer_partitions' AND rel_id = 'dominance'))::text $q$);
