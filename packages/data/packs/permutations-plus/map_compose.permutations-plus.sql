-- requires: map_compose, permutation_maps
-- permutations-plus half of sqlsrc/map_compose.sql (#283 phase 3 extraction) — the one example that needs
-- permutation_maps.sql's hand-rolled 'reverse_complement' base_map row to exist (the discoverability check that
-- [reverse,complement] is possibly_aliased against it), split out because map_compose.sql may not require a
-- pack file for load ordering.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('map_compose', 'the reverse_complement compound is flagged possibly_aliased — a different hand-authored map already covers permutations→permutations',
   'eq', 'true', 'discoverability catches the alias BEFORE a curator mints a duplicate',
   $q$ SELECT possibly_aliased FROM base_map_compound
       WHERE domain = 'permutations' AND codomain = 'permutations' AND map_path = ARRAY['reverse','complement'] $q$);
