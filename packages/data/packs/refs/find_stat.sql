-- requires: catalog-resolution, statistics, maps, permutations, integer_partitions, debug
-- The statistic finder (issue #124) — a pure-SQL analogue of FindStat's "search by values". You submit the values
-- of an unknown statistic on a handful of small objects; find_stat sweeps every stat the catalog knows for that
-- collection and returns the ones whose value_fn reproduces your data. The catalog IS the oracle (self-certifying):
-- a match means a registered value_fn, evaluated on the same objects, equals every value you submitted.
--
-- INPUT. element_values is a jsonb OBJECT keyed by an element's canonical render (render_value((element).value)) →
-- its numeric value, e.g. {"[1,3,2]": 1, ...}. Keys are matched against the collection's own enumerated elements by
-- that same render, so no per-carrier input grammar is needed — the objects identify themselves by how they print.
--
-- SWEEP. For depth 0 we try every stat in base_stat_resolved for the collection (carrier-inherited stats included).
-- At depth ≥ 1 we also try stat∘map∘…∘map: a recursive CTE over base_map_resolved walks chains of applicable maps
-- (permutation → its cycle-type partition → …) up to `depth` hops (hard-capped, see max_depth below) BEFORE a stat
-- registered on the chain's final codomain — FindStat's depth knob, now general (issue #194; #128 landed the
-- composition machinery this generalizes — map_compose.sql's map_compose_resolve builds the identical composite
-- expr_tpl, but it loads AFTER this file, so the walk is duplicated here rather than called).
--
-- QUALITY. FindStat-style (q_a, q_d) per hit: q_a = fraction of your pairs the stat explains (matched / submitted) —
-- 1.0 is a full reproduction; q_d = discriminating power (distinct values / objects located) — 1.0 separates them all,
-- low means the stat is nearly constant on your sample. Results rank q_a desc, then q_d desc.

CREATE TYPE find_stat_hit AS (stat_collection text, stat_id text, map_path text[], q_a numeric, q_d numeric);

-- The bounded enumeration source for a collection, as a FROM-clause fragment yielding element rows `e`. The full
-- handle coll() is OPEN (unbounded grades don't unfold), so we bind grade 1 to each size 0..size_cap in turn — every
-- coll(n) is a bounded handle whose remaining grades close over n. Ungraded collections have the one unit fiber.
CREATE FUNCTION find_stat_source(p_collection text, size_cap int, per_fiber_cap int) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM base_grade WHERE base_grade.collection = p_collection)
      THEN format('generate_series(0, %s) n, LATERAL elements(%I(n), %s) e', size_cap, p_collection, per_fiber_cap)
    ELSE format('elements(%I(), %s) e', p_collection, per_fiber_cap)
  END
$$;

-- The candidate walk shared by every stat-sweep matcher (find_stat #124, distribution_match #125): for a starting
-- collection and an effective (already-capped) depth, yields one row per stat∘map∘…∘map candidate — chain.hops=0 is
-- the depth-0 base case (map_path='{}', expr_tpl='%s' — the identity template). Each recursive step re-binds
-- `collection` to the step's codomain and wraps expr_tpl in the step's mapping_fn, same textual composition as
-- map_compose_resolve. Two independent guards keep the walk finite:
--  (a) STEP guard — `steps` accumulates `collection:map_id` per hop taken; a step is refused if that exact
--      (source collection, map) pair was already used earlier in the chain. This is what actually bounds the
--      fan-out: without it, a collection with several self-maps (reverse/complement/inverse/… on permutations)
--      could reapply the SAME self-map at every level, branching combinatorially even with hops capped at 3
--      (issue #201 — this alone hung the depth cap). map_id is only unique PER COLLECTION (PRIMARY KEY
--      (collection, map_id) on base_map), so the guard is scoped by collection, not bare map_id — two
--      different collections legitimately reusing a map name (e.g. 'reverse' on both permutations and
--      set_partitions) must stay distinguishable.
--  (b) PING-PONG guard — a step landing back on an EARLIER, now-abandoned collection is refused (self-loops,
--      i.e. codomain = the CURRENT collection, are always fine — that's just an endomorphism). This is what
--      blocks A→B→A round-trips (a map and its near-inverse) without also blocking same-collection composition.
CREATE FUNCTION stat_sweep_candidates(p_collection text, eff_depth int)
RETURNS TABLE(stat_collection text, stat_id text, value_fn text, map_path text[], expr_tpl text)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE chain(collection, map_path, steps, expr_tpl, hops, visited) AS (
    SELECT p_collection, '{}'::text[], '{}'::text[], '%s'::text, 0, ARRAY[p_collection]
    UNION ALL
    SELECT m.codomain, chain.map_path || m.map_id, chain.steps || (chain.collection || ':' || m.map_id),
           format('%I(%s)', m.mapping_fn, chain.expr_tpl), chain.hops + 1, chain.visited || m.codomain
      FROM chain
      JOIN base_map_resolved m ON m.collection = chain.collection
     WHERE chain.hops < eff_depth
       AND NOT ((chain.collection || ':' || m.map_id) = ANY (chain.steps))
       AND (m.codomain = chain.collection OR NOT (m.codomain = ANY (chain.visited)))
  )
  SELECT s.collection AS stat_collection, s.stat_id, s.value_fn, chain.map_path, chain.expr_tpl
    FROM chain
    JOIN base_stat_resolved s ON s.collection = chain.collection
$$;

CREATE FUNCTION find_stat(p_collection text, element_values jsonb, depth int DEFAULT 0,
                          size_cap int DEFAULT 6, per_fiber_cap int DEFAULT 2000)
RETURNS SETOF find_stat_hit LANGUAGE plpgsql AS $$   -- VOLATILE (default): #202's temp-table materialization is a
                                                       -- real side effect, no longer safe to mark STABLE
DECLARE
  src   text := find_stat_source(p_collection, size_cap, per_fiber_cap);
  total int  := (SELECT count(*) FROM jsonb_object_keys(element_values));   -- pairs submitted
  max_depth CONSTANT int := 3;                                    -- hard cap regardless of what the caller passes
  eff_depth int := least(greatest(depth, 0), max_depth);
  hits  find_stat_hit[] := '{}';
  cand  record;
  value_expr text;
  found int; matched int; distinct_vals int;
  dbg boolean := debug_enabled('enumeratio:data:findstat');   -- ONCE, before the loop (debug.sql's hot-loop pattern) —
                                                                -- this is exactly what was opaque during the #200 hang
BEGIN
  IF total = 0 THEN RETURN; END IF;

  -- #202: materialize find_stat_source ONCE per call instead of re-running its elements() enumeration inside every
  -- candidate's EXECUTE below (that re-run was the ~60ms/candidate floor). k is precomputed too since it doesn't
  -- vary by candidate. DROP first (not ON COMMIT DROP — calls aren't wrapped in an explicit transaction here) so a
  -- second find_stat() call in the same session doesn't collide with a stale table of a different collection's type.
  DROP TABLE IF EXISTS find_stat_src;
  EXECUTE format('CREATE TEMP TABLE find_stat_src AS SELECT render_value((e).value) AS k, (e).value AS value FROM %s', src);
  ANALYZE find_stat_src;

  FOR cand IN SELECT * FROM stat_sweep_candidates(p_collection, eff_depth) LOOP
    value_expr := format('%I(%s)', cand.value_fn, format(cand.expr_tpl, '(e).value'));   -- stat(mapN(...map1(element)))
    IF dbg THEN
      RAISE NOTICE '[enumeratio:data:findstat] trying %.% chain=% expr_tpl=%',
        cand.stat_collection, cand.stat_id, array_to_string(cand.map_path, ','), cand.expr_tpl;
    END IF;
    BEGIN
      -- src is now find_stat_src, the once-per-call materialization above — only value_expr varies per candidate.
      EXECUTE format($q$
        WITH cand_v AS (SELECT k, (%1$s)::numeric AS v FROM find_stat_src e)
        SELECT count(*), count(*) FILTER (WHERE cand_v.v = s.sv), count(DISTINCT cand_v.v)
          FROM cand_v JOIN (SELECT key, value::numeric AS sv FROM jsonb_each_text($1)) s ON s.key = cand_v.k
      $q$, value_expr)
      INTO found, matched, distinct_vals USING element_values;
    EXCEPTION WHEN OTHERS THEN CONTINUE;   -- non-numeric codomain, arg-type mismatch: not a candidate, skip
    END;

    IF matched > 0 THEN
      hits := hits || ROW(cand.stat_collection, cand.stat_id, cand.map_path,
                          round(matched::numeric / total, 4),
                          round(distinct_vals::numeric / nullif(found, 0), 4))::find_stat_hit;
    END IF;
  END LOOP;

  DROP TABLE IF EXISTS find_stat_src;
  RETURN QUERY SELECT h.* FROM unnest(hits) h ORDER BY h.q_a DESC, h.q_d DESC, h.stat_id;
END $$;

-- ── examples (self-certifying: the input is built FROM the catalog, so a correct finder recovers the stat) ────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('find_stat','recovers inversions from its values on S_3 (depth 0, full match q_a=1)','eq','inversions|1.0000','submit inversions(p) for every p in permutations(3); top hit is the stat itself',$q$
    SELECT stat_id || '|' || q_a::text FROM find_stat('permutations',
      (SELECT jsonb_object_agg(render_value((e).value), perm_inversions((e).value)) FROM elements(permutations(3)) e))
    ORDER BY q_a DESC, q_d DESC LIMIT 1 $q$),

  ('find_stat','major_index is only a PARTIAL depth-0 match for inversion values (equidistributed, not equal)','eq','true','maj reproduces some but not all inversion pairs on S_3',$q$
    SELECT (q_a > 0 AND q_a < 1)::text FROM find_stat('permutations',
      (SELECT jsonb_object_agg(render_value((e).value), perm_inversions((e).value)) FROM elements(permutations(3)) e))
    WHERE stat_id = 'major_index' $q$),

  ('find_stat','longest cycle length: no direct stat, recovered at depth 1 as largest_part∘cycle_type','eq','integer_partitions|largest_part|cycle_type|1.0000','submit the longest cycle length per permutation of 4; depth-1 stat∘map finds it',$q$
    SELECT stat_collection || '|' || stat_id || '|' || array_to_string(map_path, ',') || '|' || q_a::text
    FROM find_stat('permutations',
      (SELECT jsonb_object_agg(render_value((e).value), partition_largest(perm_cycle_type((e).value)))
         FROM elements(permutations(4)) e), 1)
    WHERE map_path = ARRAY['cycle_type'] AND stat_id = 'largest_part'
    ORDER BY q_a DESC LIMIT 1 $q$),

  -- Was "no full depth-0 match (needs the map)" before issue #128: map_compose_stat_materialize (map_compose.sql)
  -- has since registered exactly this depth-1 compound (cycle_type + largest_part) as a real depth-0 stat,
  -- 'longest_cycle_length' — closing the gap this example used to document. Flipped to assert the new state.
  ('find_stat','that same longest-cycle target NOW has a full depth-0 match — map_compose (#128) materialized it as longest_cycle_length','eq','longest_cycle_length|1.0000','the finder gap this example used to point at is exactly what map_compose.sql''s S1 closes',$q$
    SELECT stat_id || '|' || q_a::text FROM find_stat('permutations',
      (SELECT jsonb_object_agg(render_value((e).value), partition_largest(perm_cycle_type((e).value)))
         FROM elements(permutations(4)) e), 0)
    WHERE stat_id = 'longest_cycle_length' ORDER BY q_a DESC LIMIT 1 $q$),

  ('find_stat','recovers set-partition block count on the objects of set_partitions(4)','eq','blocks|1.0000','a different carrier: Stirling objects, depth 0',$q$
    SELECT stat_id || '|' || q_a::text FROM find_stat('set_partitions',
      (SELECT jsonb_object_agg(render_value((e).value), setpart_blocks((e).value)) FROM elements(set_partitions(4)) e))
    ORDER BY q_a DESC, q_d DESC LIMIT 1 $q$),

  ('find_stat','issue #194: a genuine 2-hop chain — cycle_count recovered at depth 2 as largest_part∘[cycle_type,conjugate]','eq','integer_partitions|largest_part|cycle_type,conjugate|1.0000','submit perm_cycle_count per permutation of 4; the depth-2 recursive-CTE walk finds stat∘map∘map even though cycle_count is ALSO a direct depth-0 stat (map_compose.sql''s own example proves the two agree)',$q$
    SELECT stat_collection || '|' || stat_id || '|' || array_to_string(map_path, ',') || '|' || q_a::text
    FROM find_stat('permutations',
      (SELECT jsonb_object_agg(render_value((e).value), perm_cycle_count((e).value))
         FROM elements(permutations(4)) e), 2)
    WHERE map_path = ARRAY['cycle_type','conjugate'] AND stat_id = 'largest_part'
    ORDER BY q_a DESC LIMIT 1 $q$),

  -- ── ping-pong guard (#194/#201) ── distinct_partitions -to_odd-> odd_partitions -to_distinct-> distinct_partitions
  -- is the Euler/Glaisher pair (maps-bijections.sql), proven mutual inverses there, so composing both legs is the
  -- IDENTITY on distinct_partitions. Without the guard, that 2-hop ping-pong would re-derive distinct_parts on
  -- itself and surface a spurious perfect-match hit at map_path=[to_odd,to_distinct] — same value, redundant longer
  -- path. The guard refuses a step landing back on an EARLIER, abandoned collection (distinct_partitions is already
  -- `visited` after hop 1 into odd_partitions), so that hit must never appear — only the true depth-0 direct match
  -- does. (First landed in #194, reverted alongside the depth-cap example below when THAT one hung the suite —
  -- this half was always cheap on its own and is safe to restore unmodified.)
  ('find_stat','issue #194: ping-pong guard blocks the Euler round-trip distinct_partitions→odd_partitions→distinct_partitions','eq','depth0:t|pingpong:f','the direct match is found; the redundant to_odd,to_distinct round-trip (which IS the identity, so it would match perfectly if unguarded) never appears',$q$
    SELECT 'depth0:' || left((EXISTS (
             SELECT 1 FROM find_stat('distinct_partitions',
               (SELECT jsonb_object_agg(render_value((e).value), partition_distinct_parts((e).value)) FROM elements(distinct_partitions(6)) e), 2)
             WHERE stat_id = 'distinct_parts' AND map_path = '{}' AND q_a = 1))::text, 1)
        || '|pingpong:' || left((EXISTS (
             SELECT 1 FROM find_stat('distinct_partitions',
               (SELECT jsonb_object_agg(render_value((e).value), partition_distinct_parts((e).value)) FROM elements(distinct_partitions(6)) e), 2)
             WHERE map_path = ARRAY['to_odd','to_distinct']))::text, 1) $q$),

  -- ── depth-cap fan-out guard (#201) ── the ORIGINAL depth-cap example (#194) asked for depth=100 on 'permutations'
  -- with full-size defaults (size_cap=6, per_fiber_cap=2000) and hung the whole suite: 'permutations' has 7 distinct
  -- self-maps (complement/inverse/reverse/…), and the pre-#201 guard let the SAME self-map re-apply at every hop
  -- (`m.codomain = chain.collection` bypassed the visited check unconditionally), so the depth-3-capped walk still
  -- fanned out combinatorially (thousands of stat∘map∘map∘map candidates, each a full dynamic-SQL EXECUTE). The
  -- `steps`-scoped guard above (NOT `chain.collection || ':' || m.map_id` = ANY `chain.steps`) forbids reusing the
  -- SAME (collection, map) step twice in one chain, so a chain of pure self-map repetition is now impossible.
  -- Kept intentionally small here (size_cap=2, per_fiber_cap=20, permutations(2) as input) — this is a fan-out
  -- proof, not a precision benchmark, and must stay cheap even with the cap fully exercised at every hop.
  ('find_stat','issue #201: requesting depth=50 on ''permutations'' (7 self-maps) still returns quickly — the steps guard bounds the fan-out, and max_depth=3 still caps every hit''s map_path','eq','true','the depth-0 identity hit (inversions) is still found, and no hit''s map_path exceeds 3 hops despite requesting depth 50 — proof the walk terminates instead of fanning out on repeated self-maps',$q$
    SELECT (bool_or(map_path = '{}' AND stat_id = 'inversions' AND q_a = 1)
            AND max(coalesce(array_length(map_path,1),0)) <= 3)::text
    FROM find_stat('permutations',
      (SELECT jsonb_object_agg(render_value((e).value), perm_inversions((e).value)) FROM elements(permutations(2)) e),
      50, 2, 20) $q$);
