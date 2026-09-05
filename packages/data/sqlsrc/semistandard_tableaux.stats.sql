-- requires: semistandard_tableaux, realizer, utilities
-- semistandard_tableaux — statistics + a shape map. The carrier is (entries int[] row-major, shape int[] = row lengths),
-- so most stats read straight off those two arrays. shape is already a partition (non-increasing row lengths).

-- ── statistics ─────────────────────────────────────────────────────────────────────────────────────────
-- number of rows = number of parts of the shape.
CREATE FUNCTION ssyt_num_rows(x semistandard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((x).shape,1), 0) $$;
-- number of columns = the longest row = the first (largest) part of the shape.
CREATE FUNCTION ssyt_num_columns(x semistandard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((x).shape[1], 0) $$;
-- largest entry actually used.
CREATE FUNCTION ssyt_max_entry(x semistandard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(v) FROM unnest((x).entries) v), 0)::int $$;
-- sum of all entries (the weighted content).
CREATE FUNCTION ssyt_entry_sum(x semistandard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(v) FROM unnest((x).entries) v), 0)::int $$;
-- number of distinct entries = support size of the weight (how many of {1..k} appear).
CREATE FUNCTION ssyt_distinct_entries(x semistandard_tableau) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT v)::int FROM unnest((x).entries) v $$;

-- ── map ────────────────────────────────────────────────────────────────────────────────────────────────
-- shape: the underlying partition (row lengths), as an integer_partition. Already non-increasing by construction.
CREATE FUNCTION ssyt_shape(x semistandard_tableau) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(coalesce((x).shape, '{}'))::integer_partition $$;

-- ── register ───────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('semistandard_tableaux','rows','ssyt_num_rows','Number of rows','natural_numbers'),
  ('semistandard_tableaux','columns','ssyt_num_columns','Number of columns','natural_numbers'),
  ('semistandard_tableaux','max_entry','ssyt_max_entry','Maximal entry','natural_numbers'),
  ('semistandard_tableaux','entry_sum','ssyt_entry_sum','Sum of entries','natural_numbers'),
  ('semistandard_tableaux','distinct_entries','ssyt_distinct_entries','Number of distinct entries','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('semistandard_tableaux','shape','ssyt_shape','integer_partitions','Shape',NULL);

-- ── examples ───────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semistandard_tableaux','stats on 1,1/2: rows 2, cols 2, max 2, sum 4, distinct 2','eq','2|2|2|4|2','entries [1,1,2] shape [2,1]',$q$
    SELECT ssyt_num_rows(ROW(ARRAY[1,1,2],ARRAY[2,1])::semistandard_tableau)::text || '|' ||
           ssyt_num_columns(ROW(ARRAY[1,1,2],ARRAY[2,1])::semistandard_tableau)::text || '|' ||
           ssyt_max_entry(ROW(ARRAY[1,1,2],ARRAY[2,1])::semistandard_tableau)::text || '|' ||
           ssyt_entry_sum(ROW(ARRAY[1,1,2],ARRAY[2,1])::semistandard_tableau)::text || '|' ||
           ssyt_distinct_entries(ROW(ARRAY[1,1,2],ARRAY[2,1])::semistandard_tableau)::text $q$),
  ('semistandard_tableaux','rows over ssyt(3,2): 4 one-row, 2 two-row','eq','4,2','single row = multisets C(4,3)=4; rest are the two 2,1-shapes',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT ssyt_num_rows((e).value) v, count(*) c FROM elements(semistandard_tableaux(3,2)) e GROUP BY 1) t(v,c) $q$),
  ('semistandard_tableaux','columns over ssyt(3,2): 2 with 2 cols, 4 with 3 cols','eq','2,4','shape [2,1] twice, shape [3] four times',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT ssyt_num_columns((e).value) v, count(*) c FROM elements(semistandard_tableaux(3,2)) e GROUP BY 1) t(v,c) $q$),
  ('semistandard_tableaux','max_entry over ssyt(3,2): 1,5','eq','1,5','exactly-max-1 = |ssyt(3,1)|=1; exactly-max-2 = 6-1=5',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT ssyt_max_entry((e).value) v, count(*) c FROM elements(semistandard_tableaux(3,2)) e GROUP BY 1) t(v,c) $q$),
  ('semistandard_tableaux','entry_sum over ssyt(3,2): distribution 1,2,2,1 (sums 3..6)','eq','1,2,2,1','sums 3,4,4,5,5,6 across the 6 fillings',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT ssyt_entry_sum((e).value) v, count(*) c FROM elements(semistandard_tableaux(3,2)) e GROUP BY 1) t(v,c) $q$),
  ('semistandard_tableaux','distinct_entries over ssyt(3,2): 2 constant, 4 use both','eq','2,4','all-1s and all-2s use 1 value; the other 4 use both',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT ssyt_distinct_entries((e).value) v, count(*) c FROM elements(semistandard_tableaux(3,2)) e GROUP BY 1) t(v,c) $q$),
  ('semistandard_tableaux','shape map: 1,1/2 → 2+1, 2,2,2 → 3','eq','2+1|3','shape as an integer_partition',$q$
    SELECT notation(ssyt_shape(ROW(ARRAY[1,1,2],ARRAY[2,1])::semistandard_tableau)) || '|' ||
           notation(ssyt_shape(ROW(ARRAY[2,2,2],ARRAY[3])::semistandard_tableau)) $q$),
  ('semistandard_tableaux','shape over ssyt(3,2) in rank order (renders in the codomain)','eq','2+1,2+1,3,3,3,3','the two 2,1-shapes then four one-row shapes',$q$
    SELECT string_agg(render_value(ssyt_shape((e).value)), ',' ORDER BY ordinality(e)) FROM elements(semistandard_tableaux(3,2)) e $q$);