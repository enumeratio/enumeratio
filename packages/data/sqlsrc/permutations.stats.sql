-- requires: permutations, realizer, utilities
-- permutations — additional statistics + a complement map. Extends the starter set in statistics.sql / maps.sql.

-- ── statistics (carrier: permutation(image int[]), one-line) ─────────────────────────────────────────────
-- ascents: #{ i : w[i] < w[i+1] } (Eulerian; complement of descents). St000245.
CREATE FUNCTION perm_ascents(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i
   WHERE i < array_length((p).image,1) AND (p).image[i] < (p).image[i+1] $$;

-- peaks: #{ i : w[i-1] < w[i] > w[i+1] } (interior local maxima). St000092.
CREATE FUNCTION perm_peaks(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i
   WHERE i > 1 AND i < array_length((p).image,1)
     AND (p).image[i-1] < (p).image[i] AND (p).image[i] > (p).image[i+1] $$;

-- valleys: #{ i : w[i-1] > w[i] < w[i+1] } (interior local minima). St000099.
CREATE FUNCTION perm_valleys(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i
   WHERE i > 1 AND i < array_length((p).image,1)
     AND (p).image[i-1] > (p).image[i] AND (p).image[i] < (p).image[i+1] $$;

-- left-to-right maxima (records): #{ i : w[i] > w[j] for all j < i }. Unsigned-Stirling-1 distributed. St000314.
CREATE FUNCTION perm_ltr_maxima(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (
    SELECT v, max(v) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) prev_max
    FROM unnest((p).image) WITH ORDINALITY t(v, o)
  ) q WHERE prev_max IS NULL OR v > prev_max $$;

-- longest increasing subsequence length (RSK: length of the first row of the P tableau). St000019... St000684.
CREATE FUNCTION perm_lis_length(p permutation) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); dp int[]; best int := 0; i int; j int;
  BEGIN
    dp := array_fill(1, ARRAY[greatest(n,1)]);
    FOR i IN 1..n LOOP
      FOR j IN 1..i-1 LOOP
        IF (p).image[j] < (p).image[i] AND dp[j] + 1 > dp[i] THEN dp[i] := dp[j] + 1; END IF;
      END LOOP;
      IF dp[i] > best THEN best := dp[i]; END IF;
    END LOOP;
    RETURN best;                                            -- 0 for the empty permutation
  END $$;

-- longest decreasing subsequence length (dual of the above; RSK column-length, = LIS of the reverse). St000308-adjacent.
CREATE FUNCTION perm_lds_length(p permutation) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); dp int[]; best int := 0; i int; j int;
  BEGIN
    dp := array_fill(1, ARRAY[greatest(n,1)]);
    FOR i IN 1..n LOOP
      FOR j IN 1..i-1 LOOP
        IF (p).image[j] > (p).image[i] AND dp[j] + 1 > dp[i] THEN dp[i] := dp[j] + 1; END IF;
      END LOOP;
      IF dp[i] > best THEN best := dp[i]; END IF;
    END LOOP;
    RETURN best;                                            -- 0 for the empty permutation
  END $$;

-- weak exceedances: #{ i : w[i] >= i } (excedances + fixed points; always >= 1 since w[1] >= 1). St000213.
CREATE FUNCTION perm_weak_exceedances(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i WHERE (p).image[i] >= i $$;

-- first descent position: least i with w[i] > w[i+1], or 0 if w is the identity (no descent).
CREATE FUNCTION perm_first_descent(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(i), 0)::int FROM generate_subscripts((p).image,1) i
   WHERE i < array_length((p).image,1) AND (p).image[i] > (p).image[i+1] $$;

-- last descent position: greatest i with w[i] > w[i+1], or 0 if w is the identity (no descent).
CREATE FUNCTION perm_last_descent(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(i), 0)::int FROM generate_subscripts((p).image,1) i
   WHERE i < array_length((p).image,1) AND (p).image[i] > (p).image[i+1] $$;

-- ── map: complement — w[i] ↦ n+1-w[i]. A permutation endomorphism (an involution). ───────────────────────
CREATE FUNCTION perm_complement(p permutation) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT array_length((p).image,1) + 1 - (p).image[i]
                   FROM generate_subscripts((p).image,1) i))::permutation $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('permutations','ascents','perm_ascents','Ascents','natural_numbers'),
  ('permutations','peaks','perm_peaks','Peaks','natural_numbers'),
  ('permutations','valleys','perm_valleys','Valleys','natural_numbers'),
  ('permutations','left_to_right_maxima','perm_ltr_maxima','Left-to-right maxima','natural_numbers'),
  ('permutations','longest_increasing_subsequence','perm_lis_length','Longest increasing subsequence length','natural_numbers'),
  ('permutations','longest_decreasing_subsequence','perm_lds_length','Longest decreasing subsequence length','natural_numbers'),
  ('permutations','weak_exceedances','perm_weak_exceedances','Weak exceedances','natural_numbers'),
  ('permutations','first_descent','perm_first_descent','First descent position','natural_numbers'),
  ('permutations','last_descent','perm_last_descent','Last descent position','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutations','complement','perm_complement','permutations','Complement',NULL);

-- ── examples (expected values derived independently in sage over the same fiber) ─────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','ascents over S_4 is the Eulerian row 1,11,11,1','eq','1,11,11,1','#{ i : w[i]<w[i+1] } distribution over permutations(4)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_ascents((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','peaks over S_4: distribution 8,16 (0 or 1 peak)','eq','8,16','#{ i : w[i-1]<w[i]>w[i+1] } over permutations(4)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_peaks((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','valleys over S_4: distribution 8,16 (equidistributed with peaks)','eq','8,16','#{ i : w[i-1]>w[i]<w[i+1] } over permutations(4)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_valleys((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','left-to-right maxima over S_4 is the unsigned Stirling-1 row 6,11,6,1','eq','6,11,6,1','records distribution over permutations(4)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_ltr_maxima((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','longest increasing subsequence over S_4: distribution 1,13,9,1','eq','1,13,9,1','LIS length over permutations(4)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_lis_length((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','longest decreasing subsequence over S_3, in rank order: 1,2,2,2,2,3','eq','1,2,2,2,2,3','LDS length per element of 123,132,213,231,312,321',$q$
    SELECT string_agg(perm_lds_length((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','LDS over S_4 matches the LIS distribution 1,13,9,1 (RSK column/row duality)','eq','1,13,9,1','longest decreasing subsequence over permutations(4)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_lds_length((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','weak exceedances over S_3, in rank order: 3,2,2,2,1,2','eq','3,2,2,2,1,2','#{ i : w[i]>=i } per element of 123,132,213,231,312,321',$q$
    SELECT string_agg(perm_weak_exceedances((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','weak exceedances over S_4 is the Eulerian row 1,11,11,1 (values 1..4)','eq','1,11,11,1','#{ i : w[i]>=i } distribution over permutations(4)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_weak_exceedances((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','first descent over S_3, in rank order: 0,2,1,2,1,1','eq','0,2,1,2,1,1','least i with w[i]>w[i+1], 0 = identity, per element of 123,132,213,231,312,321',$q$
    SELECT string_agg(perm_first_descent((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','last descent over S_3, in rank order: 0,2,1,2,1,2','eq','0,2,1,2,1,2','greatest i with w[i]>w[i+1], 0 = identity, per element of 123,132,213,231,312,321',$q$
    SELECT string_agg(perm_last_descent((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','first/last descent over S_4: distributions 1,12,8,3 and 1,3,8,12 (mirror images)','eq','1,12,8,3|1,3,8,12','positions 0..3 over permutations(4)',$q$
    SELECT (SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_first_descent((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c)) || '|' ||
           (SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_last_descent((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c)) $q$),
  ('permutations','spot check 2413: ascents 2, peaks 1, valleys 1, ltr-maxima 2, LIS 2','eq','2|1|1|2|2','all five new stats on 2413',$q$
    SELECT perm_ascents(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_peaks(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_valleys(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_ltr_maxima(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_lis_length(ROW(ARRAY[2,4,1,3])::permutation)::text $q$),
  ('permutations','spot check 2413: LDS 2, weak-exceedances 2, first-descent 2, last-descent 2','eq','2|2|2|2','the four newest stats on 2413',$q$
    SELECT perm_lds_length(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_weak_exceedances(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_first_descent(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_last_descent(ROW(ARRAY[2,4,1,3])::permutation)::text $q$),
  ('permutations','complement over S_3: each w ↦ 4-w, in rank order','eq','321,312,231,213,132,123','complement of 123,132,213,231,312,321',$q$
    SELECT string_agg(one_line(perm_complement((e).value)), ',' ORDER BY ordinality(e)) FROM elements(permutations(3)) e $q$),
  ('permutations','complement: 2413 → 3142, and it is an involution','eq','3142|2413','w[i] ↦ n+1-w[i]',$q$
    SELECT one_line(perm_complement(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           one_line(perm_complement(perm_complement(ROW(ARRAY[2,4,1,3])::permutation))) $q$);
