-- requires: permutations, permutations.stats, maps, permutation_maps, references, realizer, utilities
-- permutations — FindStat sweep wave 3 (issue #326), MAPS. Cross-references for four already-implemented
-- permutation maps, each confirmed against findstat.org's own Mp page (definition + images table). Seeded as
-- base_reference rows directly (subject_kind='map'), same pattern as #224's kreweras_complement: the base_map
-- findstat auto-backfill (findstat-refs.maps.sql) loads too early in the topo order to catch a code set here, so
-- this file seeds base_reference itself. The image-examples compute OUR mapping_fn on FindStat's own objects and
-- assert FindStat's published images, so the gate re-verifies every mapping.
--
-- CONFIRMED (definition + images match ours):
--   reverse     Mp00064  "reverse" — w ↦ w reversed  (Mp00064: [1,2,3] ↦ [3,2,1])
--   inverse     Mp00066  "inverse" — w ↦ w⁻¹          (Mp00066: [2,3,1] ↦ [3,1,2])
--   complement  Mp00069  "complement" — w(i) ↦ n+1−w(i) (Mp00069: [1,3,2] ↦ [3,1,2])
--   foata       Mp00067  "Foata bijection" (maj ↦ inv)  (Mp00067: [1,3,2] ↦ [3,1,2])
-- (cycle_type Mp00108 and kreweras_complement Mp00088 already carry ids.)
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('map','permutations.reverse',    'findstat','Mp00064','https://www.findstat.org/Mp00064',''),
  ('map','permutations.inverse',    'findstat','Mp00066','https://www.findstat.org/Mp00066',''),
  ('map','permutations.complement', 'findstat','Mp00069','https://www.findstat.org/Mp00069',''),
  ('map','permutations.foata',      'findstat','Mp00067','https://www.findstat.org/Mp00067','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','reverse (Mp00064): 123↦321, 231↦132','eq','321|132','findstat.org Mp00064 images',$q$
    SELECT one_line(perm_reverse(ROW(ARRAY[1,2,3])::permutation)) || '|' ||
           one_line(perm_reverse(ROW(ARRAY[2,3,1])::permutation)) $q$),
  ('permutations','inverse (Mp00066): 231↦312, 312↦231','eq','312|231','findstat.org Mp00066 images',$q$
    SELECT one_line(perm_inverse(ROW(ARRAY[2,3,1])::permutation)) || '|' ||
           one_line(perm_inverse(ROW(ARRAY[3,1,2])::permutation)) $q$),
  ('permutations','complement (Mp00069): 132↦312, 231↦213','eq','312|213','findstat.org Mp00069 images',$q$
    SELECT one_line(perm_complement(ROW(ARRAY[1,3,2])::permutation)) || '|' ||
           one_line(perm_complement(ROW(ARRAY[2,3,1])::permutation)) $q$),
  ('permutations','foata (Mp00067): 132↦312, 312↦132','eq','312|132','findstat.org Mp00067 images',$q$
    SELECT one_line(perm_foata(ROW(ARRAY[1,3,2])::permutation)) || '|' ||
           one_line(perm_foata(ROW(ARRAY[3,1,2])::permutation)) $q$),
  ('references','the four new permutation-map findstat refs resolve and back real base_map rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 4 AND array_agg(r.subject) @> ARRAY['permutations.reverse','permutations.inverse','permutations.complement','permutations.foata'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='map' AND r.subject IN
      ('permutations.reverse','permutations.inverse','permutations.complement','permutations.foata')
      AND EXISTS (SELECT 1 FROM base_map m WHERE m.collection='permutations' AND m.map_id = split_part(r.subject,'.',2)) $q$);
