-- requires: semistandard_tableaux.stats, semistandard_tableaux, references, realizer
-- semistandard_tableaux — FindStat sweep wave 3 (issue #326), deeper STAT coverage.
--   distinct_entries  St001401  "the number of distinct entries in a semistandard tableau"
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','semistandard_tableaux.distinct_entries','findstat','St001401','https://www.findstat.org/St001401','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semistandard_tableaux','distinct_entries (St001401): [[1,2]]=2, [[2,2]]=1, [[1,2,3]]=3, [[1],[2],[3]]=3','eq','2|1|3|3','findstat.org St001401 Values table',$q$
    SELECT ssyt_distinct_entries(ROW(ARRAY[1,2],ARRAY[2])::semistandard_tableau)::text || '|' ||
           ssyt_distinct_entries(ROW(ARRAY[2,2],ARRAY[2])::semistandard_tableau)::text || '|' ||
           ssyt_distinct_entries(ROW(ARRAY[1,2,3],ARRAY[3])::semistandard_tableau)::text || '|' ||
           ssyt_distinct_entries(ROW(ARRAY[1,2,3],ARRAY[1,1,1])::semistandard_tableau)::text $q$),
  ('references','findstat ref resolves for semistandard_tableaux.distinct_entries (St001401)','eq','St001401','the identity strip pointer',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='semistandard_tableaux.distinct_entries' AND system='findstat' $q$);
