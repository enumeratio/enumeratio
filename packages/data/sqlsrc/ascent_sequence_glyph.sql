-- requires: ascent_sequences, glyphs
-- ascent_sequence_glyph — the page-space glyph for the ascent_sequence carrier (issue #222 glyph batch): a BAR
-- CHART, one bar per term, height ∝ the term's value, growing up from a baseline. Each bar is also labelled with
-- its value below the baseline (word_glyph/composition_glyph's label convention), so a 0-term still reads clearly
-- even though its bar collapses to nothing.
--
-- Shared design (ascent_sequence hosts it since it's the first of five "word as bars" carriers in this batch —
-- subexcedant_seq_glyph.sql, rgs_word_glyph.sql, gray_code_glyph.sql and ternary_gray_code_glyph.sql all
-- `-- requires: ascent_sequence_glyph` and reuse it): sequence_bar_svg(terms int[]) takes any int[] of
-- non-negative small integers (ascents-so-far / subexcedant values / rgs letters / bits / ternary digits — every
-- one of these five carriers is exactly that shape) and draws the same picture. No base_glyph registry row on
-- purpose (the composition/standard_tableau precedent in glyphs.sql): the overload alone lights up
-- carrier_renders_svg.
CREATE FUNCTION sequence_bar_svg(terms int[], unit numeric DEFAULT 18, unit_h numeric DEFAULT 10, label_h numeric DEFAULT 14)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH t AS (SELECT o - 1 AS i, term FROM unnest(terms) WITH ORDINALITY AS tt(term, o)),
  dim AS (SELECT greatest(1, count(*)) * unit AS w, greatest(1, coalesce(max(term), 0)) * unit_h AS h FROM t)
  -- args: 1=w+2 2=h+label_h+2 (viewBox) · 3=bars (rect grows up from baseline y=h, height=term*unit_h) + labels
  -- (value printed below the baseline, always legible even for a 0-height bar)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="sequence bar chart">%s</svg>',
    trim_scale(round((SELECT w FROM dim) + 2, 2)), trim_scale(round((SELECT h FROM dim) + label_h + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%4$s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 55%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%5$s" y="%6$s" text-anchor="middle" dominant-baseline="hanging" font-size="%7$s" fill="var(--enumeratio-text,currentColor)">%8$s</text>',
      trim_scale(round(i * unit, 2)), trim_scale(round((SELECT h FROM dim) - term * unit_h, 2)),
      trim_scale(round(unit, 2)), trim_scale(round(term * unit_h, 2)),
      trim_scale(round(i * unit + unit / 2, 2)), trim_scale(round((SELECT h FROM dim) + 2, 2)),
      trim_scale(round(label_h * 0.7, 2)), term
    ), '' ORDER BY i) FROM t, dim));
$$;
CREATE FUNCTION glyph_svg(s ascent_sequence) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT sequence_bar_svg((s).terms) $$;

-- Assert the GEOMETRY (bar heights track values, labels present), not the styling — mirrors composition_glyph.sql.
-- {0,1,2}: a valid ascent sequence (x1=0; x2=1<=1+asc(0)=1; x3=2<=1+asc(0,1)=2).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for an ascent_sequence','eq','<svg…</svg>','{0,1,2}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[0,1,2])::ascent_sequence) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the ascent_sequence carrier','eq','true','glyph_svg(ascent_sequence) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('ascent_sequence')::text $q$),
  ('glyphs','sequence bar viewBox tracks length and max value (0,1,2; unit 18, unit_h 10, label_h 14)','eq','-1 -1 56 36|3','w=3*18+2, h=2*10+14+2; one <rect> per term',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT sequence_bar_svg(ARRAY[0,1,2]) g) s $q$),
  ('glyphs','a 0-term still prints its label even though its bar has zero height','eq','true','the baseline label, not the invisible rect, carries the 0',$q$
    SELECT (g LIKE '%>0</text>%')::text FROM (SELECT sequence_bar_svg(ARRAY[0,1,2]) g) s $q$),
  ('glyphs','sequence_bar_svg on the empty sequence collapses to a 1-unit strip, no bars','eq','-1 -1 20 26|0','greatest(1,·) keeps the viewBox non-degenerate — same convention as word_cells_svg',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT sequence_bar_svg(ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches ascent_sequence to sequence_bar_svg','eq','true','carrier→helper wiring, same pattern as composition/word',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,1,0])::ascent_sequence) = sequence_bar_svg(ARRAY[0,1,0]))::text $q$),
  ('glyphs','glyph_svg renders a real ascent_sequences() element','eq','<svg…</svg>','ascent_sequences(3), rank 0 (the all-zero sequence)',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(ascent_sequences(3),0)).value) g) s $q$);
