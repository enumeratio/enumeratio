-- requires: perfect_matchings.stats, perfect_matchings, references, realizer
-- perfect_matchings — FindStat sweep wave 3 (issue #326), deeper STAT coverage.
--   short_pairs  St000164  "the number of short pairs" (a matching pair (i,i+1))
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','perfect_matchings.short_pairs','findstat','St000164','https://www.findstat.org/St000164','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perfect_matchings','short_pairs (St000164): (1,2)=1, (1,2)(3,4)=2, (1,3)(2,4)=0, (1,4)(2,3)=1','eq','1|2|0|1','findstat.org St000164 Values table',$q$
    SELECT perfect_matchings_short_pairs(ROW(ARRAY[1,2])::perfect_matching)::text || '|' ||
           perfect_matchings_short_pairs(ROW(ARRAY[1,2,3,4])::perfect_matching)::text || '|' ||
           perfect_matchings_short_pairs(ROW(ARRAY[1,3,2,4])::perfect_matching)::text || '|' ||
           perfect_matchings_short_pairs(ROW(ARRAY[1,4,2,3])::perfect_matching)::text $q$),
  ('references','findstat ref resolves for perfect_matchings.short_pairs (St000164)','eq','St000164','the identity strip pointer',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='perfect_matchings.short_pairs' AND system='findstat' $q$);
