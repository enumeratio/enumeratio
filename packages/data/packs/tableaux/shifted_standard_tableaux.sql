-- requires: standard_tableaux, realizer, utilities
-- shifted_standard_tableaux — standard Young tableaux on SHIFTED diagrams of strict partitions (λ_1 > λ_2 > … > 0),
-- with n cells (a Sage `StandardSkewTableaux`/FindStat-adjacent family; sage: StandardTableaux of shifted shape).
-- Row i (1-indexed) of the shifted diagram of λ occupies columns i..i+λ_i−1 — each row starts one column further
-- right than the last, so row i's k-th cell shares a COLUMN with row (i−1)'s (k+1)-th cell. Reuses the
-- `standard_tableau` carrier (row_word[i] = 0-based row of entry i) rather than a bespoke carrier: given the
-- shifted geometry, row assignment + row-fill order (increasing) still determines the exact cell, exactly as for
-- the plain (non-shifted) standard_tableau notation()/render — see standard_tableaux.sql (audit §3.2: no new
-- carrier when a sibling's fits). NOTE: `notation()` on this carrier does not draw the shift offset — it renders
-- row contents only, same as the straight collection; a shift-aware repr is future work.
--
-- The floor mirrors standard_tableaux' ballot-word generator, but the "row r must be shorter than row r-1"
-- guard becomes "row r must be shorter than row r-1 BY AT LEAST 2" — the extra column of shift means the cell
-- above a new entry in row r sits one column further into row r-1, so row r-1 must already reach one cell past
-- where row r would align in the straight case. (Verified: this keeps the completed shape a STRICT partition,
-- and the floor's counts by n for n=0..6 are 1,1,1,2,3,6,12 — checked by hand against the shifted hook-length
-- count per shape, and cross-checked against a direct SQL brute-force in the session that built this file.)

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE shifted_standard_tableaux_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f shifted_standard_tableaux_fiber, element_limit int) RETURNS SETOF standard_tableau LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS w, ARRAY[]::int[] AS counts                          -- counts[k] = current length of row k-1
    UNION ALL
    SELECT b.w || r, b.counts[1:r] || (coalesce(b.counts[r+1],0) + 1) || b.counts[r+2:]
      FROM build b, LATERAL generate_series(0, coalesce(array_length(b.counts,1), 0)) r   -- r = 0 .. #rows (a new row)
     WHERE coalesce(array_length(b.w,1), 0) < (f).size::int
       AND coalesce(b.counts[r+1],0) + 2 <= CASE WHEN r = 0 THEN 2147483647 ELSE b.counts[r] END   -- shifted gap: row r at least 2 shorter than row r-1
  )
  SELECT ROW(w)::standard_tableau FROM build
   WHERE coalesce(array_length(w,1), 0) = (f).size::int
   ORDER BY w
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f shifted_standard_tableaux_fiber, v standard_tableau) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).size::int; w int[] := (v).row_word; counts int[] := '{}'; i int; r int;
  BEGIN
    IF coalesce(array_length(w,1), 0) <> n THEN RETURN false; END IF;
    FOR i IN 1..n LOOP                                                            -- replay the placement, checking each is legal
      r := w[i];
      IF r < 0 OR r > coalesce(array_length(counts,1), 0) THEN RETURN false; END IF;             -- row index out of reach
      IF r > 0 AND coalesce(counts[r+1],0) + 2 > counts[r] THEN RETURN false; END IF;             -- would break the shifted-strict shape
      counts := counts[1:r] || (coalesce(counts[r+1],0) + 1) || counts[r+2:];
    END LOOP;
    RETURN true;
  END $$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('shifted_standard_tableaux', 'standard_tableau');
INSERT INTO base_grade VALUES ('shifted_standard_tableaux', 1, 'size', NULL, NULL);
SELECT base_realize('shifted_standard_tableaux');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('shifted_standard_tableaux','anchor: |shifted_standard_tableaux(n)| for n=0..6 is 1,1,1,2,3,6,12','eq','1,1,1,2,3,6,12','summed over every strict-partition shape of n',$q$
    SELECT string_agg(cardinality(shifted_standard_tableaux(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('shifted_standard_tableaux','the 2 shifted SYT with 3 cells: the row (3), and the hook (2,1) shifted','eq','1,2,3|1,2/3','shape (3) has 1, shape (2,1) shifted has 1',$q$
    SELECT string_agg(render(e), '|' ORDER BY ordinality(e)) FROM elements(shifted_standard_tableaux(3)) e $q$),
  ('shifted_standard_tableaux','the 3 shifted SYT with 4 cells: shape (4) has 1, shifted (3,1) has 2','eq','1,2,3,4|1,2,3/4|1,2,4/3','row-fill order distinguishes the two (3,1) fillings',$q$
    SELECT string_agg(render(e), '|' ORDER BY ordinality(e)) FROM elements(shifted_standard_tableaux(4)) e $q$),
  ('shifted_standard_tableaux','contains via <@: 1,2/3 (row_word {0,0,1}) ∈ shifted_standard_tableaux(3); the non-shifted 1,3/2 (row_word {0,1,0}) ∉','eq','true|false','the shifted-strict gap condition',$q$
    SELECT (ROW(ARRAY[0,0,1])::standard_tableau <@ shifted_standard_tableaux(3))::text || '|' ||
           (ROW(ARRAY[0,1,0])::standard_tableau <@ shifted_standard_tableaux(3))::text $q$),
  ('shifted_standard_tableaux','every shape occurring has DISTINCT row lengths (a strict partition), for n=0..6','eq','true','shifted diagrams require distinct part sizes — #rows = #distinct row-lengths',$q$
    SELECT bool_and(
      (SELECT count(*) FROM (SELECT count(*) c FROM unnest(((e).value).row_word) r GROUP BY r) t) =
      (SELECT count(DISTINCT c) FROM (SELECT count(*) c FROM unnest(((e).value).row_word) r GROUP BY r) t)
    )::text FROM generate_series(1,6) n, LATERAL elements(shifted_standard_tableaux(n)) e $q$),
  ('shifted_standard_tableaux','range constructor shifted_standard_tableaux(0,4): fibers unfold to sizes 0,1,2,3,4','eq','0,1,2,3,4','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(shifted_standard_tableaux(0,4)) f $q$);
