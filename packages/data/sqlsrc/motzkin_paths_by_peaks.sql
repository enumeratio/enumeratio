-- requires: motzkin_paths, motzkin_paths.stats, triangle_slices, realizer, utilities
-- motzkin_paths_by_peaks(n,k) — the MOTZKIN TRIANGLE (OEIS A055151): Motzkin paths of length n with exactly k
-- peaks (a peak = a U immediately followed by a D, the same `peaks` statistic motzkin_paths already carries).
-- Reuses the motzkin_path carrier directly (steps int[] of +1/0/-1) rather than a fresh bespoke type — the
-- carrier already fits, per the audit's "one family, one carrier" rule (§3.2), unlike narayana_numbers'
-- narayana_dyck (a pre-existing instance of the friction this batch avoids repeating). Registered against
-- `triangle_refines` as a genuine refinement of motzkin_paths by its own `peaks` stat, differential-checked
-- below. fiber_count is an independent DP over (position, height, peaks-so-far) — not a re-scan of the floor.

CREATE FUNCTION motzkin_peak_count(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE cur numeric[][][]; nxt numeric[][][]; h int; p int; lu int; step int; w numeric; nh int; np int; BEGIN
    IF n < 0 OR k < 0 OR k * 2 > n THEN RETURN 0; END IF;
    -- cur[height+1][peaks+1][last_was_u+1]: ways to be here; last_was_u tracks whether the previous step was a
    -- U (so an immediately-following D would complete a peak). peaks is capped at k (paths that would exceed
    -- it are simply never generated — dead ends are fine, they just don't reach the target cell).
    cur := array_fill(0::numeric, ARRAY[n + 1, k + 1, 2]);
    cur[1][1][1] := 1;                                            -- height 0, peaks 0, last_was_u = false
    FOR step IN 1..n LOOP
      nxt := array_fill(0::numeric, ARRAY[n + 1, k + 1, 2]);
      FOR h IN 0..n LOOP
        FOR p IN 0..k LOOP
          FOR lu IN 0..1 LOOP
            w := cur[h + 1][p + 1][lu + 1];
            IF w = 0 THEN CONTINUE; END IF;
            -- level step L: height/peaks unchanged, last_was_u := false
            nxt[h + 1][p + 1][1] := nxt[h + 1][p + 1][1] + w;
            -- up step U: height+1 (if room remains), peaks unchanged, last_was_u := true
            IF h + 1 <= n THEN nxt[h + 2][p + 1][2] := nxt[h + 2][p + 1][2] + w; END IF;
            -- down step D: height-1 (if h≥1); a peak completes iff the previous step was U (lu=1)
            IF h - 1 >= 0 THEN
              np := p + lu;
              IF np <= k THEN nxt[h][np + 1][1] := nxt[h][np + 1][1] + w; END IF;
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
      cur := nxt;
    END LOOP;
    RETURN cur[1][k + 1][1] + cur[1][k + 1][2];
  END $$;

CREATE TYPE motzkin_paths_by_peaks_fiber AS (n natural_number, k natural_number);
-- FLOOR: generate every Motzkin path of length n (the same bounded walk motzkin_paths uses), keep only those
-- with exactly k peaks, emitted in the same ascending-step order as motzkin_paths.
CREATE FUNCTION fiber_elements(f motzkin_paths_by_peaks_fiber, element_limit int) RETURNS SETOF motzkin_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE walk(pos, height, steps) AS (
    SELECT 0, 0, ARRAY[]::int[]
    UNION ALL
    SELECT pos + 1, height + step, steps || step
    FROM walk, (VALUES (1), (0), (-1)) AS s(step)
    WHERE pos < (f).n::int
      AND height + step >= 0
      AND height + step <= (f).n::int - (pos + 1)
  )
  SELECT ROW(steps)::motzkin_path FROM walk
  WHERE pos = (f).n::int AND height = 0 AND motzkin_peaks(ROW(steps)::motzkin_path) = (f).k::int
  ORDER BY steps
  LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f motzkin_paths_by_peaks_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT motzkin_peak_count((f).n::int, (f).k::int) $$;

CREATE FUNCTION contains_in_fiber(f motzkin_paths_by_peaks_fiber, v motzkin_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (-1, 0, 1))
     AND (SELECT coalesce(sum(s), 0) FROM unnest((v).steps) s) = 0
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).steps, 1) i
                     WHERE (SELECT sum((v).steps[j]) FROM generate_series(1, i) j) < 0)
     AND motzkin_peaks(v) = (f).k::int $$;

INSERT INTO base_collection VALUES ('motzkin_paths_by_peaks', 'motzkin_path');
INSERT INTO base_grade VALUES
  ('motzkin_paths_by_peaks', 1, 'n', NULL, NULL),
  ('motzkin_paths_by_peaks', 2, 'k', '0', 'trunc(g1/2)');          -- k ranges 0..floor(n/2)
CREATE FUNCTION fiber_symbol(f motzkin_paths_by_peaks_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Motz' || to_unicode_subscript((f).k) || '(' || (f).n::int || ')' $$;
SELECT base_realize('motzkin_paths_by_peaks');

INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('motzkin_paths_by_peaks', 'n', 'k', 'Motzkin triangle — Motzkin paths of length n by number of peaks (A055151)', 'motzkin_numbers');

-- the base_triangle_refines row lives in triangle_refines.sql itself (requires-tag: collection loads it after
-- every collection, this one included — an explicit `requires: triangle_refines` here would be circular).

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('motzkin_paths_by_peaks','row n=4 over k=0..2 (accel) is 4,4,1','eq','4,4,1','matches the peaks distribution already checked in motzkin_paths.stats.sql',$q$
    SELECT string_agg(cardinality(motzkin_paths_by_peaks(4,k))::text, ',' ORDER BY k) FROM generate_series(0,2) k $q$),
  ('motzkin_paths_by_peaks','row n=5 over k=0..2 (accel) is 8,10,3','eq','8,10,3','matches the peaks distribution already checked in motzkin_paths.stats.sql',$q$
    SELECT string_agg(cardinality(motzkin_paths_by_peaks(5,k))::text, ',' ORDER BY k) FROM generate_series(0,2) k $q$),
  ('motzkin_paths_by_peaks','row-sum: Σ_k T(n,k) = Motzkin(n) for n=0..7','eq','true','the triangle refines the Motzkin numbers',$q$
    SELECT bool_and(cardinality(motzkin_paths_by_peaks(n)) = motzkin(n))::text FROM generate_series(0,7) n $q$),
  ('motzkin_paths_by_peaks','the DP accel and the filtered floor agree for every (n,k), n≤6','eq','true','accelerated == naive (the selfcert claim, exercised directly)',$q$
    SELECT bool_and(cardinality(motzkin_paths_by_peaks(n,k)) = (SELECT count(*) FROM elements(motzkin_paths_by_peaks(n,k), 1000)))::text
      FROM generate_series(0,6) n, generate_series(0, n/2) k $q$),
  ('motzkin_paths_by_peaks','every element of fiber [5,1] has exactly 1 peak (structural invariant)','eq','true','cross-checked via the shared motzkin_peaks stat',$q$
    SELECT bool_and(motzkin_peaks((e).value) = 1)::text FROM elements(motzkin_paths_by_peaks(5,1)) e $q$),
  ('motzkin_paths_by_peaks','triangle_refines_agrees holds for the registered (motzkin_paths_by_peaks, motzkin_paths, peaks) row, n≤6','eq','true','the generic differential from triangle_refines.sql',$q$
    SELECT triangle_refines_agrees('motzkin_paths_by_peaks', 'motzkin_paths', 'peaks', 6)::text $q$),
  ('motzkin_paths_by_peaks','contains via <@: UD ∈ motzkin_paths_by_peaks(2,1), LL ∉ (0 peaks, not 1)','eq','true|false','membership = parent path ∧ peaks = k',$q$
    SELECT (ROW(ARRAY[1,-1])::motzkin_path <@ motzkin_paths_by_peaks(2,1))::text || '|' ||
           (ROW(ARRAY[0,0])::motzkin_path <@ motzkin_paths_by_peaks(2,1))::text $q$);
