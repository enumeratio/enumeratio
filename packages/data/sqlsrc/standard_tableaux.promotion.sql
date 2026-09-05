-- requires: standard_tableaux.evacuation
-- standard_tableau_promotion — Schützenberger promotion, the "single-round" cousin of evacuation: remove the
-- entry 1 (a hole at its cell), slide the hole out via jeu de taquin (same right/down rule as evacuation's slide),
-- decrement every remaining entry by 1, then place n at the newly vacated outer corner. Unlike evacuation this
-- STAYS on the same shape (verified: shape-preserving and a bijection on standard_tableaux(n), n=0..6) — it is
-- the classical order-n permutation on RECTANGULAR shapes (verified here for the 2×2 shape: promotion^4 = id);
-- on a non-rectangular shape it is still a bijection but generally has smaller/other order.

CREATE FUNCTION standard_tableau_promotion(x standard_tableau) RETURNS standard_tableau LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  w int[] := (x).row_word; n int := coalesce(array_length(w,1), 0);
  numrows int; cnt int[]; origlen int[]; grid int[][]; maxlen int := 0;
  i int; r int; r0 int; c0 int; rr int; cc int; hasright boolean; hasdown boolean; outw int[];
BEGIN
  IF n <= 1 THEN RETURN x; END IF;
  numrows := (SELECT max(rw) FROM unnest(w) rw) + 1;
  cnt := array_fill(0, ARRAY[numrows]);
  FOR i IN 1..n LOOP cnt[w[i]+1] := cnt[w[i]+1] + 1; END LOOP;
  origlen := cnt;
  SELECT max(v) INTO maxlen FROM unnest(cnt) v;
  grid := array_fill(NULL::int, ARRAY[numrows, maxlen]);
  cnt := array_fill(0, ARRAY[numrows]);
  FOR i IN 1..n LOOP r := w[i]; cnt[r+1] := cnt[r+1] + 1; grid[r+1][cnt[r+1]] := i; END LOOP;

  r0 := NULL; c0 := NULL;
  FOR rr IN 1..numrows LOOP FOR cc IN 1..origlen[rr] LOOP IF grid[rr][cc] = 1 THEN r0 := rr; c0 := cc; END IF; END LOOP; END LOOP;
  grid[r0][c0] := NULL;
  LOOP                                                                    -- slide the hole to an outer corner
    hasright := (c0 < origlen[r0]);
    hasdown := false;
    IF r0 < numrows THEN IF c0 <= origlen[r0+1] THEN hasdown := true; END IF; END IF;
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
  FOR rr IN 1..numrows LOOP
    FOR cc IN 1..origlen[rr] LOOP IF grid[rr][cc] IS NOT NULL THEN grid[rr][cc] := grid[rr][cc] - 1; END IF; END LOOP;
  END LOOP;
  grid[r0][c0] := n;                                                      -- place n at the vacated corner (shape unchanged)

  outw := array_fill(0, ARRAY[n]);
  FOR rr IN 1..numrows LOOP
    FOR cc IN 1..origlen[rr] LOOP outw[grid[rr][cc]] := rr - 1; END LOOP;
  END LOOP;
  RETURN ROW(outw)::standard_tableau;
END $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, is_bijection) VALUES
  ('standard_tableaux','promotion','standard_tableau_promotion','standard_tableaux','Promotion',NULL,true);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','promotion is shape-preserving over standard_tableaux(n), n=0..6','eq','true','same row-length multiset before and after',$q$
    SELECT bool_and(standard_tableau_shape(standard_tableau_promotion((e).value)) = standard_tableau_shape((e).value))::text
    FROM generate_series(0,6) n, LATERAL elements(standard_tableaux(n)) e $q$),
  ('standard_tableaux','promotion is a bijection on standard_tableaux(n): as many distinct images as inputs, n=0..6','eq','1,1,2,4,10,26,76','image count matches |standard_tableaux(n)| for each n',$q$
    SELECT string_agg((SELECT count(DISTINCT notation(standard_tableau_promotion((e).value))) FROM elements(standard_tableaux(n)) e)::text, ',' ORDER BY n)
    FROM generate_series(0,6) n $q$),
  ('standard_tableaux','promotion has order 4 on the rectangular shape (2,2): applying it 4 times returns every SYT of that shape to itself','eq','true','the classical cyclic order on rectangles',$q$
    SELECT bool_and(
      (standard_tableau_promotion(standard_tableau_promotion(standard_tableau_promotion(standard_tableau_promotion((e).value))))).row_word
      = ((e).value).row_word
    )::text
    FROM elements(standard_tableaux(4)) e WHERE notation(standard_tableau_shape((e).value)) = '2+2' $q$),
  ('standard_tableaux','worked instance: promoting 1,3/2 (shape 2+1) gives 1,2/3','eq','1,2/3','remove 1, slide, decrement, place 3 at the vacated corner',$q$
    SELECT notation(standard_tableau_promotion(ROW(ARRAY[0,1,0])::standard_tableau)) $q$),
  ('standard_tableaux','the registry lists promotion, declared a bijection','eq','true','base_map row',$q$
    SELECT bool_and(is_bijection)::text FROM base_map WHERE collection = 'standard_tableaux' AND map_id = 'promotion' $q$);
