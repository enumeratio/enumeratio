-- requires: perfect_numbers, amicable_numbers, search_sequence.number-sets
-- The `perfect_numbers`/`amicable_numbers` slice of example-tiers.sql's slow-tagging (#283 phase 3 split) —
-- same reasoning as packs/refs/example-tiers.refs.sql's `find_stat` split: the expensive divisor-sum searches
-- are owned by this pack, so the tiering row that names them lives here rather than a core UPDATE reaching
-- into a number-sets-owned base_example row (base_guard_pack forbids it). Also picks up this pack's own
-- search_sequence.number-sets.sql example: core's blanket `suite IN ('search_sequence', …)` UPDATE ran before
-- this pack's row existed, so it needs its own slow tag here, self-owned.
UPDATE base_example SET slow = true WHERE
     (suite = 'perfect_numbers'  AND title LIKE 'first four%')  -- the one expensive divisor-sum search
  OR (suite = 'perfect_numbers'  AND title LIKE 'unrank(2)%')    -- 6.7s: same divisor-sum search, reached through unrank
  OR (suite = 'amicable_numbers' AND title LIKE 'first six%')   -- ditto — cheap membership/anchor examples stay default-tier
  OR (suite = 'search_sequence' AND title LIKE 'a mid-sequence paste%');  -- this pack's search_sequence.number-sets.sql row
