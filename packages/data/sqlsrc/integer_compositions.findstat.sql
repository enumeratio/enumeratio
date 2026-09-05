-- requires: integer_compositions.stats, integer_compositions, references, realizer
-- integer_compositions — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder over
-- the n<=4 fibers; carrier `parts int[]` is FindStat's composition object. Value-examples are the gate oracle.
--
-- CONFIRMED:
--   ascents       St000761  "number of ascents in a composition: index i with a_i < a_{i+1}" — matches
--                           composition_ascents pointwise (integer_compositions.stats.sql).
--   smallest_part St000657  "the smallest part of an integer composition."
--
-- DELIBERATELY OMITTED (no exact match at depth 0 — do NOT fabricate):
--   descents        — our a_i>a_{i+1} count is only DISTRIBUTION-equal to St000761 (ascents, via reversal), not
--                     pointwise; the finder surfaced no exact composition-descents statistic. Left NULL.
--   parts_equal_one — the finder returned no match. Left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','integer_compositions.ascents',      'findstat','St000761','https://www.findstat.org/St000761',''),
  ('stat','integer_compositions.smallest_part','findstat','St000657','https://www.findstat.org/St000657','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_compositions','ascents (St000761): [1,2]=1, [2,1]=0, [1,1,2]=1, [1,2,1]=1','eq','1|0|1|1','findstat.org St000761 Values table',$q$
    SELECT composition_ascents(ROW(ARRAY[1,2])::composition)::text || '|' ||
           composition_ascents(ROW(ARRAY[2,1])::composition)::text || '|' ||
           composition_ascents(ROW(ARRAY[1,1,2])::composition)::text || '|' ||
           composition_ascents(ROW(ARRAY[1,2,1])::composition)::text $q$),
  ('integer_compositions','smallest_part (St000657): [2]=2, [3]=3, [1,2]=1, [2,2]=2','eq','2|3|1|2','findstat.org St000657 Values table',$q$
    SELECT composition_smallest_part(ROW(ARRAY[2])::composition)::text || '|' ||
           composition_smallest_part(ROW(ARRAY[3])::composition)::text || '|' ||
           composition_smallest_part(ROW(ARRAY[1,2])::composition)::text || '|' ||
           composition_smallest_part(ROW(ARRAY[2,2])::composition)::text $q$),
  ('references','the two new integer_compositions findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 2 AND array_agg(r.subject) @> ARRAY['integer_compositions.ascents','integer_compositions.smallest_part'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('integer_compositions.ascents','integer_compositions.smallest_part')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='integer_compositions' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
