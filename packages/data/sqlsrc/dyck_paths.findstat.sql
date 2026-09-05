-- requires: dyck_paths.stats, dyck_paths.stats2, references, realizer
-- dyck_paths — FindStat sweep wave 2 (issue #263): cross-references for three already-implemented statistics,
-- each confirmed against findstat.org's own definition + Values table (St-number is the page URL, so a matching
-- definition AND matching first values confirm the mapping). The value-examples below are the real oracle: they
-- compute OUR value_fn on FindStat's own element literals and assert FindStat's published values, so the gate
-- fails if a mapping is wrong. area/bounce/dinv already carry findstat ids (findstat-refs.sql).
--
-- CONFIRMED (definition + first values match ours):
--   returns       St000011  "number of touch points (or returns): points, excluding the origin, at height 0"
--   valleys       St000053  "number of valleys of the Dyck path" (a DU factor)
--   double_rises  St000024  "number of double rises (equivalently double falls)" (a UU factor)
-- FindStat encodes a step word as [1,0,…] (1 = up, 0 = down); ours is ±1, so 0 ↦ −1 in the literals below.
--
-- DELIBERATELY OMITTED (near-miss / no exact match — do not fabricate):
--   number_of_touch_points  — ours counts touch points INCLUDING the origin (= returns + 1); St000011 excludes the
--                             origin, so it equals `returns`, not this. No FindStat stat for the origin-inclusive count.
--   major_index             — ours sums PEAK (UD) positions; St000027 "major index of a Dyck path" sums VALLEY (DU)
--                             positions ([1,0,1,0]: ours = 4, St000027 = 2) — a different statistic. Left NULL.
--   hills, initial_rise, longest_ascent, longest_descent — no St-number confirmable against findstat.org; left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','dyck_paths.returns',      'findstat','St000011','https://www.findstat.org/St000011',''),
  ('stat','dyck_paths.valleys',      'findstat','St000053','https://www.findstat.org/St000053',''),
  ('stat','dyck_paths.double_rises', 'findstat','St000024','https://www.findstat.org/St000024','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','returns (St000011) on findstat literals: UDUDUD=3, UUDUDD=1, UUDD=1','eq','3|1|1','findstat.org St000011 Values table',$q$
    SELECT dyck_returns(ROW(ARRAY[1,-1,1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_returns(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_returns(ROW(ARRAY[1,1,-1,-1])::dyck_path)::text $q$),
  ('dyck_paths','valleys (St000053) on findstat literals: UDUDUD=2, UUDUDD=1, UUUDDD=0','eq','2|1|0','findstat.org St000053 Values table',$q$
    SELECT dyck_valleys(ROW(ARRAY[1,-1,1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_valleys(ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_valleys(ROW(ARRAY[1,1,1,-1,-1,-1])::dyck_path)::text $q$),
  ('dyck_paths','double_rises (St000024) on findstat literals: UUUDDD=2, UUDDUD=1, UDUD=0','eq','2|1|0','findstat.org St000024 Values table',$q$
    SELECT dyck_double_rises(ROW(ARRAY[1,1,1,-1,-1,-1])::dyck_path)::text || '|' ||
           dyck_double_rises(ROW(ARRAY[1,1,-1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_double_rises(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text $q$),
  ('references','the three new dyck_paths findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count (post-#171)',$q$
    SELECT (count(*) >= 3 AND array_agg(r.subject) @> ARRAY['dyck_paths.returns','dyck_paths.valleys','dyck_paths.double_rises'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('dyck_paths.returns','dyck_paths.valleys','dyck_paths.double_rises')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='dyck_paths' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
