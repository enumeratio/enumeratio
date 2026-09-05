-- requires: permutations, statistics, pattern_avoiding_permutations, realizer, utilities
-- permutations — #240 part A, chunk 3: depth, cyclic descents, stack-sortability, a peak_set map, and
-- pattern-occurrence COUNTS (as opposed to the avoidance booleans in pattern_avoiding_permutations.sql).

-- ── depth (St000029): Σ over i with w(i)>i of (w(i)-i). Half the total displacement |w(i)-i|. ────────────
-- Values verified against FindStat's own worked examples before writing: [2,1]↦1, [1,2]↦0.
CREATE FUNCTION perm_depth(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum((p).image[i] - i), 0)::int FROM generate_subscripts((p).image,1) i WHERE (p).image[i] > i $$;

-- ── cyclic_descents: ordinary descents, plus a wrap-around descent if w(n) > w(1) (Cellini's cyclic descent
-- set: extend the descent positions {1..n-1} to the circular word w(1)…w(n)w(1)). A permutation's linear
-- arrangement can never be monotonically increasing all the way around a cycle (n>1), so this is always ≥1.
CREATE FUNCTION perm_cyclic_descents(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT perm_descents(p) + CASE WHEN coalesce(array_length((p).image,1),0) > 0
                                   AND (p).image[array_length((p).image,1)] > (p).image[1]
                              THEN 1 ELSE 0 END $$;

-- ── stack_sortable (0/1): Knuth's theorem — a permutation is sortable by one pass through a stack iff it
-- avoids the pattern 231. Reuses is_avoiding_231 (pattern_avoiding_permutations.sql).
CREATE FUNCTION perm_stack_sortable(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT is_avoiding_231(p)::int $$;

-- ── peak_set (map → subsets): the interior local-maxima positions {i : w(i-1)<w(i)>w(i+1)}, a finset of
-- {1..n} (positions 1 and n can never be peaks, but the ground stays n to match the descent_set convention
-- of subsets over the full index range — here the register's first/last bit is always 0).
CREATE FUNCTION permutation_peak_set(p permutation) RETURNS finset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT i FROM generate_subscripts((p).image, 1) i
    WHERE i > 1 AND i < array_length((p).image, 1)
      AND (p).image[i-1] < (p).image[i] AND (p).image[i] > (p).image[i+1]
    ORDER BY i
  ), array_length((p).image, 1))::finset $$;

-- ── pattern OCCURRENCE COUNTS (vs. the avoidance booleans in pattern_avoiding_permutations.sql): count every
-- length-3 subsequence order-isomorphic to (r1,r2,r3), not just test existence. Same O(n³) triple scan as
-- permutation_avoids_pattern3, but count(*) instead of NOT EXISTS.
CREATE FUNCTION perm_pattern3_count(p permutation, r1 int, r2 int, r3 int) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) j, generate_subscripts((p).image,1) k
   WHERE i < j AND j < k
     AND (((p).image[i] < (p).image[j]) = (r1 < r2))
     AND (((p).image[i] < (p).image[k]) = (r1 < r3))
     AND (((p).image[j] < (p).image[k]) = (r2 < r3)) $$;
CREATE FUNCTION perm_occurrences_123(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT perm_pattern3_count(p,1,2,3) $$;
CREATE FUNCTION perm_occurrences_132(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT perm_pattern3_count(p,1,3,2) $$;

-- ── occurrences_of_21_3 (VINCULAR): the "21" part must sit at ADJACENT positions (i,i+1) with w(i)>w(i+1);
-- the "3" part is any later position k>i+1 with w(k) > w(i) (largest of the three, matching pattern (2,1,3)).
-- Hand-verified: 3142 has exactly 1 occurrence (adjacent descent (3,1) at i=1, then w(3)=4>3 ⇒ counts;
-- the other adjacent descent (4,2) at i=3 has no k>4). 2413, 4231, 3412 and 4132 each score 0 (traced by hand:
-- every adjacent descent's later values never exceed its own "2"-role value in those four).
CREATE FUNCTION perm_occurrences_21_3(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) k
   WHERE i < array_length((p).image,1) AND k > i + 1
     AND (p).image[i] > (p).image[i+1]        -- adjacent "21"
     AND (p).image[k] > (p).image[i] $$;       -- later "3", largest of the three

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('permutations','depth','perm_depth','Depth (St000029)','natural_numbers'),
  ('permutations','cyclic_descents','perm_cyclic_descents','Cyclic descents','natural_numbers'),
  ('permutations','stack_sortable','perm_stack_sortable','Stack-sortable (0/1)','natural_numbers'),
  ('permutations','occurrences_of_123','perm_occurrences_123','Number of occurrences of the pattern 123','natural_numbers'),
  ('permutations','occurrences_of_132','perm_occurrences_132','Number of occurrences of the pattern 132','natural_numbers'),
  ('permutations','number_of_occurrences_of_21_3','perm_occurrences_21_3','Number of occurrences of the vincular pattern 21-3','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','peak_set','permutation_peak_set','subsets','Peak set',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','depth over permutations(3), in rank order: 0,1,1,2,2,2 (hand-traced against St000029''s definition)','eq','0,1,1,2,2,2','Σ_{w(i)>i} (w(i)-i)',$q$
    SELECT string_agg(perm_depth((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','depth spot check matching FindStat''s own worked example: 21 scores 1, 12 scores 0','eq','1|0','the smallest nontrivial case',$q$
    SELECT perm_depth(ROW(ARRAY[2,1])::permutation)::text || '|' || perm_depth(ROW(ARRAY[1,2])::permutation)::text $q$),
  ('permutations','cyclic_descents over permutations(3), in rank order: 1,2,2,1,1,2 (ordinary descents + wrap w(n)>w(1))','eq','1,2,2,1,1,2','a permutation can never increase monotonically all the way around the cycle, so this is always ≥1',$q$
    SELECT string_agg(perm_cyclic_descents((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','stack_sortable over permutations(4): 14 sortable (Catalan(4)), matching Av(231)''s own cardinality','eq','14','count of 1s = |Av(231)| at n=4',$q$
    SELECT count(*) FILTER (WHERE perm_stack_sortable((e).value) = 1)::text FROM elements(permutations(4)) e $q$),
  ('permutations','stack_sortable agrees with is_avoiding_231 element-wise over permutations(4)','eq','true','same predicate, two names',$q$
    SELECT bool_and((perm_stack_sortable((e).value) = 1) = is_avoiding_231((e).value))::text FROM elements(permutations(4)) e $q$),
  ('permutations','peak_set: 2413 ↦ {2} (ground 4, register 0100); the identity and any run have no interior peak','eq','0100|0000','positions of interior local maxima',$q$
    SELECT notation(permutation_peak_set(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           notation(permutation_peak_set(ROW(ARRAY[1,2,3,4])::permutation)) $q$),
  ('permutations','peak_set count matches the existing peaks stat, over permutations(4)','eq','true','the map and the earlier count-only stat agree',$q$
    SELECT bool_and(cardinality(permutation_peak_set((e).value)) = perm_peaks((e).value))::text FROM elements(permutations(4)) e $q$),
  ('permutations','occurrences_of_123 and occurrences_of_132 each total 16 over permutations(4) (C(4,3)·4!/6, by symmetry every length-3 pattern is equally likely)','eq','16|16','a floor-free arithmetic identity, not a guess',$q$
    SELECT sum(perm_occurrences_123((e).value))::text || '|' || sum(perm_occurrences_132((e).value))::text FROM elements(permutations(4)) e $q$),
  ('permutations','occurrences_of_132 on permutations(3): only 132 itself scores 1, everything else scores 0','eq','0,1,0,0,0,0','n=3 has one length-3 subsequence per permutation — itself',$q$
    SELECT string_agg(perm_occurrences_132((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','vincular 21-3 spot check: 3142 scores 1 (adjacent descent 3,1 at i=1, then w(3)=4>3); 2413, 4231, 3412, 4132 each score 0','eq','1|0|0|0|0','hand-traced, not a formula guess',$q$
    SELECT perm_occurrences_21_3(ROW(ARRAY[3,1,4,2])::permutation)::text || '|' ||
           perm_occurrences_21_3(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_occurrences_21_3(ROW(ARRAY[4,2,3,1])::permutation)::text || '|' ||
           perm_occurrences_21_3(ROW(ARRAY[3,4,1,2])::permutation)::text || '|' ||
           perm_occurrences_21_3(ROW(ARRAY[4,1,3,2])::permutation)::text $q$),
  ('permutations','number_of_occurrences_of_21_3 is 0 exactly on permutations avoiding the vincular pattern, e.g. the identity of any size','eq','true','no adjacent descent at all ⇒ zero occurrences, trivially',$q$
    SELECT bool_and(perm_occurrences_21_3((unrank(permutations(n), 0)).value) = 0)::text FROM generate_series(1,6) n $q$);
