-- requires: ascent_sequences, realizer, utilities
-- ascent_sequences statistics — classic invariants over ascent_sequence(terms int[]): the defining ascent count
-- itself, plus the usual entry-shape stats (max/last entry, zero count, distinct-value counts, repeats). x_1 = 0
-- always holds on a nonempty sequence, so distinct_nonzero_values = distinct_values - 1 whenever n >= 1.

-- ── statistics (carrier: ascent_sequence(terms int[])) ──────────────────────────────────────────────────
-- ascents: #{ i : x_i < x_{i+1} } — the quantity the floor bounds the next term by (the defining statistic).
CREATE FUNCTION as_ascents(s ascent_sequence) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((s).terms,1) i
   WHERE i < array_length((s).terms,1) AND (s).terms[i] < (s).terms[i+1] $$;
-- max entry: the largest term (0 on the empty sequence).
CREATE FUNCTION as_max_entry(s ascent_sequence) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(t) FROM unnest((s).terms) t), 0)::int $$;
-- zeros: #{ i : x_i = 0 } (always >= 1 on a nonempty sequence, since x_1 = 0).
CREATE FUNCTION as_zeros(s ascent_sequence) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM unnest((s).terms) t WHERE t = 0), 0)::int $$;
-- distinct values: the size of the value set used (including 0).
CREATE FUNCTION as_distinct_values(s ascent_sequence) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(DISTINCT t) FROM unnest((s).terms) t), 0)::int $$;
-- last entry: x_n (0 on the empty sequence).
CREATE FUNCTION as_last_entry(s ascent_sequence) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((s).terms[array_length((s).terms,1)], 0)::int $$;
-- distinct nonzero values: the size of the value set excluding 0.
CREATE FUNCTION as_distinct_nonzero_values(s ascent_sequence) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(DISTINCT t) FROM unnest((s).terms) t WHERE t <> 0), 0)::int $$;
-- repeats: n - distinct_values (how many terms are repeats of an already-seen value).
CREATE FUNCTION as_repeats(s ascent_sequence) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((s).terms,1), 0) - as_distinct_values(s) $$;

-- ── register in base_stat (collection, stat_id, value_fn, title, codomain) ──────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('ascent_sequences','ascents','as_ascents','Ascents','natural_numbers'),
  ('ascent_sequences','max_entry','as_max_entry','Maximum entry','natural_numbers'),
  ('ascent_sequences','zeros','as_zeros','Number of zeros','natural_numbers'),
  ('ascent_sequences','distinct_values','as_distinct_values','Number of distinct values','natural_numbers'),
  ('ascent_sequences','last_entry','as_last_entry','Last entry','natural_numbers'),
  ('ascent_sequences','distinct_nonzero_values','as_distinct_nonzero_values','Number of distinct nonzero values','natural_numbers'),
  ('ascent_sequences','repeats','as_repeats','Repeats','natural_numbers');

-- ── examples (expected values hand-verified against the n=3/n=4 listings in ascent_sequences.sql) ────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ascent_sequences','spot check on 0,1,2,3: ascents 3, max 3, zeros 1, distinct 4, last 3, distinct-nonzero 3, repeats 0','eq','3|3|1|4|3|3|0','all seven stats on the max-ascent n=4 sequence',$q$
    SELECT as_ascents(ROW(ARRAY[0,1,2,3])::ascent_sequence)::text || '|' ||
           as_max_entry(ROW(ARRAY[0,1,2,3])::ascent_sequence)::text || '|' ||
           as_zeros(ROW(ARRAY[0,1,2,3])::ascent_sequence)::text || '|' ||
           as_distinct_values(ROW(ARRAY[0,1,2,3])::ascent_sequence)::text || '|' ||
           as_last_entry(ROW(ARRAY[0,1,2,3])::ascent_sequence)::text || '|' ||
           as_distinct_nonzero_values(ROW(ARRAY[0,1,2,3])::ascent_sequence)::text || '|' ||
           as_repeats(ROW(ARRAY[0,1,2,3])::ascent_sequence)::text $q$),
  ('ascent_sequences','spot check on 0,1,0,2: ascents 2, max 2, zeros 2, distinct 3, last 2, distinct-nonzero 2, repeats 1','eq','2|2|2|3|2|2|1','all seven stats on a non-monotone n=4 sequence',$q$
    SELECT as_ascents(ROW(ARRAY[0,1,0,2])::ascent_sequence)::text || '|' ||
           as_max_entry(ROW(ARRAY[0,1,0,2])::ascent_sequence)::text || '|' ||
           as_zeros(ROW(ARRAY[0,1,0,2])::ascent_sequence)::text || '|' ||
           as_distinct_values(ROW(ARRAY[0,1,0,2])::ascent_sequence)::text || '|' ||
           as_last_entry(ROW(ARRAY[0,1,0,2])::ascent_sequence)::text || '|' ||
           as_distinct_nonzero_values(ROW(ARRAY[0,1,0,2])::ascent_sequence)::text || '|' ||
           as_repeats(ROW(ARRAY[0,1,0,2])::ascent_sequence)::text $q$),
  ('ascent_sequences','n=0 (empty sequence): every stat is 0','eq','0|0|0|0|0|0|0','edge case, no terms',$q$
    SELECT as_ascents((unrank(ascent_sequences(0),0)).value)::text || '|' ||
           as_max_entry((unrank(ascent_sequences(0),0)).value)::text || '|' ||
           as_zeros((unrank(ascent_sequences(0),0)).value)::text || '|' ||
           as_distinct_values((unrank(ascent_sequences(0),0)).value)::text || '|' ||
           as_last_entry((unrank(ascent_sequences(0),0)).value)::text || '|' ||
           as_distinct_nonzero_values((unrank(ascent_sequences(0),0)).value)::text || '|' ||
           as_repeats((unrank(ascent_sequences(0),0)).value)::text $q$),
  ('ascent_sequences','ascents distribution over ascent_sequences(4) is 1,6,7,1','eq','1,6,7,1','#sequences with 0,1,2,3 ascents',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT as_ascents((e).value) k, count(*) c FROM elements(ascent_sequences(4)) e GROUP BY 1) t(k,c) $q$),
  ('ascent_sequences','max entry distribution over ascent_sequences(4) is 1,7,6,1','eq','1,7,6,1','#sequences with max entry 0,1,2,3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT as_max_entry((e).value) k, count(*) c FROM elements(ascent_sequences(4)) e GROUP BY 1) t(k,c) $q$),
  ('ascent_sequences','zeros distribution over ascent_sequences(4) is 5,6,3,1','eq','5,6,3,1','#sequences with 1,2,3,4 zeros',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT as_zeros((e).value) k, count(*) c FROM elements(ascent_sequences(4)) e GROUP BY 1) t(k,c) $q$),
  ('ascent_sequences','distinct values distribution over ascent_sequences(4) is 1,7,6,1','eq','1,7,6,1','#sequences with 1,2,3,4 distinct values',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT as_distinct_values((e).value) k, count(*) c FROM elements(ascent_sequences(4)) e GROUP BY 1) t(k,c) $q$),
  ('ascent_sequences','last entry distribution over ascent_sequences(4) is 5,5,4,1','eq','5,5,4,1','#sequences ending in 0,1,2,3',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT as_last_entry((e).value) k, count(*) c FROM elements(ascent_sequences(4)) e GROUP BY 1) t(k,c) $q$),
  ('ascent_sequences','repeats distribution over ascent_sequences(4) is 1,6,7,1','eq','1,6,7,1','#sequences with 0,1,2,3 repeats',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT as_repeats((e).value) k, count(*) c FROM elements(ascent_sequences(4)) e GROUP BY 1) t(k,c) $q$),
  ('ascent_sequences','ascents over ascent_sequences(3) in rank order: 0,1,1,1,2','eq','0,1,1,1,2','all five length-3 sequences, lex order',$q$
    SELECT string_agg(as_ascents((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ascent_sequences(3)) e $q$),
  ('ascent_sequences','zeros over ascent_sequences(4) in rank order','eq','4,3,3,2,2,3,2,2,2,1,1,2,1,1,1','all fifteen length-4 sequences, lex order',$q$
    SELECT string_agg(as_zeros((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ascent_sequences(4)) e $q$),
  ('ascent_sequences','structural invariant: distinct_nonzero_values = distinct_values - 1 over ascent_sequences(4)','eq','true','x_1 = 0 always holds, so 0 is always in the value set',$q$
    SELECT bool_and(as_distinct_nonzero_values((e).value) = as_distinct_values((e).value) - 1)::text
      FROM elements(ascent_sequences(4)) e $q$);
