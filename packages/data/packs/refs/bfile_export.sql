-- requires: realizer, triangle_slices
-- OEIS b-file export (issue #135). A b-file is OEIS's plain-text format for a sequence: one line per term,
-- "n a(n)" (space-separated, 0-based index by convention), used for terms too long/many for the main entry page.
-- bfile() produces exactly that text for any collection wired into this catalog, dispatching on shape:
--   • plain (ungraded) number-sequence collection ⇒ n a(n) is just the index and elements(coll(), N).value, read
--     via ONE elements() call over the whole requested range (not N separate unrank calls — unrank(handle, r) walks
--     elements(h, r+1) from scratch every time, so looping it per n would be O(N) redundant scans instead of one).
--   • (n,k)-graded triangle registered in base_triangle ⇒ "the flattened triangle reading": cells in row-major
--     order (row_index, col_index ascending), a(n) = the fiber cardinality, n = the flat 0-based position — there's
--     no single index axis on a triangle, so flattening is the only way to express it as ONE b-file sequence (OEIS
--     itself publishes triangles this way, e.g. A007318 for Pascal's triangle).
-- up_to is capped at 10000 rows (n_max for a triangle — its row count grows like n_max², so this is already a lot
-- of cells) to keep this an interactive export, not a batch job.
CREATE FUNCTION bfile(collection text, up_to int) RETURNS SETOF text LANGUAGE plpgsql STABLE AS $$
  DECLARE capped int; is_triangle boolean;
  BEGIN
    IF up_to IS NULL OR up_to < 0 THEN RETURN; END IF;
    capped := least(up_to, 10000);
    SELECT EXISTS(SELECT 1 FROM base_triangle t WHERE t.collection = bfile.collection) INTO is_triangle;

    IF is_triangle THEN
      RETURN QUERY
        SELECT (rn - 1)::text || ' ' || value::text
        FROM (SELECT value, row_number() OVER (ORDER BY row_index, col_index) rn
              FROM triangle_cells(bfile.collection, capped)) cells
        ORDER BY rn;
    ELSE
      RETURN QUERY EXECUTE format(
        'SELECT ordinality(e)::text || '' '' || (e).value::text FROM elements(%I(), %s) e ORDER BY ordinality(e)',
        collection, capped + 1);
    END IF;
  END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('bfile','plain sequence: catalan_numbers up to n=6','eq','0 1
1 1
2 2
3 5
4 14
5 42
6 132','one "n a(n)" line per term, index order',$q$
    SELECT string_agg(line, E'\n' ORDER BY split_part(line, ' ', 1)::int) FROM bfile('catalan_numbers', 6) line $q$),
  ('bfile','triangle: k_subsets (Pascal) up to row n=3, flattened','eq','0 1
1 1
2 1
3 1
4 2
5 1
6 1
7 3
8 3
9 1','row-major flatten of C(n,k) for n=0..3, a(flat index)',$q$
    SELECT string_agg(line, E'\n' ORDER BY split_part(line, ' ', 1)::int) FROM bfile('k_subsets', 3) line $q$),
  ('bfile','up_to is capped at 10000','eq','10001','never emits more than 10001 lines (n=0..10000), even asking for far more',$q$
    SELECT count(*)::text FROM bfile('triangular_numbers', 999999) $q$),
  ('bfile','negative up_to yields no rows','eq','0','guards against a nonsensical bound',$q$
    SELECT count(*)::text FROM bfile('catalan_numbers', -1) $q$);
