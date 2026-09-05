-- requires: gelfand_tsetlin.stats, gelfand_tsetlin, references, realizer
-- gelfand_tsetlin — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder: our
-- patterns (rendered into FindStat's triangular nested-list notation) plus our value_fn values matched St000186
-- pointwise on every pattern FindStat stores (the all-zero patterns it lacks show as "?", which is why the finder
-- reported 86% not 100% — no value disagreement). Carrier is the flat triangular word `rows int[]`: the top
-- (longest) row first, lengths n, n-1, …, 1. So [1,0,0] = [[1,0],[0]] and [3,3,3] = [[3,3],[3]].
--
-- CONFIRMED:
--   top_row_sum  St000186  "the sum of the first row in a Gelfand-Tsetlin pattern"
--
-- DELIBERATELY OMITTED: distinct_entries — the finder returned no exact match; left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','gelfand_tsetlin.top_row_sum','findstat','St000186','https://www.findstat.org/St000186','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gelfand_tsetlin','top_row_sum (St000186): [[1,0],[0]]=1, [[2,1],[1]]=3, [[3,3],[3]]=6, [[2,0],[2]]=2','eq','1|3|6|2','findstat.org St000186 Values table',$q$
    SELECT gt_top_row_sum(ROW(ARRAY[1,0,0])::gelfand_tsetlin_pattern)::text || '|' ||
           gt_top_row_sum(ROW(ARRAY[2,1,1])::gelfand_tsetlin_pattern)::text || '|' ||
           gt_top_row_sum(ROW(ARRAY[3,3,3])::gelfand_tsetlin_pattern)::text || '|' ||
           gt_top_row_sum(ROW(ARRAY[2,0,2])::gelfand_tsetlin_pattern)::text $q$),
  ('references','findstat ref resolves for gelfand_tsetlin.top_row_sum (St000186)','eq','St000186','the identity strip pointer for a real base_stat row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='gelfand_tsetlin.top_row_sum' AND system='findstat' $q$);
