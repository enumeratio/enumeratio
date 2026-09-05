-- requires: lehmer_codes, permutations, statistics, realizer, utilities
-- lehmer_codes statistics — code[i] = L[i] = #{ j>i : image[j] < image[i] } (the trailing L[n]=0 is implied, not
-- stored), so Σcode IS the permutation's inversion number directly (FindStat St000018), no offset needed — unlike
-- subexcedant_seqs' shifted a_i ∈ [1,i] encoding. Cross-checked against perm_inversions via to_permutation below.

-- ── statistics (carrier: permutation_inversion(code int[])) ────────────────────────────────────────────
-- sum: Σcode — the inversion number of the encoded permutation. FindStat St000018.
CREATE FUNCTION lehmer_sum(v permutation_inversion) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(x) FROM unnest((v).code) x), 0)::int $$;
-- nonzero_entries: the number of positions with a nonzero inversion count.
CREATE FUNCTION lehmer_nonzero_entries(v permutation_inversion) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((v).code) x WHERE x <> 0 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('lehmer_codes','sum','lehmer_sum','Sum (inversions)','natural_numbers'),
  ('lehmer_codes','nonzero_entries','lehmer_nonzero_entries','Nonzero entries','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- lehmer_codes(3) serialized in order (from lehmer_codes.sql's own example): 000,010,100,110,200,210.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lehmer_codes','sum over lehmer_codes(3) in rank order is 0,1,1,2,2,3','eq','0,1,1,2,2,3','matches the Mahonian inversion distribution',$q$
    SELECT string_agg(lehmer_sum((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(lehmer_codes(3)) e $q$),
  ('lehmer_codes','sum EXACTLY reproduces perm_inversions of to_permutation, over lehmer_codes(4)','eq','true','the direct cross-check against the permutation stat',$q$
    SELECT bool_and(lehmer_sum((e).value) = perm_inversions(to_permutation((e).value)))::text
      FROM elements(lehmer_codes(4)) e $q$),
  ('lehmer_codes','nonzero_entries over lehmer_codes(3) in rank order is 0,1,1,2,1,2','eq','0,1,1,2,1,2','count of nonzero code positions',$q$
    SELECT string_agg(lehmer_nonzero_entries((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(lehmer_codes(3)) e $q$),
  ('lehmer_codes','321 has code {2,1}, sum 3 (max inversions), nonzero_entries 2','eq','3|2','the fully-reversed permutation',$q$
    SELECT lehmer_sum(to_inversion(ROW(ARRAY[3,2,1])::permutation))::text || '|' ||
           lehmer_nonzero_entries(to_inversion(ROW(ARRAY[3,2,1])::permutation))::text $q$),
  ('lehmer_codes','the identity has sum 0 and nonzero_entries 0, at size 4','eq','0|0','123 4, no inversions at all',$q$
    SELECT lehmer_sum(to_inversion(ROW(ARRAY[1,2,3,4])::permutation))::text || '|' ||
           lehmer_nonzero_entries(to_inversion(ROW(ARRAY[1,2,3,4])::permutation))::text $q$);
