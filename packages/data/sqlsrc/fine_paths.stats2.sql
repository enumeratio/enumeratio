-- requires: fine_paths, dyck_paths.stats2, realizer, utilities
-- fine_paths statistics — NOT new registrations: fine_paths shares the dyck_path carrier with dyck_paths, and
-- base_stat_resolved (catalog-resolution.sql) already resolves every carrier-typed dyck_paths stat here
-- automatically (own=false) — an explicit base_stat row would be a harmful duplicate (see the header comment
-- in grand_dyck_paths.stats.sql for the invariant this would break). Examples only. fine_paths further
-- restricts dyck_paths by excluding any path with a hill (a UD factor at height 0) — so the inherited `hills`
-- stat is not just well-defined here, its RANGE collapses to exactly 0 for every element, unlike on the
-- unrestricted parent where hills ranges over 0..n.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fine_paths','the dyck_paths stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees peaks on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'fine_paths' AND stat_id = 'peaks' AND NOT own)::text $q$),
  ('fine_paths','area/height/peaks on UUDUDD (n=3, the smaller of the two n=3 survivors)','eq','2|2|2','carrier-typed dyck_ stat fns run on a fine_paths element',$q$
    SELECT dyck_area(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_height(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_peaks(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)::text $q$),
  ('fine_paths','the inherited hills stat is forced to 0 on every fine_paths element — the defining restriction, not a coincidence','eq','true','sibling-specific range collapse: hills ranges 0..n on dyck_paths but is identically 0 here',$q$
    SELECT bool_and(dyck_hills((e).value) = 0)::text FROM generate_series(0,6) n, LATERAL elements(fine_paths(n)) e $q$);
