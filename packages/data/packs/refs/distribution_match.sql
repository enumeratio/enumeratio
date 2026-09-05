-- requires: find_stat
-- The distribution finder (issue #125) — sibling of find_stat (#124), sharing its stat-sweep (stat_sweep_candidates,
-- find_stat.sql) but with fundamentally different comparison semantics. find_stat matches per-element VALUES
-- (element-wise equality against a submitted render→value map). distribution_match matches a FIBER's value
-- DISTRIBUTION — an order-agnostic multiset/histogram — the equidistribution question ("which stats are Mahonian /
-- Eulerian / Narayana here?"). Two thin matchers over one shared candidate walk, per the #125 code-owner decision:
-- folding this into find_stat as a mode would muddy both (a "did you submit values or a histogram?" branch deep
-- inside one function, versus two small functions that each do one thing).
--
-- INPUT. target_distribution is a jsonb OBJECT keyed by a stat VALUE (as text) → its multiplicity, e.g. the Mahonian
-- distribution on permutations(4): {"0":1,"1":3,"2":5,"3":6,"4":5,"5":3,"6":1} (Σ=24=4!, statistics.sql's own
-- q-factorial example). Unlike find_stat's element_values, there is no per-object key — a distribution has no
-- individual identity, only a shape — so the fiber itself must be pinned to a single n (a single grade): pass it as
-- `n`. Pooling elements across several grades (find_stat_source's generate_series sweep) would blend independent
-- distributions together, which is not what "a fiber's distribution" means.
--
-- SWEEP. Same depth-capped stat∘map∘…∘map walk as find_stat (stat_sweep_candidates), applied to every element of
-- the ONE fiber collection(n) (or the single unit fiber for an ungraded collection — n is ignored there, matching
-- find_stat_source's ELSE branch). Each candidate's histogram over that fiber is computed once via a temp-table
-- materialization, same #202 pattern as find_stat_src.
--
-- SCORE. q_a = matched mass / max(target total, candidate total) — the overlap between the two histograms
-- (sum of min(target_count, candidate_count) per shared value) normalized by the larger of the two totals. This is
-- 1.0 exactly when the histograms are IDENTICAL (same values, same multiplicities, same total — a short argument:
-- overlap = target total forces the candidate to dominate the target pointwise, and equal totals then force no
-- leftover candidate mass elsewhere), and strictly less than 1.0 for any partial overlap or size mismatch — the
-- distribution analogue of find_stat's q_a ("fraction of your data the stat explains"). q_d = distinct values in the
-- candidate's own histogram / fiber size — its discriminating power, same ratio find_stat reports.

CREATE TYPE distribution_match_hit AS (stat_collection text, stat_id text, map_path text[], q_a numeric, q_d numeric);

-- The bounded single-fiber enumeration source, analogous to find_stat_source but pinned to ONE grade `p_n` instead
-- of pooling generate_series(0, size_cap) — a distribution is a property of one fiber, not a range of them.
CREATE FUNCTION distribution_source(p_collection text, p_n int, per_fiber_cap int) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM base_grade WHERE base_grade.collection = p_collection)
      THEN format('elements(%I(%s), %s) e', p_collection, p_n, per_fiber_cap)
    ELSE format('elements(%I(), %s) e', p_collection, per_fiber_cap)
  END
$$;

CREATE FUNCTION distribution_match(p_collection text, target_distribution jsonb, n int DEFAULT NULL,
                                    depth int DEFAULT 0, per_fiber_cap int DEFAULT 2000)
RETURNS SETOF distribution_match_hit LANGUAGE plpgsql AS $$   -- VOLATILE: temp-table materialization, same as find_stat
DECLARE
  graded boolean := EXISTS (SELECT 1 FROM base_grade WHERE base_grade.collection = p_collection);
  src  text;
  total_target numeric := (SELECT coalesce(sum(value::numeric), 0) FROM jsonb_each_text(target_distribution));
  max_depth CONSTANT int := 3;
  eff_depth int := least(greatest(depth, 0), max_depth);
  hits distribution_match_hit[] := '{}';
  cand record;
  value_expr text;
  total_candidate numeric; matched_mass numeric; distinct_vals int;
  dbg boolean := debug_enabled('enumeratio:data:distmatch');
BEGIN
  IF total_target = 0 THEN RETURN; END IF;
  IF graded AND n IS NULL THEN
    RAISE EXCEPTION 'distribution_match(%): n is required for a graded collection (a distribution is a single fiber''s shape)', p_collection;
  END IF;
  src := distribution_source(p_collection, n, per_fiber_cap);

  -- Same #202 pattern as find_stat_src: materialize the fiber ONCE, then only value_expr varies per candidate.
  DROP TABLE IF EXISTS distribution_match_src;
  EXECUTE format('CREATE TEMP TABLE distribution_match_src AS SELECT (e).value AS value FROM %s', src);
  ANALYZE distribution_match_src;

  FOR cand IN SELECT * FROM stat_sweep_candidates(p_collection, eff_depth) LOOP
    value_expr := format('%I(%s)', cand.value_fn, format(cand.expr_tpl, '(e).value'));
    IF dbg THEN
      RAISE NOTICE '[enumeratio:data:distmatch] trying %.% chain=% expr_tpl=%',
        cand.stat_collection, cand.stat_id, array_to_string(cand.map_path, ','), cand.expr_tpl;
    END IF;
    BEGIN
      EXECUTE format($q$
        WITH cand_v AS (SELECT (%1$s)::numeric AS v FROM distribution_match_src e),
             cand_dist AS (SELECT v, count(*) AS c FROM cand_v GROUP BY v),
             tgt AS (SELECT key::numeric AS v, value::numeric AS c FROM jsonb_each_text($1))
        SELECT (SELECT count(*) FROM cand_v),
               (SELECT coalesce(sum(least(tgt.c, coalesce(cand_dist.c, 0))), 0) FROM tgt LEFT JOIN cand_dist USING (v)),
               (SELECT count(*) FROM cand_dist)
      $q$, value_expr)
      INTO total_candidate, matched_mass, distinct_vals USING target_distribution;
    EXCEPTION WHEN OTHERS THEN CONTINUE;   -- non-numeric codomain, arg-type mismatch: not a candidate, skip
    END;

    IF matched_mass > 0 THEN
      hits := hits || ROW(cand.stat_collection, cand.stat_id, cand.map_path,
                          round(matched_mass / greatest(total_target, total_candidate, 1), 4),
                          round(distinct_vals::numeric / nullif(total_candidate, 0), 4))::distribution_match_hit;
    END IF;
  END LOOP;

  DROP TABLE IF EXISTS distribution_match_src;
  RETURN QUERY SELECT h.* FROM unnest(hits) h ORDER BY h.q_a DESC, h.q_d DESC, h.stat_id;
END $$;

-- ── examples (self-certifying: targets are built FROM the catalog's own recorded distributions) ───────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('distribution_match','recovers inversions from its own histogram on S_4 (full match q_a=1, among the top-tied hits — other Mahonian stats share the histogram)','eq','inversions|1.0000','submit the inversions histogram of permutations(4); inversions itself is among the top hits',$q$
    SELECT 'inversions|' || (SELECT q_a::text FROM distribution_match('permutations',
      (SELECT jsonb_object_agg(k::text, c) FROM (SELECT perm_inversions((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t), 4)
    WHERE stat_id = 'inversions') $q$),

  ('distribution_match','issue #125: the Mahonian distribution on permutations(4) recovers BOTH inversions and major_index (equidistribution)','eq','true','the classical MacMahon equidistribution result: inv and maj share the same histogram on S_n even though find_stat (#124) only sees maj as a PARTIAL element-wise match against inv values',$q$
    SELECT (bool_and(q_a = 1) AND count(*) = 2)::text FROM distribution_match('permutations',
      '{"0":1,"1":3,"2":5,"3":6,"4":5,"5":3,"6":1}'::jsonb, 4)
    WHERE stat_id IN ('inversions','major_index') $q$),

  ('distribution_match','the Eulerian descents histogram is NOT a full match against the Mahonian target (different shape, some overlap)','eq','true','descents ranges 0..3 with row 1,11,11,1 — distinct from Mahonian 1,3,5,6,5,3,1, so any hit scores q_a<1',$q$
    SELECT (NOT EXISTS (SELECT 1 FROM distribution_match('permutations',
      '{"0":1,"1":3,"2":5,"3":6,"4":5,"5":3,"6":1}'::jsonb, 4) WHERE stat_id = 'descents' AND q_a = 1))::text $q$),

  ('distribution_match','a graded collection without n raises (a distribution is one fiber''s shape, not a range of them)','eq','true','n is required when the collection is graded',$q$
    SELECT base_raises($e$ SELECT * FROM distribution_match('permutations', '{"0":1}'::jsonb) $e$)::text $q$);
