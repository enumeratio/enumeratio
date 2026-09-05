-- requires: affine_permutations, glyphs
-- affine_permutation_glyph — the page-space glyph for the affine_permutation carrier (issue #222 glyph batch):
-- reuses permutation_arc_svg (hoisted into core's glyphs.sql — #283 phase 3). affine_window is a bijection Z→Z with
-- a_{i+n}=a_i+n (affine_permutations.sql); its window notation a_1..a_n can carry values outside [1,n] — the
-- WINDING that names which tile of the tessellation this element sits in. Reduce each a_i mod n to the finite part
-- u_i = ((a_i−1) mod n + n) mod n + 1 (affine_permutations.sql's own contains_in_fiber formula) to get an arc
-- target back in [1,n], and mark position i `decorated` exactly when a_i ≠ u_i — i.e. when it winds — so a wound
-- arc/loop draws dashed and its point hollow, reading the translation part c straight off the picture.
-- layer: glyph
CREATE FUNCTION glyph_svg(w affine_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH win AS (SELECT (w).affine_window AS a, greatest(1, coalesce(array_length((w).affine_window,1),0)) AS n)
  SELECT permutation_arc_svg(
    ARRAY(SELECT ((x - 1) % n + n) % n + 1 FROM win, unnest(a) WITH ORDINALITY AS t(x, i) ORDER BY i),
    ARRAY(SELECT x <> ((x - 1) % n + n) % n + 1 FROM win, unnest(a) WITH ORDINALITY AS t(x, i) ORDER BY i)
  ) FROM win $$;

-- Assert the GEOMETRY (reduced targets, winding decoration), not the styling. affine_permutations(3,0) rank 0 is
-- level-0 (no winding: window IS a genuine S_3 permutation, radius=0 means c=0 everywhere) — use a level-0
-- identity window {1,2,3} for the plain case and a hand-built wound window for the decorated case.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for an affine_permutation','eq','<svg…</svg>','[1,2,3]: level-0, no winding',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3])::affine_permutation) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the affine_permutation carrier','eq','true','glyph_svg(affine_permutation) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('affine_permutation')::text $q$),
  ('glyphs','a level-0 window (no winding) draws zero dashed marks','eq','0','[1,2,3]: every a_i already equals its own reduced position, u_i=a_i',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'dasharray', 'g')) FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3])::affine_permutation) g) s $q$),
  ('glyphs','a wound window (a_1=4=1+3) draws exactly one dashed mark, at the wound position','eq','1','[4,2,3]: a_1=4 reduces to u_1=1≠4, positions 2,3 unwound',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'dasharray', 'g')) FROM (SELECT glyph_svg(ROW(ARRAY[4,2,3])::affine_permutation) g) s $q$),
  ('glyphs','glyph_svg reduces the window mod n before dispatching to permutation_arc_svg','eq','true','[4,2,3]: reduced image = [1,2,3], decorated = [true,false,false]',$q$
    SELECT (glyph_svg(ROW(ARRAY[4,2,3])::affine_permutation) = permutation_arc_svg(ARRAY[1,2,3], ARRAY[true,false,false]))::text $q$),
  ('glyphs','glyph_svg renders a real affine_permutations() element','eq','<svg…</svg>','affine_permutations(3,1), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(affine_permutations(3,1),0)).value) g) s $q$);
