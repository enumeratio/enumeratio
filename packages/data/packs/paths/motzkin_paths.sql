-- requires: dyck_paths, realizer, utilities
-- motzkin_paths — realized from data. Single grade [n]. A Motzkin path of length n is a word over the steps
-- U(+1)/L(0)/D(-1) whose prefix sums stay >= 0 and whose total is 0 (a lattice path that never dips below the
-- axis and returns to it). The floor generates one fiber [n] by a bounded lattice walk; a closed-form Motzkin(n)
-- count + a validity-predicate contains engine are the accelerations.
-- #286: fiber_unrank via motzkin_completions(l,h) — insert l−h−m U/D steps and m level steps anywhere (level
-- steps don't touch height, so the U/D subsequence alone must be dyck_completions-valid); a sum over m.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE motzkin_path AS (steps int[]);                             -- +1 up, 0 level, -1 down; e.g. {1,0,-1}
CREATE FUNCTION notation(p motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE s WHEN 1 THEN 'U' WHEN -1 THEN 'D' ELSE 'L' END, '' ORDER BY ord), '')
  FROM unnest((p).steps) WITH ORDINALITY AS t(s, ord) $$;

-- Motzkin(n) — hoisted to sqlsrc/utilities.sql (#283 phase 3): core's motzkin_numbers.sql calls it directly, so it
-- can't stay only in this pack file. Still `-- requires: utilities` above, same as any core file that calls it.

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- the FLOOR: all Motzkin paths of length n=address[1], in ascending-step (D<L<U) array order. A bounded lattice
-- walk: at each position try U/L/D, keep only steps that stay >= 0 and leave the height reachable back to 0
-- within the remaining positions. address[1]=0 ⇒ the single empty path.
CREATE TYPE motzkin_paths_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f motzkin_paths_fiber, element_limit int) RETURNS SETOF motzkin_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE walk(pos, height, steps) AS (
    SELECT 0, 0, ARRAY[]::int[]
    UNION ALL
    SELECT pos + 1, height + step, steps || step
    FROM walk, (VALUES (1), (0), (-1)) AS s(step)
    WHERE pos < (f).n::int
      AND height + step >= 0
      AND height + step <= (f).n::int - (pos + 1)   -- prune: must be able to descend back to 0 in what's left
  )
  SELECT ROW(steps)::motzkin_path FROM walk
  WHERE pos = (f).n::int AND height = 0
  ORDER BY steps
  LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f motzkin_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT motzkin((f).n::int) $$;

-- motzkin_completions(l,h): # of U(+1)/L(0)/D(-1) words of length l, from height h, staying ≥ 0, ending at 0.
-- Choose which m of the l positions are L (C(l,m) ways); the remaining l−m positions are a ±1 word that must
-- itself be dyck_completions-valid from height h (level steps don't move the height, so they're free inserts).
CREATE FUNCTION motzkin_completions(l int, h int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE total numeric := 0; m int; p int; BEGIN
    IF l < 0 OR h < 0 OR h > l THEN RETURN 0; END IF;
    FOR m IN 0..(l - h) LOOP
      IF (l - m - h) % 2 = 0 THEN
        p := (l - m - h) / 2;
        total := total + binomial(l, m) * dyck_completions(p, p + h, h);
      END IF;
    END LOOP;
    RETURN total;
  END $$;

-- fiber_unrank: walk the n positions preferring D, then L, then U (the floor's ASC/D<L<U order).
CREATE FUNCTION fiber_unrank(f motzkin_paths_fiber, rank rank_index) RETURNS motzkin_path LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; steps int[] := '{}'; h int := 0; l int; r numeric := rank; cd numeric; cl numeric; i int; BEGIN
    FOR i IN 1..n LOOP
      l := n - i + 1;   -- remaining length INCLUDING this step
      cd := motzkin_completions(l - 1, h - 1);
      cl := motzkin_completions(l - 1, h);
      IF r < cd THEN
        steps := steps || -1; h := h - 1;
      ELSIF r < cd + cl THEN
        r := r - cd; steps := steps || 0;
      ELSE
        r := r - cd - cl; steps := steps || 1; h := h + 1;
      END IF;
    END LOOP;
    RETURN ROW(steps)::motzkin_path;
  END $$;
CREATE FUNCTION contains_in_fiber(f motzkin_paths_fiber, v motzkin_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (-1, 0, 1))
     AND (SELECT coalesce(sum(s), 0) FROM unnest((v).steps) s) = 0
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).steps, 1) i
                     WHERE (SELECT sum((v).steps[j]) FROM generate_series(1, i) j) < 0) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('motzkin_paths', 'motzkin_path');
INSERT INTO base_grade VALUES ('motzkin_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f motzkin_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Motz(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('motzkin_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('motzkin_paths','cardinality sequence n=0..6 = 1,1,2,4,9,21,51 (accel)','eq','1,1,2,4,9,21,51','Motzkin numbers via the closed-form count',$q$
    SELECT string_agg(cardinality(motzkin_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('motzkin_paths','floor counts n=0..6 match the sequence','eq','1,1,2,4,9,21,51','the generated floor, counted (not the accel)',$q$
    SELECT string_agg((SELECT count(*) FROM elements(motzkin_paths(n)))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('motzkin_paths','elements(motzkin_paths(2)) = LL,UD','eq','LL,UD','the 2 paths of length 2 in step order',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(motzkin_paths(2)) e $q$),
  ('motzkin_paths','elements(motzkin_paths(3)) = LLL,LUD,UDL,ULD','eq','LLL,LUD,UDL,ULD','the 4 paths of length 3',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(motzkin_paths(3)) e $q$),
  ('motzkin_paths','unrank(motzkin_paths(3), 0) = LLL','eq','LLL','r-th element, then its value',$q$
    SELECT notation((unrank(motzkin_paths(3), 0)).value) $q$),
  ('motzkin_paths','unrank(motzkin_paths(3), 2) = UDL','eq','UDL','ranks 0..3 = LLL,LUD,UDL,ULD',$q$
    SELECT notation((unrank(motzkin_paths(3), 2)).value) $q$),
  ('motzkin_paths','#286: element_at(motzkin_paths(6), 7) matches sequential unrank (direct fiber_unrank accel)','eq','true','the O(n) DP unrank agrees with the floor',$q$
    SELECT (render(element_at(f, 7)) = (SELECT render(e) FROM elements(f, 8) e ORDER BY e OFFSET 7 LIMIT 1))::text
      FROM fibers(motzkin_paths(6)) f $q$),
  ('motzkin_paths','element carries a TYPED point fiber [n]','eq','4|5','unrank(motzkin_paths(4),5): fiber length + ordinality',$q$
    SELECT (unrank(motzkin_paths(4), 5)).fiber.n::text || '|' || ordinality(unrank(motzkin_paths(4), 5))::text $q$),
  ('motzkin_paths','every enumerated path stays >=0 and ends at 0 (n=5)','eq','true','floor cross-checked by the contains predicate',$q$
    SELECT bool_and(contains(motzkin_paths(5), (e).value))::text FROM elements(motzkin_paths(5)) e $q$),
  ('motzkin_paths','contains: UD in motzkin_paths(2), DU not (dips below 0)','eq','true|false','length+sum+prefix-nonneg predicate',$q$
    SELECT contains(motzkin_paths(2), ROW(ARRAY[1,-1])::motzkin_path)::text || '|' ||
           contains(motzkin_paths(2), ROW(ARRAY[-1,1])::motzkin_path)::text $q$),
  ('motzkin_paths','the <@ operator works: UDL <@ motzkin_paths(3)','eq','true','operator wrapper over contains',$q$
    SELECT (ROW(ARRAY[1,-1,0])::motzkin_path <@ motzkin_paths(3))::text $q$),
  ('motzkin_paths','range handle: cardinality(motzkin_paths(0,3)) = 8 = 1+1+2+4','eq','8','fibers unfold over n=0..3, summed',$q$
    SELECT cardinality(motzkin_paths(0,3))::text $q$),
  ('motzkin_paths','fibers(motzkin_paths(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(motzkin_paths(0,3)) f $q$),
  ('motzkin_paths','DO-block: floor count = Motzkin(n) for n=0..7','ok',NULL,'a running assertion over the sequence',$q$
    DO $d$ BEGIN
      FOR i IN 0..7 LOOP
        IF (SELECT count(*) FROM elements(motzkin_paths(i))) <> motzkin(i)
          THEN RAISE EXCEPTION 'floor count mismatch at n=%', i; END IF;
      END LOOP;
    END $d$; $q$);
