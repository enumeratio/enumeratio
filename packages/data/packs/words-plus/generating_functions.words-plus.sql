-- requires: generating_functions, binary_words.stats
-- words-plus half of sqlsrc/generating_functions.sql's binary_words differential examples (#283 phase 3
-- extraction) — the base_generating_function ROWS stay in core (collection='binary_words' is core, FK-safe), but
-- gf_agrees resolves the stat's value_fn from base_stat, and binary_words' number_of_ones/descents/number_of_runs
-- rows are words-plus's own (binary_words.stats.sql) — they don't exist loading core alone.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('generating_functions','(1+q)^n IS the Hamming-weight distribution on binary_words(n), n=0..6','eq','true','gf_pascal_row == live GROUP BY number_of_ones',$q$
    SELECT gf_agrees('binary_words','number_of_ones',6)::text $q$),
  ('generating_functions','the binary-word descents/runs generating functions reproduce their live distributions, n=0..6','eq','true','gf_binary_word_descents_row / gf_binary_word_runs == live GROUP BY',$q$
    SELECT bool_and(gf_agrees(c, s, 6))::text FROM (VALUES
      ('binary_words','descents'),('binary_words','number_of_runs')) v(c, s) $q$);
