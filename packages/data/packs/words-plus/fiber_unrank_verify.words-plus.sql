-- requires-tag: collection
-- words-plus half of sqlsrc/fiber_unrank_verify.sql (#283 phase 3 extraction) — one row for this pack's own
-- indexable collection, split out because it calls the pack's own collection constructor directly (element_at
-- over fibers(gray_codes(...))), which doesn't exist loading core alone.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
('fiber_unrank','gray_codes: element_at == iterator','eq','true','direct unrank agrees with the floor',$q$ SELECT coalesce(bool_and((element_at(f, r)).value = (SELECT (e).value FROM elements(f, r+1) e ORDER BY e OFFSET r LIMIT 1)), true)::text FROM fibers(gray_codes(4)) f, generate_series(0, 8) r WHERE r < cardinality(f) $q$);
