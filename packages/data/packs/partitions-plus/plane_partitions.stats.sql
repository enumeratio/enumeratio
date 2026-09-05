-- requires: plane_partitions, integer_partitions, realizer, utilities
-- plane_partitions statistics + maps — per-element numerics (rows, columns, largest part, number of cells, trace)
-- and the two shape/transpose morphisms. All handle the empty element (coalesce to 0/∅). #rows, #columns and the
-- largest part are equidistributed over plane_partitions(n) (the S_3 symmetry of the three axes of a plane partition).

-- ── statistics (carrier plane_partition: entries row-major, shape = row lengths; n = Σ entries) ──────────────
CREATE FUNCTION plane_partitions_num_rows(p plane_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((p).shape, 1), 0) $$;                              -- rows = length(shape) (every row non-empty)
CREATE FUNCTION plane_partitions_num_columns(p plane_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((p).shape[1], 0) $$;                                           -- shape non-increasing ⇒ #cols = shape_1
CREATE FUNCTION plane_partitions_largest_part(p plane_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((p).entries) x), 0)::int $$;        -- the top-left corner value (the max height)
CREATE FUNCTION plane_partitions_num_parts(p plane_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((p).entries, 1), 0) $$;                           -- number of positive parts = number of cells
CREATE FUNCTION plane_partitions_trace(p plane_partition) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE sh int[] := (p).shape; ent int[] := (p).entries; off int := 0; i int; t int := 0;
  BEGIN
    FOR i IN 1..coalesce(array_length(sh,1),0) LOOP
      IF sh[i] >= i THEN t := t + ent[off + i]; END IF;                          -- diagonal cell (i,i) exists iff row i reaches column i
      off := off + sh[i];
    END LOOP;
    RETURN t;
  END $$;

-- ── maps ─────────────────────────────────────────────────────────────────────────────────────────────────
-- shape: the row lengths of the plane partition, which are already a (non-increasing) integer partition of the cell count.
CREATE FUNCTION plane_partitions_shape(p plane_partition) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(coalesce((p).shape, '{}'::int[]))::integer_partition $$;
-- transpose: reflect across the main diagonal (a[i][j] ↦ a[j][i]) — an involution on plane_partitions of the same n
-- (the S_3 swap of the row and column axes). New shape = conjugate of the old shape.
CREATE FUNCTION plane_partitions_transpose(p plane_partition) RETURNS plane_partition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE sh int[] := (p).shape; ent int[] := (p).entries;
          nrows int := coalesce(array_length(sh,1),0); ncols int := coalesce(sh[1],0);
          new_ent int[] := '{}'; new_shape int[] := '{}'; off int[] := '{}'; acc int := 0; i int; j int; collen int;
  BEGIN
    FOR i IN 1..nrows LOOP off := off || acc; acc := acc + sh[i]; END LOOP;      -- off[i] = start of row i in entries
    FOR j IN 1..ncols LOOP                                                       -- new row j = old column j, top-to-bottom
      collen := 0;
      FOR i IN 1..nrows LOOP
        IF sh[i] >= j THEN new_ent := new_ent || ent[off[i] + j]; collen := collen + 1; END IF;
      END LOOP;
      new_shape := new_shape || collen;
    END LOOP;
    RETURN ROW(new_ent, new_shape)::plane_partition;
  END $$;

-- ── register in base_stat (collection, stat_id, value_fn, title, codomain) ───────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('plane_partitions','num_rows','plane_partitions_num_rows','Number of rows','natural_numbers'),
  ('plane_partitions','num_columns','plane_partitions_num_columns','Number of columns','natural_numbers'),
  ('plane_partitions','largest_part','plane_partitions_largest_part','Largest part','natural_numbers'),
  ('plane_partitions','num_parts','plane_partitions_num_parts','Number of parts','natural_numbers'),
  ('plane_partitions','trace','plane_partitions_trace','Trace','natural_numbers');

-- ── register in base_map (collection, map_id, mapping_fn, codomain, title, findstat) ─────────────────────
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('plane_partitions','shape','plane_partitions_shape','integer_partitions','Shape',NULL),
  ('plane_partitions','transpose','plane_partitions_transpose','plane_partitions','Transpose',NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('plane_partitions','2/1/1 has 3 rows, 1 column, largest 2, 3 cells, trace 2','eq','3|1|2|3|2','a single-column spot check (rows ≠ columns)',$q$
    SELECT plane_partitions_num_rows(ROW(ARRAY[2,1,1],ARRAY[1,1,1])::plane_partition)::text || '|' ||
           plane_partitions_num_columns(ROW(ARRAY[2,1,1],ARRAY[1,1,1])::plane_partition)::text || '|' ||
           plane_partitions_largest_part(ROW(ARRAY[2,1,1],ARRAY[1,1,1])::plane_partition)::text || '|' ||
           plane_partitions_num_parts(ROW(ARRAY[2,1,1],ARRAY[1,1,1])::plane_partition)::text || '|' ||
           plane_partitions_trace(ROW(ARRAY[2,1,1],ARRAY[1,1,1])::plane_partition)::text $q$),
  ('plane_partitions','3,2/2,1: trace 4 sums both diagonal cells (3+1)','eq','2|2|3|4|4','rows|columns|largest|cells|trace',$q$
    SELECT plane_partitions_num_rows(ROW(ARRAY[3,2,2,1],ARRAY[2,2])::plane_partition)::text || '|' ||
           plane_partitions_num_columns(ROW(ARRAY[3,2,2,1],ARRAY[2,2])::plane_partition)::text || '|' ||
           plane_partitions_largest_part(ROW(ARRAY[3,2,2,1],ARRAY[2,2])::plane_partition)::text || '|' ||
           plane_partitions_num_parts(ROW(ARRAY[3,2,2,1],ARRAY[2,2])::plane_partition)::text || '|' ||
           plane_partitions_trace(ROW(ARRAY[3,2,2,1],ARRAY[2,2])::plane_partition)::text $q$),
  ('plane_partitions','empty plane partition has every statistic 0','eq','0|0|0|0|0','coalesce on the size-0 element',$q$
    SELECT plane_partitions_num_rows((e).value)::text || '|' || plane_partitions_num_columns((e).value)::text || '|' ||
           plane_partitions_largest_part((e).value)::text || '|' || plane_partitions_num_parts((e).value)::text || '|' ||
           plane_partitions_trace((e).value)::text FROM elements(plane_partitions(0)) e $q$),
  ('plane_partitions','num_rows over plane_partitions(4) groups as 5,5,2,1','eq','5,5,2,1','distribution by 1,2,3,4 rows',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (
      SELECT plane_partitions_num_rows((e).value) v, count(*) c FROM elements(plane_partitions(4)) e GROUP BY 1) t(v,c) $q$),
  ('plane_partitions','#rows, #columns, largest part are equidistributed over plane_partitions(4) (S_3 symmetry)','eq','5,5,2,1|5,5,2,1|5,5,2,1','the three axes of a plane partition',$q$
    SELECT (SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT plane_partitions_num_rows((e).value) v, count(*) c FROM elements(plane_partitions(4)) e GROUP BY 1) t(v,c)) || '|' ||
           (SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT plane_partitions_num_columns((e).value) v, count(*) c FROM elements(plane_partitions(4)) e GROUP BY 1) t(v,c)) || '|' ||
           (SELECT string_agg(c::text, ',' ORDER BY v) FROM (SELECT plane_partitions_largest_part((e).value) v, count(*) c FROM elements(plane_partitions(4)) e GROUP BY 1) t(v,c)) $q$),
  ('plane_partitions','num_parts over plane_partitions(4) groups as 1,4,3,5','eq','1,4,3,5','distribution by 1,2,3,4 cells',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (
      SELECT plane_partitions_num_parts((e).value) v, count(*) c FROM elements(plane_partitions(4)) e GROUP BY 1) t(v,c) $q$),
  ('plane_partitions','trace over plane_partitions(4) groups as 4,6,2,1 (Stanley trace GF ∏1/(1-q x^k)^k)','eq','4,6,2,1','distribution by trace 1,2,3,4',$q$
    SELECT string_agg(c::text, ',' ORDER BY v) FROM (
      SELECT plane_partitions_trace((e).value) v, count(*) c FROM elements(plane_partitions(4)) e GROUP BY 1) t(v,c) $q$),
  ('plane_partitions','shape of 3,2/2,1 is 2+2, of 2/1/1 is 1+1+1','eq','2+2|1+1+1','row lengths recovered as an integer partition',$q$
    SELECT notation(plane_partitions_shape(ROW(ARRAY[3,2,2,1],ARRAY[2,2])::plane_partition)) || '|' ||
           notation(plane_partitions_shape(ROW(ARRAY[2,1,1],ARRAY[1,1,1])::plane_partition)) $q$),
  ('plane_partitions','shapes over plane_partitions(3) in rank order (rendered in the codomain form)','eq','1,1+1,1+1+1,2,2+1,3','shape image of each of the 6 plane partitions of 3',$q$
    SELECT string_agg(render_value(plane_partitions_shape((e).value)), ',' ORDER BY ordinality(e)) FROM elements(plane_partitions(3)) e $q$),
  ('plane_partitions','Σ(shape) = num_parts for every plane partition of 4','eq','true','the row lengths sum to the number of cells',$q$
    SELECT bool_and((SELECT coalesce(sum(x),0) FROM unnest((plane_partitions_shape((e).value)).parts) x) = plane_partitions_num_parts((e).value))::text
      FROM elements(plane_partitions(4)) e $q$),
  ('plane_partitions','transpose 3,2/1 ↦ 3,1/2, and it is an involution','eq','3,1/2|3,2/1','reflect across the main diagonal',$q$
    SELECT notation(plane_partitions_transpose(ROW(ARRAY[3,2,1],ARRAY[2,1])::plane_partition)) || '|' ||
           notation(plane_partitions_transpose(plane_partitions_transpose(ROW(ARRAY[3,2,1],ARRAY[2,1])::plane_partition))) $q$),
  ('plane_partitions','transpose is an involution on all of plane_partitions(4)','eq','true','transpose∘transpose = identity across the fiber',$q$
    SELECT bool_and(notation(plane_partitions_transpose(plane_partitions_transpose((e).value))) = notation((e).value))::text
      FROM elements(plane_partitions(4)) e $q$),
  ('plane_partitions','the registry lists at least the known plane partition maps (a floor — more may be added)','eq','true','base_map rows',$q$
    SELECT (array_agg(map_id) @> ARRAY['shape','transpose'])::text FROM base_map WHERE collection = 'plane_partitions' $q$);