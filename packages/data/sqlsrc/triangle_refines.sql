-- requires: triangle_slices, realizer
-- requires-tag: collection
-- A triangle REFINES a parent collection by a statistic: T(n, k) = |{ e ∈ parent(n) : stat(e) = k }| — the (n,k)-graded
-- sibling IS the parent's GROUP BY stat, with a closed-form fiber_count where the parent's distribution would have to
-- enumerate. Recorded as data so the query view's planner reads a registered distribution off fibers(<triangle>(n))
-- (works on an OPEN parent handle: the Eulerian rows of permutations stream), and "name this" answers "this GROUP BY
-- has a name" without probing. Several statistics may share one triangle: that is EQUIDISTRIBUTION as data —
-- descents / ascents / excedances are all Eulerian, cycles / left_to_right_maxima both Stirling-1 (Foata).
-- Each row is verified by the differential below on n ≤ 4; the rows were discovered by that same comparison.
CREATE TABLE base_triangle_refines (
  triangle text NOT NULL REFERENCES base_triangle,
  parent   text NOT NULL REFERENCES base_collection,
  stat_id  text NOT NULL,                                        -- a statistic of the parent (base_stat_resolved)
  PRIMARY KEY (triangle, parent, stat_id),
  pack     text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);
CREATE TRIGGER base_triangle_refines_pack_guard BEFORE UPDATE OR DELETE ON base_triangle_refines FOR EACH ROW EXECUTE FUNCTION base_guard_pack();
-- (the k_descent_permutations/k_cycle_permutations/surjections_onto_k/k_inversion_permutations rows moved to
-- packs/permutations-plus/triangle_refines.permutations-plus.sql — both triangle and parent are permutations-plus
-- collections, and base_triangle_refines FKs both columns, #283 phase 3)
INSERT INTO base_triangle_refines (triangle, parent, stat_id) VALUES
  ('k_subsets',              'subsets',         'cardinality'),          -- Pascal: subsets of [n] by size
  ('k_subsets',              'boolean_algebra', 'cardinality'),          -- the same powerset as a lattice
  -- issue #220 chunk 1 — the unrefined triangles that DO have a natural one-axis parent AND actually fit this
  -- table's model (T(n,k) = |{e : stat(e) = k}|, an EXACT level-set). Checked and skipped: weak_compositions_into_k_parts
  -- and little_schroder_triangle have no one-axis parent; gelfand_tsetlin and k_dyck_paths grade by a construction
  -- PARAMETER (an entry bound / an order k), not a per-element statistic; bounded_part_partitions was tried against
  -- integer_partitions.largest_part but triangle_refines_agrees returns false — bounded_part_partitions(n,k) counts
  -- parts ≤ k (CUMULATIVE: partition_count_max_part), not parts = k exactly, so it isn't this table's kind of
  -- refinement at all (it would need a "≤" variant this table doesn't model) — left unregistered, not forced.
  ('narayana_numbers',              'dyck_paths',           'peaks'),        -- Narayana N(n,k), refining Catalan(n)
  ('set_partitions_into_k_blocks',  'set_partitions',       'blocks'),       -- Stirling-2 S(n,k), refining Bell(n)
  -- k_part_partitions' row (p(n,k), refining p(n)) moved to the partitions-plus pack (triangle_refines.partitions-plus.sql, #283).
  ('compositions_into_k_parts',     'integer_compositions', 'parts_count'),  -- C(n-1,k-1), refining 2^(n-1)
  ('schroeder_triangle',            'schroeder_paths',      'flat_steps');   -- T(n,k), refining the large Schröder numbers

-- the differential: the triangle's cells for rows 0..nmax vs the parent's GROUP BY stat counts, as one text.
-- Built row-by-row (not via one triangle_cells(tri, nmax) sweep): some triangles' column axis starts at k=1
-- (narayana_numbers, k_part_partitions, bounded_part_partitions, compositions_into_k_parts,
-- set_partitions_into_k_blocks — "k ranges 1..n"), so n=0 leaves an EMPTY k-range ([1,0)), not a zero row.
-- triangle_cells hits that as a hard range-construction error; a row genuinely outside a triangle's declared
-- domain isn't a disagreement, so it's skipped, same as triangle_slices.sql's own row-sum check already starts
-- at n=1 to dodge the identical case.
CREATE FUNCTION triangle_refines_agrees(tri text, par text, stat text, nmax int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE fn text; cells text; dist text; col_axis text; n int; part text; skip_ns int[] := ARRAY[]::int[]; exclude_sql text := '';
BEGIN
  SELECT value_fn INTO fn FROM base_stat_resolved WHERE collection = par AND stat_id = stat;
  IF fn IS NULL THEN RETURN false; END IF;
  SELECT t.col_axis INTO col_axis FROM base_triangle t WHERE t.collection = tri;
  IF col_axis IS NULL THEN RETURN false; END IF;
  FOR n IN 0..nmax LOOP
    BEGIN
      EXECUTE format('SELECT string_agg(%s::numeric || '','' || (f).%I::numeric || ''='' || cardinality(f), '' '' ORDER BY (f).%I)
                        FROM fibers(%I(%s::numeric)) f WHERE cardinality(f) > 0',
                      n, col_axis, col_axis, tri, n) INTO part;
    EXCEPTION WHEN OTHERS THEN
      part := NULL; skip_ns := skip_ns || n;   -- n outside tri's declared domain (e.g. an empty k-range) — excluded from BOTH sides below
    END;
    IF part IS NOT NULL THEN cells := coalesce(cells || ' ', '') || part; END IF;
  END LOOP;
  -- a row skipped above is missing from `cells`, so it must also be dropped from the parent's GROUP BY sweep, or a
  -- row the parent genuinely has (e.g. dyck_paths(0), 1 path, 0 peaks) but the triangle's own domain excludes would
  -- read as a false mismatch instead of an honest "this triangle doesn't cover n=0".
  IF array_length(skip_ns, 1) > 0 THEN
    exclude_sql := format(' AND (fiber_address((e).fiber))[1] <> ALL (ARRAY[%s]::numeric[])', array_to_string(skip_ns, ','));
  END IF;
  EXECUTE format('SELECT string_agg(n || '','' || k || ''='' || v, '' '' ORDER BY n, k) FROM (
                    SELECT (fiber_address((e).fiber))[1] AS n, %I((e).value) AS k, count(*) AS v
                      FROM elements(%I(0, %s), 2147483647) e WHERE true%s GROUP BY 1, 2) t', fn, par, nmax, exclude_sql) INTO dist;
  RETURN cells IS NOT NULL AND cells = dist;
END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('triangle_refines','every registered refinement agrees: the triangle''s cells ARE the parent''s GROUP BY stat counts (n ≤ 4)','eq','true','the registry is data the differential keeps honest',$q$
    SELECT bool_and(triangle_refines_agrees(triangle, parent, stat_id, 4))::text FROM base_triangle_refines $q$),
  -- (the k_descent_permutations equidistribution example moved to
  -- packs/permutations-plus/triangle_refines.permutations-plus.sql, same reason as its rows)
  ('triangle_refines','a refinement names a statistic the parent really has','eq','0','no dangling stat ids',$q$
    SELECT count(*)::text FROM base_triangle_refines r WHERE NOT EXISTS (SELECT 1 FROM base_stat_resolved s WHERE s.collection = r.parent AND s.stat_id = r.stat_id) $q$),
  -- NB: carrier is NOT required to match — a triangle MAY grade on its own fresh carrier rather than reusing the
  -- parent's; narayana_numbers and schroeder_triangle used to (a pre-#236 instance of the audit's §3.2 friction),
  -- but a bespoke carrier was never the load-bearing part of "refines" — the numeric differential
  -- (triangle_refines_agrees, above) is. What DOES have to hold is the one-axis-parent shape.
  ('triangle_refines','the parent has exactly one grade axis — the triangle''s row axis','eq','0','a refinement adds ONE axis (the statistic) to a one-axis parent',$q$
    SELECT count(*)::text FROM base_triangle_refines r
     WHERE (SELECT count(*) FROM base_grade g WHERE g.collection = r.parent) <> 1 $q$);
