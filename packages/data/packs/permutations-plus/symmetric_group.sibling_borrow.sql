-- requires: base_sibling_borrow, symmetric_group, cross-collection-maps.permutations-plus
-- #401 slice 2 — symmetric_group borrows permutations' `inversions` stat across its own sibling bijection
-- (symmetric_group.to_permutation, registered in cross-collection-maps.permutations-plus.sql). Split out of
-- symmetric_group.sql for the same FK reason lehmer_codes.sibling_borrow.sql is split from base_sibling_borrow.sql:
-- base_sibling_borrow.collection/from_collection REFERENCE base_collection, and symmetric_group is a pack
-- collection — this row would FK-fail loading core alone.
--
-- A nice self-consistency demo: by CONSTRUCTION, a symmetric_group element's rank was placed by its Coxeter
-- length (= inversions of its one-line word) — so the borrowed `inversions` stat should equal the rank's own
-- block, not just agree with permutations' stat after transport. The differentials below check both.
INSERT INTO base_sibling_borrow (collection, kind, id, from_collection, via_map) VALUES
  ('symmetric_group', 'stat', 'inversions', 'permutations', 'to_permutation');

-- ── examples — the differentials this slice exists to prove ────────────────────────────────────────────────────
-- Run only after base_pack_finalize('permutations-plus') has generated symmetric_group_inversions_borrowed_stat
-- (the pack tail, applied before any example executes — see sqlsrc-order.ts applyPackSegments).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sibling_borrow', 'the borrow row realizes into a symmetric_group base_stat named inversions', 'eq', 'true',
   'base_sibling_borrow -> base_stat, same id as the canonical',
   $q$ SELECT EXISTS (SELECT 1 FROM base_stat WHERE collection = 'symmetric_group' AND stat_id = 'inversions')::text $q$),
  ('sibling_borrow', 'symmetric_group.inversions (borrowed) = permutations.inversions∘to_permutation, over symmetric_group(5)',
   'eq', 'true', 'the mechanism''s whole point: the generated transport must equal the canonical stat composed '
   'through the bijection, elementwise — not just structurally present',
   $q$ SELECT bool_and(symmetric_group_inversions_borrowed_stat((e).value) = perm_inversions(to_permutation((e).value)))::text
       FROM elements(symmetric_group(5)) e $q$),
  ('sibling_borrow', 'self-consistency: the borrowed inversions stat equals the element''s own Coxeter length (its rank-defining block), over symmetric_group(5)',
   'eq', 'true', 'symmetric_group''s ranking IS by Coxeter length — the DP''s own accounting (via symmetric_group_coxeter_rank''s '
   'block-finding) must agree with the independently-borrowed stat value; recomputed directly from the DP''s inversions count',
   $q$ SELECT bool_and(symmetric_group_inversions_borrowed_stat((e).value) =
                        (SELECT sum(x) FROM unnest((to_inversion(to_permutation((e).value))).code) x))::text
       FROM elements(symmetric_group(5)) e $q$),
  ('sibling_borrow', 'spot check: (1 2 3) (a 3-cycle, ↦ 231 one-line) borrows inversions = 2', 'eq', '2',
   'one-line 231 has 2 inversions: (2,1) and (3,1)',
   $q$ SELECT symmetric_group_inversions_borrowed_stat(ROW(ARRAY[1,2,3])::permutation_cycles)::text $q$);
