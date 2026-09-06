-- requires: realizer, utilities
-- gelfand_tsetlin — Gelfand-Tsetlin patterns with n rows and entries in {0..k} (a FindStat collection; sage
-- GelfandTsetlinPatterns(n, k)). A triangular array: the top row has n weakly-decreasing entries ≤ k, each lower row
-- has one fewer entry and INTERLACES the row above (above[j] ≥ below[j] ≥ above[j+1]). A 2-parameter family (n rows,
-- bound k). Carried FLAT (rows concatenated top-to-bottom; the triangular shape is recovered from the length
-- n(n+1)/2), rendered rows-slash-separated (e.g. 2,0,0/1,0/1). count 4,10,20,… / 8,35,… (counted from the floor).

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE gelfand_tsetlin_pattern AS (rows int[]);               -- the triangle flattened, top row first
CREATE FUNCTION notation(g gelfand_tsetlin_pattern) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE flat int[] := (g).rows; len int := coalesce(array_length(flat,1),0); n int; off int := 0; i int; rl int; out text := '';
  BEGIN
    n := floor((-1 + sqrt(1 + 8*len)) / 2)::int;                   -- len = n(n+1)/2 ⇒ n rows
    FOR i IN 0..n-1 LOOP
      rl := n - i;                                                 -- row i has n-i entries
      out := out || CASE WHEN i > 0 THEN '/' ELSE '' END || array_to_string(flat[off+1 : off+rl], ',');
      off := off + rl;
    END LOOP;
    RETURN out;
  END $$;

-- length-`len` weakly-decreasing sequences with entries in [0, maxv] (the possible top rows)
CREATE FUNCTION gt_top_rows(len int, maxv int) RETURNS SETOF int[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE s AS (
    SELECT ARRAY[]::int[] AS a
    UNION ALL
    SELECT s.a || v FROM s, LATERAL generate_series(0, coalesce(s.a[array_length(s.a,1)], maxv)) v
     WHERE coalesce(array_length(s.a,1),0) < len
  )
  SELECT a FROM s WHERE coalesce(array_length(a,1),0) = len $$;
-- the rows that INTERLACE `above`: b has one fewer entry, with above[j] ≥ b[j] ≥ above[j+1] (b is then non-increasing)
CREATE FUNCTION gt_interlacing_rows(above int[]) RETURNS SETOF int[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE r AS (
    SELECT ARRAY[]::int[] AS b
    UNION ALL
    SELECT r.b || v
      FROM r, LATERAL generate_series(above[coalesce(array_length(r.b,1),0)+2], above[coalesce(array_length(r.b,1),0)+1]) v
     WHERE coalesce(array_length(r.b,1),0) < coalesce(array_length(above,1),0) - 1
  )
  SELECT b FROM r WHERE coalesce(array_length(b,1),0) = coalesce(array_length(above,1),0) - 1 $$;

-- ── fiber_unrank support (digit-DP over the flat row-major order the generator's ORDER BY flat emits) ────
-- Weyl dimension formula: the number of GT-pattern completions BELOW a fully-specified row lam — every way to fill
-- every row underneath it, already summing over every interlacing choice recursively. This is the SAME identity
-- fiber_count leans on (its docstring's "hook-content SSYT count s_λ(1ⁿ)"), applied to one row instead of summed
-- over the whole top-row box. Hand-verified: gt_weyl_dim([2,1,0]) = 8 (SU(3) adjoint dimension); gt_weyl_dim of a
-- length-2 row is lam1-lam2+1, matching a single gt_interlacing_rows count directly (both checked by hand below).
CREATE FUNCTION gt_weyl_dim(lam int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m int := coalesce(array_length(lam,1),0); p int; q int; num numeric := 1; den numeric := 1;
  BEGIN
    FOR p IN 1..m-1 LOOP
      FOR q IN p+1..m LOOP
        num := num * (lam[p] - lam[q] + q - p);
        den := den * (q - p);
      END LOOP;
    END LOOP;
    RETURN round(num / den);            -- num/den accumulated separately (utilities.sql `binomial` pattern)
  END $$;
-- completions of a PARTIAL row: `prefix` (leading entries already fixed) extended to length `target_len`, weakly
-- decreasing, bounded above by `maxv` (used only while `above` is NULL — the top row) and, once `above` is given,
-- interlacing it (above[j] ≥ row[j] ≥ above[j+1]). Same shape as gt_interlacing_rows/gt_top_rows above, generalized
-- to start from a partial prefix instead of the empty row — a small, bounded lattice (correct-by-enumeration,
-- deliberately not a closed form: the risky part of this ticket is the per-cell PRICE below, not this count).
CREATE FUNCTION gt_row_completions(prefix int[], target_len int, above int[], maxv int) RETURNS SETOF int[] LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE r AS (
    SELECT prefix AS b
    UNION ALL
    SELECT r.b || v
      FROM r,
           LATERAL (SELECT coalesce(array_length(r.b,1),0) AS len) l,
           LATERAL (SELECT CASE WHEN above IS NULL THEN maxv ELSE above[l.len+1] END AS abv) a,
           LATERAL generate_series(
             CASE WHEN above IS NULL THEN 0 ELSE above[l.len+2] END,
             LEAST(coalesce(r.b[l.len], a.abv), a.abv)
           ) v
     WHERE l.len < target_len
  )
  SELECT b FROM r WHERE coalesce(array_length(b,1),0) = target_len $$;
-- the per-cell PRICE a digit-DP unrank needs: sum of gt_weyl_dim over every completion of a partial row — "how many
-- full patterns share this prefix" (degenerates to a single term at the row's last cell, where gt_row_completions
-- already has nothing left to vary).
CREATE FUNCTION gt_completions_price(prefix int[], target_len int, above int[], maxv int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(gt_weyl_dim(c)), 0) FROM gt_row_completions(prefix, target_len, above, maxv) c $$;

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE gelfand_tsetlin_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n, k
CREATE FUNCTION fiber_elements(f gelfand_tsetlin_fiber, element_limit int) RETURNS SETOF gelfand_tsetlin_pattern LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT top AS flat, top AS last_row FROM gt_top_rows((f).n::int, (f).k::int) top   -- start: the top row (n entries ≤ k)
    UNION ALL
    SELECT b.flat || nr, nr
      FROM build b, LATERAL gt_interlacing_rows(b.last_row) nr
     WHERE array_length(b.last_row,1) > 1                                              -- add rows until the last has length 1
  )
  SELECT ROW(flat)::gelfand_tsetlin_pattern FROM build
   WHERE coalesce(array_length(last_row,1),0) <= 1                                     -- complete triangle (bottom row, or the empty n=0)
   ORDER BY flat
   LIMIT element_limit $$;
-- closed form (#254 — was enumeration-only, explodes past n≈8): |{n rows, entries ≤ k}| = Π_{1≤i≤j≤n} (k+i+j−1)/(i+j−1).
-- Derived by summing the hook-content SSYT count s_λ(1ⁿ) over every top row λ fitting the n×k box; the double
-- product falls out of the resulting multiplicities (verified against brute force for n≤4, k≤5 — see #254 close-out).
-- num/den accumulated separately then divided once (the `binomial` pattern in utilities.sql) so no intermediate
-- numeric division rounds a non-integer partial product.
CREATE FUNCTION fiber_count(f gelfand_tsetlin_fiber) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; k int := (f).k::int; i int; j int; num numeric := 1; den numeric := 1;
  BEGIN
    FOR i IN 1..n LOOP
      FOR j IN i..n LOOP
        num := num * (k + i + j - 1);
        den := den * (i + j - 1);
      END LOOP;
    END LOOP;
    RETURN round(num / den);
  END $$;
CREATE FUNCTION contains_in_fiber(f gelfand_tsetlin_fiber, v gelfand_tsetlin_pattern) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE flat int[] := (v).rows; n int := (f).n::int; k int := (f).k::int; off int := 0; i int; j int; row int[]; above int[] := NULL;
  BEGIN
    IF coalesce(array_length(flat,1),0) <> n*(n+1)/2 THEN RETURN false; END IF;
    FOR i IN 0..n-1 LOOP
      row := flat[off+1 : off+(n-i)];
      FOR j IN 1..(n-i) LOOP
        IF row[j] < 0 OR row[j] > k THEN RETURN false; END IF;                          -- entries in [0,k]
        IF j > 1 AND row[j] > row[j-1] THEN RETURN false; END IF;                        -- weakly decreasing
        IF above IS NOT NULL AND NOT (above[j] >= row[j] AND row[j] >= above[j+1]) THEN RETURN false; END IF;   -- interlacing
      END LOOP;
      above := row; off := off + (n-i);
    END LOOP;
    RETURN true;
  END $$;
-- direct unrank: fill the flat row-major array cell by cell, in the SAME order `ORDER BY flat` sorts it in
-- (fiber_elements' own floor). At each cell, try candidate values ascending (lex-smallest first) and PRICE each one
-- via gt_completions_price — "how many full patterns share this prefix" — subtracting priced-off buckets from
-- `remaining` until the target rank falls inside one, then fixing that value and descending to the next cell. Once
-- a row is fully fixed it becomes `above` for the row underneath, and `remaining` is already the correct rank WITHIN
-- that sub-triangle (this is what makes the digit-DP telescope instead of needing a fresh closed form per row).
CREATE FUNCTION fiber_unrank(f gelfand_tsetlin_fiber, rank rank_index) RETURNS gelfand_tsetlin_pattern LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE
    n int := (f).n::int; k int := (f).k::int;
    above int[] := NULL; cur int[]; flat int[] := ARRAY[]::int[];
    m int; i int; j int; len int; abv int; lo int; hi int; v int;
    remaining numeric := rank::numeric; price numeric;
  BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::gelfand_tsetlin_pattern; END IF;
    FOR i IN 0..n-1 LOOP
      m := n - i; cur := ARRAY[]::int[];
      FOR j IN 1..m LOOP
        len := coalesce(array_length(cur,1),0);
        abv := CASE WHEN above IS NULL THEN k ELSE above[len+1] END;
        hi := LEAST(coalesce(cur[len], abv), abv);
        lo := CASE WHEN above IS NULL THEN 0 ELSE above[len+2] END;
        v := lo;
        LOOP
          price := gt_completions_price(cur || v, m, above, k);
          EXIT WHEN remaining < price;   -- this bucket holds the target rank — fix v here
          remaining := remaining - price;
          v := v + 1;
        END LOOP;
        cur := cur || v;
      END LOOP;
      flat := flat || cur; above := cur;
    END LOOP;
    RETURN ROW(flat)::gelfand_tsetlin_pattern;
  END $fu$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('gelfand_tsetlin', 'gelfand_tsetlin_pattern');
INSERT INTO base_grade VALUES ('gelfand_tsetlin', 1, 'n', NULL, NULL), ('gelfand_tsetlin', 2, 'k', '0', 'g1');   -- n rows; entry bound k (defaults to ≤ n)
SELECT base_realize('gelfand_tsetlin');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gelfand_tsetlin','anchor: |gelfand_tsetlin(2, k)| for k=1..4 is 4,10,20,35','eq','4,10,20,35','patterns with 2 rows and entries ≤ k',$q$
    SELECT string_agg(cardinality(gelfand_tsetlin(2, k))::text, ',' ORDER BY k) FROM generate_series(1,4) k $q$),
  ('gelfand_tsetlin','|gelfand_tsetlin(n, 1)| for n=1..4 is 2,4,8,16 (entries in {0,1})','eq','2,4,8,16','2^n binary patterns',$q$
    SELECT string_agg(cardinality(gelfand_tsetlin(n, 1))::text, ',' ORDER BY n) FROM generate_series(1,4) n $q$),
  ('gelfand_tsetlin','|gelfand_tsetlin(3, 2)| = 35','eq','35','3 rows, entries ≤ 2',$q$
    SELECT cardinality(gelfand_tsetlin(3, 2))::text $q$),
  ('gelfand_tsetlin','the 4 patterns of gelfand_tsetlin(2, 1)','eq','0,0/0,1,0/0,1,0/1,1,1/1','top row over its interlacing bottom entry',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(gelfand_tsetlin(2,1)) e $q$),
  ('gelfand_tsetlin','contains via <@: 2,0,0/1,0/1 ∈ gelfand_tsetlin(3,2); a non-interlacing pattern ∉','eq','true|false','the interlacing condition',$q$
    SELECT (ROW(ARRAY[2,0,0,1,0,1])::gelfand_tsetlin_pattern <@ gelfand_tsetlin(3,2))::text || '|' ||
           (ROW(ARRAY[2,0,0,0,1,1])::gelfand_tsetlin_pattern <@ gelfand_tsetlin(3,2))::text $q$),
  ('gelfand_tsetlin','range over the bound k: fibers of (n=2, k∈0..3) unfold to k=0,1,2,3','eq','0,1,2,3','the 2nd family parameter ranged',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k)
      FROM fibers(ROW(natural_range(2,2,'[]'), natural_range(0,3,'[]'))::gelfand_tsetlin) f $q$),
  ('gelfand_tsetlin','closed-form fiber_count(4, k) for k=1..5 is 16,126,672,2772,9504 (#254 accel)','eq','16,126,672,2772,9504','n=4 rows, past the old n≈8 explosion threshold in spirit',$q$
    SELECT string_agg(cardinality(gelfand_tsetlin(4, k))::text, ',' ORDER BY k) FROM generate_series(1,5) k $q$);
