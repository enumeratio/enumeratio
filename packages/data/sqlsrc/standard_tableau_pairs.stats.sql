-- requires: standard_tableau_pairs, standard_tableaux.stats, realizer, utilities
-- standard_tableau_pairs statistics — P and Q always share a shape (that's the RSK invariant), so shape_length (the
-- number of rows of that common shape) is well-defined reading off EITHER side; reuses standard_tableau_rows
-- (standard_tableaux.stats.sql) rather than reimplementing the row-count.

-- ── statistics (carrier: standard_tableau_pair(p standard_tableau, q standard_tableau)) ────────────────
-- shape_length: the number of rows of the pair's (shared) shape λ.
CREATE FUNCTION standard_tableau_pair_shape_length(v standard_tableau_pair) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT standard_tableau_rows((v).p) $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('standard_tableau_pairs','shape_length','standard_tableau_pair_shape_length','Shape length','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableau_pairs','shape_length agrees whether read from P or Q, over standard_tableau_pairs(5)','eq','true','P and Q share a shape by the RSK invariant',$q$
    SELECT bool_and(standard_tableau_rows(((e).value).p) = standard_tableau_rows(((e).value).q))::text
      FROM elements(standard_tableau_pairs(5)) e $q$),
  ('standard_tableau_pairs','shape_length of the RSK image of 2413 is 2','eq','2','shape 2+2, two rows',$q$
    SELECT standard_tableau_pair_shape_length(perm_rsk(ROW(ARRAY[2,4,1,3])::permutation))::text $q$),
  ('standard_tableau_pairs','the identity permutation RSKs to shape_length 1 (a single row), at size 4','eq','1','the increasing permutation ⇒ one row',$q$
    SELECT standard_tableau_pair_shape_length(perm_rsk(ROW(ARRAY[1,2,3,4])::permutation))::text $q$),
  ('standard_tableau_pairs','the fully-reversed permutation RSKs to shape_length n (every row length 1), at size 4','eq','4','the decreasing permutation ⇒ the transpose extreme',$q$
    SELECT standard_tableau_pair_shape_length(perm_rsk(ROW(ARRAY[4,3,2,1])::permutation))::text $q$),
  ('standard_tableau_pairs','shape_length never exceeds n, over standard_tableau_pairs(4)','eq','true','a shape of n cells has at most n rows',$q$
    SELECT bool_and(standard_tableau_pair_shape_length((e).value) <= 4)::text FROM elements(standard_tableau_pairs(4)) e $q$);
