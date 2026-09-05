-- requires: skew_partitions, integer_partitions, realizer, utilities
-- skew_partitions statistics + maps — per-element numerics (rows, columns, |λ|, |μ|, largest row) and the two
-- shape morphisms λ/μ ↦ λ and λ/μ ↦ μ into integer_partitions. All handle the empty element (coalesce to 0/∅).

-- ── statistics (carrier skew_partition: lam = λ, mu = μ; n = |λ|−|μ| cells) ───────────────────────────────
CREATE FUNCTION skew_partitions_num_rows(s skew_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((s).lam, 1), 0) $$;                              -- rows = length(λ) (every row non-empty)
CREATE FUNCTION skew_partitions_num_columns(s skew_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((s).lam[1], 0) $$;                                           -- λ non-increasing + column-reduced ⇒ #cols = λ_1
CREATE FUNCTION skew_partitions_outer_size(s skew_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(x) FROM unnest((s).lam) x), 0)::int $$;          -- |λ|
CREATE FUNCTION skew_partitions_inner_size(s skew_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(x) FROM unnest((s).mu) x), 0)::int $$;           -- |μ|
CREATE FUNCTION skew_partitions_largest_row(s skew_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max((s).lam[i] - coalesce((s).mu[i], 0))            -- longest row = max_i (λ_i − μ_i)
                   FROM generate_subscripts((s).lam, 1) i), 0)::int $$;

-- ── maps (λ/μ ↦ its outer / inner shape, as integer partitions) ──────────────────────────────────────────
CREATE FUNCTION skew_partitions_outer_shape(s skew_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(coalesce((s).lam, '{}'::int[]))::integer_partition $$;
CREATE FUNCTION skew_partitions_inner_shape(s skew_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(coalesce((s).mu, '{}'::int[]))::integer_partition $$;

-- ── register in base_stat (collection, stat_id, value_fn, title, codomain) ───────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('skew_partitions','num_rows','skew_partitions_num_rows','Number of rows','natural_numbers'),
  ('skew_partitions','num_columns','skew_partitions_num_columns','Number of columns','natural_numbers'),
  ('skew_partitions','outer_size','skew_partitions_outer_size','Size of the outer shape','natural_numbers'),
  ('skew_partitions','inner_size','skew_partitions_inner_size','Size of the inner shape','natural_numbers'),
  ('skew_partitions','largest_row','skew_partitions_largest_row','Largest number of cells in a row','natural_numbers');

-- ── register in base_map (collection, map_id, mapping_fn, codomain, title, findstat) ─────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('skew_partitions','outer_shape','skew_partitions_outer_shape','integer_partitions','Outer shape',NULL),
  ('skew_partitions','inner_shape','skew_partitions_inner_shape','integer_partitions','Inner shape',NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('skew_partitions','num_rows over skew_partitions(3) groups as 1,4,4 (by 1,2,3 rows)','eq','1,4,4','length(λ) distribution over the 9 shapes',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (
      SELECT skew_partitions_num_rows((e).value) v, count(*) c FROM elements(skew_partitions(3)) e GROUP BY 1) t(v,c) $q$),
  ('skew_partitions','num_columns is transpose-symmetric to rows: 1,4,4 over skew_partitions(3)','eq','1,4,4','λ_1 distribution mirrors the row distribution',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (
      SELECT skew_partitions_num_columns((e).value) v, count(*) c FROM elements(skew_partitions(3)) e GROUP BY 1) t(v,c) $q$),
  ('skew_partitions','3,1/1 has 2 rows, 3 columns, largest row 2 (λ_1−μ_1, not 3)','eq','2|3|2','spot check that μ is subtracted from the row',$q$
    SELECT skew_partitions_num_rows(ROW(ARRAY[3,1],ARRAY[1])::skew_partition)::text || '|' ||
           skew_partitions_num_columns(ROW(ARRAY[3,1],ARRAY[1])::skew_partition)::text || '|' ||
           skew_partitions_largest_row(ROW(ARRAY[3,1],ARRAY[1])::skew_partition)::text $q$),
  ('skew_partitions','Σ outer_size = 37, Σ inner_size = 10 over skew_partitions(3)','eq','37|10','|λ| and |μ| totals; every element has |λ|−|μ|=3 ⇒ 37−10 = 9·3',$q$
    SELECT sum(skew_partitions_outer_size((e).value))::text || '|' ||
           sum(skew_partitions_inner_size((e).value))::text FROM elements(skew_partitions(3)) e $q$),
  ('skew_partitions','largest_row over skew_partitions(3) groups as 4,4,1 (by 1,2,3 cells)','eq','4,4,1','max_i(λ_i−μ_i) distribution over the 9 shapes',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (
      SELECT skew_partitions_largest_row((e).value) v, count(*) c FROM elements(skew_partitions(3)) e GROUP BY 1) t(v,c) $q$),
  ('skew_partitions','outer_shape/inner_shape of the hook 2,1/1 are 2+1 and 1','eq','2+1|1','λ and μ recovered as integer partitions',$q$
    SELECT notation(skew_partitions_outer_shape(ROW(ARRAY[2,1],ARRAY[1])::skew_partition)) || '|' ||
           notation(skew_partitions_inner_shape(ROW(ARRAY[2,1],ARRAY[1])::skew_partition)) $q$),
  ('skew_partitions','a full (non-skew) shape has empty μ: inner_shape of 1,1/ prints as 0','eq','0','the empty inner partition',$q$
    SELECT notation(skew_partitions_inner_shape(ROW(ARRAY[1,1],ARRAY[]::int[])::skew_partition)) $q$),
  ('skew_partitions','outer shapes over skew_partitions(2) in rank order: 1+1,2,2+1','eq','1+1,2,2+1','λ of the column, the row, the hook (rendered in the codomain form)',$q$
    SELECT string_agg(render_value(skew_partitions_outer_shape((e).value)), ',' ORDER BY ordinality(e)) FROM elements(skew_partitions(2)) e $q$),
  ('skew_partitions','inner shapes over skew_partitions(2) in rank order: 0,0,1','eq','0,0,1','μ of the column, the row, the hook',$q$
    SELECT string_agg(render_value(skew_partitions_inner_shape((e).value)), ',' ORDER BY ordinality(e)) FROM elements(skew_partitions(2)) e $q$);