-- requires: signed_permutations, permutations, realizer, utilities
-- signed_permutations statistics & maps — classic B_n (hyperoctahedral) invariants beyond negatives_count: type-B
-- descents (with the w(0)=0 sentinel — the type-B Eulerian statistic), window inversions #{i<j : w(i)>w(j)},
-- fixed points w(i)=i, and negative fixed points w(i)=-i. MAPS: to_permutation drops the signs (|w(i)| as a
-- permutation of [n]), and inverse is the group inverse of the signed permutation. Distributions checked against
-- sage SignedPermutations(n) (fibers 2,8,48,384 = 2^n·n!); signed inverse matches sage's .inverse() over all B_3.

-- ── statistics (carrier: signed_permutation(image int[]), entries ±1..±n) ────────────────────────────────
-- type-B descents: prepend a 0 sentinel (position 0) and count i in {0..n-1} with w(i) > w(i+1). Position 0 is a
-- descent iff w(1) < 0. Distribution over B_n is the type-B Eulerian numbers (n=3 ⇒ 1,23,23,1).
CREATE FUNCTION signed_perm_descents(x signed_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  WITH ext(a) AS (SELECT ARRAY[0] || coalesce((x).image, '{}'))
  SELECT count(*)::int FROM ext, generate_subscripts(ext.a, 1) i
   WHERE i < array_length(ext.a, 1) AND ext.a[i] > ext.a[i+1] $$;
-- window inversions: pairs of positions i<j with w(i) > w(j), comparing the signed values directly.
CREATE FUNCTION signed_perm_inversions(x signed_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).image, 1) i, generate_subscripts((x).image, 1) j
   WHERE i < j AND (x).image[i] > (x).image[j] $$;
-- fixed points: positions with w(i) = i (a positive fixed point).
CREATE FUNCTION signed_perm_fixed_points(x signed_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).image, 1) i WHERE (x).image[i] = i $$;
-- negative fixed points: positions with w(i) = -i (an anti-fixed point). Same distribution as fixed points by the
-- sign-flip symmetry of B_n.
CREATE FUNCTION signed_perm_negative_fixed_points(x signed_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).image, 1) i WHERE (x).image[i] = -i $$;

-- ── maps ────────────────────────────────────────────────────────────────────────────────────────────────
-- to_permutation → permutations: forget the signs, |w(i)| as a permutation of [n] (the projection B_n ↠ S_n).
CREATE FUNCTION signed_perm_to_permutation(x signed_permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT abs((x).image[i]) FROM generate_subscripts((x).image, 1) i ORDER BY i))::permutation $$;
-- inverse → signed_permutations: the group inverse. If w(i) = s·k (s = ±1, k = |w(i)|) then w⁻¹(k) = s·i.
CREATE FUNCTION signed_perm_inverse(x signed_permutation) RETURNS signed_permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (CASE WHEN (x).image[i] < 0 THEN -1 ELSE 1 END) * i
    FROM generate_subscripts((x).image, 1) i ORDER BY abs((x).image[i])
  ))::signed_permutation $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('signed_permutations','descents','signed_perm_descents','Number of descents','natural_numbers'),
  ('signed_permutations','inversions','signed_perm_inversions','Number of inversions','natural_numbers'),
  ('signed_permutations','fixed_points','signed_perm_fixed_points','Number of fixed points','natural_numbers'),
  ('signed_permutations','negative_fixed_points','signed_perm_negative_fixed_points','Number of negative fixed points','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('signed_permutations','to_permutation','signed_perm_to_permutation','permutations','To permutation',NULL),
  ('signed_permutations','inverse','signed_perm_inverse','signed_permutations','Inverse',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('signed_permutations','descents (type B): -1,2,-3=2; 2,-1,3=1; 3,2,1=2; 1,2,3=0; -1,-2,-3=3','eq','2|1|2|0|3','w(0)=0 sentinel then w(i)>w(i+1)',$q$
    SELECT signed_perm_descents(ROW(ARRAY[-1,2,-3])::signed_permutation)::text || '|' ||
           signed_perm_descents(ROW(ARRAY[2,-1,3])::signed_permutation)::text || '|' ||
           signed_perm_descents(ROW(ARRAY[3,2,1])::signed_permutation)::text || '|' ||
           signed_perm_descents(ROW(ARRAY[1,2,3])::signed_permutation)::text || '|' ||
           signed_perm_descents(ROW(ARRAY[-1,-2,-3])::signed_permutation)::text $q$),
  ('signed_permutations','descents is type-B Eulerian over B_3: distribution 1,23,23,1','eq','1,23,23,1','#{w : des_B(w)=0,1,2,3}',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT signed_perm_descents((e).value) k, count(*) c FROM elements(signed_permutations(3)) e GROUP BY 1) t(k,c) $q$),
  ('signed_permutations','descents type-B Eulerian over B_2: distribution 1,6,1','eq','1,6,1','B_2 Eulerian row',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT signed_perm_descents((e).value) k, count(*) c FROM elements(signed_permutations(2)) e GROUP BY 1) t(k,c) $q$),
  ('signed_permutations','inversions: -1,2,-3=2; 2,-1,3=1; 3,2,1=3; 1,2,3=0','eq','2|1|3|0','#{i<j : w(i)>w(j)}',$q$
    SELECT signed_perm_inversions(ROW(ARRAY[-1,2,-3])::signed_permutation)::text || '|' ||
           signed_perm_inversions(ROW(ARRAY[2,-1,3])::signed_permutation)::text || '|' ||
           signed_perm_inversions(ROW(ARRAY[3,2,1])::signed_permutation)::text || '|' ||
           signed_perm_inversions(ROW(ARRAY[1,2,3])::signed_permutation)::text $q$),
  ('signed_permutations','inversions distribution over B_3 is 8,16,16,8','eq','8,16,16,8','#{w : inv(w)=0,1,2,3}',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT signed_perm_inversions((e).value) k, count(*) c FROM elements(signed_permutations(3)) e GROUP BY 1) t(k,c) $q$),
  ('signed_permutations','fixed points: 1,2,3=3; -1,2,-3=1; 3,2,1=1; -1,-2,-3=0','eq','3|1|1|0','w(i)=i',$q$
    SELECT signed_perm_fixed_points(ROW(ARRAY[1,2,3])::signed_permutation)::text || '|' ||
           signed_perm_fixed_points(ROW(ARRAY[-1,2,-3])::signed_permutation)::text || '|' ||
           signed_perm_fixed_points(ROW(ARRAY[3,2,1])::signed_permutation)::text || '|' ||
           signed_perm_fixed_points(ROW(ARRAY[-1,-2,-3])::signed_permutation)::text $q$),
  ('signed_permutations','fixed points distribution over B_3 is 29,15,3,1','eq','29,15,3,1','#{w : #fix(w)=0,1,2,3}',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT signed_perm_fixed_points((e).value) k, count(*) c FROM elements(signed_permutations(3)) e GROUP BY 1) t(k,c) $q$),
  ('signed_permutations','negative fixed points: -1,2,-3=2; -1,-2,-3=3; 2,-1,3=0; 1,2,3=0','eq','2|3|0|0','w(i)=-i',$q$
    SELECT signed_perm_negative_fixed_points(ROW(ARRAY[-1,2,-3])::signed_permutation)::text || '|' ||
           signed_perm_negative_fixed_points(ROW(ARRAY[-1,-2,-3])::signed_permutation)::text || '|' ||
           signed_perm_negative_fixed_points(ROW(ARRAY[2,-1,3])::signed_permutation)::text || '|' ||
           signed_perm_negative_fixed_points(ROW(ARRAY[1,2,3])::signed_permutation)::text $q$),
  ('signed_permutations','negative fixed points share the fixed-point distribution over B_3: 29,15,3,1','eq','29,15,3,1','sign-flip symmetry of B_n',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT signed_perm_negative_fixed_points((e).value) k, count(*) c FROM elements(signed_permutations(3)) e GROUP BY 1) t(k,c) $q$),
  ('signed_permutations','edge n=0: every stat is 0 on the empty signed permutation','eq','0|0|0|0','no positions',$q$
    SELECT signed_perm_descents((unrank(signed_permutations(0),0)).value)::text || '|' ||
           signed_perm_inversions((unrank(signed_permutations(0),0)).value)::text || '|' ||
           signed_perm_fixed_points((unrank(signed_permutations(0),0)).value)::text || '|' ||
           signed_perm_negative_fixed_points((unrank(signed_permutations(0),0)).value)::text $q$),
  ('signed_permutations','to_permutation drops signs: -1,2,-3 ↦ 123; 2,-3,-1 ↦ 231; -2,-3,1 ↦ 231','eq','123|231|231','|w(i)| as a permutation of [n]',$q$
    SELECT one_line(signed_perm_to_permutation(ROW(ARRAY[-1,2,-3])::signed_permutation)) || '|' ||
           one_line(signed_perm_to_permutation(ROW(ARRAY[2,-3,-1])::signed_permutation)) || '|' ||
           one_line(signed_perm_to_permutation(ROW(ARRAY[-2,-3,1])::signed_permutation)) $q$),
  ('signed_permutations','to_permutation is 2^n-to-1: B_2 collapses onto exactly 2 permutations of [2]','eq','2','all sign patterns of one perm share an image',$q$
    SELECT count(DISTINCT one_line(signed_perm_to_permutation((e).value)))::text FROM elements(signed_permutations(2)) e $q$),
  ('signed_permutations','to_permutation image renders in the codomain (permutations) form','eq','231','render_value on a permutation image',$q$
    SELECT render_value(signed_perm_to_permutation(ROW(ARRAY[2,-3,-1])::signed_permutation)) $q$),
  ('signed_permutations','inverse: 2,-1,3 ↦ -2,1,3; -2,-3,1 ↦ 3,-1,-2; -1,2,-3 is self-inverse (matches sage .inverse())','eq','-2,1,3|3,-1,-2|-1,2,-3','w⁻¹(|w(i)|) = sign(w(i))·i',$q$
    SELECT notation(signed_perm_inverse(ROW(ARRAY[2,-1,3])::signed_permutation)) || '|' ||
           notation(signed_perm_inverse(ROW(ARRAY[-2,-3,1])::signed_permutation)) || '|' ||
           notation(signed_perm_inverse(ROW(ARRAY[-1,2,-3])::signed_permutation)) $q$),
  ('signed_permutations','inverse is an involution-closed endomorphism: inverse(inverse(w)) = w over all of B_3','eq','true','group inverse applied twice is the identity',$q$
    SELECT bool_and(((signed_perm_inverse(signed_perm_inverse((e).value))).image) = ((e).value).image)::text
      FROM elements(signed_permutations(3)) e $q$),
  ('signed_permutations','inverse preserves fixed points, negative fixed points and negatives over B_3','eq','true','w(i)=±i ⟺ w⁻¹(i)=±i, and the sign multiset is permuted, not changed',$q$
    SELECT bool_and(
        signed_perm_fixed_points(signed_perm_inverse((e).value)) = signed_perm_fixed_points((e).value) AND
        signed_perm_negative_fixed_points(signed_perm_inverse((e).value)) = signed_perm_negative_fixed_points((e).value) AND
        negatives_count(signed_perm_inverse((e).value)) = negatives_count((e).value)
      )::text FROM elements(signed_permutations(3)) e $q$),
  ('signed_permutations','the registry lists at least the known signed_permutations stats (a floor — more may be added)','eq','true','base_stat rows',$q$
    SELECT (array_agg(stat_id) @> ARRAY['descents','fixed_points','inversions','negative_fixed_points','negatives_count'])::text
    FROM base_stat WHERE collection = 'signed_permutations' $q$),
  ('signed_permutations','the registry lists at least the known signed_permutations maps (a floor — more may be added)','eq','true','base_map rows',$q$
    SELECT (array_agg(map_id) @> ARRAY['inverse','to_permutation'])::text FROM base_map WHERE collection = 'signed_permutations' $q$);
