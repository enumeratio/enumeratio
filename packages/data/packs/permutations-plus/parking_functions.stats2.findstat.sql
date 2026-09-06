-- requires: parking_functions.stats, parking_functions, references, realizer
-- parking_functions — FindStat sweep wave 3 (issue #326), deeper STAT coverage.
--   preference_sum  St000165  "the sum of the entries of a parking function"
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','parking_functions.preference_sum','findstat','St000165','https://www.findstat.org/St000165','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('parking_functions','preference_sum (St000165): [1]=1, [1,1]=2, [1,2]=3, [1,2,3]=6','eq','1|2|3|6','findstat.org St000165 Values table',$q$
    SELECT parking_functions_preference_sum(ROW(ARRAY[1])::parking_function)::text || '|' ||
           parking_functions_preference_sum(ROW(ARRAY[1,1])::parking_function)::text || '|' ||
           parking_functions_preference_sum(ROW(ARRAY[1,2])::parking_function)::text || '|' ||
           parking_functions_preference_sum(ROW(ARRAY[1,2,3])::parking_function)::text $q$),
  ('references','findstat ref resolves for parking_functions.preference_sum (St000165)','eq','St000165','the identity strip pointer',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='parking_functions.preference_sum' AND system='findstat' $q$);
