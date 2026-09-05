-- requires: schroeder_paths, realizer, little_schroder_numbers, triangle_slices
-- little_schroder_triangle — the LITTLE Schröder (super-Catalan) paths refined by a second axis: k = the
-- number of HILLS. A little Schröder path is a Schröder path (U/D/F steps, U=(1,1), D=(1,-1), F=(2,0),
-- never below the x-axis) with no F step AT HEIGHT 0 — the standard bijective characterization of the little
-- Schröder / super-Catalan numbers s(n) (A001003), distinct from schroeder_triangle's plain (unrestricted)
-- Schröder paths. A "hill" is a peak (a U immediately followed by a D) whose up-step leaves height 0 — i.e.
-- a peak AT height 1, narrower than schroeder_triangle's/narayana's "any peak". Multi-grade chain [n
-- (semilength), k (#hills, 0..n)]. #236: folded onto the `schroeder_path` carrier — little Schröder paths ARE
-- a subset of large Schröder paths (the same {-1,0,1} steps int[], same U/D/F notation, same lex-DESC order),
-- just restricted (no F at height 0), so the identity map into schroeder_path is order-preserving. Gains
-- schroeder_paths' flat_steps/peaks/height stats and glyph for free; `hills` stays its own registration
-- (schroeder_paths itself has no such stat, and any schroeder_path value can be asked for its hill count).
--
-- s(n,k) = # little Schröder paths of length 2n with k hills; this is OEIS A114709, verified against Fu &
-- Wang, "Bijective recurrences concerning two Schröder triangles" (arXiv:1908.03912), Theorem 1.2:
--   s(0,0) = 1; s(1,0) = 0, s(1,1) = 1; for n ≥ 2:
--   s(n,0) = Σ_{j=1}^{n-1} 2·3^{j-1}·s(n-1,j)
--   s(n,k) = s(n-1,k-1) + Σ_{j=k+1}^{n-1} 2·3^{j-k-1}·s(n-1,j),   1 ≤ k ≤ n
-- Row-sum Σ_k s(n,k) = s(n) by construction (partitioning little Schröder paths by hill count), which is the
-- REALIZED `little_schroder_numbers` sequence built alongside this triangle. Diagonal s(n,n) = 1 always (the
-- only all-hill path is (UD)^n, no nesting). NB: a different (and also legitimate) "super-Catalan triangle",
-- A033877, refines the SAME row-sum sequence by a less-obviously-combinatorial statistic (verified by its own
-- recurrence + diagonal = large Schröder numbers, but not pinned to an explicit path statistic here) — left
-- as a follow-up if a second little-Schröder triangle is ever wanted; this file builds the hills-graded one,
-- since it has a clean, directly-generable combinatorial definition (same "no flats at height 0" carrier as
-- the sequence's own defining bijection).

-- s(n,k) via the Fu–Wang DP recurrence above (row-by-row, O(n²) fill, no path enumeration).
CREATE FUNCTION little_schroder_triangle_count(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE row numeric[]; prevrow numeric[]; pow3 numeric[]; i int; kk int; j int; acc numeric;
  BEGIN
    IF n < 0 OR k < 0 OR k > n THEN RETURN 0::numeric; END IF;
    IF n = 0 THEN RETURN 1::numeric; END IF;                          -- s(0,0)=1, only cell in row 0
    prevrow := ARRAY[0::numeric, 1::numeric];                         -- row 1: s(1,0)=0, s(1,1)=1 (array pos j+1 = s(1,j))
    IF n = 1 THEN RETURN prevrow[k + 1]; END IF;
    pow3 := ARRAY[1::numeric];                                        -- pow3[e+1] = 3^e, built by repeated int multiply (no power(), keeps scale 0)
    FOR i IN 1..n LOOP pow3[i + 1] := pow3[i] * 3; END LOOP;
    FOR i IN 2..n LOOP
      row := ARRAY[]::numeric[];
      acc := 0;
      FOR j IN 1..(i - 1) LOOP acc := acc + 2 * pow3[j] * prevrow[j + 1]; END LOOP;   -- 2·3^(j-1) = 2·pow3[(j-1)+1]
      row[1] := acc;                                                  -- s(i,0)
      FOR kk IN 1..i LOOP
        acc := coalesce(prevrow[kk], 0);                              -- s(i-1,kk-1)
        FOR j IN (kk + 1)..(i - 1) LOOP acc := acc + 2 * pow3[j - kk] * prevrow[j + 1]; END LOOP;   -- 2·3^(j-kk-1)
        row[kk + 1] := acc;
      END LOOP;
      prevrow := row;
    END LOOP;
    RETURN prevrow[k + 1];
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: grow every valid little-Schröder prefix (height h, x-position x; U/D width 1, F width 2, never dip
-- below 0, AND never take an F step while h = 0 — the little-Schröder constraint), keep the height-0
-- completions at x=2n, then filter to those with exactly address[2] hills (a U-D adjacency whose U leaves h=0).
CREATE TYPE little_schroder_triangle_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n, k
CREATE FUNCTION fiber_elements(f little_schroder_triangle_fiber, element_limit int) RETURNS SETOF schroeder_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, h, x) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.h + c.dh, g.x + c.dx
      FROM gen g CROSS JOIN (VALUES (1, 1, 1), (-1, -1, 1), (0, 0, 2)) AS c(step, dh, dx)
      WHERE g.x < 2 * (f).n::int
        AND g.h + c.dh >= 0
        AND g.x + c.dx <= 2 * (f).n::int
        AND NOT (c.step = 0 AND g.h = 0)                              -- no flat step while at ground level
  ),
  paths AS (SELECT steps FROM gen WHERE x = 2 * (f).n::int AND h = 0),
  hills AS (
    SELECT p.steps,
           (SELECT count(*) FROM (
              SELECT s, lead(s) OVER (ORDER BY o) AS s2,
                     sum(s) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS h_before
              FROM unnest(p.steps) WITH ORDINALITY AS t(s, o)
            ) q WHERE s = 1 AND s2 = -1 AND coalesce(h_before, 0) = 0) AS hill_count
    FROM paths p
  )
  SELECT ROW(steps)::schroeder_path FROM hills
  WHERE hill_count = (f).k::int
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f little_schroder_triangle_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT little_schroder_triangle_count((f).n::int, (f).k::int) $$;

-- contains: a valid little-Schröder path of semilength n (steps in {1,-1,0}, net height 0, x-width 2n, every
-- prefix height ≥ 0, no F step at h=0) with EXACTLY k hills (a U-D adjacency whose U leaves height 0).
CREATE FUNCTION contains_in_fiber(f little_schroder_triangle_fiber, v schroeder_path) RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH s AS (
    SELECT step, o,
           sum(step) OVER (ORDER BY o) AS h_after,
           sum(step) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS h_before,
           lead(step) OVER (ORDER BY o) AS nxt
    FROM unnest((v).steps) WITH ORDINALITY AS t(step, o)
  )
  SELECT NOT EXISTS (SELECT 1 FROM s WHERE step NOT IN (1, -1, 0))
     AND coalesce((SELECT sum(step) FROM s), 0) = 0
     AND coalesce((SELECT sum(CASE WHEN step = 0 THEN 2 ELSE 1 END) FROM s), 0) = 2 * (f).n::int
     AND coalesce((SELECT min(h_after) FROM s), 0) >= 0
     AND NOT EXISTS (SELECT 1 FROM s WHERE step = 0 AND coalesce(h_before, 0) = 0)
     AND (SELECT count(*) FROM s WHERE step = 1 AND nxt = -1 AND coalesce(h_before, 0) = 0) = (f).k::int $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('little_schroder_triangle', 'schroeder_path');
INSERT INTO base_grade VALUES
  ('little_schroder_triangle', 1, 'n', NULL, NULL),
  ('little_schroder_triangle', 2, 'k', '0', 'g1');                    -- k ranges 0..n by default
SELECT base_realize('little_schroder_triangle');

-- register with the triangle-slicing machinery: row-sum recovers the REALIZED little Schröder sequence.
INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('little_schroder_triangle', 'n', 'k', 'Little Schröder triangle — little Schröder paths by number of hills — s(n,k)', 'little_schroder_numbers');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('little_schroder_triangle','rows n=0..4, hand-verified against Fu–Wang''s Theorem 1.2 recurrence','eq',
   '1|0,1|2,0,1|6,4,0,1|26,12,6,0,1','rows via the accelerated cardinality',$q$
    SELECT string_agg(row_str, '|' ORDER BY n) FROM (
      SELECT n, string_agg(cardinality(little_schroder_triangle(n,k))::text, ',' ORDER BY k) row_str
      FROM generate_series(0,4) n, LATERAL generate_series(0,n) k GROUP BY n) t $q$),
  ('little_schroder_triangle','the floor at [2,0] generates the 2 zero-hill semilength-2 paths','eq','UUDD,UFD',
   'a nested Dyck peak (height 2) and a flat-wrapped peak both have 0 hills',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(little_schroder_triangle(2,0)) e $q$),
  ('little_schroder_triangle','the floor at [3,3] is the single all-hill path UDUDUD','eq','UDUDUD','s(3,3)=1, no nesting possible',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(little_schroder_triangle(3,3)) e $q$),
  ('little_schroder_triangle','row-sum recovers the little Schröder numbers s(n)=1,1,3,11,45,197 (n=0..5)','eq','1,1,3,11,45,197',
   'triangle_rowsum(little_schroder_triangle, n) = little_schroder_number(n)',$q$
    SELECT string_agg(triangle_rowsum('little_schroder_triangle', n)::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('little_schroder_triangle','row-sum matches the realized little_schroder_numbers floor term-for-term (n=0..6)','eq','all-match',
   'triangle ⟶ sequence alias identity, this pairing specifically',$q$
    SELECT coalesce(string_agg('n='||n, ', '), 'all-match') FROM generate_series(0,6) n
    WHERE triangle_rowsum('little_schroder_triangle', n)::numeric IS DISTINCT FROM sequence_term('little_schroder_numbers', n) $q$),
  ('little_schroder_triangle','column k=0 is 1,0,2,6,26 (n=0..4)','eq','1,0,2,6,26','s(n,0), n=0..4',$q$
    SELECT string_agg(value::text, ',' ORDER BY row_index) FROM triangle_column('little_schroder_triangle', 0, 4) $q$),
  ('little_schroder_triangle','diagonal k=n (the all-hill path) is always 1','eq','1,1,1,1,1,1','s(n,n) = 1, n=0..5',$q$
    SELECT string_agg(value::text, ',' ORDER BY row_index) FROM triangle_diagonal('little_schroder_triangle', 0, 5) $q$),
  ('little_schroder_triangle','every element of fiber [4,2] has exactly 2 hills (structural invariant)','eq','true',
   'count U-D adjacencies whose U leaves height 0, per path',$q$
    SELECT bool_and(
        (SELECT count(*) FROM (
           SELECT s, lead(s) OVER (ORDER BY o) AS s2,
                  sum(s) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS h_before
           FROM unnest(((e).value).steps) WITH ORDINALITY AS t(s, o)
         ) q WHERE s = 1 AND s2 = -1 AND coalesce(h_before, 0) = 0) = 2
      )::text FROM elements(little_schroder_triangle(4,2)) e $q$),
  ('little_schroder_triangle','contains via <@: UUDD ∈ T(2,0); UDUD ∉ T(2,0) (it is T(2,2))','eq','true|false',
   'a valid little-Schröder path with exactly k hills',$q$
    SELECT (ROW(ARRAY[1,1,-1,-1])::schroeder_path <@ little_schroder_triangle(2,0))::text || '|' ||
           (ROW(ARRAY[1,-1,1,-1])::schroeder_path <@ little_schroder_triangle(2,0))::text $q$),
  ('little_schroder_triangle','#236: every schroeder_paths stat resolves here too (flat_steps, peaks, height), plus this collection''s own hills stat','eq','true','base_stat_resolved inheritance via the shared carrier + the own registration',$q$
    SELECT (EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'little_schroder_triangle' AND stat_id = 'flat_steps') AND
            EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'little_schroder_triangle' AND stat_id = 'peaks') AND
            EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'little_schroder_triangle' AND stat_id = 'height') AND
            EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'little_schroder_triangle' AND stat_id = 'hills'))::text $q$);
