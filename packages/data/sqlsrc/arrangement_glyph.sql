-- requires: arrangements, decorated_permutation_glyph
-- arrangement_glyph — the page-space glyph for the arrangement carrier (issue #222 glyph batch): reuses
-- permutation_arc_svg (decorated_permutation_glyph.sql). An arrangement's `word` holds only the injective word
-- itself — n (the ground it's drawn from) is NOT stored on the value (see arrangements.sql), so the picture sizes
-- itself off the word's own content: draw a baseline of length n' = max(length(word), max(word)) positions, an
-- arc from domain row i to word[i] for each i in the word, and leave rows beyond the word's length as bare points
-- with no outgoing arc (permutation_arc_svg's NULL-image convention, the same "no mark here" idea
-- rook_placement_grid_svg uses for a preference-free row). No decoration semantics apply here, so `decorated` is
-- left NULL throughout.
CREATE FUNCTION glyph_svg(a arrangement) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH w AS (SELECT (a).word AS word),
  nn AS (SELECT greatest(coalesce(array_length(word,1),0), coalesce((SELECT max(x) FROM unnest(word) x), 0)) AS n FROM w)
  SELECT permutation_arc_svg(
    (SELECT array_agg(word[i] ORDER BY i) FROM w, generate_series(1, (SELECT n FROM nn)) i)
  ) FROM w $$;

-- Assert the GEOMETRY (baseline length, arc count, sparse-row handling), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for an arrangement','eq','<svg…</svg>','{3,1}: an injective 2-word',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[3,1])::arrangement) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the arrangement carrier','eq','true','glyph_svg(arrangement) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('arrangement')::text $q$),
  ('glyphs','the baseline sizes to max(length, max value present): {3,1} needs 3 positions, not 2','eq','true','permutation_arc_svg''s n×unit width formula, read off the viewBox',$q$
    SELECT (substring(glyph_svg(ROW(ARRAY[3,1])::arrangement) FROM 'viewBox="[-0-9.]+ [-0-9.]+ ([-0-9.]+) ') =
            substring(permutation_arc_svg(ARRAY[NULL,1,3]) FROM 'viewBox="[-0-9.]+ [-0-9.]+ ([-0-9.]+) '))::text $q$),
  ('glyphs','a 2-word over a ground of 4 draws only 2 arcs, its 2 unused rows (3,4) stay bare points','eq','2','{2,4}: word[1]=2≠1 and word[2]=4≠2 both draw arcs; rows 3,4 have no entry at all',$q$
    SELECT (length(g) - length(replace(g, '<path', '')))/5 FROM (SELECT glyph_svg(ROW(ARRAY[2,4])::arrangement) g) s $q$),
  ('glyphs','glyph_svg dispatches arrangement to permutation_arc_svg, padding unused rows with NULL','eq','true','carrier→helper wiring: word padded to max(length,max value), undecorated',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,4])::arrangement) = permutation_arc_svg(ARRAY[2,4,NULL,NULL]))::text $q$),
  ('glyphs','glyph_svg renders a real arrangements() element','eq','<svg…</svg>','arrangements(3,2), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(arrangements(3,2),0)).value) g) s $q$);
