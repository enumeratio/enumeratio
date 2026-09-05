-- requires: non_nesting_matchings, perfect_matchings.stats, realizer
-- non_nesting_matchings statistics — NOT new registrations: this collection shares the perfect_matching carrier
-- with perfect_matchings, so base_stat_resolved (catalog-resolution.sql) already resolves every carrier-typed
-- perfect_matchings stat here automatically (own=false) — an explicit base_stat row would be a harmful
-- duplicate (see grand_dyck_paths.stats.sql for the invariant this would break). Examples only. The defining
-- restriction forces the inherited `nestings` stat to exactly 0 on every element — the crossing-dual of the
-- range collapse on non_crossing_matchings.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_nesting_matchings','the perfect_matchings stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees nestings on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'non_nesting_matchings' AND stat_id = 'nestings' AND NOT own)::text $q$),
  ('non_nesting_matchings','crossings/short_pairs/widest_arc on (1,3)(2,4) (n=2, the crossing survivor)','eq','1|0|2','carrier-typed perfect_matchings_ stat fns run on a non_nesting_matchings element',$q$
    SELECT perfect_matchings_crossings(ROW(ARRAY[1,3,2,4])::perfect_matching)::text || '|' ||
           perfect_matchings_short_pairs(ROW(ARRAY[1,3,2,4])::perfect_matching)::text || '|' ||
           perfect_matchings_widest_arc(ROW(ARRAY[1,3,2,4])::perfect_matching)::text $q$),
  ('non_nesting_matchings','the inherited nestings stat is forced to 0 on every element — the defining restriction, not a coincidence','eq','true','sibling-specific range collapse: nestings ranges up on perfect_matchings but is identically 0 here',$q$
    SELECT bool_and(perfect_matchings_nestings((e).value) = 0)::text FROM generate_series(0,4) n, LATERAL elements(non_nesting_matchings(n)) e $q$);
