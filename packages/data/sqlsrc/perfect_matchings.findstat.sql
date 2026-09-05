-- requires: perfect_matchings.stats, perfect_matchings, references, realizer
-- perfect_matchings — FindStat sweep wave 2 (issue #263). Confirmed against findstat.org's definition + Values
-- table. Carrier is `pairs int[]` = arc endpoints [a1,b1,a2,b2,…] sorted by opener, arcs (a_i,b_i):
-- {(1,3),(2,4)} = [1,3,2,4] (the crossing), {(1,4),(2,3)} = [1,4,2,3] (the nesting).
--
-- CONFIRMED:
--   crossings St000042  "number of crossings: pairs of edges (a,b),(c,d) with a<c<b<d"
--   nestings  St000041  "number of nestings: pairs of edges (a,b),(c,d) with a<c<d<b (nested)"
-- Match perfect_matchings_crossings / perfect_matchings_nestings (perfect_matchings.stats.sql). short_pairs and
-- widest_arc left NULL — no St-number confirmed here.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','perfect_matchings.crossings','findstat','St000042','https://www.findstat.org/St000042',''),
  ('stat','perfect_matchings.nestings', 'findstat','St000041','https://www.findstat.org/St000041','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perfect_matchings','crossings (St000042): (1,3)(2,4)=1, (1,4)(2,3)=0','eq','1|0','findstat.org St000042 Values table',$q$
    SELECT perfect_matchings_crossings(ROW(ARRAY[1,3,2,4])::perfect_matching)::text || '|' ||
           perfect_matchings_crossings(ROW(ARRAY[1,4,2,3])::perfect_matching)::text $q$),
  ('perfect_matchings','nestings (St000041): (1,4)(2,3)=1, (1,3)(2,4)=0','eq','1|0','findstat.org St000041 Values table',$q$
    SELECT perfect_matchings_nestings(ROW(ARRAY[1,4,2,3])::perfect_matching)::text || '|' ||
           perfect_matchings_nestings(ROW(ARRAY[1,3,2,4])::perfect_matching)::text $q$),
  ('references','the two new perfect_matchings findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 2 AND array_agg(r.subject) @> ARRAY['perfect_matchings.crossings','perfect_matchings.nestings'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('perfect_matchings.crossings','perfect_matchings.nestings')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='perfect_matchings' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
