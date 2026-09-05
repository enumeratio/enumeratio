-- requires: realizer, utilities
-- standard_tableaux — standard Young tableaux with n cells, over ALL shapes λ ⊢ n (a FindStat collection). Carried
-- as the ROW-WORD, a lattice/ballot word: row_word[i] = the 0-based row containing entry i. Rendered as the tableau
-- (rows of entries, e.g. 1,3/2). count = the telephone numbers T(n) = |involutions of [n]| (Σ_{λ⊢n} f^λ, A000085; the
-- RSK image of an involution is a single tableau). The floor builds every ballot word of length n in lex order: entry
-- i may extend row r iff row r is currently shorter than row r-1, so the shape stays a partition (column-strictness
-- is then automatic, since entries are placed in increasing order).

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE standard_tableau AS (row_word int[]);                    -- row_word[i] = 0-based row of entry i (a ballot word)
CREATE FUNCTION notation(t standard_tableau) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(cells, '/' ORDER BY r), '')             -- the tableau rows: entries per row, e.g. 1,3/2
  FROM (SELECT (t).row_word[pos] r, string_agg(pos::text, ',' ORDER BY pos) cells
        FROM generate_subscripts((t).row_word,1) pos GROUP BY (t).row_word[pos]) g $$;

-- the telephone / involution numbers T(0)=T(1)=1, T(k)=T(k-1)+(k-1)·T(k-2) — |SYT with n cells|
CREATE FUNCTION telephone_number(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 1; b numeric := 1; c numeric; i int;
  BEGIN
    IF n <= 1 THEN RETURN 1; END IF;
    FOR i IN 2..n LOOP c := b + (i - 1) * a; a := b; b := c; END LOOP;
    RETURN b;
  END $$;

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE standard_tableaux_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f standard_tableaux_fiber, element_limit int) RETURNS SETOF standard_tableau LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS w, ARRAY[]::int[] AS counts                          -- counts[k] = current length of row k-1
    UNION ALL
    SELECT b.w || r, b.counts[1:r] || (coalesce(b.counts[r+1],0) + 1) || b.counts[r+2:]
      FROM build b, LATERAL generate_series(0, coalesce(array_length(b.counts,1), 0)) r   -- r = 0 .. #rows (a new row)
     WHERE coalesce(array_length(b.w,1), 0) < (f).size::int
       AND coalesce(b.counts[r+1],0) < CASE WHEN r = 0 THEN 2147483647 ELSE b.counts[r] END   -- row r shorter than row r-1
  )
  SELECT ROW(w)::standard_tableau FROM build
   WHERE coalesce(array_length(w,1), 0) = (f).size::int
   ORDER BY w
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f standard_tableaux_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT telephone_number((f).size::int) $$;
CREATE FUNCTION contains_in_fiber(f standard_tableaux_fiber, v standard_tableau) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).size::int; w int[] := (v).row_word; counts int[] := '{}'; i int; r int;
  BEGIN
    IF coalesce(array_length(w,1), 0) <> n THEN RETURN false; END IF;
    FOR i IN 1..n LOOP                                                            -- replay the placement, checking each is legal
      r := w[i];
      IF r < 0 OR r > coalesce(array_length(counts,1), 0) THEN RETURN false; END IF;        -- row index out of reach
      IF r > 0 AND coalesce(counts[r+1],0) >= counts[r] THEN RETURN false; END IF;          -- would break the partition shape
      counts := counts[1:r] || (coalesce(counts[r+1],0) + 1) || counts[r+2:];
    END LOOP;
    RETURN true;
  END $$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('standard_tableaux', 'standard_tableau');
INSERT INTO base_grade VALUES ('standard_tableaux', 1, 'size', NULL, NULL);
SELECT base_realize('standard_tableaux');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','anchor: |standard_tableaux(n)| for n=0..6 is 1,1,2,4,10,26,76','eq','1,1,2,4,10,26,76','the telephone numbers T(n) = Σ_λ f^λ = |involutions|',$q$
    SELECT string_agg(cardinality(standard_tableaux(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('standard_tableaux','the 4 tableaux with 3 cells, as rows','eq','1,2,3|1,2/3|1,3/2|1/2/3','all shapes of 3: the row, two hooks, the column',$q$
    SELECT string_agg(render(e), '|' ORDER BY ordinality(e)) FROM elements(standard_tableaux(3)) e $q$),
  ('standard_tableaux','render of the RGS-like row-word: row_word {0,1,0} is the tableau 1,3/2','eq','1,3/2','entry 1,3 in row 0, entry 2 in row 1',$q$
    SELECT notation(ROW(ARRAY[0,1,0])::standard_tableau) $q$),
  ('standard_tableaux','same count as involutions (RSK): |standard_tableaux(5)| = |involutions(5)| = 26','eq','26|26','Σ_λ f^λ = telephone number',$q$
    SELECT cardinality(standard_tableaux(5))::text || '|' || cardinality(involutions(5))::text $q$),
  ('standard_tableaux','contains via <@: 1,3/2 (row_word {0,1,0}) ∈ standard_tableaux(3); a non-ballot word ∉','eq','true|false','the ballot condition',$q$
    SELECT (ROW(ARRAY[0,1,0])::standard_tableau <@ standard_tableaux(3))::text || '|' ||
           (ROW(ARRAY[0,2,0])::standard_tableau <@ standard_tableaux(3))::text $q$),
  ('standard_tableaux','range constructor standard_tableaux(0,3): fibers unfold to sizes 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(standard_tableaux(0,3)) f $q$);
