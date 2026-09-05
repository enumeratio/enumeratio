-- requires: parking_functions.stats, parking_functions, references, realizer
-- parking_functions — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder: our
-- value_fn values over the n<=3 fibers matched these St-numbers pointwise (the finder also surfaces distribution-
-- only matches, so each was picked by exact per-object equality plus the definition). Carrier is `spots int[]` =
-- the preference list, which is exactly FindStat's parking-function object; value-examples are the gate oracle.
--
-- CONFIRMED:
--   displacement  St000188  "total displacement of a parking function, sum of p_parked - p_preferred"
--   lucky_cars    St000135  "number of lucky cars: cars that park in their preferred spot"
--   descents      St001946  "number of descents: indices i with p_i > p_{i+1}"
--
-- DELIBERATELY OMITTED (no exact match at depth 0 — do NOT fabricate):
--   distinct_preferences — the finder's nearest (St001905, #{i: a_i<i}) matches only up to a +1 offset, not equal.
--   preference_sum, ties, max_preference, prefers_first — left NULL, no St-number confirmed here.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','parking_functions.displacement','findstat','St000188','https://www.findstat.org/St000188',''),
  ('stat','parking_functions.lucky_cars',  'findstat','St000135','https://www.findstat.org/St000135',''),
  ('stat','parking_functions.descents',    'findstat','St001946','https://www.findstat.org/St001946','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('parking_functions','displacement (St000188): [1,1]=1, [1,1,1]=3, [1,2,1]=2, [1,2,3]=0','eq','1|3|2|0','findstat.org St000188 Values table',$q$
    SELECT parking_functions_displacement(ROW(ARRAY[1,1])::parking_function)::text || '|' ||
           parking_functions_displacement(ROW(ARRAY[1,1,1])::parking_function)::text || '|' ||
           parking_functions_displacement(ROW(ARRAY[1,2,1])::parking_function)::text || '|' ||
           parking_functions_displacement(ROW(ARRAY[1,2,3])::parking_function)::text $q$),
  ('parking_functions','lucky_cars (St000135): [1,1]=1, [1,2]=2, [1,1,1]=1, [1,2,3]=3','eq','1|2|1|3','findstat.org St000135 Values table',$q$
    SELECT parking_functions_lucky_cars(ROW(ARRAY[1,1])::parking_function)::text || '|' ||
           parking_functions_lucky_cars(ROW(ARRAY[1,2])::parking_function)::text || '|' ||
           parking_functions_lucky_cars(ROW(ARRAY[1,1,1])::parking_function)::text || '|' ||
           parking_functions_lucky_cars(ROW(ARRAY[1,2,3])::parking_function)::text $q$),
  ('parking_functions','descents (St001946): [2,1]=1, [1,2,1]=1, [3,2,1]=2, [1,2,3]=0','eq','1|1|2|0','findstat.org St001946 Values table',$q$
    SELECT parking_functions_descents(ROW(ARRAY[2,1])::parking_function)::text || '|' ||
           parking_functions_descents(ROW(ARRAY[1,2,1])::parking_function)::text || '|' ||
           parking_functions_descents(ROW(ARRAY[3,2,1])::parking_function)::text || '|' ||
           parking_functions_descents(ROW(ARRAY[1,2,3])::parking_function)::text $q$),
  ('references','the three new parking_functions findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 3 AND array_agg(r.subject) @> ARRAY['parking_functions.displacement','parking_functions.lucky_cars','parking_functions.descents'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('parking_functions.displacement','parking_functions.lucky_cars','parking_functions.descents')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='parking_functions' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
