-- requires: perfect_matchings.stats, perfect_matchings, set_partitions, references, realizer
-- perfect_matchings — FindStat sweep wave 3 (issue #326), MAPS. The to_set_partition map gets its FindStat
-- Mp-number, confirmed against findstat.org's Mp page (definition + images). A perfect matching's arcs become the
-- blocks of a set partition. Domain carrier `pairs int[]` = [a1,b1,…]; image is the set partition RGS.
--
-- CONFIRMED:
--   to_set_partition  Mp00092  "perfect matchings to set partitions"  {(1,3),(2,4)} ↦ {{1,3},{2,4}}
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('map','perfect_matchings.to_set_partition','findstat','Mp00092','https://www.findstat.org/Mp00092','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perfect_matchings','to_set_partition (Mp00092): (1,3)(2,4)↦{{1,3},{2,4}}, (1,4)(2,3)↦{{1,4},{2,3}}, (1,2)(3,4)↦{{1,2},{3,4}}','eq','{0,1,0,1}|{0,1,1,0}|{0,0,1,1}','findstat.org Mp00092 images, as the image set-partition RGS',$q$
    SELECT (perfect_matchings_to_set_partition(ROW(ARRAY[1,3,2,4])::perfect_matching)).rgs::text || '|' ||
           (perfect_matchings_to_set_partition(ROW(ARRAY[1,4,2,3])::perfect_matching)).rgs::text || '|' ||
           (perfect_matchings_to_set_partition(ROW(ARRAY[1,2,3,4])::perfect_matching)).rgs::text $q$),
  ('references','findstat map ref resolves for perfect_matchings.to_set_partition (Mp00092)','eq','Mp00092','the identity strip pointer for a real base_map row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='map' AND subject='perfect_matchings.to_set_partition' AND system='findstat' $q$);
