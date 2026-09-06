-- requires: standard_tableaux.stats
-- standard_tableau_evacuation — the Schützenberger involution on standard Young tableaux (FindStat map Mp00087 is
-- the permutation-carrier "reverse RSK" cousin; this is the tableau-carrier evacuation itself). Built via repeated
-- jeu de taquin: remove the cell holding 1, slide the resulting hole out to an outer corner (always moving the
-- SMALLER of the right/down neighbor into the hole), record that corner as vacated at step s, decrement every
-- remaining entry by 1, and repeat for s = 1..n. The s-th vacated corner gets FINAL label n+1-s (verified by
-- differential below: evacuation is an involution and lands back in the same fiber, checked over every SYT with
-- ≤ 6 cells).

CREATE FUNCTION standard_tableau_evacuation(x standard_tableau) RETURNS standard_tableau LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  w int[] := (x).row_word; n int := coalesce(array_length(w,1), 0);
  numrows int; cnt int[]; origlen int[]; rowlen int[]; grid int[][]; evac int[][]; maxlen int := 0;
  i int; r int; s int; r0 int; c0 int; rr int; cc int; hasright boolean; hasdown boolean; outw int[];
BEGIN
  IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::standard_tableau; END IF;
  numrows := (SELECT max(rw) FROM unnest(w) rw) + 1;
  cnt := array_fill(0, ARRAY[numrows]);
  FOR i IN 1..n LOOP cnt[w[i]+1] := cnt[w[i]+1] + 1; END LOOP;         -- row lengths (0-based row → 1-based array slot)
  origlen := cnt;
  SELECT max(v) INTO maxlen FROM unnest(cnt) v;
  grid := array_fill(NULL::int, ARRAY[numrows, maxlen]);               -- grid[row+1][col] = entry, NULL outside the shape
  cnt := array_fill(0, ARRAY[numrows]);
  FOR i IN 1..n LOOP r := w[i]; cnt[r+1] := cnt[r+1] + 1; grid[r+1][cnt[r+1]] := i; END LOOP;   -- fill left-to-right by entry order (row-fill order = column order)
  rowlen := origlen;
  evac := array_fill(NULL::int, ARRAY[numrows, maxlen]);

  FOR s IN 1..n LOOP
    r0 := NULL; c0 := NULL;
    FOR rr IN 1..numrows LOOP
      FOR cc IN 1..rowlen[rr] LOOP IF grid[rr][cc] = 1 THEN r0 := rr; c0 := cc; END IF; END LOOP;
    END LOOP;
    grid[r0][c0] := NULL;
    LOOP                                                               -- slide the hole to an outer corner
      hasright := (c0 < rowlen[r0]);
      hasdown := false;
      IF r0 < numrows THEN IF c0 <= rowlen[r0+1] THEN hasdown := true; END IF; END IF;
      EXIT WHEN NOT hasright AND NOT hasdown;
      IF hasright AND NOT hasdown THEN
        grid[r0][c0] := grid[r0][c0+1]; grid[r0][c0+1] := NULL; c0 := c0 + 1;
      ELSIF hasdown AND NOT hasright THEN
        grid[r0][c0] := grid[r0+1][c0]; grid[r0+1][c0] := NULL; r0 := r0 + 1;
      ELSIF grid[r0][c0+1] < grid[r0+1][c0] THEN
        grid[r0][c0] := grid[r0][c0+1]; grid[r0][c0+1] := NULL; c0 := c0 + 1;
      ELSE
        grid[r0][c0] := grid[r0+1][c0]; grid[r0+1][c0] := NULL; r0 := r0 + 1;
      END IF;
    END LOOP;
    evac[r0][c0] := n + 1 - s;                                         -- (r0,c0) is now the vacated outer corner
    rowlen[r0] := rowlen[r0] - 1;
    FOR rr IN 1..numrows LOOP
      FOR cc IN 1..rowlen[rr] LOOP grid[rr][cc] := grid[rr][cc] - 1; END LOOP;
    END LOOP;
  END LOOP;

  outw := array_fill(0, ARRAY[n]);
  FOR rr IN 1..numrows LOOP
    FOR cc IN 1..origlen[rr] LOOP outw[evac[rr][cc]] := rr - 1; END LOOP;
  END LOOP;
  RETURN ROW(outw)::standard_tableau;
END $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, is_bijection, is_order_iso) VALUES
  ('standard_tableaux','evacuation','standard_tableau_evacuation','standard_tableaux','Evacuation (Schützenberger involution)',NULL,true,false);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','evacuation is an involution on every SYT with ≤ 6 cells','eq','true','evac(evac(t)) = t, exhaustively',$q$
    SELECT bool_and((standard_tableau_evacuation(standard_tableau_evacuation((e).value))).row_word = ((e).value).row_word)::text
    FROM generate_series(0,6) n, LATERAL elements(standard_tableaux(n)) e $q$),
  ('standard_tableaux','evacuation lands back in the same fiber, for every SYT with ≤ 6 cells','eq','true','it stays a valid SYT of the same size (in fact same shape)',$q$
    SELECT bool_and(standard_tableau_evacuation((e).value) <@ standard_tableaux(n))::text
    FROM generate_series(0,6) n, LATERAL elements(standard_tableaux(n)) e $q$),
  ('standard_tableaux','evacuation swaps the two hook-shape SYT of size 3: 1,3/2 ↔ 1,2/3','eq','1,2/3|1,3/2','the shape (2,1) has 2 SYT, non-trivially paired',$q$
    SELECT notation(standard_tableau_evacuation(ROW(ARRAY[0,1,0])::standard_tableau)) || '|' ||
           notation(standard_tableau_evacuation(ROW(ARRAY[0,0,1])::standard_tableau)) $q$),
  ('standard_tableaux','evacuation fixes the single-row and single-column SYT (rectangular 1×n shapes)','eq','1,2,3|1/2/3','a row/column has only one SYT, so evacuation must fix it',$q$
    SELECT notation(standard_tableau_evacuation(ROW(ARRAY[0,0,0])::standard_tableau)) || '|' ||
           notation(standard_tableau_evacuation(ROW(ARRAY[0,1,2])::standard_tableau)) $q$),
  ('standard_tableaux','evacuation preserves shape (its own shape, since it stays in the same collection over ≤ 6 cells)','eq','true','evac(t) and t always have the same row-length multiset',$q$
    SELECT bool_and(standard_tableau_shape(standard_tableau_evacuation((e).value)) = standard_tableau_shape((e).value))::text
    FROM generate_series(0,6) n, LATERAL elements(standard_tableaux(n)) e $q$),
  ('standard_tableaux','the registry now lists the evacuation map, declared a bijection (an involution)','eq','true','base_map row',$q$
    SELECT bool_and(is_bijection)::text FROM base_map WHERE collection = 'standard_tableaux' AND map_id = 'evacuation' $q$);
