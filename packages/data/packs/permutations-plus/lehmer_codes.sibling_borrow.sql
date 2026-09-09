-- requires: base_sibling_borrow, lehmer_codes, cross-collection-maps.permutations-plus
-- #401 slice 1 — the concrete opt-in proof: lehmer_codes borrows permutations' `inversions` stat across the
-- existing order-iso sibling bijection (permutations.to_lehmer_code <-> lehmer_codes.to_permutation, #402).
-- Split out of base_sibling_borrow.sql (core) for the same reason cross-collection-maps.permutations-plus.sql is
-- split from cross-collection-maps.sql: base_sibling_borrow.collection/from_collection REFERENCE base_collection,
-- and lehmer_codes is a pack collection — this row would FK-fail loading core alone.
--
-- lehmer_codes already hand-authors an inversion-count stat under the name `sum` (lehmer_codes.stats.sql, Σcode).
-- This row borrows the SAME semantic value under permutations' OWN name, `inversions` — proving a sibling can pull
-- in a canonical stat_id verbatim, standing right next to (and checked against) its own differently-named native
-- stat. via_map = 'to_permutation', the map_id lehmer_codes.sql/cross-collection-maps registers FOR lehmer_codes
-- (mapping_fn to_permutation, codomain permutations) — the bijection base_realize_sibling_borrow transports through.
INSERT INTO base_sibling_borrow (collection, kind, id, from_collection, via_map) VALUES
  ('lehmer_codes', 'stat', 'inversions', 'permutations', 'to_permutation');

-- ── examples — the differential this slice exists to prove ────────────────────────────────────────────────────
-- Run only after base_pack_finalize('permutations-plus') has generated lehmer_codes_inversions_borrowed_stat (the
-- pack tail, applied before any example executes — see sqlsrc-order.ts applyPackSegments).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sibling_borrow', 'the borrow row realizes into a lehmer_codes base_stat named inversions', 'eq', 'true',
   'base_sibling_borrow -> base_stat, same id as the canonical',
   $q$ SELECT EXISTS (SELECT 1 FROM base_stat WHERE collection = 'lehmer_codes' AND stat_id = 'inversions')::text $q$),
  ('sibling_borrow', 'lehmer_codes.inversions (borrowed) = permutations.inversions∘to_permutation, over lehmer_codes(5)',
   'eq', 'true', 'the mechanism''s whole point: the generated transport must equal the canonical stat composed '
   'through the bijection, elementwise — not just structurally present',
   $q$ SELECT bool_and(lehmer_codes_inversions_borrowed_stat((e).value) = perm_inversions(to_permutation((e).value)))::text
       FROM elements(lehmer_codes(5)) e $q$),
  ('sibling_borrow', 'the borrowed stat also agrees with lehmer_codes'' own hand-authored sum, over lehmer_codes(5)',
   'eq', 'true', 'a second, independent witness — sum was hand-derived from the code array directly (Σcode), the '
   'borrowed stat was codegen''d through the bijection; both must land on the same Mahonian value',
   $q$ SELECT bool_and(lehmer_codes_inversions_borrowed_stat((e).value) = lehmer_sum((e).value))::text
       FROM elements(lehmer_codes(5)) e $q$),
  ('sibling_borrow', 'spot check: lehmer code of 321 (code {2,1}) borrows inversions = 3', 'eq', '3',
   'to_permutation({2,1}) = 321, which has 3 inversions',
   $q$ SELECT lehmer_codes_inversions_borrowed_stat(to_inversion(ROW(ARRAY[3,2,1])::permutation))::text $q$);
