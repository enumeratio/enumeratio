-- requires: dyck_paths, statistics, realizer, utilities
-- dyck_paths_by_height(n,h) — the RESTRICTION family #226 asks for: Dyck paths of semilength n with maximum
-- height EXACTLY h (dyck_height already registered on dyck_paths). Reuses the dyck_path carrier directly. The
-- row-sum over h recovers the Catalan numbers (every path has SOME max height, 0 ≤ h ≤ n). fiber_count is an
-- independent DP over (position, height capped at h, "has the walk touched h yet") — not a floor re-scan.

CREATE FUNCTION dyck_height_exactly_count(n int, h int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE cur numeric[][]; nxt numeric[][]; ht int; touched int; step int; nh int; w numeric; BEGIN
    IF n < 0 OR h < 0 OR h > n THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN CASE WHEN h = 0 THEN 1 ELSE 0 END; END IF;
    -- cur[height+1][touched+1]: ways to be at this height, having (not) yet reached h; height is capped at h —
    -- a step that would exceed h is simply never taken (dead end, contributes to no cell, as intended).
    cur := array_fill(0::numeric, ARRAY[h + 1, 2]);
    cur[1][1] := 1;                                               -- height 0, not yet touched h
    FOR step IN 1..2 * n LOOP
      nxt := array_fill(0::numeric, ARRAY[h + 1, 2]);
      FOR ht IN 0..h LOOP
        FOR touched IN 0..1 LOOP
          w := cur[ht + 1][touched + 1];
          IF w = 0 THEN CONTINUE; END IF;
          -- up step: allowed only while it stays ≤ h
          IF ht + 1 <= h THEN
            nh := ht + 1;
            nxt[nh + 1][GREATEST(touched, CASE WHEN nh = h THEN 1 ELSE 0 END) + 1] :=
              nxt[nh + 1][GREATEST(touched, CASE WHEN nh = h THEN 1 ELSE 0 END) + 1] + w;
          END IF;
          -- down step: allowed while height ≥ 1
          IF ht - 1 >= 0 THEN
            nxt[ht][touched + 1] := nxt[ht][touched + 1] + w;
          END IF;
        END LOOP;
      END LOOP;
      cur := nxt;
    END LOOP;
    RETURN cur[1][2];                                             -- height 0, touched = true (max height was exactly h)
  END $$;

CREATE TYPE dyck_paths_by_height_fiber AS (n natural_number, h natural_number);
-- FLOOR: the same bounded walk as dyck_paths, additionally capped at height h, keeping only paths whose max
-- height reaches h (not just stays under it).
CREATE FUNCTION fiber_elements(f dyck_paths_by_height_fiber, element_limit int) RETURNS SETOF dyck_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, h, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.h + c.step, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (-1)) AS c(step)
      WHERE g.len < 2 * (f).n::int
        AND g.h + c.step >= 0
        AND g.h + c.step <= (f).h::int
        AND (c.step = -1 OR (g.len + g.h) / 2 < (f).n::int)
  )
  SELECT ROW(steps)::dyck_path FROM gen
  WHERE len = 2 * (f).n::int AND h = 0
    AND dyck_height(ROW(steps)::dyck_path) = (f).h::int
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f dyck_paths_by_height_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT dyck_height_exactly_count((f).n::int, (f).h::int) $$;

CREATE FUNCTION contains_in_fiber(f dyck_paths_by_height_fiber, v dyck_path) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT v <@ dyck_paths((f).n::int) AND dyck_height(v) = (f).h::int $$;

INSERT INTO base_collection VALUES ('dyck_paths_by_height', 'dyck_path');
INSERT INTO base_grade VALUES
  ('dyck_paths_by_height', 1, 'n', NULL, NULL),
  ('dyck_paths_by_height', 2, 'h', '0', 'g1');                     -- h ranges 0..n
CREATE FUNCTION fiber_symbol(f dyck_paths_by_height_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Dyck[h=' || (f).h::int || '](' || (f).n::int || ')' $$;
SELECT base_realize('dyck_paths_by_height');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths_by_height','row n=4 over h=0..4 (accel) is 0,1,7,5,1','eq','0,1,7,5,1','no path has height 0 except n=0; sums to Catalan(4)=14',$q$
    SELECT string_agg(cardinality(dyck_paths_by_height(4,h))::text, ',' ORDER BY h) FROM generate_series(0,4) h $q$),
  ('dyck_paths_by_height','row-sum: Σ_h T(n,h) = Catalan(n) for n=0..6','eq','true','the height triangle refines the Catalan numbers',$q$
    SELECT bool_and(cardinality(dyck_paths_by_height(n)) = cardinality(dyck_paths(n)))::text FROM generate_series(0,6) n $q$),
  ('dyck_paths_by_height','the DP accel and the filtered floor agree for every (n,h), n≤6','eq','true','accelerated == naive (the selfcert claim, exercised directly)',$q$
    SELECT bool_and(cardinality(dyck_paths_by_height(n,h)) = (SELECT count(*) FROM elements(dyck_paths_by_height(n,h), 1000)))::text
      FROM generate_series(0,6) n, generate_series(0,n) h $q$),
  ('dyck_paths_by_height','every element of fiber [4,2] has max height exactly 2 (structural invariant)','eq','true','cross-checked via the shared dyck_height stat',$q$
    SELECT bool_and(dyck_height((e).value) = 2)::text FROM elements(dyck_paths_by_height(4,2)) e $q$),
  ('dyck_paths_by_height','fiber [n,0] is empty for n≥1 (a nonempty Dyck path always rises)','eq','0','no path of positive semilength has max height 0',$q$
    SELECT count(*)::text FROM elements(dyck_paths_by_height(3,0)) e $q$),
  ('dyck_paths_by_height','fiber [n,n] is the single path UUUU…DDDD (max possible height)','eq','1|UUUUDDDD','the unique height-n path of semilength n',$q$
    SELECT count(*)::text || '|' || notation((unrank(dyck_paths_by_height(4,4), 0)).value) FROM elements(dyck_paths_by_height(4,4)) e $q$),
  ('dyck_paths_by_height','contains via <@: UUDD ∈ dyck_paths_by_height(2,2), UDUD ∉ (height 1, not 2)','eq','true|false','membership = parent path ∧ height = h',$q$
    SELECT (ROW(ARRAY[1,1,-1,-1])::dyck_path <@ dyck_paths_by_height(2,2))::text || '|' ||
           (ROW(ARRAY[1,-1,1,-1])::dyck_path <@ dyck_paths_by_height(2,2))::text $q$);
