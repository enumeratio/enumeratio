-- requires: gelfand_tsetlin.stats, gelfand_tsetlin, references, realizer
-- gelfand_tsetlin — FindStat sweep wave 3 (issue #326), deeper STAT coverage. Carrier is the flat triangular word
-- (top row first, lengths n, n-1, …, 1): [1,0,0] = [[1,0],[0]].
--   distinct_entries  St001404  "the number of distinct entries in a Gelfand-Tsetlin pattern"
-- (St000176, total number of TILES, coincides on tiny patterns but is a different statistic — the definition and
--  every resolved value pin St001404.)
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','gelfand_tsetlin.distinct_entries','findstat','St001404','https://www.findstat.org/St001404','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gelfand_tsetlin','distinct_entries (St001404): [[1,0],[0]]=2, [[2,0],[1]]=3, [[1,1],[1]]=1, [[2,2],[2]]=1','eq','2|3|1|1','findstat.org St001404 Values table',$q$
    SELECT gt_distinct_entries(ROW(ARRAY[1,0,0])::gelfand_tsetlin_pattern)::text || '|' ||
           gt_distinct_entries(ROW(ARRAY[2,0,1])::gelfand_tsetlin_pattern)::text || '|' ||
           gt_distinct_entries(ROW(ARRAY[1,1,1])::gelfand_tsetlin_pattern)::text || '|' ||
           gt_distinct_entries(ROW(ARRAY[2,2,2])::gelfand_tsetlin_pattern)::text $q$),
  ('references','findstat ref resolves for gelfand_tsetlin.distinct_entries (St001404)','eq','St001404','the identity strip pointer',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='gelfand_tsetlin.distinct_entries' AND system='findstat' $q$);
