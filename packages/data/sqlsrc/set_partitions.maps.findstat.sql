-- requires: set_partitions, set_partitions.stats, references, realizer
-- set_partitions — FindStat sweep wave 3 (issue #326), MAPS. The shape map gets its FindStat Mp-number, confirmed
-- against findstat.org's Mp page (definition + images). Carrier is the RGS; setpart_shape sends a set partition to
-- the integer partition of its block sizes (sorted weakly decreasing). Compared as the image parts array.
--
-- CONFIRMED:
--   shape  Mp00079  "shape map from set partitions to integer partitions"  {{1,3},{2}} ↦ [2,1]
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('map','set_partitions.shape','findstat','Mp00079','https://www.findstat.org/Mp00079','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partitions','shape (Mp00079): {{1,3},{2}}↦{2,1}, {{1},{2},{3}}↦{1,1,1}, {{1,2,3}}↦{3}','eq','{2,1}|{1,1,1}|{3}','findstat.org Mp00079 images',$q$
    SELECT (setpart_shape(ROW(ARRAY[0,1,0])::set_partition)).parts::text || '|' ||
           (setpart_shape(ROW(ARRAY[0,1,2])::set_partition)).parts::text || '|' ||
           (setpart_shape(ROW(ARRAY[0,0,0])::set_partition)).parts::text $q$),
  ('references','findstat map ref resolves for set_partitions.shape (Mp00079)','eq','Mp00079','the identity strip pointer for a real base_map row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='set_partitions.shape' AND system='findstat' $q$);
