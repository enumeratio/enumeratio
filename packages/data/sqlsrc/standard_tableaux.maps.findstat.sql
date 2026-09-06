-- requires: standard_tableaux, standard_tableaux.reading_word, standard_tableaux.evacuation, permutations, references, realizer, utilities
-- standard_tableaux — FindStat sweep wave 3 (issue #326), MAPS. Two more already-implemented SYT maps get their
-- FindStat Mp-numbers (shape/transpose/promotion already carry ids from #224), confirmed against findstat.org's Mp
-- pages (definition + images). Carrier row_word[i] = the row (0-based) holding entry i+1, so [0,1,0] = [[1,3],[2]].
-- Images are compared as the raw row_word (SYT codomain) / one_line (permutation codomain).
--
-- CONFIRMED (definition + images match ours):
--   reading_word  Mp00081  "reading word permutation" (SYT → permutations)   [[1,3],[2]] ↦ [2,1,3]
--   evacuation    Mp00085  "Schützenberger involution" (SYT → SYT)           [[1,3],[2]] ↦ [[1,2],[3]]
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('map','standard_tableaux.reading_word','findstat','Mp00081','https://www.findstat.org/Mp00081',''),
  ('map','standard_tableaux.evacuation',  'findstat','Mp00085','https://www.findstat.org/Mp00085','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','reading_word (Mp00081): [[1,3],[2]]↦213, [[1,2],[3]]↦312, [[1],[2],[3]]↦321','eq','213|312|321','findstat.org Mp00081 images',$q$
    SELECT one_line(standard_tableau_reading_word(ROW(ARRAY[0,1,0])::standard_tableau)) || '|' ||
           one_line(standard_tableau_reading_word(ROW(ARRAY[0,0,1])::standard_tableau)) || '|' ||
           one_line(standard_tableau_reading_word(ROW(ARRAY[0,1,2])::standard_tableau)) $q$),
  ('standard_tableaux','evacuation (Mp00085): [[1,3],[2]]↦[[1,2],[3]], and back (an involution)','eq','{0,0,1}|{0,1,0}','findstat.org Mp00085 images, as the image row_word',$q$
    SELECT (standard_tableau_evacuation(ROW(ARRAY[0,1,0])::standard_tableau)).row_word::text || '|' ||
           (standard_tableau_evacuation(ROW(ARRAY[0,0,1])::standard_tableau)).row_word::text $q$),
  ('references','the two new standard_tableaux-map findstat refs resolve and back real base_map rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 2 AND array_agg(r.subject) @> ARRAY['standard_tableaux.reading_word','standard_tableaux.evacuation'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='map' AND r.subject IN
      ('standard_tableaux.reading_word','standard_tableaux.evacuation')
      AND EXISTS (SELECT 1 FROM base_map m WHERE m.collection='standard_tableaux' AND m.map_id = split_part(r.subject,'.',2)) $q$);
