-- requires: permutations, statistics, realizer, utilities
-- Denert's statistic (#240 part A, chunk 2). St000156. A Mahonian statistic (equidistributed with inversions
-- and major_index), first studied by Denert (1990) and later given a bijective proof of equidistribution by
-- Foata-Zeilberger. For w ∈ S_n:
--   den(w) = #{ (l,k) : l<k, w(k) < w(l) ≤ k }  +  #{ (l,k) : l<k, w(l) ≤ k < w(k) }  +  #{ (l,k) : l<k, k < w(k) < w(l) }
-- Definition + the S_3 per-element values and the S_4 distribution (1,3,5,6,5,3,1) verified against FindStat's
-- own worked example for St000156 before writing this.
CREATE FUNCTION perm_denert(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) l, generate_subscripts((p).image,1) k
   WHERE l < k
     AND ( ((p).image[k] < (p).image[l] AND (p).image[l] <= k)
        OR ((p).image[l] <= k AND k < (p).image[k])
        OR (k < (p).image[k] AND (p).image[k] < (p).image[l]) ) $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('permutations','denert','perm_denert','Denert''s statistic (St000156)','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','Denert over permutations(3), element-anchored (matches FindStat St000156''s own S_3 table): den(123)=0, den(132)=2, den(213)=1, den(231)=3, den(312)=1, den(321)=2','eq','0,2,1,3,1,2','FindStat orders S_3 differently from our rank — assert per literal element, not by position',$q$
    SELECT perm_denert(ROW(ARRAY[1,2,3])::permutation)::text || ',' ||
           perm_denert(ROW(ARRAY[1,3,2])::permutation)::text || ',' ||
           perm_denert(ROW(ARRAY[2,1,3])::permutation)::text || ',' ||
           perm_denert(ROW(ARRAY[2,3,1])::permutation)::text || ',' ||
           perm_denert(ROW(ARRAY[3,1,2])::permutation)::text || ',' ||
           perm_denert(ROW(ARRAY[3,2,1])::permutation)::text $q$),
  ('permutations','Denert is Mahonian: distribution over permutations(4) is 1,3,5,6,5,3,1, matching major_index/inversions','eq','1,3,5,6,5,3,1','Σ=24, the q-factorial coefficients',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_denert((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','Denert and major_index are equidistributed over permutations(4) (both Mahonian, same histogram)','eq','true','two different Mahonian statistics, same value counts, checked histogram-for-histogram',$q$
    SELECT (
      (SELECT array_agg(c ORDER BY k) FROM (SELECT perm_denert((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c))
      =
      (SELECT array_agg(c ORDER BY k) FROM (SELECT perm_major_index((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c))
    )::text $q$);
