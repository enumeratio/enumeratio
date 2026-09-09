-- requires: cross-collection-maps, lehmer_codes, symmetric_group
-- permutations-plus half of sqlsrc/cross-collection-maps.sql (#283 phase 3 extraction) — the lehmer_codes and
-- symmetric_group sibling bijections, split out because base_map.collection REFERENCES base_collection (the
-- pack-sourced rows would FK-fail loading core alone) and their examples call the pack collections directly.

-- [permutations.to_lehmer_code <-> lehmer_codes.to_permutation]  the order-isomorphic sibling bijection.
-- Both functions (to_inversion / to_permutation) are defined and rank-verified in lehmer_codes.sql; here we
-- surface them as first-class maps in BOTH directions (one identity, two carriers).
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, inverse, is_bijection, is_order_iso) VALUES
  ('permutations','to_lehmer_code','to_inversion','lehmer_codes','To Lehmer code',NULL,'to_permutation',true,true),
  ('lehmer_codes','to_permutation','to_permutation','permutations','To permutation',NULL,'to_lehmer_code',true,true);

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

-- [permutations.to_cycle_notation <-> symmetric_group.to_permutation]  the sibling bijection (#401 slice 2).
-- UNLIKE the lehmer_codes pair above, this one is NOT order-iso: symmetric_group orders by Coxeter length, while
-- permutations is plain lex — same underlying n! set, different order, so is_order_iso is explicitly false. Both
-- functions (to_cycles / to_permutation) are defined in symmetric_group.sql; surfaced here as first-class maps.
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, inverse, is_bijection, is_order_iso) VALUES
  ('permutations','to_cycle_notation','to_cycles','symmetric_group','To cycle notation',NULL,'to_permutation',true,false),
  ('symmetric_group','to_permutation','to_permutation','permutations','To one-line notation',NULL,'to_cycle_notation',true,false);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','to_cycle_notation: 321 ↦ (1 3)(2), 231 ↦ (1 2 3) (rendered in the codomain form)','eq','(1 3)(2)|(1 2 3)','permutation → its cycle notation',$q$
    SELECT render_value(to_cycles(ROW(ARRAY[3,2,1])::permutation)) || '|' ||
           render_value(to_cycles(ROW(ARRAY[2,3,1])::permutation)) $q$),
  ('permutations','the sibling maps round-trip: to_permutation(to_cycle_notation(w)) = w over all of permutations(5)','eq','true','bijection, both directions',$q$
    SELECT bool_and(to_permutation(to_cycles((e).value)) = (e).value)::text FROM elements(permutations(5)) e $q$),
  ('symmetric_group','and back: to_cycles(to_permutation(v)) = v over all of symmetric_group(5)','eq','true','bijection, both directions',$q$
    SELECT bool_and(to_cycles(to_permutation((e).value)) = (e).value)::text FROM elements(symmetric_group(5)) e $q$),
  ('symmetric_group','NOT order-iso: the r-th symmetric_group element does NOT generally map to the r-th permutation (n=4, some r differ)','eq','true',
   'the design-defining difference from lehmer_codes — at least one rank must disagree, since the orders differ',$q$
    SELECT bool_or(to_permutation((unrank(symmetric_group(4), r)).value) <> (unrank(permutations(4), r)).value)::text
    FROM generate_series(0, 23) r $q$),
  ('permutations','base_map declares the pair as bijective but explicitly NOT order-iso (orders differ — Coxeter length vs lex)','eq','true','is_bijection AND NOT is_order_iso, both directions',$q$
    SELECT bool_and(is_bijection AND NOT is_order_iso)::text FROM base_map
     WHERE (collection,map_id) IN (('permutations','to_cycle_notation'),('symmetric_group','to_permutation')) $q$);
