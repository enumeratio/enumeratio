-- requires: integer_compositions, integer_compositions.stats, composition_maps, references, realizer
-- integer_compositions — FindStat sweep wave 3 (issue #326), MAPS. Four already-implemented composition maps get
-- their FindStat Mp-numbers, each confirmed against findstat.org's own Mp page (definition + images table). Seeded
-- as base_reference rows (subject_kind='map'); the image-examples assert FindStat's own images through our
-- mapping_fn (compared as the raw parts array), so the gate re-verifies every mapping.
--
-- CONFIRMED (definition + images match ours):
--   reverse       Mp00038  "reverse" — reverse the parts        ([1,2] ↦ [2,1])
--   complement    Mp00039  "complement" — complement the cut set ([1,1,1] ↦ [3], [3] ↦ [1,1,1])
--   conjugate     Mp00041  "conjugate" — ribbon transpose        ([1,2] ↦ [1,2], [1,1,1] ↦ [3])
--   to_partition  Mp00040  "to partition" — sort the parts weakly decreasing (→ integer_partitions)
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('map','integer_compositions.reverse',      'findstat','Mp00038','https://www.findstat.org/Mp00038',''),
  ('map','integer_compositions.complement',   'findstat','Mp00039','https://www.findstat.org/Mp00039',''),
  ('map','integer_compositions.conjugate',    'findstat','Mp00041','https://www.findstat.org/Mp00041',''),
  ('map','integer_compositions.to_partition', 'findstat','Mp00040','https://www.findstat.org/Mp00040','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_compositions','reverse (Mp00038): [1,2]↦{2,1}, [1,1,2]↦{2,1,1}','eq','{2,1}|{2,1,1}','findstat.org Mp00038 images',$q$
    SELECT (composition_reverse(ROW(ARRAY[1,2])::composition)).parts::text || '|' ||
           (composition_reverse(ROW(ARRAY[1,1,2])::composition)).parts::text $q$),
  ('integer_compositions','complement (Mp00039): [1,1,1]↦{3}, [3]↦{1,1,1}, [1,2]↦{2,1}','eq','{3}|{1,1,1}|{2,1}','findstat.org Mp00039 images',$q$
    SELECT (composition_complement(ROW(ARRAY[1,1,1])::composition)).parts::text || '|' ||
           (composition_complement(ROW(ARRAY[3])::composition)).parts::text || '|' ||
           (composition_complement(ROW(ARRAY[1,2])::composition)).parts::text $q$),
  ('integer_compositions','conjugate (Mp00041): [1,2]↦{1,2}, [1,1,1]↦{3}, [3]↦{1,1,1}','eq','{1,2}|{3}|{1,1,1}','findstat.org Mp00041 images (self-conjugate [1,2])',$q$
    SELECT (composition_conjugate(ROW(ARRAY[1,2])::composition)).parts::text || '|' ||
           (composition_conjugate(ROW(ARRAY[1,1,1])::composition)).parts::text || '|' ||
           (composition_conjugate(ROW(ARRAY[3])::composition)).parts::text $q$),
  ('integer_compositions','to_partition (Mp00040): [1,2]↦{2,1}, [2,1]↦{2,1}','eq','{2,1}|{2,1}','findstat.org Mp00040 images (sort weakly decreasing)',$q$
    SELECT (composition_to_partition(ROW(ARRAY[1,2])::composition)).parts::text || '|' ||
           (composition_to_partition(ROW(ARRAY[2,1])::composition)).parts::text $q$),
  ('references','the four new integer_compositions-map findstat refs resolve and back real base_map rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 4 AND array_agg(r.subject) @> ARRAY['integer_compositions.reverse','integer_compositions.complement','integer_compositions.conjugate','integer_compositions.to_partition'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='map' AND r.subject LIKE 'integer_compositions.%'
      AND EXISTS (SELECT 1 FROM base_map m WHERE m.collection='integer_compositions' AND m.map_id = split_part(r.subject,'.',2)) $q$);
