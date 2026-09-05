-- requires: realizer, utilities
-- plane_partitions — plane partitions of n: a 2D array of positive integers weakly decreasing along rows AND columns,
-- summing to n (a FindStat collection; sage's "Plane partitions of size n"). Equivalently a chain of partition rows
-- π₁ ⊇ π₂ ⊇ … (each row entrywise ≤ the one above), Σ|πᵢ| = n. Carried FLAT as (entries = the rows concatenated
-- row-major, shape = the row lengths), rendered rows-slash-separated (e.g. 2,1/1). count = 1,1,3,6,13,24,48,… (A000219;
-- no simple closed form — counted from the floor). The floor chains rows: each next row is any NON-EMPTY partition
-- bounded above by the previous row (partitions_under), until the cells sum to n.

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE plane_partition AS (entries int[], shape int[]);        -- entries row-major; shape = the row lengths (a partition)
CREATE FUNCTION notation(p plane_partition) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE sh int[] := (p).shape; off int := 0; i int; out text := '';
  BEGIN
    FOR i IN 1..coalesce(array_length(sh,1),0) LOOP
      out := out || CASE WHEN i > 1 THEN '/' ELSE '' END || array_to_string((p).entries[off+1 : off+sh[i]], ',');
      off := off + sh[i];
    END LOOP;
    RETURN out;
  END $$;

-- every partition entrywise ≤ `ceiling` (and no longer), with sum ≤ max_sum — built one non-increasing entry at a time.
CREATE FUNCTION partitions_under(ceiling int[], max_sum int) RETURNS SETOF int[] LANGUAGE sql STABLE AS $$
  WITH RECURSIVE b AS (
    SELECT ARRAY[]::int[] AS r, 0 AS s
    UNION ALL
    SELECT b.r || v, b.s + v
      FROM b, LATERAL generate_series(1, least(
               coalesce(b.r[array_length(b.r,1)], 2147483647),                   -- ≤ the previous entry (non-increasing)
               coalesce(ceiling[coalesce(array_length(b.r,1),0) + 1], 0),        -- ≤ the ceiling at this column
               max_sum - b.s)) v
     WHERE coalesce(array_length(b.r,1),0) < coalesce(array_length(ceiling,1),0)  -- length ≤ ceiling length
  )
  SELECT r FROM b $$;                                                             -- every partial IS a valid partition under

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE plane_partitions_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f plane_partitions_fiber, element_limit int) RETURNS SETOF plane_partition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS entries, ARRAY[]::int[] AS shape,
           ARRAY(SELECT (f).size::int FROM generate_series(1, (f).size::int)) AS prev_row, 0 AS cells   -- ceiling for row 1 = n×n
    UNION ALL
    SELECT b.entries || nr, b.shape || array_length(nr,1), nr, b.cells + (SELECT sum(x)::int FROM unnest(nr) x)
      FROM build b, LATERAL partitions_under(b.prev_row, (f).size::int - b.cells) nr
     WHERE b.cells < (f).size::int AND array_length(nr,1) >= 1                       -- each next row is non-empty and ⊆ the row above
  )
  SELECT ROW(entries, shape)::plane_partition FROM build
   WHERE cells = (f).size::int
   ORDER BY shape, entries
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f plane_partitions_fiber, v plane_partition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE ent int[] := (v).entries; sh int[] := (v).shape; nr int; off int := 0; i int; j int; rowvals int[]; prev_row int[] := NULL;
  BEGIN
    nr := coalesce(array_length(sh,1), 0);
    IF coalesce((SELECT sum(x) FROM unnest(ent) x),0) <> (f).size::int THEN RETURN false; END IF;
    IF coalesce(array_length(ent,1),0) <> coalesce((SELECT sum(x) FROM unnest(sh) x),0) THEN RETURN false; END IF;   -- #entries = total cells
    FOR i IN 1..nr LOOP
      IF sh[i] < 1 OR (i > 1 AND sh[i] > sh[i-1]) THEN RETURN false; END IF;                         -- shape is a partition
      rowvals := ent[off+1 : off+sh[i]];
      FOR j IN 1..sh[i] LOOP
        IF rowvals[j] < 1 OR (j > 1 AND rowvals[j] > rowvals[j-1]) THEN RETURN false; END IF;        -- row non-increasing, positive
        IF prev_row IS NOT NULL AND rowvals[j] > prev_row[j] THEN RETURN false; END IF;              -- column non-increasing
      END LOOP;
      prev_row := rowvals; off := off + sh[i];
    END LOOP;
    RETURN true;
  END $$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('plane_partitions', 'plane_partition');
INSERT INTO base_grade VALUES ('plane_partitions', 1, 'size', NULL, NULL);
SELECT base_realize('plane_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('plane_partitions','anchor: |plane_partitions(n)| for n=0..6 is 1,1,3,6,13,24,48','eq','1,1,3,6,13,24,48','A000219, plane partitions of n',$q$
    SELECT string_agg(cardinality(plane_partitions(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('plane_partitions','the 3 plane partitions of 2','eq','2,1/1,1,1','a single 2, a 1-over-1 column, and a 1,1 row',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(plane_partitions(2)) e $q$),
  ('plane_partitions','render: the array [[2,1],[1]] (rows 2,1 over 1) is 2,1/1','eq','2,1/1','weakly decreasing along rows and columns',$q$
    SELECT notation(ROW(ARRAY[2,1,1], ARRAY[2,1])::plane_partition) $q$),
  ('plane_partitions','contains via <@: 2,1/1 ∈ plane_partitions(4); a column-increasing 1/2 ∉','eq','true|false','weakly decreasing down columns',$q$
    SELECT (ROW(ARRAY[2,1,1], ARRAY[2,1])::plane_partition <@ plane_partitions(4))::text || '|' ||
           (ROW(ARRAY[1,2], ARRAY[1,1])::plane_partition <@ plane_partitions(3))::text $q$),
  ('plane_partitions','every element of plane_partitions(4) sums to 4','eq','true','the defining invariant',$q$
    SELECT bool_and((SELECT coalesce(sum(x),0) FROM unnest(((e).value).entries) x) = 4)::text FROM elements(plane_partitions(4)) e $q$),
  ('plane_partitions','range constructor plane_partitions(0,3): fibers unfold to sizes 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(plane_partitions(0,3)) f $q$);
