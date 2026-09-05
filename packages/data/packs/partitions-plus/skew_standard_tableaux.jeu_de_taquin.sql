-- requires: skew_standard_tableaux, standard_tableaux.stats
-- jeu de taquin rectification: skew_standard_tableaux → standard_tableaux, straightening a skew filling into a
-- straight one (the classical use: it defines Littlewood–Richardson coefficients and is independent of slide
-- order — the "fundamental theorem of jeu de taquin"). Repeatedly pick the BOTTOM-MOST remaining inner corner of
-- μ (always legal: μ non-increasing ⇒ its last nonzero row is automatically a corner), open a hole there, and
-- slide the hole toward increasing row/column — same rule as standard_tableau_evacuation's slide (move the
-- SMALLER of the right/down neighbor into the hole) — until it exits the shape at an outer corner of λ, which
-- then shrinks. |μ| rounds later μ is empty and λ has shrunk by |μ| cells, leaving a straight SYT with the same n.

CREATE FUNCTION skew_tableau_rectification(t skew_tableau) RETURNS standard_tableau LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  lam int[] := (t).lam; mu0 int[] := (t).mu; w int[] := (t).row_word;
  L int := coalesce(array_length(lam,1),0); n int := coalesce(array_length(w,1),0);
  maxcol int; mucur int[]; lamcur int[]; grid int[][]; cnt int[];
  i int; r int; c int; rr int; cc int; hasright boolean; hasdown boolean; outw int[];
BEGIN
  IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::standard_tableau; END IF;
  mucur := array_fill(0, ARRAY[L]);
  FOR i IN 1..L LOOP mucur[i] := coalesce(mu0[i], 0); END LOOP;
  lamcur := lam;
  maxcol := lam[1];
  grid := array_fill(NULL::int, ARRAY[L, maxcol]);
  cnt := array_fill(0, ARRAY[L]);
  FOR i IN 1..n LOOP                                        -- fill left-to-right within each row, starting at μ_r+1
    r := w[i] + 1; cnt[r] := cnt[r] + 1; grid[r][mucur[r] + cnt[r]] := i;
  END LOOP;

  WHILE (SELECT coalesce(sum(x),0) FROM unnest(mucur) x) > 0 LOOP
    r := NULL;
    FOR rr IN REVERSE L..1 LOOP IF mucur[rr] > 0 THEN r := rr; EXIT; END IF; END LOOP;   -- bottom-most nonzero row of μ
    c := mucur[r];
    mucur[r] := mucur[r] - 1;
    LOOP                                                     -- slide the hole toward the outer boundary
      hasright := (c < lamcur[r]);
      hasdown := false;
      IF r < L THEN IF c > mucur[r+1] AND c <= lamcur[r+1] THEN hasdown := true; END IF; END IF;
      EXIT WHEN NOT hasright AND NOT hasdown;
      IF hasright AND NOT hasdown THEN
        grid[r][c] := grid[r][c+1]; grid[r][c+1] := NULL; c := c + 1;
      ELSIF hasdown AND NOT hasright THEN
        grid[r][c] := grid[r+1][c]; grid[r+1][c] := NULL; r := r + 1;
      ELSIF grid[r][c+1] < grid[r+1][c] THEN
        grid[r][c] := grid[r][c+1]; grid[r][c+1] := NULL; c := c + 1;
      ELSE
        grid[r][c] := grid[r+1][c]; grid[r+1][c] := NULL; r := r + 1;
      END IF;
    END LOOP;
    lamcur[r] := lamcur[r] - 1;                               -- (r,c) is now the vacated outer corner
  END LOOP;

  outw := array_fill(0, ARRAY[n]);
  FOR rr IN 1..L LOOP
    FOR cc IN 1..lamcur[rr] LOOP outw[grid[rr][cc]] := rr - 1; END LOOP;
  END LOOP;
  RETURN ROW(outw)::standard_tableau;
END $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('skew_standard_tableaux','jeu_de_taquin','skew_tableau_rectification','standard_tableaux','Jeu de taquin rectification',NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('skew_standard_tableaux','a straight-shape skew tableau (μ empty) rectifies to itself: 1,3/2 unchanged','eq','1,3/2','no inner corners to slide',$q$
    SELECT notation(skew_tableau_rectification(ROW(ARRAY[2,1], ARRAY[]::int[], ARRAY[0,1,0])::skew_tableau)) $q$),
  ('skew_standard_tableaux','worked instance: (2,1)/(1) filled .,1/2 rectifies to the column 1/2','eq','1/2','one slide pulls entry 1 left, then entry 2 up',$q$
    SELECT notation(skew_tableau_rectification(ROW(ARRAY[2,1], ARRAY[1], ARRAY[0,1])::skew_tableau)) $q$),
  ('skew_standard_tableaux','jeu de taquin always lands in standard_tableaux(n), over skew_standard_tableaux(n), n=0..5','eq','true','the rectification differential',$q$
    SELECT bool_and(skew_tableau_rectification((e).value) <@ standard_tableaux(n))::text
    FROM generate_series(0,5) n, LATERAL elements(skew_standard_tableaux(n)) e $q$),
  ('skew_standard_tableaux','the registry lists jeu_de_taquin, mapping into standard_tableaux','eq','true','base_map row',$q$
    SELECT (codomain = 'standard_tableaux')::text FROM base_map WHERE collection='skew_standard_tableaux' AND map_id='jeu_de_taquin' $q$);
