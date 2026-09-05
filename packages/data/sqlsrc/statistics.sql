-- requires: permutations, integer_partitions, integer_compositions, dyck_paths, set_partitions, subsets
-- statistics — Phase 2 of the client/CLI catalog port: a per-element → numeric value function per collection,
-- registered in base_stat so the client can project it as a column (`--stats`). This is a STARTER set over a few
-- representative carriers; further stats live here or, better, alongside their collection. A stat's value_fn takes
-- the CARRIER; the client calls value_fn((element).value). (Mirrors the C-ext `stat` table + value_func_id.)

-- ── permutations (image int[]) ─────────────────────────────────────────────────────────────────────────
CREATE FUNCTION perm_inversions(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) j
   WHERE i < j AND (p).image[i] > (p).image[j] $$;
CREATE FUNCTION perm_descents(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i
   WHERE i < array_length((p).image,1) AND (p).image[i] > (p).image[i+1] $$;
CREATE FUNCTION perm_fixed_points(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i WHERE (p).image[i] = i $$;

-- ── integer_partitions (parts int[], non-increasing) ────────────────────────────────────────────────────
CREATE FUNCTION partition_length(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((p).parts,1), 0) $$;
CREATE FUNCTION partition_largest(p integer_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((p).parts[1], 0) $$;                                          -- stored non-increasing ⇒ first is max

-- ── integer_compositions (parts int[]) ──────────────────────────────────────────────────────────────────
CREATE FUNCTION composition_num_parts(c composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((c).parts,1), 0) $$;
CREATE FUNCTION composition_largest(c composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((c).parts) x), 0) $$;

-- ── dyck_paths (steps ±1) ───────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION dyck_peaks(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((d).steps,1) i
   WHERE i < array_length((d).steps,1) AND (d).steps[i] = 1 AND (d).steps[i+1] = -1 $$;      -- an up immediately followed by a down
CREATE FUNCTION dyck_height(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((d).steps) WITH ORDINALITY AS t(s, o)) q $$;

-- ── set_partitions (rgs int[]) ──────────────────────────────────────────────────────────────────────────
CREATE FUNCTION setpart_blocks(s set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((s).rgs) x), -1) + 1 $$;                        -- blocks = max RGS value + 1

-- ── subsets (members int[], sorted ascending) ───────────────────────────────────────────────────────────
CREATE FUNCTION cardinality(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((s).members,1), 0) $$;   -- overload of cardinality(subsets) handle-count; distinct arg types (finset vs subsets), pg resolves by type (#107)
CREATE FUNCTION subset_sum(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT sum(x) FROM unnest((s).members) x), 0)::int $$;
CREATE FUNCTION subset_max(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((s).members[array_length((s).members,1)], 0) $$;                           -- sorted ⇒ last is the max
CREATE FUNCTION subset_min(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((s).members[1], 0) $$;

-- ── more classic statistics ─────────────────────────────────────────────────────────────────────────────
-- permutations: major index (Σ descent positions — Mahonian, equidistributed with inversions), excedances
-- (#{ i : p(i) > i }), and the number of cycles (unsigned-Stirling-1 distributed).
CREATE FUNCTION perm_major_index(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(i), 0)::int FROM generate_subscripts((p).image,1) i
   WHERE i < array_length((p).image,1) AND (p).image[i] > (p).image[i+1] $$;
CREATE FUNCTION perm_excedances(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).image,1) i WHERE (p).image[i] > i $$;
CREATE FUNCTION perm_cycle_count(p permutation) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          c int := 0; i int; j int;
  BEGIN
    FOR i IN 1..n LOOP
      IF NOT seen[i] THEN c := c + 1; j := i; LOOP seen[j] := true; j := (p).image[j]; EXIT WHEN j = i; END LOOP; END IF;
    END LOOP;
    RETURN c;
  END $$;

-- dyck_paths: area (Σ of the height after each down-step — the q,t-Catalan area, giving the q-Catalan distribution).
CREATE FUNCTION dyck_area(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(h) FILTER (WHERE s = -1), 0)::int
  FROM (SELECT s, sum(s) OVER (ORDER BY o) h FROM unnest((d).steps) WITH ORDINALITY AS t(s, o)) q $$;

-- set_partitions: the size of the largest block.
CREATE FUNCTION setpart_largest_block(s set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(c) FROM (SELECT count(*) c FROM unnest((s).rgs) v GROUP BY v) t), 0)::int $$;

-- ── register in base_stat (collection, stat_id, value_fn, title, codomain) ──────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('permutations','inversions','perm_inversions','Inversions','natural_numbers'),
  ('permutations','descents','perm_descents','Descents','natural_numbers'),
  ('permutations','fixed_points','perm_fixed_points','Fixed points','natural_numbers'),
  ('integer_partitions','length','partition_length','Number of parts','natural_numbers'),
  ('integer_partitions','largest_part','partition_largest','Largest part','natural_numbers'),
  ('integer_compositions','parts_count','composition_num_parts','Number of parts','natural_numbers'),
  ('integer_compositions','largest_part','composition_largest','Largest part','natural_numbers'),
  ('dyck_paths','peaks','dyck_peaks','Peaks','natural_numbers'),
  ('dyck_paths','height','dyck_height','Height','natural_numbers'),
  ('set_partitions','blocks','setpart_blocks','Number of blocks','natural_numbers'),
  ('subsets','cardinality','cardinality','Cardinality','natural_numbers'),
  ('subsets','sum','subset_sum','Sum of elements','natural_numbers'),
  ('subsets','max_element','subset_max','Largest element','natural_numbers'),
  ('subsets','min_element','subset_min','Smallest element','natural_numbers'),
  ('permutations','major_index','perm_major_index','Major index','natural_numbers'),
  ('permutations','excedances','perm_excedances','Excedances','natural_numbers'),
  ('permutations','cycles','perm_cycle_count','Number of cycles','natural_numbers'),
  ('dyck_paths','area','dyck_area','Area','natural_numbers'),
  ('set_partitions','largest_block','setpart_largest_block','Largest block','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('statistics','inversions(321) = 3, descents(321) = 2, fixed_points(321) = 1','eq','3|2|1','permutation 3,2,1 (2 is a fixed point)',$q$
    SELECT perm_inversions(ROW(ARRAY[3,2,1])::permutation)::text || '|' ||
           perm_descents(ROW(ARRAY[3,2,1])::permutation)::text || '|' ||
           perm_fixed_points(ROW(ARRAY[3,2,1])::permutation)::text $q$),
  ('statistics','inversions is a Mahonian stat: sum over S_3 = 9','eq','9','Σ inversions over all of permutations(3)',$q$
    SELECT sum(perm_inversions((e).value))::text FROM elements(permutations(3)) e $q$),
  ('statistics','partition 3+1: length 2, largest 3','eq','2|3','integer_partition {3,1}',$q$
    SELECT partition_length(ROW(ARRAY[3,1])::integer_partition)::text || '|' ||
           partition_largest(ROW(ARRAY[3,1])::integer_partition)::text $q$),
  ('statistics','dyck peaks(UDUD)=2, height(UUDD)=2','eq','2|2','',$q$
    SELECT dyck_peaks(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_height(ROW(ARRAY[1,1,-1,-1])::dyck_path)::text $q$),
  ('statistics','set partition {0,1,0} has 2 blocks','eq','2','RGS 010 = {1,3}/{2}',$q$
    SELECT setpart_blocks(ROW(ARRAY[0,1,0])::set_partition)::text $q$),
  ('statistics','the registry lists at least the known permutation stats (a floor — more may be added)','eq','true','base_stat rows',$q$
    SELECT (array_agg(stat_id) @> ARRAY['ascents','cycles','descents','excedances','first_descent','fixed_points','inversions','last_descent','left_to_right_maxima','longest_decreasing_subsequence','longest_increasing_subsequence','major_index','peaks','valleys','weak_exceedances'])::text
    FROM base_stat WHERE collection = 'permutations' $q$),
  ('statistics','peaks over dyck_paths(3) sum to 10 (Narayana N(3,k)=1,3,1 ⇒ Σ k·N = 1+6+3)','eq','10','Σ peaks over the 5 Dyck paths of semilength 3',$q$
    SELECT sum(dyck_peaks((e).value))::text FROM elements(dyck_paths(3)) e $q$),
  ('statistics','finset {1,3,4}: cardinality 3, sum 8, max 4, min 1','eq','3|8|4|1','finset stats',$q$
    SELECT cardinality(ROW(ARRAY[1,3,4], 4)::finset)::text || '|' || subset_sum(ROW(ARRAY[1,3,4], 4)::finset)::text || '|' ||
           subset_max(ROW(ARRAY[1,3,4], 4)::finset)::text || '|' || subset_min(ROW(ARRAY[1,3,4], 4)::finset)::text $q$),
  ('statistics','grouping subsets(4) by cardinality is the Pascal row 1,4,6,4,1','eq','1,4,6,4,1','the |S|-distribution over 2^[4]',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT cardinality((e).value) k, count(*) c FROM elements(subsets(4)) e GROUP BY 1) t(k,c) $q$),
  ('statistics','major index is Mahonian: its distribution over S_3 is 1,2,2,1 (same as inversions)','eq','1,2,2,1','Σ of the descent positions',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_major_index((e).value) k, count(*) c FROM elements(permutations(3)) e GROUP BY 1) t(k,c) $q$),
  ('statistics','excedances over S_4 is the Eulerian row 1,11,11,1','eq','1,11,11,1','#{ i : p(i) > i }',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_excedances((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('statistics','number of cycles over S_4 is the unsigned Stirling-1 row 6,11,6,1','eq','6,11,6,1','cycle count',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_cycle_count((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('statistics','Dyck area is Carlitz-Riordan: Σ over Dyck(3) = 7 (q-Catalan 1+2q+q^2+q^3)','eq','7','area = Σ height after each down-step',$q$
    SELECT sum(dyck_area((e).value))::text FROM elements(dyck_paths(3)) e $q$),
  ('statistics','largest block of {1,3}/{2} is 2','eq','2','set partition RGS 010',$q$
    SELECT setpart_largest_block(ROW(ARRAY[0,1,0])::set_partition)::text $q$),
  ('statistics','Mahonian: permutations(4) by inversions = [4]_q! coefficients 1,3,5,6,5,3,1','eq','1,3,5,6,5,3,1','the q-factorial distribution (Σ=24=4!)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_inversions((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('statistics','Eulerian: permutations(4) by descents = 1,11,11,1 (equidistributed with excedances)','eq','1,11,11,1','the classic descent statistic; A008292 row 4 (Σ=24)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_descents((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('statistics','Narayana: dyck_paths(4) by peaks = 1,6,6,1','eq','1,6,6,1','N(4,k) refining Catalan(4)=14',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT dyck_peaks((e).value) k, count(*) c FROM elements(dyck_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('statistics','Stirling-2: set_partitions(4) by number of blocks = 1,7,6,1','eq','1,7,6,1','S(4,k) refining Bell(4)=15',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT setpart_blocks((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c) $q$);
