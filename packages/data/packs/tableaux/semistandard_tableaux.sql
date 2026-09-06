-- requires: realizer, utilities
-- semistandard_tableaux — semistandard Young tableaux with n cells over ALL shapes, entries in {1..k} (a FindStat
-- collection; sage SemistandardTableaux(n, max_entry=k)). Rows weakly increase left-to-right, columns strictly increase
-- top-to-bottom. A 2-parameter family (n cells, max entry k), carried FLAT as (entries row-major, shape = row lengths),
-- rendered rows-slash-separated (e.g. 1,1/2). count from the floor: it chains rows top-to-bottom — each next row is any
-- weakly-increasing sequence, no longer than the row above, and strictly greater than it entrywise, until n cells.

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE semistandard_tableau AS (entries int[], shape int[]);   -- entries row-major; shape = the row lengths (a partition)
CREATE FUNCTION notation(t semistandard_tableau) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE sh int[] := (t).shape; off int := 0; i int; out text := '';
  BEGIN
    FOR i IN 1..coalesce(array_length(sh,1),0) LOOP
      out := out || CASE WHEN i > 1 THEN '/' ELSE '' END || array_to_string((t).entries[off+1 : off+sh[i]], ',');
      off := off + sh[i];
    END LOOP;
    RETURN out;
  END $$;

-- the rows that can sit below `above`: weakly increasing, length ≤ len(above), entries ≤ maxv, and STRICTLY greater
-- than `above` entrywise (b[j] > above[j]) — the column-strictness. (For the top row pass a zero ceiling.)
CREATE FUNCTION ssyt_rows_below(above int[], maxv int) RETURNS SETOF int[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE r AS (
    SELECT ARRAY[]::int[] AS b
    UNION ALL
    SELECT r.b || v
      FROM r, LATERAL generate_series(
             greatest(above[coalesce(array_length(r.b,1),0)+1] + 1, coalesce(r.b[array_length(r.b,1)], 1)), maxv) v
     WHERE coalesce(array_length(r.b,1),0) < coalesce(array_length(above,1),0)
  )
  SELECT b FROM r $$;                                              -- every partial is a valid row of length 0..len(above)

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE semistandard_tableaux_fiber AS (size natural_number, max_entry natural_number);   -- typed fiber; axes: size, max_entry
CREATE FUNCTION fiber_elements(f semistandard_tableaux_fiber, element_limit int) RETURNS SETOF semistandard_tableau LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS entries, ARRAY[]::int[] AS shape,
           ARRAY(SELECT 0 FROM generate_series(1, (f).size::int)) AS last_row, 0 AS cells   -- zero ceiling: the first row is ≥ 1
    UNION ALL
    SELECT b.entries || nr, b.shape || array_length(nr,1), nr, b.cells + array_length(nr,1)
      FROM build b, LATERAL ssyt_rows_below(b.last_row, (f).max_entry::int) nr
     WHERE b.cells < (f).size::int AND array_length(nr,1) >= 1        -- each next row is non-empty, ⊆ and strictly above the last
  )
  SELECT ROW(entries, shape)::semistandard_tableau FROM build
   WHERE cells = (f).size::int
   ORDER BY shape, entries
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f semistandard_tableaux_fiber, v semistandard_tableau) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE ent int[] := (v).entries; sh int[] := (v).shape; nr int; off int := 0; i int; j int; row int[]; above int[] := NULL;
  BEGIN
    nr := coalesce(array_length(sh,1), 0);
    IF coalesce((SELECT sum(x) FROM unnest(sh) x),0) <> (f).size::int THEN RETURN false; END IF;                 -- n cells
    IF coalesce(array_length(ent,1),0) <> (f).size::int THEN RETURN false; END IF;
    FOR i IN 1..nr LOOP
      IF sh[i] < 1 OR (i > 1 AND sh[i] > sh[i-1]) THEN RETURN false; END IF;                                  -- shape is a partition
      row := ent[off+1 : off+sh[i]];
      FOR j IN 1..sh[i] LOOP
        IF row[j] < 1 OR row[j] > (f).max_entry::int THEN RETURN false; END IF;                                       -- entries in [1,k]
        IF j > 1 AND row[j] < row[j-1] THEN RETURN false; END IF;                                             -- rows weakly increasing
        IF above IS NOT NULL AND row[j] <= above[j] THEN RETURN false; END IF;                                -- columns strictly increasing
      END LOOP;
      above := row; off := off + sh[i];
    END LOOP;
    RETURN true;
  END $$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('semistandard_tableaux', 'semistandard_tableau');
INSERT INTO base_grade VALUES ('semistandard_tableaux', 1, 'size', NULL, NULL), ('semistandard_tableaux', 2, 'max_entry', '1', 'g1');   -- n cells; entry bound k
SELECT base_realize('semistandard_tableaux');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semistandard_tableaux','anchor: |semistandard_tableaux(n, 3)| for n=0..4 is 1,3,9,19,39','eq','1,3,9,19,39','SSYT with n cells and entries ≤ 3',$q$
    SELECT string_agg(cardinality(semistandard_tableaux(n, 3))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('semistandard_tableaux','|semistandard_tableaux(3, k)| for k=1..4 is 1,6,19,44','eq','1,6,19,44','more entries, more fillings',$q$
    SELECT string_agg(cardinality(semistandard_tableaux(3, k))::text, ',' ORDER BY k) FROM generate_series(1,4) k $q$),
  ('semistandard_tableaux','the 6 SSYT with 3 cells and entries ≤ 2','eq','1,1/2,1,2/2,1,1,1,1,1,2,1,2,2,2,2,2','the two 2,1-shaped, then four one-row fillings',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(semistandard_tableaux(3,2)) e $q$),
  ('semistandard_tableaux','contains via <@: 1,1/2 ∈ semistandard_tableaux(3,2); a column-equal 1,1/1 ∉','eq','true|false','columns must strictly increase',$q$
    SELECT (ROW(ARRAY[1,1,2], ARRAY[2,1])::semistandard_tableau <@ semistandard_tableaux(3,2))::text || '|' ||
           (ROW(ARRAY[1,1,1], ARRAY[2,1])::semistandard_tableau <@ semistandard_tableaux(3,2))::text $q$),
  ('semistandard_tableaux','entries ≤ 1 forces a single row: |semistandard_tableaux(n, 1)| = 1','eq','1,1,1','only the all-1s row',$q$
    SELECT string_agg(cardinality(semistandard_tableaux(n, 1))::text, ',' ORDER BY n) FROM generate_series(1,3) n $q$),
  ('semistandard_tableaux','range over max_entry: fibers of (n=2, k∈1..3) unfold to k=1,2,3','eq','1,2,3','the 2nd family parameter ranged',$q$
    SELECT string_agg((f).max_entry::text, ',' ORDER BY (f).max_entry)
      FROM fibers(ROW(natural_range(2,2,'[]'), natural_range(1,3,'[]'))::semistandard_tableaux) f $q$);
