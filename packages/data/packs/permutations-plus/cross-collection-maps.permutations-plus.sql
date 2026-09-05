-- requires: cross-collection-maps, lehmer_codes
-- permutations-plus half of sqlsrc/cross-collection-maps.sql (#283 phase 3 extraction) — the lehmer_codes
-- sibling bijection, split out because base_map.collection REFERENCES base_collection (the lehmer_codes-sourced
-- row would FK-fail loading core alone) and its examples call lehmer_codes() directly.

-- [permutations.to_lehmer_code <-> lehmer_codes.to_permutation]  the order-isomorphic sibling bijection.
-- Both functions (to_inversion / to_permutation) are defined and rank-verified in lehmer_codes.sql; here we
-- surface them as first-class maps in BOTH directions (one identity, two carriers).
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','to_lehmer_code','to_inversion','lehmer_codes','To Lehmer code',NULL),
  ('lehmer_codes','to_permutation','to_permutation','permutations','To permutation',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','to_lehmer_code: 321 ↦ 210, 231 ↦ 110 (rendered in the codomain form)','eq','210|110','permutation → its Lehmer code',$q$
    SELECT render_value(to_inversion(ROW(ARRAY[3,2,1])::permutation)) || '|' ||
           render_value(to_inversion(ROW(ARRAY[2,3,1])::permutation)) $q$),
  ('permutations','to_lehmer_code over permutations(3) matches the lehmer_codes(3) enumeration','eq','000,010,100,110,200,210','the order-iso: rank-for-rank image',$q$
    SELECT string_agg(render_value(to_inversion((e).value)), ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('lehmer_codes','to_permutation over lehmer_codes(3) recovers permutations(3) in rank order','eq','123,132,213,231,312,321','the inverse map, rank-for-rank',$q$
    SELECT string_agg(render_value(to_permutation((e).value)), ',' ORDER BY ordinality(e)) FROM elements(lehmer_codes(3)) e $q$),
  ('permutations','the sibling maps round-trip: to_permutation(to_lehmer_code(w)) = w over all of permutations(4)','eq','true','order-iso bijection, both directions',$q$
    SELECT bool_and(to_permutation(to_inversion((e).value)) = (e).value)::text FROM elements(permutations(4)) e $q$);
