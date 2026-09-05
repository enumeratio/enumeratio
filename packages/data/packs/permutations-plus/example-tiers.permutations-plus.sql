-- requires: boolean_permutations, example-tiers
-- The `boolean_permutations` slice of example-tiers.sql's slow-tagging (#283 phase 3 split) — same reasoning as
-- packs/refs/example-tiers.refs.sql's `find_stat` split and packs/number-sets/example-tiers.number-sets.sql's
-- `perfect_numbers`/`amicable_numbers` split: base_guard_pack forbids a core UPDATE on a pack-owned base_example
-- row once this pack is loaded.
UPDATE base_example SET slow = true WHERE
  suite = 'boolean_permutations' AND title LIKE 'count = F(n+1)%';   -- three stay in the default tier
