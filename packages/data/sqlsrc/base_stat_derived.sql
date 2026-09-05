-- requires: statistics, maps, cross-collection-maps, dyck_paths.stats, set_partitions.stats, integer_partitions.stats, realizer
-- base_stat_derived — statistics that are COMPOSITIONS of other statistics/maps, as DATA (catalog audit friction 4):
-- `descents = |descent_set|`, `cycles = length ∘ cycle_type` are relations the registry couldn't see before this —
-- every hand-authored base_stat function had to re-derive its expression from scratch, so "name this" and the
-- FindStat sweep couldn't read a composition off the catalog. A row here names the composition using the SAME
-- stat_id/map_id vocabulary the client/explorer already show (not raw SQL internals). The generator below resolves
-- those names against base_stat/base_map for the collection — and, for a map argument, against the MAP'S CODOMAIN
-- collection's own stats (the "apply a map, then read a stat off the result" shape, e.g. `length(cycle_type)`) —
-- and emits one real SQL function per row via EXECUTE format(...), exactly the realizer's own generator pattern
-- (constructions.sql's construction_cardinality does the same `\m…\M` token-substitution over an expression-as-data).
-- No realizer change: base_stat_derived is a plain new table, base_stat itself is untouched. Loaded after every file
-- that registers a stat/map this batch composes, so each substitution target already exists.

CREATE TABLE base_stat_derived (collection text NOT NULL REFERENCES base_collection, stat_id text NOT NULL,
                                expr text NOT NULL, title text, codomain text,
                                PRIMARY KEY (collection, stat_id));

-- base_realize_stat_derived(p_pack): NOT per-collection — this sweeps base_stat_derived's own small curated
-- registry (~10 rows today, spanning 4 collections), not base_collection. Registered below as a "pack"-scope
-- finalizer (#283 phase 1.3): base_pack_finalize(pack) calls this ONCE with the pack id, and the join to
-- base_collection here does the pack-filtering — the finalizer table itself only knows collection vs pack shape,
-- not which registry a "pack" fn reads.
CREATE FUNCTION base_realize_stat_derived(p_pack text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  d record; carrier text; fn_name text; body text; ref record;
BEGIN
  FOR d IN SELECT bsd.* FROM base_stat_derived bsd JOIN base_collection c ON c.id = bsd.collection
            WHERE c.pack = p_pack ORDER BY bsd.collection, bsd.stat_id LOOP
    SELECT c.carrier INTO carrier FROM base_collection c WHERE c.id = d.collection;
    body := d.expr;

    -- pass 1: "outer(inner)" compositions — inner is a MAP of this collection, outer is a STAT registered on the
    -- map's codomain collection (apply the map, then read a stat off its image — e.g. length(cycle_type)). Longest
    -- names first so a shorter token can't half-eat a longer one.
    FOR ref IN
      SELECT m.map_id, m.mapping_fn, s.stat_id AS outer_id, s.value_fn AS outer_fn
      FROM base_map m JOIN base_stat s ON s.collection = m.codomain
      WHERE m.collection = d.collection
      ORDER BY length(m.map_id) DESC, length(s.stat_id) DESC
    LOOP
      body := regexp_replace(body,
        '\m' || ref.outer_id || '\M\s*\(\s*\m' || ref.map_id || '\M\s*\)',
        ref.outer_fn || '(' || ref.mapping_fn || '(e))', 'g');
    END LOOP;

    -- pass 2: bare references to this collection's own stats/maps — whatever pass 1 didn't already consume
    -- (e.g. `peaks - 1`, or the leftover `smallest_block` in `largest_part(block_sizes) - smallest_block`).
    FOR ref IN
      SELECT id, fn FROM (
        SELECT stat_id AS id, value_fn AS fn FROM base_stat WHERE collection = d.collection
        UNION ALL
        SELECT map_id, mapping_fn FROM base_map WHERE collection = d.collection
      ) t ORDER BY length(id) DESC
    LOOP
      body := regexp_replace(body, '\m' || ref.id || '\M', ref.fn || '(e)', 'g');
    END LOOP;

    fn_name := regexp_replace(d.collection || '_' || d.stat_id || '_derived', '[^a-zA-Z0-9_]+', '_', 'g');
    EXECUTE format('CREATE FUNCTION %I(e %I) RETURNS numeric LANGUAGE sql IMMUTABLE AS $b$ SELECT (%s)::numeric $b$',
                    fn_name, carrier, body);
    INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain)
      VALUES (d.collection, d.stat_id, fn_name, coalesce(d.title, d.stat_id), coalesce(d.codomain, 'natural_numbers'));
  END LOOP;
END $$;

-- ── the obvious compositions (friction 4), across permutations / paths / partitions / set partitions ───────────
-- The ticket's own literal examples (valleys=peaks−1, ascents=n−1−descents, cycles=length∘cycle_type) turned out to
-- already be hand-authored in this branch (permutations.stats.sql St000245/St000099, statistics.sql's cycles) — these
-- are the same "obvious composition" shape over what was still uncomposed.
-- NOTE: 'runs' is NOT registered here — permutations already own a direct `runs` stat (#240); this derived
-- convenience would collide on base_stat's PK. Deferred to the canonical direct stat.
INSERT INTO base_stat_derived (collection, stat_id, expr, title, codomain) VALUES
  ('permutations','largest_cycle_length','largest_part(cycle_type)','Length of the largest cycle',NULL),
  ('permutations','distinct_cycle_lengths','distinct_parts(cycle_type)','Number of distinct cycle lengths',NULL),
  ('permutations','largest_run_length','largest_part(descent_composition)','Length of the longest maximal ascending run',NULL),
  ('dyck_paths','coarea','area(reverse_complement)','Area of the reverse-complement image',NULL),
  ('dyck_paths','interior_returns','greatest(returns - 1, 0)','Returns to the axis beyond the mandatory final one',NULL),
  ('set_partitions','block_size_span','largest_part(block_sizes) - smallest_block','Spread between the largest and smallest block',NULL),
  ('set_partitions','crossing_nesting_total','crossings + nestings','Total crossing+nesting arc pairs',NULL),
  ('integer_partitions','parts_at_least_two','length - parts_equal_one','Number of parts of size at least two',NULL),
  ('integer_partitions','conjugate_odd_parts','odd_parts(conjugate)','Odd parts of the conjugate',NULL),
  ('integer_partitions','conjugate_distinct_parts','distinct_parts(conjugate)','Distinct parts of the conjugate',NULL);

INSERT INTO base_finalizer (id, fn, description, scope) VALUES
  ('stat_derived', 'base_realize_stat_derived', 'Realize base_stat_derived compositions (stat/map token-substitution) '
   'for the pack''s own curated rows.', 'pack');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────────────
-- Each asserts the IDENTITY on n ≤ 5: the generated function agrees, elementwise, with a hand-composed reference
-- built independently from the same underlying functions — a true check that the token substitution did what the
-- expr says, not a restatement of it.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('stat_derived','largest_cycle_length = largest_part∘cycle_type holds over permutations(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(permutations_largest_cycle_length_derived((e).value) = partition_largest(perm_cycle_type((e).value)))::text
    FROM elements(permutations(5)) e $q$),
  ('stat_derived','distinct_cycle_lengths = distinct_parts∘cycle_type holds over permutations(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(permutations_distinct_cycle_lengths_derived((e).value) = partition_distinct_parts(perm_cycle_type((e).value)))::text
    FROM elements(permutations(5)) e $q$),
  ('stat_derived','largest_run_length = largest_part∘descent_composition holds over permutations(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(permutations_largest_run_length_derived((e).value) = composition_largest(permutation_descent_composition((e).value)))::text
    FROM elements(permutations(5)) e $q$),
  ('stat_derived','coarea = area∘reverse_complement holds over dyck_paths(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(dyck_paths_coarea_derived((e).value) = dyck_area(dyck_reverse_complement((e).value)))::text
    FROM elements(dyck_paths(5)) e $q$),
  ('stat_derived','interior_returns = greatest(returns-1,0) holds over dyck_paths(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(dyck_paths_interior_returns_derived((e).value) = greatest(dyck_returns((e).value) - 1, 0))::text
    FROM elements(dyck_paths(5)) e $q$),
  ('stat_derived','block_size_span = largest_part∘block_sizes − smallest_block holds over set_partitions(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(set_partitions_block_size_span_derived((e).value) = composition_largest(setpart_block_sizes((e).value)) - setpart_smallest_block((e).value))::text
    FROM elements(set_partitions(5)) e $q$),
  ('stat_derived','crossing_nesting_total = crossings + nestings holds over set_partitions(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(set_partitions_crossing_nesting_total_derived((e).value) = setpart_crossings((e).value) + setpart_nestings((e).value))::text
    FROM elements(set_partitions(5)) e $q$),
  ('stat_derived','parts_at_least_two = length − parts_equal_one holds over integer_partitions(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(integer_partitions_parts_at_least_two_derived((e).value) = partition_length((e).value) - partition_parts_equal_one((e).value))::text
    FROM elements(integer_partitions(5)) e $q$),
  ('stat_derived','conjugate_odd_parts = odd_parts∘conjugate holds over integer_partitions(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(integer_partitions_conjugate_odd_parts_derived((e).value) = partition_odd_parts(partition_conjugate((e).value)))::text
    FROM elements(integer_partitions(5)) e $q$),
  ('stat_derived','conjugate_distinct_parts = distinct_parts∘conjugate holds over integer_partitions(5)','eq','true','generated vs. hand-composed reference, elementwise',$q$
    SELECT bool_and(integer_partitions_conjugate_distinct_parts_derived((e).value) = partition_distinct_parts(partition_conjugate((e).value)))::text
    FROM elements(integer_partitions(5)) e $q$),
  ('stat_derived','the registry lists at least the derived stats above (a floor — more may be added)','eq','true','base_stat_derived rows realize into base_stat',$q$
    SELECT bool_and(EXISTS (SELECT 1 FROM base_stat s WHERE s.collection = d.collection AND s.stat_id = d.stat_id))::text
    FROM base_stat_derived d $q$),
  ('stat_derived','a derived stat''s value_fn is a real, callable function on the carrier','eq','true','spot check: permutations_largest_run_length_derived(identity of 4) = 4 (one ascending run of length 4)',$q$
    SELECT (permutations_largest_run_length_derived(ROW(ARRAY[1,2,3,4])::permutation) = 4)::text $q$),
  ('stat_derived','the composition pass is a registered "pack"-scope finalizer, not a load-time sweep','eq','true','#283 phase 1.3 — this sweep is bounded/curated, not per-collection, so it runs once per pack',$q$
    SELECT EXISTS (SELECT 1 FROM base_finalizer WHERE id = 'stat_derived' AND fn = 'base_realize_stat_derived'::regproc AND scope = 'pack')::text $q$);
