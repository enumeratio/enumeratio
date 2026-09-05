-- requires: dyck_paths_by_height, dyck_paths.stats2, statistics, realizer, utilities
-- dyck_paths_by_height statistics — NOT new registrations: this collection is a strict RESTRICTION of dyck_paths
-- (same positivity constraint, just filtered to a fixed max height), so every dyck_paths stat already resolves
-- here via base_stat_resolved's carrier inheritance (catalog-resolution.sql) — an explicit base_stat row would
-- be a harmful duplicate. Examples only: a few cross-checks against the shared underlying functions.

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths_by_height','the dyck_paths stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees area on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'dyck_paths_by_height' AND stat_id = 'area' AND NOT own)::text $q$),
  ('dyck_paths_by_height','fiber [4,4] is the single path UUUUDDDD: area = 0+1+2+3 = 6 (max area at max height)','eq','6','the unique height-4 semilength-4 path',$q$
    SELECT dyck_area((unrank(dyck_paths_by_height(4,4), 0)).value)::text $q$),
  ('dyck_paths_by_height','peaks distribution over the [4,2] fiber (7 paths) matches the same elements read as dyck_paths(4)','eq','true','a restriction of dyck_paths(4) filtered by height=2, same stat function',$q$
    SELECT (
      (SELECT string_agg(dyck_peaks((e).value)::text, ',' ORDER BY notation((e).value)) FROM elements(dyck_paths_by_height(4,2)) e)
      = (SELECT string_agg(dyck_peaks((e).value)::text, ',' ORDER BY notation((e).value)) FROM elements(dyck_paths(4)) e WHERE dyck_height((e).value) = 2)
    )::text $q$),
  ('dyck_paths_by_height','bounce and dinv on the [4,4] path (UUUUDDDD): both 0 (the single-arch path minimizes each)','eq','0|0','max-height path is the pure staircase shape',$q$
    SELECT dyck_bounce((unrank(dyck_paths_by_height(4,4), 0)).value)::text || '|' ||
           dyck_dinv((unrank(dyck_paths_by_height(4,4), 0)).value)::text $q$),
  ('dyck_paths_by_height','area distribution over the whole [4,2] fiber sums to 12','eq','12','Σ area over the 7 height-exactly-2 paths of semilength 4',$q$
    SELECT sum(dyck_area((e).value))::text FROM elements(dyck_paths_by_height(4,2)) e $q$);
