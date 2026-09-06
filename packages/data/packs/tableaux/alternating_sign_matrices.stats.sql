-- requires: alternating_sign_matrices, realizer, utilities
-- alternating_sign_matrices statistics: the number of -1 entries (the statistic distinguishing ASMs from the
-- permutation matrices — it is 0 exactly on the n! permutation matrices), and the number of nonzero entries.

CREATE FUNCTION alternating_sign_matrix_negative_ones(a alternating_sign_matrix) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((a).matrix) x WHERE x = -1 $$;
-- an ASM has exactly (n + #(-1)) ones (row sums = 1), so nonzeros = n + 2·#(-1).
CREATE FUNCTION alternating_sign_matrix_nonzeros(a alternating_sign_matrix) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((a).matrix) x WHERE x <> 0 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('alternating_sign_matrices','negative_ones','alternating_sign_matrix_negative_ones','Number of -1s','natural_numbers'),
  ('alternating_sign_matrices','nonzeros','alternating_sign_matrix_nonzeros','Number of nonzero entries','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('alternating_sign_matrices','negative_ones over ASM(3) is 6,1: six permutation matrices, one diamond','eq','6,1','#(-1) = 0 on the 3! permutation matrices, 1 on the diamond',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT alternating_sign_matrix_negative_ones((e).value) k, count(*) c
      FROM elements(alternating_sign_matrices(3)) e GROUP BY 1) t(k,c) $q$),
  ('alternating_sign_matrices','the diamond has one -1 and 5 nonzeros; the identity has none and 3','eq','1|5|0|3','#(-1) and #nonzero of two ASMs of order 3',$q$
    SELECT alternating_sign_matrix_negative_ones(ROW(ARRAY[0,1,0,1,-1,1,0,1,0])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_nonzeros(ROW(ARRAY[0,1,0,1,-1,1,0,1,0])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_negative_ones(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix)::text || '|' ||
           alternating_sign_matrix_nonzeros(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix)::text $q$),
  ('alternating_sign_matrices','exactly n! ASMs of order 4 are permutation matrices (no -1): 24','eq','24','the #(-1)=0 fiber is S_4',$q$
    SELECT count(*)::text FROM elements(alternating_sign_matrices(4)) e WHERE alternating_sign_matrix_negative_ones((e).value) = 0 $q$);
