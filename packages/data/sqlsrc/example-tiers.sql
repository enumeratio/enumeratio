-- requires: bootstrap, search_sequence, policies
-- requires-tag: collection
-- Tier the heavy integration/oracle-class examples as `slow` so the DEFAULT gate (base_run_examples()) skips them.
-- These ~dozen examples are ~90% of total example runtime: full-catalog sweeps (search_sequence, find_stat) and
-- full enumerations (the Catalan thesis, perfect/amicable/boolean number searches). Flagging happens HERE, after
-- every example has loaded, so the source files stay untouched. The full tier still runs on demand — run.mts lifts
-- EXAMPLES=all into base_run_examples(include_slow => true), and that is what a pre-merge / CI run should use.
-- `find_stat` moved to packs/refs/example-tiers.refs.sql (#283 phase 2.2) — its pack owns the suite, so the tiering
-- row that names it lives there too. `perfect_numbers`/`amicable_numbers` moved the same way to
-- packs/number-sets/example-tiers.number-sets.sql (#283 phase 3). `boolean_permutations` moved to
-- packs/permutations-plus/example-tiers.permutations-plus.sql (#283 phase 3), same reason — base_guard_pack
-- forbids core UPDATEing a pack-owned base_example row once that pack is loaded.
UPDATE base_example SET slow = true WHERE
     suite IN ('search_sequence', 'thesis')            -- wholly integration-class suites
  OR (suite = 'policies'             AND title LIKE 'case 7%')        -- the full restrict enumerate⇔predicate sweep
  OR (suite = 'species'              AND title LIKE 'MARQUEE (full degree 8)%')   -- the deg-8 plethysm cert (~160s); the deg-6 twin stays in the default tier
  -- #274's own catalog sweeps, measured after it landed: these five were 61 of the fast tier's 107 SECONDS —
  -- the two species ones alone were 48% of the whole example run. Same criterion as everything above: each is a
  -- sweep over EVERY collection (or every corpus entry), not a check of one identity, so they belong in the tier
  -- a pre-merge/CI run turns on rather than the one a dev runs per edit. The per-identity species examples
  -- (isotype(E∘E+), Euler transform, labelled(E∘C), …) deliberately STAY default-tier — they are what actually
  -- certifies the feature, and they are ~1-3s each.
  OR (suite = 'species'  AND title LIKE 'MARQUEE: the Z-walker%')                  -- 27s: the whole labelled corpus
  OR (suite = 'species'  AND title LIKE 'EVERY collection''s species reading%')    -- 26s: every collection × n=0..6
  OR (suite = 'policies' AND title LIKE 'the resolved sweep is total%')            --  3s: every collection × environment
  OR (suite = 'policies' AND title LIKE 'case 1b:%');                              --  3s: ditto
