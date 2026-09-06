-- requires: semistandard_tableaux, semistandard_tableaux.stats, references, realizer
-- semistandard_tableaux — FindStat sweep wave 3 (issue #326), MAPS. The shape map gets its FindStat Mp-number,
-- confirmed against findstat.org's Mp page (definition + images). ssyt_shape sends a semistandard tableau to the
-- integer partition of its row lengths. Carrier is (entries int[], shape int[]); image compared as the parts array.
--
-- CONFIRMED:
--   shape  Mp00077  "shape of a semistandard tableau"  [[1],[2]] ↦ [1,1], [[1,2],[2]] ↦ [2,1]
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('map','semistandard_tableaux.shape','findstat','Mp00077','https://www.findstat.org/Mp00077','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semistandard_tableaux','shape (Mp00077): [[1,1]]↦{2}, [[1],[2]]↦{1,1}, [[1,2],[2]]↦{2,1}','eq','{2}|{1,1}|{2,1}','findstat.org Mp00077 images',$q$
    SELECT (ssyt_shape(ROW(ARRAY[1,1],ARRAY[2])::semistandard_tableau)).parts::text || '|' ||
           (ssyt_shape(ROW(ARRAY[1,2],ARRAY[1,1])::semistandard_tableau)).parts::text || '|' ||
           (ssyt_shape(ROW(ARRAY[1,2,2],ARRAY[2,1])::semistandard_tableau)).parts::text $q$),
  ('references','findstat map ref resolves for semistandard_tableaux.shape (Mp00077)','eq','Mp00077','the identity strip pointer for a real base_map row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='semistandard_tableaux.shape' AND system='findstat' $q$);
