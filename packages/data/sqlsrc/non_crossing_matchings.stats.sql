-- requires: non_crossing_matchings, perfect_matchings.stats, realizer
-- non_crossing_matchings statistics — NOT new registrations: this collection shares the perfect_matching carrier
-- with perfect_matchings, so base_stat_resolved (catalog-resolution.sql) already resolves every carrier-typed
-- perfect_matchings stat here automatically (own=false) — an explicit base_stat row would be a harmful
-- duplicate (see grand_dyck_paths.stats.sql for the invariant this would break). Examples only. The defining
-- restriction forces the inherited `crossings` stat to exactly 0 on every element — its range collapses from
-- 0..C(n,2)-ish on the unrestricted parent down to the single value 0 here.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_crossing_matchings','the perfect_matchings stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees crossings on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'non_crossing_matchings' AND stat_id = 'crossings' AND NOT own)::text $q$),
  ('non_crossing_matchings','nestings/short_pairs/widest_arc on (1,6)(2,3)(4,5) (n=3, one of the 5 non-crossing matchings)','eq','2|2|5','carrier-typed perfect_matchings_ stat fns run on a non_crossing_matchings element',$q$
    SELECT perfect_matchings_nestings(ROW(ARRAY[1,6,2,3,4,5])::perfect_matching)::text || '|' ||
           perfect_matchings_short_pairs(ROW(ARRAY[1,6,2,3,4,5])::perfect_matching)::text || '|' ||
           perfect_matchings_widest_arc(ROW(ARRAY[1,6,2,3,4,5])::perfect_matching)::text $q$),
  ('non_crossing_matchings','the inherited crossings stat is forced to 0 on every element — the defining restriction, not a coincidence','eq','true','sibling-specific range collapse: crossings ranges up on perfect_matchings but is identically 0 here',$q$
    SELECT bool_and(perfect_matchings_crossings((e).value) = 0)::text FROM generate_series(0,4) n, LATERAL elements(non_crossing_matchings(n)) e $q$);
