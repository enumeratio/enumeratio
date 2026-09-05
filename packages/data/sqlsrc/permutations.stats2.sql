-- requires: permutations, statistics, permutations.stats, realizer, utilities
-- permutations — the statistic long tail (#240 part A, chunk 1): records variants, runs, sign, order,
-- reflection length, cycle-length counts. NOT separately registered: "number_of_occurrences_of_21" and
-- "adjacent_transpositions" from the ticket are both, by definition, exactly perm_inversions (an inversion
-- IS an occurrence of the pattern 21; the minimum number of ADJACENT transpositions to sort — bubble sort —
-- is exactly the inversion count). Registering them as duplicate-valued base_stat rows made find_stat's/
-- distribution_match's "recover the stat from its values" examples nondeterministic (multiple stats now tie
-- on identical values), so they're noted here instead of re-registered under the existing inversions stat.

-- ── records variants (statistics.sql/permutations.stats.sql already has left_to_right_maxima) ─────────────
-- left-to-right minima: #{ i : w[i] < w[j] for all j < i }. Dual of left_to_right_maxima.
CREATE FUNCTION perm_ltr_minima(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (
    SELECT v, min(v) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) prev_min
    FROM unnest((p).image) WITH ORDINALITY t(v, o)
  ) q WHERE prev_min IS NULL OR v < prev_min $$;

-- right-to-left maxima: #{ i : w[i] > w[j] for all j > i }. Read the reverse image, then take ltr maxima.
CREATE FUNCTION perm_rtl_maxima(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (
    SELECT v, max(v) OVER (ORDER BY o DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) foll_max
    FROM unnest((p).image) WITH ORDINALITY t(v, o)
  ) q WHERE foll_max IS NULL OR v > foll_max $$;

-- right-to-left minima: #{ i : w[i] < w[j] for all j > i }.
CREATE FUNCTION perm_rtl_minima(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (
    SELECT v, min(v) OVER (ORDER BY o DESC ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) foll_min
    FROM unnest((p).image) WITH ORDINALITY t(v, o)
  ) q WHERE foll_min IS NULL OR v < foll_min $$;

-- ── runs: maximal ascending runs, a derived stat (#runs = #descents + 1) ────────────────────────────────
CREATE FUNCTION perm_runs(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT perm_descents(p) + 1 $$;

-- longest_run: the length (in elements) of the longest maximal ascending run. A new run starts wherever the
-- previous element is NOT smaller (a descent, or the first element); a running sum of these starts is a
-- run-id — group by it and take the largest group size.
CREATE FUNCTION perm_longest_run(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(run_len), 0)::int FROM (
    SELECT count(*) run_len FROM (
      SELECT o, sum(is_start) OVER (ORDER BY o) AS run_id FROM (
        SELECT o, v, CASE WHEN v > lag(v) OVER (ORDER BY o) THEN 0 ELSE 1 END AS is_start
        FROM unnest((p).image) WITH ORDINALITY t(v, o)
      ) w
    ) s
    GROUP BY run_id
  ) x $$;

-- ── sign (parity): 0 = even, 1 = odd, i.e. inv(w) mod 2. ────────────────────────────────────────────────
CREATE FUNCTION perm_sign(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT perm_inversions(p) % 2 $$;

-- ── order: the multiplicative order of w as a group element = lcm of its cycle lengths. ────────────────
CREATE FUNCTION perm_order(p permutation) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          i int; j int; len int; ord numeric := 1;
  BEGIN
    IF n = 0 THEN RETURN 1; END IF;
    FOR i IN 1..n LOOP
      IF NOT seen[i] THEN
        len := 0; j := i;
        LOOP seen[j] := true; j := (p).image[j]; len := len + 1; EXIT WHEN j = i; END LOOP;
        ord := lcm(ord, len::numeric);
      END IF;
    END LOOP;
    RETURN ord::int;
  END $$;

-- ── reflection_length: minimum number of (not-necessarily-adjacent) transpositions to reach w = n − cycles. ─
CREATE FUNCTION perm_reflection_length(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((p).image,1),0) - perm_cycle_count(p) $$;

-- ── cycle-length counts (cycles_of_length_1 = fixed_points, already registered; 2 and 3 here). ──────────
CREATE FUNCTION perm_cycles_of_length_2(p permutation) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          i int; j int; len int; c int := 0;
  BEGIN
    FOR i IN 1..n LOOP
      IF NOT seen[i] THEN
        len := 0; j := i;
        LOOP seen[j] := true; j := (p).image[j]; len := len + 1; EXIT WHEN j = i; END LOOP;
        IF len = 2 THEN c := c + 1; END IF;
      END IF;
    END LOOP;
    RETURN c;
  END $$;
CREATE FUNCTION perm_cycles_of_length_3(p permutation) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length((p).image,1),0); seen boolean[] := array_fill(false, ARRAY[greatest(n,1)]);
          i int; j int; len int; c int := 0;
  BEGIN
    FOR i IN 1..n LOOP
      IF NOT seen[i] THEN
        len := 0; j := i;
        LOOP seen[j] := true; j := (p).image[j]; len := len + 1; EXIT WHEN j = i; END LOOP;
        IF len = 3 THEN c := c + 1; END IF;
      END IF;
    END LOOP;
    RETURN c;
  END $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('permutations','left_to_right_minima','perm_ltr_minima','Left-to-right minima','natural_numbers'),
  ('permutations','right_to_left_maxima','perm_rtl_maxima','Right-to-left maxima','natural_numbers'),
  ('permutations','right_to_left_minima','perm_rtl_minima','Right-to-left minima','natural_numbers'),
  ('permutations','runs','perm_runs','Number of maximal ascending runs','natural_numbers'),
  ('permutations','longest_run','perm_longest_run','Length of the longest ascending run','natural_numbers'),
  ('permutations','sign','perm_sign','Sign (parity: 0 even, 1 odd)','natural_numbers'),
  ('permutations','order','perm_order','Order (lcm of cycle lengths)','natural_numbers'),
  ('permutations','reflection_length','perm_reflection_length','Reflection length','natural_numbers'),
  ('permutations','number_of_cycles_of_length_2','perm_cycles_of_length_2','Number of 2-cycles','natural_numbers'),
  ('permutations','number_of_cycles_of_length_3','perm_cycles_of_length_3','Number of 3-cycles','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations','records variants on 2413: ltr-max 2, ltr-min 2, rtl-max 2, rtl-min 2','eq','2|2|2|2','left_to_right_maxima already exists; the three duals here',$q$
    SELECT perm_ltr_maxima(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_ltr_minima(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_rtl_maxima(ROW(ARRAY[2,4,1,3])::permutation)::text || '|' ||
           perm_rtl_minima(ROW(ARRAY[2,4,1,3])::permutation)::text $q$),
  ('permutations','runs = descents+1: distribution over permutations(4) is the Eulerian row shifted, 1,11,11,1 for values 1..4','eq','1,11,11,1','maximal ascending runs',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_runs((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','longest_run over permutations(3): distribution 1,4,1 for values 1,2,3 (hand-traced: only 123 and 321 are extremal)','eq','1,4,1','length of the longest maximal ascending run',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_longest_run((e).value) k, count(*) c FROM elements(permutations(3)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','sign over permutations(4) splits evenly: 12 even (0), 12 odd (1)','eq','12,12','parity of inversions',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_sign((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','order over permutations(4): distribution 1,9,8,6 for orders 1,2,3,4 (by cycle type)','eq','1,9,8,6','lcm of cycle lengths',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_order((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','order spot check: the 4-cycle 2341 has order 4, the double-transposition 2143 has order 2','eq','4|2','lcm(4)=4, lcm(2,2)=2',$q$
    SELECT perm_order(ROW(ARRAY[2,3,4,1])::permutation)::text || '|' || perm_order(ROW(ARRAY[2,1,4,3])::permutation)::text $q$),
  ('permutations','reflection_length over permutations(4): distribution 1,6,11,6 for lengths 0,1,2,3 (n − cycles)','eq','1,6,11,6','minimum (non-adjacent) transpositions',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_reflection_length((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','cycles_of_length_2 over permutations(4): distribution 15,6,3 for counts 0,1,2','eq','15,6,3','2-cycles per permutation',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_cycles_of_length_2((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$),
  ('permutations','cycles_of_length_3 over permutations(4): distribution 16,8 for counts 0,1','eq','16,8','3-cycles per permutation',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perm_cycles_of_length_3((e).value) k, count(*) c FROM elements(permutations(4)) e GROUP BY 1) t(k,c) $q$);
