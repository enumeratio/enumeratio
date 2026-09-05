-- requires: realizer, utilities
-- dyck_paths — lattice paths of n up (+1) and n down (-1) steps that never dip below 0 (semilength n).
-- Single grade [n]. Provides the floor (paths in lex order, U<D) + a Catalan count accel + a contains engine;
-- base_realize generates handle/fiber/element + constructor (incl. the (lo,hi) range form) + the full surface.
-- #286: fiber_unrank via the ballot problem's reflection-principle formula — dyck_completions(p,q,h) is the
-- number of ±1 paths (p remaining ups, q remaining downs, current height h, q must equal p+h to reach 0) that
-- stay ≥ 0, reused by the sibling path families below (motzkin/k_motzkin/colored_motzkin all reduce to it).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE dyck_path AS (steps int[]);                               -- ±1 word, length 2n; e.g. {1,1,-1,-1} = UUDD
CREATE FUNCTION notation(p dyck_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN s = 1 THEN 'U' ELSE 'D' END, '' ORDER BY o), '')
  FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) $$;

CREATE FUNCTION catalan(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- C_n = C_{n-1}·2(2n-1)/(n+1)
  DECLARE c numeric := 1; i int; BEGIN
    IF n < 0 THEN RETURN 0; END IF;
    FOR i IN 1..n LOOP c := div(c * 2 * (2*i - 1), (i + 1)::numeric); END LOOP;   -- exact integer division at each step
    RETURN c;
  END $$;

-- dyck_height_exactly_count(n,h): the number of Dyck paths of semilength n with max height EXACTLY h — a DP over
-- (position, height capped at h, "has the walk touched h yet"). Hoisted here (#283 phase 3 — was
-- dyck_paths_by_height.sql, a `paths` file) because core's generating_functions.sql (gf_dyck_height_row) reuses
-- it directly for its own height-distribution GF on dyck_paths; packs/paths/dyck_paths_by_height.sql still
-- `-- requires: utilities` and calls it from here for its own fiber_count.
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

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE dyck_paths_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: every Dyck path of semilength (f).n, emitted in lex order with U(+1) before D(-1). Grow all
-- valid prefixes (never let height go < 0, never exceed n ups); keep the balanced, height-0 completions.
-- Array DESC on the ±1 word == lex U<D (at the first differing step the U-word carries the larger value, +1).
CREATE FUNCTION fiber_elements(f dyck_paths_fiber, element_limit int) RETURNS SETOF dyck_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, h, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.h + c.step, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (-1)) AS c(step)
      WHERE g.len < 2 * (f).n::int
        AND g.h + c.step >= 0                                   -- stay ≥ 0 (also caps downs: h>0 ⇒ downs<n)
        AND (c.step = -1 OR (g.len + g.h) / 2 < (f).n::int)     -- an up is allowed only while ups used < n
  )
  SELECT ROW(steps)::dyck_path FROM gen
  WHERE len = 2 * (f).n::int AND h = 0
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f dyck_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan((f).n::int) $$;

-- dyck_completions(p,q,h): # of ±1 paths with p ups and q downs remaining, from height h, staying ≥ 0, that end
-- at height 0 — forces q = p+h (else unreachable). Reflection principle: C(p+q,p) − C(p+q,p+h+1) (the bad paths,
-- reflected at their first dip to −1, biject onto p+h+1-subsets). Verified against catalan(n) = dyck_completions(n,n,0).
CREATE FUNCTION dyck_completions(p int, q int, h int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p < 0 OR q < 0 OR h < 0 OR q <> p + h THEN 0::numeric
              ELSE binomial(p + q, p) - binomial(p + q, p + h + 1) END $$;

-- fiber_unrank: walk the 2n positions, at each preferring U (the floor's DESC/U<D order) iff rank falls within
-- the completions reachable by taking U now; dyck_completions gives that count in O(1), no per-step scan.
CREATE FUNCTION fiber_unrank(f dyck_paths_fiber, rank rank_index) RETURNS dyck_path LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; steps int[] := '{}'; ru int := n; rd int := n; h int := 0; r numeric := rank;
          cu numeric; i int; BEGIN
    FOR i IN 1..2 * n LOOP
      cu := CASE WHEN ru > 0 THEN dyck_completions(ru - 1, rd, h + 1) ELSE 0 END;
      IF ru > 0 AND r < cu THEN
        steps := steps || 1; ru := ru - 1; h := h + 1;
      ELSE
        IF ru > 0 THEN r := r - cu; END IF;
        steps := steps || -1; rd := rd - 1; h := h - 1;
      END IF;
    END LOOP;
    RETURN ROW(steps)::dyck_path;
  END $$;

-- contains: v is a Dyck path of semilength n iff length 2n, every step ±1, ends at 0, and no prefix goes < 0.
CREATE FUNCTION contains_in_fiber(f dyck_paths_fiber, v dyck_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = 2 * (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (1, -1))
     AND coalesce((SELECT sum(s) FROM unnest((v).steps) s), 0) = 0
     AND coalesce((SELECT min(h) FROM (
           SELECT sum(s) OVER (ORDER BY o) h FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q), 0) >= 0 $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('dyck_paths', 'dyck_path');
INSERT INTO base_grade VALUES ('dyck_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f dyck_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Dyck(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('dyck_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','cardinality anchor = Catalan for n=0..5 (accel)','eq','1,1,2,5,14,42','C(2n,n)/(n+1)',$q$
    SELECT string_agg(cardinality(dyck_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('dyck_paths','n=0 ⇒ one empty path','eq','1|','Catalan(0)=1, the empty word',$q$
    SELECT count(*)::text || '|' || notation((unrank(dyck_paths(0), 0)).value) FROM elements(dyck_paths(0)) e $q$),
  ('dyck_paths','semilength 2 in lex order (U<D)','eq','UUDD,UDUD','the two paths, U before D',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(2)) e $q$),
  ('dyck_paths','semilength 3 in lex order (U<D)','eq','UUUDDD,UUDUDD,UUDDUD,UDUUDD,UDUDUD','the five paths',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','floor generates 14 paths at n=4 (cardinality via counting)','eq','14','independent of the Catalan accel',$q$
    SELECT count(*)::text FROM elements(dyck_paths(4)) e $q$),
  ('dyck_paths','floor generates 42 paths at n=5','eq','42','the floor, counted',$q$
    SELECT count(*)::text FROM elements(dyck_paths(5)) e $q$),
  ('dyck_paths','every generated path stays ≥ 0 and ends at 0','eq','true','structural check, no contains fn',$q$
    SELECT bool_and(
        (SELECT sum(x) FROM unnest(((e).value).steps) x) = 0
        AND (SELECT min(h) FROM (SELECT sum(x) OVER (ORDER BY o) h
             FROM unnest(((e).value).steps) WITH ORDINALITY AS t(x, o)) q) >= 0
      )::text FROM elements(dyck_paths(4)) e $q$),
  ('dyck_paths','cardinality(dyck_paths(5)) = 42 (accel)','eq','42','closed-form Catalan',$q$
    SELECT cardinality(dyck_paths(5))::text $q$),
  ('dyck_paths','range handle: cardinality(dyck_paths(0,3)) = 9','eq','9','C0+C1+C2+C3 summed over fibers',$q$
    SELECT cardinality(dyck_paths(0,3))::text $q$),
  ('dyck_paths','fibers(dyck_paths(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(dyck_paths(0,3)) f $q$),
  ('dyck_paths','unrank first/last of semilength 3','eq','UUUDDD|UDUDUD','ranks 0 and 4',$q$
    SELECT notation((unrank(dyck_paths(3), 0)).value) || '|' ||
           notation((unrank(dyck_paths(3), 4)).value) $q$),
  ('dyck_paths','element carries a TYPED point fiber + ordinality','eq','3|1','unrank(dyck_paths(3),1)',$q$
    SELECT (unrank(dyck_paths(3), 1)).fiber.n::text || '|' || ordinality(unrank(dyck_paths(3), 1))::text $q$),
  ('dyck_paths','global order across fibers = (n, ordinality): dyck_paths(1,2)','eq','UD|UUDD|UDUD','n ascending, lex within',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY e) FROM elements(dyck_paths(1,2)) e $q$),
  ('dyck_paths','contains: UUDD ∈ dyck_paths(2), DUUD ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[1,1,-1,-1])::dyck_path <@ dyck_paths(2))::text || '|' ||
           (ROW(ARRAY[-1,1,1,-1])::dyck_path <@ dyck_paths(2))::text $q$),
  ('dyck_paths','#286: element_at(dyck_paths(5), 10) matches sequential unrank (direct fiber_unrank accel)','eq','true','the O(1) ballot unrank agrees with the floor',$q$
    SELECT (render(element_at(f, 10)) = (SELECT render(e) FROM elements(f, 11) e ORDER BY e OFFSET 10 LIMIT 1))::text
      FROM fibers(dyck_paths(5)) f $q$);
