-- requires: dyck_paths, realizer
-- fine_paths(n) — Dyck paths of semilength n with NO HILLS: a hill is a peak (UD factor) whose U starts at
-- height 0, i.e. an arch that touches down in a single step right on the axis. Reuses the dyck_path carrier
-- (same ±1 word, same U/D notation) — fine_paths is a further restriction of dyck_paths. Count = the Fine
-- numbers (OEIS A000957): 1,0,1,2,6,18,57 for n=0..6 (n=1's only path, UD, is itself one hill).
-- fiber_count is an independent DP over (position, height, "previous step was a ground-U") — NOT a re-scan of
-- the floor — giving a genuine accelerated-vs-naive pair for selfcert.

CREATE FUNCTION fine_count(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE cur numeric[][]; nxt numeric[][]; h int; flag int; step int; nh int; nflag int; BEGIN
    IF n < 0 THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN 1; END IF;
    -- cur[height+1][flag+1]: ways to be at this height after some steps, flag=1 iff the last step was a U taken
    -- from height 0 (so an immediate D next would complete a forbidden hill).
    cur := array_fill(0::numeric, ARRAY[n + 1, 2]);
    cur[1][1] := 1;                                              -- height 0, flag=false, before any steps
    FOR step IN 1..2 * n LOOP
      nxt := array_fill(0::numeric, ARRAY[n + 1, 2]);
      FOR h IN 0..n LOOP
        FOR flag IN 0..1 LOOP
          IF cur[h + 1][flag + 1] = 0 THEN CONTINUE; END IF;
          -- take an up-step (always allowed while room remains): becomes a "ground-U" flag iff taken from height 0
          IF h + 1 <= n THEN
            nh := h + 1; nflag := CASE WHEN h = 0 THEN 1 ELSE 0 END;
            nxt[nh + 1][nflag + 1] := nxt[nh + 1][nflag + 1] + cur[h + 1][flag + 1];
          END IF;
          -- take a down-step: forbidden immediately after a ground-U (that would be a hill)
          IF h - 1 >= 0 AND flag = 0 THEN
            nxt[h][1] := nxt[h][1] + cur[h + 1][flag + 1];
          END IF;
        END LOOP;
      END LOOP;
      cur := nxt;
    END LOOP;
    RETURN cur[1][1] + cur[1][2];
  END $$;

CREATE TYPE fine_paths_fiber AS (n natural_number);
-- FLOOR: generate every Dyck path of semilength n (same walk as dyck_paths), keep only those with no hill.
CREATE FUNCTION fiber_elements(f fine_paths_fiber, element_limit int) RETURNS SETOF dyck_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, h, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.h + c.step, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (-1)) AS c(step)
      WHERE g.len < 2 * (f).n::int
        AND g.h + c.step >= 0
        AND (c.step = -1 OR (g.len + g.h) / 2 < (f).n::int)
  ),
  paths AS (SELECT steps FROM gen WHERE len = 2 * (f).n::int AND h = 0),
  no_hill AS (
    SELECT p.steps FROM paths p
    WHERE NOT EXISTS (
      SELECT 1 FROM (
        SELECT s, lead(s) OVER (ORDER BY o) AS s2, sum(s) OVER (ORDER BY o) - s AS pre
        FROM unnest(p.steps) WITH ORDINALITY AS t(s, o)
      ) q WHERE s = 1 AND s2 = -1 AND pre = 0))
  SELECT ROW(steps)::dyck_path FROM no_hill ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f fine_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fine_count((f).n::int) $$;

-- #286: fiber_unrank — the no-hill flag is a ONE-STEP lookback (only depends on whether the immediately
-- preceding step was a ground-U), so the walk just carries it forward itself; no reflection-principle closed
-- form exists (the flag breaks the simple ballot recurrence), so this precomputes a suffix-completions table:
-- tbl[remaining][height][flag] = # of ways to complete a no-hill path from here. Filled bottom-up by INCREASING
-- remaining (same direction fine_count fills forward by elapsed steps — this is its mirror, indexed by what's left).
CREATE FUNCTION fine_completions_table(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE tbl numeric[]; rem int; h int; fl int; w numeric; idx int; BEGIN
    -- flattened [remaining 0..2n][height 0..n][flag 0..1], 1-based: idx(rem,h,fl) = rem*(n+1)*2 + h*2 + fl + 1
    tbl := array_fill(0::numeric, ARRAY[(2 * n + 1) * (n + 1) * 2]);
    tbl[0 * (n + 1) * 2 + 0 * 2 + 0 + 1] := 1;   -- remaining=0, height=0, flag=0: done
    tbl[0 * (n + 1) * 2 + 0 * 2 + 1 + 1] := 1;   -- remaining=0, height=0, flag=1: done (flag is moot at completion)
    FOR rem IN 1..2 * n LOOP
      FOR h IN 0..n LOOP
        FOR fl IN 0..1 LOOP
          w := 0;
          IF h + 1 <= n THEN   -- take U: new height h+1, new flag := (h=0) — a ground-U iff taken from height 0
            idx := (rem - 1) * (n + 1) * 2 + (h + 1) * 2 + (CASE WHEN h = 0 THEN 1 ELSE 0 END) + 1;
            w := w + tbl[idx];
          END IF;
          IF h - 1 >= 0 AND fl = 0 THEN   -- take D: forbidden right after a ground-U (that would complete a hill)
            idx := (rem - 1) * (n + 1) * 2 + (h - 1) * 2 + 0 + 1;
            w := w + tbl[idx];
          END IF;
          tbl[rem * (n + 1) * 2 + h * 2 + fl + 1] := w;
        END LOOP;
      END LOOP;
    END LOOP;
    RETURN tbl;
  END $$;

CREATE FUNCTION fiber_unrank(f fine_paths_fiber, rank rank_index) RETURNS dyck_path LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; tbl numeric[] := fine_completions_table(n); steps int[] := '{}';
          h int := 0; fl int := 0; rem int; r numeric := rank; cu numeric; i int; ohgt int; BEGIN
    FOR i IN 1..2 * n LOOP
      rem := 2 * n - i + 1;   -- remaining INCLUDING this step
      cu := CASE WHEN h + 1 <= n THEN tbl[(rem - 1) * (n + 1) * 2 + (h + 1) * 2 + (CASE WHEN h = 0 THEN 1 ELSE 0 END) + 1] ELSE 0 END;
      IF r < cu THEN
        ohgt := h; h := h + 1; fl := CASE WHEN ohgt = 0 THEN 1 ELSE 0 END;
        steps := steps || 1;
      ELSE
        r := r - cu; h := h - 1; fl := 0;
        steps := steps || -1;
      END IF;
    END LOOP;
    RETURN ROW(steps)::dyck_path;
  END $$;

-- contains: a valid Dyck path of semilength n with no U-at-height-0 immediately followed by D.
CREATE FUNCTION contains_in_fiber(f fine_paths_fiber, v dyck_path) RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH s AS (SELECT step, sum(step) OVER (ORDER BY o) - step AS pre, lead(step) OVER (ORDER BY o) AS nxt
             FROM unnest((v).steps) WITH ORDINALITY AS t(step, o))
  SELECT coalesce(array_length((v).steps, 1), 0) = 2 * (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) x WHERE x <> 1 AND x <> -1)
     AND coalesce((SELECT sum(step) FROM unnest((v).steps) step), 0) = 0
     AND coalesce((SELECT bool_and(pre >= 0) FROM s), true)
     AND NOT EXISTS (SELECT 1 FROM s WHERE step = 1 AND nxt = -1 AND pre = 0) $$;

INSERT INTO base_collection VALUES ('fine_paths', 'dyck_path');
INSERT INTO base_grade VALUES ('fine_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f fine_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Fine(' || (f).n::int || ')' $$;
SELECT base_realize('fine_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fine_paths','floor and DP accel agree n=0..6 (both hand-verifiable for n≤3: 1,0,1,2)','eq','true','accelerated == naive, the selfcert claim as an example too',$q$
    SELECT bool_and(cardinality(fine_paths(n)) = (SELECT count(*) FROM elements(fine_paths(n), 1000)))::text FROM generate_series(0,6) n $q$),
  ('fine_paths','n=0..3 = 1,0,1,2 (hand-verified: UD is the only n=1 path, and it is one hill)','eq','1,0,1,2','edge cases',$q$
    SELECT string_agg(cardinality(fine_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,3) n $q$),
  ('fine_paths','n=1 has no valid paths: UD is a hill','eq','0','the only dyck path at n=1 is excluded',$q$
    SELECT count(*)::text FROM elements(fine_paths(1)) e $q$),
  ('fine_paths','n=3: UUUDDD and UUDUDD survive; UUDDUD, UDUUDD, UDUDUD are hills','eq','UUUDDD,UUDUDD','hand-verified against all 5 dyck paths of semilength 3',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(fine_paths(3)) e $q$),
  ('fine_paths','fine_paths(n) ⊆ dyck_paths(n): every survivor is still a valid Dyck path','eq','true','a further restriction',$q$
    SELECT bool_and((e).value <@ dyck_paths(4))::text FROM elements(fine_paths(4)) e $q$),
  ('fine_paths','contains via <@: UUDUDD ∈ fine_paths(3), UDUUDD ∉ (starts with a hill)','eq','true|false','no-hill membership',$q$
    SELECT (ROW(ARRAY[1,1,-1,1,-1,-1])::dyck_path <@ fine_paths(3))::text || '|' ||
           (ROW(ARRAY[1,-1,1,1,-1,-1])::dyck_path <@ fine_paths(3))::text $q$),
  ('fine_paths','#286: element_at(fine_paths(3), 1) = UUDUDD (direct fiber_unrank accel)','eq','UUDUDD','rank 1 of UUUDDD,UUDUDD (DESC/U<D order)',$q$
    SELECT notation((element_at((SELECT f FROM fibers(fine_paths(3)) f), 1)).value) $q$);
