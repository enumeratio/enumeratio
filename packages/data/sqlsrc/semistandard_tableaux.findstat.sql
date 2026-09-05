-- requires: semistandard_tableaux.stats, semistandard_tableaux, references, realizer
-- semistandard_tableaux — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder: our
-- tableaux (rendered row-wise into FindStat's nested-list notation) plus our value_fn values matched these
-- St-numbers on every tableau FindStat resolves (some size-graded tableaux show as "?", lowering the reported
-- quality without any value disagreement — the definition and every resolved value match). Carrier is
-- (entries int[] row-major, shape int[]): [[1,2]] = (entries {1,2}, shape {2}); [[1],[2],[3]] = ({1,2,3},{1,1,1}).
--
-- CONFIRMED:
--   max_entry  St001409  "the maximal entry of a semistandard tableau"
--   entry_sum  St000103  "the sum of the entries of a semistandard tableau"
--
-- DELIBERATELY OMITTED: rows, columns, distinct_entries — no exact match confirmed here; left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','semistandard_tableaux.max_entry','findstat','St001409','https://www.findstat.org/St001409',''),
  ('stat','semistandard_tableaux.entry_sum','findstat','St000103','https://www.findstat.org/St000103','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semistandard_tableaux','max_entry (St001409): [[1,2]]=2, [[3,3,3]]=3, [[1],[2],[3]]=3, [[1,1],[2]]=2','eq','2|3|3|2','findstat.org St001409 Values table',$q$
    SELECT ssyt_max_entry(ROW(ARRAY[1,2],ARRAY[2])::semistandard_tableau)::text || '|' ||
           ssyt_max_entry(ROW(ARRAY[3,3,3],ARRAY[3])::semistandard_tableau)::text || '|' ||
           ssyt_max_entry(ROW(ARRAY[1,2,3],ARRAY[1,1,1])::semistandard_tableau)::text || '|' ||
           ssyt_max_entry(ROW(ARRAY[1,1,2],ARRAY[2,1])::semistandard_tableau)::text $q$),
  ('semistandard_tableaux','entry_sum (St000103): [[1,2]]=3, [[2,2,2]]=6, [[1],[2],[3]]=6, [[3,3,3]]=9','eq','3|6|6|9','findstat.org St000103 Values table',$q$
    SELECT ssyt_entry_sum(ROW(ARRAY[1,2],ARRAY[2])::semistandard_tableau)::text || '|' ||
           ssyt_entry_sum(ROW(ARRAY[2,2,2],ARRAY[3])::semistandard_tableau)::text || '|' ||
           ssyt_entry_sum(ROW(ARRAY[1,2,3],ARRAY[1,1,1])::semistandard_tableau)::text || '|' ||
           ssyt_entry_sum(ROW(ARRAY[3,3,3],ARRAY[3])::semistandard_tableau)::text $q$),
  ('references','the two new semistandard_tableaux findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 2 AND array_agg(r.subject) @> ARRAY['semistandard_tableaux.max_entry','semistandard_tableaux.entry_sum'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('semistandard_tableaux.max_entry','semistandard_tableaux.entry_sum')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='semistandard_tableaux' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
