-- requires: alternating_sign_matrices.stats, alternating_sign_matrices, references, realizer
-- alternating_sign_matrices — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder:
-- our matrices (rendered row-wise into FindStat's nested-list notation) plus our value_fn values matched these
-- St-numbers pointwise (definition + every resolved value; the n=1 matrix shows "?" only because FindStat lacks it).
-- Carrier is `matrix int[]` flattened row-major, n×n; [0,1,0,1,-1,1,0,1,0] = [[0,1,0],[1,-1,1],[0,1,0]].
--
-- CONFIRMED:
--   negative_ones  St000065  "the number of entries equal to -1 in an alternating sign matrix"
--   nonzeros       St000890  "the number of nonzero entries in an alternating sign matrix"
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','alternating_sign_matrices.negative_ones','findstat','St000065','https://www.findstat.org/St000065',''),
  ('stat','alternating_sign_matrices.nonzeros',     'findstat','St000890','https://www.findstat.org/St000890','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('alternating_sign_matrices','negative_ones (St000065): U-turn ASM=1, identity_3=0, [[0,1],[1,0]]=0','eq','1|0|0','findstat.org St000065 Values table',$q$
    SELECT alternating_sign_matrix_negative_ones(ROW(ARRAY[0,1,0,1,-1,1,0,1,0])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_negative_ones(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_negative_ones(ROW(ARRAY[0,1,1,0])::alternating_sign_matrix)::text $q$),
  ('alternating_sign_matrices','nonzeros (St000890): [[1]]=1, [[0,1],[1,0]]=2, U-turn ASM=5, identity_3=3','eq','1|2|5|3','findstat.org St000890 Values table',$q$
    SELECT alternating_sign_matrix_nonzeros(ROW(ARRAY[1])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_nonzeros(ROW(ARRAY[0,1,1,0])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_nonzeros(ROW(ARRAY[0,1,0,1,-1,1,0,1,0])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_nonzeros(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix)::text $q$),
  ('references','the two new alternating_sign_matrices findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 2 AND array_agg(r.subject) @> ARRAY['alternating_sign_matrices.negative_ones','alternating_sign_matrices.nonzeros'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('alternating_sign_matrices.negative_ones','alternating_sign_matrices.nonzeros')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='alternating_sign_matrices' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
