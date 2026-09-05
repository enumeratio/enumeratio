-- requires: fiber_unrank_verify
-- permutations-plus half of sqlsrc/fiber_unrank_verify.sql (#283 phase 3 extraction) — one element_at==iterator
-- row per permutations-plus collection given a direct fiber_unrank; core keeps every non-pack row.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
('fiber_unrank','lehmer_codes: element_at == iterator','eq','true','direct unrank agrees with the floor',$q$ SELECT coalesce(bool_and((element_at(f, r)).value = (SELECT (e).value FROM elements(f, r+1) e ORDER BY e OFFSET r LIMIT 1)), true)::text FROM fibers(lehmer_codes(4)) f, generate_series(0, 8) r WHERE r < cardinality(f) $q$);
