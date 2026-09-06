-- requires: gelfand_tsetlin, realizer, utilities
-- gelfand_tsetlin statistics — natural invariants of a Gelfand-Tsetlin pattern (carrier gelfand_tsetlin_pattern,
-- the triangle flattened top row first). TOP-ROW SUM is the weight of the shape the pattern fills (the top row is
-- the longest, n entries); DISTINCT ENTRIES counts how many different values appear across the whole triangle.

-- ── statistics ─────────────────────────────────────────────────────────────────────────────────────────
-- top-row sum: the sum of the n entries in the top (longest) row. len = n(n+1)/2 recovers the row count n.
CREATE FUNCTION gt_top_row_sum(g gelfand_tsetlin_pattern) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE flat int[] := (g).rows; len int := coalesce(array_length(flat,1),0); n int;
  BEGIN
    n := floor((-1 + sqrt(1 + 8*len)) / 2)::int;
    RETURN coalesce((SELECT sum(flat[i]) FROM generate_series(1, n) i), 0)::int;
  END $$;
-- distinct entries: how many different integer values occur anywhere in the triangle.
CREATE FUNCTION gt_distinct_entries(g gelfand_tsetlin_pattern) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT v)::int FROM unnest((g).rows) v $$;

-- ── register in base_stat ──────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('gelfand_tsetlin','top_row_sum','gt_top_row_sum','Top-row sum','natural_numbers'),
  ('gelfand_tsetlin','distinct_entries','gt_distinct_entries','Number of distinct entries','natural_numbers');

-- ── examples ───────────────────────────────────────────────────────────────────────────────────────────
-- gelfand_tsetlin(2,1) in rank order: 0,0/0 ; 1,0/0 ; 1,0/1 ; 1,1/1
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gelfand_tsetlin','top-row sum over gelfand_tsetlin(2,1) in rank order is 0,1,1,2','eq','0,1,1,2','Σ of the top row per pattern',$q$
    SELECT string_agg(gt_top_row_sum((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gelfand_tsetlin(2,1)) e $q$),
  ('gelfand_tsetlin','distinct entries over gelfand_tsetlin(2,1) in rank order is 1,2,2,1','eq','1,2,2,1','#distinct values per pattern',$q$
    SELECT string_agg(gt_distinct_entries((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(gelfand_tsetlin(2,1)) e $q$),
  ('gelfand_tsetlin','top-row sum of 2,0,0/1,0/1 is 2','eq','2','top row (2,0,0) sums to 2',$q$
    SELECT gt_top_row_sum(ROW(ARRAY[2,0,0,1,0,1])::gelfand_tsetlin_pattern)::text $q$),
  ('gelfand_tsetlin','distinct entries of 2,0,0/1,0/1 is 3','eq','3','values {0,1,2} appear',$q$
    SELECT gt_distinct_entries(ROW(ARRAY[2,0,0,1,0,1])::gelfand_tsetlin_pattern)::text $q$);
