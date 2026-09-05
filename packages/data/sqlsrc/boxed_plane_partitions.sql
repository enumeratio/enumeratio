-- requires: plane_partitions, realizer
-- boxed_plane_partitions — plane partitions fitting inside an a×b×c box: at most a rows, each row of length ≤ b, all
-- entries ≤ c, positive and weakly decreasing along rows AND down columns (the 0-cells are dropped, so the empty plane
-- partition is the box's floor). The first genuinely 3-GRADED collection — three INDEPENDENT axes (a,b,c) — which is why
-- it earns its keep beyond the object itself: it exercises the generic N-axis grade odometer and the realizer's N-axis
-- constructors/fibers/address end to end. Shares the ragged `plane_partition` carrier with plane_partitions (a sibling:
-- the same object, box-bounded instead of size-graded). |box(a,b,c)| = MacMahon's box product ∏∏∏ (i+j+k−1)/(i+j+k−2).

-- MacMahon's box formula — the number of plane partitions in an a×b×c box. Symmetric in a,b,c. The product of rationals
-- is an exact integer; round() clears numeric fuzz. Empty product (any dim 0) = 1 (just the empty plane partition).
CREATE FUNCTION macmahon_box(a int, b int, c int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE p numeric := 1; i int; j int; k int;
  BEGIN
    FOR i IN 1..a LOOP FOR j IN 1..b LOOP FOR k IN 1..c LOOP
      p := p * (i + j + k - 1)::numeric / (i + j + k - 2);
    END LOOP; END LOOP; END LOOP;
    RETURN round(p);
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────────
CREATE TYPE boxed_plane_partitions_fiber AS (a natural_number, b natural_number, c natural_number);   -- three independent axes: the box dims
CREATE FUNCTION fiber_count(f boxed_plane_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT macmahon_box((f).a::int, (f).b::int, (f).c::int) $$;
-- FLOOR: stack rows top→bottom, each row a partition bounded above by the row over it (partitions_under, reused from
-- plane_partitions) with parts ≤ c and length ≤ b, up to a rows. EVERY prefix (including the empty start) is a plane
-- partition in the box, so all build states are emitted — no completeness filter.
CREATE FUNCTION fiber_elements(f boxed_plane_partitions_fiber, element_limit int) RETURNS SETOF plane_partition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS entries, ARRAY[]::int[] AS shape,
           ARRAY(SELECT (f).c::int FROM generate_series(1, (f).b::int)) AS prev_row, 0 AS nrows   -- row-0 ceiling = [c × b]
    UNION ALL
    SELECT b.entries || nr, b.shape || array_length(nr, 1), nr, b.nrows + 1
      FROM build b, LATERAL partitions_under(b.prev_row, (f).a::int * (f).b::int * (f).c::int) nr
     WHERE b.nrows < (f).a::int AND array_length(nr, 1) >= 1                       -- ≤ a rows; a zero-length row = stop
  )
  SELECT ROW(entries, shape)::plane_partition FROM build
   ORDER BY shape, entries
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f boxed_plane_partitions_fiber, v plane_partition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE ent int[] := (v).entries; sh int[] := (v).shape; nr int; off int := 0; i int; j int; rowvals int[]; prev int[] := NULL;
  BEGIN
    nr := coalesce(array_length(sh, 1), 0);
    IF nr > (f).a::int THEN RETURN false; END IF;                                                          -- ≤ a rows
    IF coalesce(array_length(ent, 1), 0) <> coalesce((SELECT sum(x) FROM unnest(sh) x), 0) THEN RETURN false; END IF;   -- #entries = total cells
    FOR i IN 1..nr LOOP
      IF sh[i] < 1 OR sh[i] > (f).b::int OR (i > 1 AND sh[i] > sh[i-1]) THEN RETURN false; END IF;         -- row length 1..b; shape a partition
      rowvals := ent[off+1 : off+sh[i]];
      FOR j IN 1..sh[i] LOOP
        IF rowvals[j] < 1 OR rowvals[j] > (f).c::int OR (j > 1 AND rowvals[j] > rowvals[j-1]) THEN RETURN false; END IF;   -- entries 1..c, non-increasing
        IF prev IS NOT NULL AND j <= coalesce(array_length(prev, 1), 0) AND rowvals[j] > prev[j] THEN RETURN false; END IF; -- ≤ the row above
      END LOOP;
      prev := rowvals; off := off + sh[i];
    END LOOP;
    RETURN true;
  END $$;
CREATE FUNCTION fiber_symbol(f boxed_plane_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'PP[' || (f).a::int || '×' || (f).b::int || '×' || (f).c::int || ']' $$;

-- declare it as DATA (three independent unbounded axes) + realize
INSERT INTO base_collection VALUES ('boxed_plane_partitions', 'plane_partition');
INSERT INTO base_grade VALUES
  ('boxed_plane_partitions', 1, 'a', NULL, NULL),   -- rows
  ('boxed_plane_partitions', 2, 'b', NULL, NULL),   -- columns
  ('boxed_plane_partitions', 3, 'c', NULL, NULL);   -- max entry (box height)
SELECT base_realize('boxed_plane_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('boxed_plane_partitions','MacMahon count: |box(1,1,1)|=2, |box(2,2,2)|=20, |box(1,1,c)|=c+1','eq','2|20|4','the box product',$q$
    SELECT cardinality(boxed_plane_partitions(1,1,1))::text || '|' ||
           cardinality(boxed_plane_partitions(2,2,2))::text || '|' ||
           cardinality(boxed_plane_partitions(1,1,3))::text $q$),
  ('boxed_plane_partitions','the count is symmetric in the box dims: |box(1,2,3)| = |box(3,2,1)| = |box(2,3,1)|','eq','true','MacMahon symmetry',$q$
    SELECT (cardinality(boxed_plane_partitions(1,2,3)) = cardinality(boxed_plane_partitions(3,2,1))
        AND cardinality(boxed_plane_partitions(1,2,3)) = cardinality(boxed_plane_partitions(2,3,1)))::text $q$),
  ('boxed_plane_partitions','the floor realizes exactly the count (accel = enumeration) for several boxes','eq','2,4,20,50','count == |elements| for (1,1,1),(1,1,3),(2,2,2),(2,2,3)',$q$
    SELECT string_agg(cnt::text, ',' ORDER BY ord) FROM (VALUES
      ((SELECT count(*) FROM elements(boxed_plane_partitions(1,1,1))), 1),
      ((SELECT count(*) FROM elements(boxed_plane_partitions(1,1,3))), 2),
      ((SELECT count(*) FROM elements(boxed_plane_partitions(2,2,2))), 3),
      ((SELECT count(*) FROM elements(boxed_plane_partitions(2,2,3))), 4)) t(cnt, ord) $q$),
  ('boxed_plane_partitions','rank 0 of box(2,2,2) is the empty plane partition (the all-zero box)','eq','|2,2,2','ORDER BY shape,entries puts the empty PP first',$q$
    SELECT notation((unrank(boxed_plane_partitions(2,2,2), 0)).value) || '|' ||
           ((unrank(boxed_plane_partitions(2,2,2), 0)).fiber).a || ',' ||
           ((unrank(boxed_plane_partitions(2,2,2), 0)).fiber).b || ',' ||
           ((unrank(boxed_plane_partitions(2,2,2), 0)).fiber).c $q$),
  ('boxed_plane_partitions','the full box is the top element: 2/2 ∈ box(2,2,1) means both cells filled (all = 1)','eq','true','the maximal plane partition in a 2×2×1 box',$q$
    SELECT (ROW(ARRAY[1,1,1,1], ARRAY[2,2])::plane_partition <@ boxed_plane_partitions(2,2,1))::text $q$),
  ('boxed_plane_partitions','contains is box-bounded: 3 ∉ box(2,2,2) (entry exceeds c=2); 2,1/1 ∈','eq','false|true','entries ≤ c, ≤ a rows, rows ≤ b',$q$
    SELECT (ROW(ARRAY[3], ARRAY[1])::plane_partition <@ boxed_plane_partitions(2,2,2))::text || '|' ||
           (ROW(ARRAY[2,1,1], ARRAY[2,1])::plane_partition <@ boxed_plane_partitions(2,2,2))::text $q$),
  ('boxed_plane_partitions','THREE axes: the fiber address is a length-3 vector, and next steps the innermost (c)','eq','3|1,1,2','the generic N-axis odometer on a 3-graded collection',$q$
    SELECT array_length(address(ROW(1,1,1)::boxed_plane_partitions_fiber), 1)::text || '|' ||
           (next(ROW(1,1,1)::boxed_plane_partitions_fiber)).a || ',' ||
           (next(ROW(1,1,1)::boxed_plane_partitions_fiber)).b || ',' ||
           (next(ROW(1,1,1)::boxed_plane_partitions_fiber)).c $q$);
