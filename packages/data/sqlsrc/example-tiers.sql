-- requires: bootstrap, search_sequence, policies
-- requires-tag: collection
-- Tier the heavy integration/oracle-class examples as `slow` so the DEFAULT gate (base_run_examples()) skips them.
-- These ~dozen examples are ~90% of total example runtime: full-catalog sweeps (search_sequence, find_stat) and
-- full enumerations (the Catalan thesis, perfect/amicable/boolean number searches). Flagging happens HERE, after
-- every example has loaded, so the source files stay untouched. The full tier still runs on demand — run.mts lifts
-- EXAMPLES=all into base_run_examples(include_slow => true), and that is what a pre-merge / CI run should use.
-- `find_stat` moved to packs/refs/example-tiers.refs.sql (#283 phase 2.2) — its pack owns the suite, so the tiering
-- row that names it lives there too.
UPDATE base_example SET slow = true WHERE
     suite IN ('search_sequence', 'thesis')            -- wholly integration-class suites
  OR (suite = 'perfect_numbers'      AND title LIKE 'first four%')  -- the one expensive divisor-sum search; the
  OR (suite = 'amicable_numbers'     AND title LIKE 'first six%')   --   cheap membership/anchor examples in these
  OR (suite = 'boolean_permutations' AND title LIKE 'count = F(n+1)%')   -- three stay in the default tier
  OR (suite = 'policies'             AND title LIKE 'case 7%');       -- the full restrict enumerate⇔predicate sweep
