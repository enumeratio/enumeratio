-- requires: set_compositions, glyphs
-- set_composition_glyph — the page-space glyph for the set_composition carrier (#145's glyph bald spot): an
-- ORDERED ROW of labelled block boxes, one per block, left-to-right in COMPOSITION order (block 1, block 2, ...).
-- Each box is a light-bordered rounded rect containing one small accent cell per member, labelled with its [n]
-- position. This is deliberately NOT the set_partition arc diagram (set_partition_glyph.sql) — an ordered set
-- partition's defining feature is that block ORDER is part of the data (unlike a plain partition, where only the
-- grouping matters), so the glyph has to show a left-to-right sequence, not an order-agnostic arc/curve picture.
-- Reading a composition {2}|{1} vs {1}|{2} as two boxes swapping places makes the ordering legible at a glance.

-- args: 1=w+2 2=h+2 (viewBox) · 3=block boxes (one per block, width ∝ member count) · 4=member cells (labelled, nested inside their block box)
CREATE FUNCTION set_composition_blocks_svg(labels int[], unit numeric DEFAULT 20, pad numeric DEFAULT 4, gap numeric DEFAULT 10)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH b AS (SELECT o AS pos, lbl FROM unnest(labels) WITH ORDINALITY AS t(lbl, o)),
  blocks AS (SELECT lbl AS blk, array_agg(pos ORDER BY pos) AS members FROM b GROUP BY lbl),
  calc AS (                                                        -- box width ∝ member count; boxes in blk order (= composition order)
    SELECT blk, members, array_length(members, 1) * unit + 2 * pad AS bw,
           row_number() OVER (ORDER BY blk) AS bi
    FROM blocks
  ),
  offs AS (                                                        -- bx = running offset of prior boxes + prior gaps
    SELECT blk, members, bw,
           coalesce(sum(bw) OVER (ORDER BY blk ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)
             + (bi - 1) * gap AS bx
    FROM calc
  ),
  totals AS (SELECT coalesce(sum(bw), 0) + greatest(count(*) - 1, 0) * gap AS w FROM calc),
  cells AS (SELECT o.blk, o.bx, mem AS pos, ord - 1 AS idx FROM offs o, unnest(o.members) WITH ORDINALITY AS t(mem, ord)),
  h AS (SELECT unit + 2 * pad AS height)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="ordered set partition">%s%s</svg>',
    trim_scale(round(greatest(1, (SELECT w FROM totals)) + 2, 2)), trim_scale(round((SELECT height FROM h) + 2, 2)),
    coalesce((SELECT string_agg(format(
      '<rect x="%s" y="0" width="%s" height="%s" rx="4" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.5"/>',
      trim_scale(round(bx, 2)), trim_scale(round(bw, 2)), trim_scale(round((SELECT height FROM h), 2))
    ), '' ORDER BY blk) FROM offs), ''),
    coalesce((SELECT string_agg(format(
      '<rect x="%1$s" y="%3$s" width="%2$s" height="%2$s" rx="2" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 22%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      trim_scale(round(bx + pad + idx * unit, 2)), trim_scale(round(unit, 2)), trim_scale(round(pad, 2)),
      trim_scale(round(bx + pad + idx * unit + unit / 2, 2)), trim_scale(round(pad + unit / 2, 2)),
      trim_scale(round(unit * 0.5, 2)), pos
    ), '' ORDER BY blk, idx) FROM cells), '')
  );
$$;
CREATE FUNCTION glyph_svg(c set_composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT set_composition_blocks_svg((c).labels) $$;

-- Assert the GEOMETRY (box count/widths/order, cell count), not the styling — mirrors set_partition_glyph.sql.
-- set_compositions(2) ranks: 0={1,2} (one block, labels=[1,1]), 1={1}|{2} (labels=[1,2]), 2={2}|{1} (labels=[2,1]).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a set_composition','eq','<svg…</svg>','set_compositions(2) rank 1 = {1}|{2}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(set_compositions(2),1)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the set_composition carrier','eq','true','glyph_svg(set_composition) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('set_composition')::text $q$),
  ('glyphs','two singleton blocks ({1}|{2}, unit 20/pad 4/gap 10) viewBox','eq','-1 -1 68 30','bw=1*20+8=28 each, w=28+28+10=66',$q$
    SELECT substring(glyph_svg((unrank(set_compositions(2),1)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','two singleton blocks ({1}|{2}): 2 block boxes + 2 member cells','eq','2|2','one box per block, one cell per member',$q$
    SELECT ((length(g) - length(replace(g, 'rx="4"', '')))/6)::text || '|' || ((length(g) - length(replace(g, 'rx="2"', '')))/6)::text
    FROM (SELECT glyph_svg((unrank(set_compositions(2),1)).value) g) s $q$),
  ('glyphs','single block holding both members ({1,2}, unit 20/pad 4/gap 10) viewBox','eq','-1 -1 50 30','one box, bw=2*20+8=48, w=48 (no gap, k=1)',$q$
    SELECT substring(glyph_svg((unrank(set_compositions(2),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','single block holding both members: 1 box, 2 cells','eq','1|2','both members share one block box',$q$
    SELECT ((length(g) - length(replace(g, 'rx="4"', '')))/6)::text || '|' || ((length(g) - length(replace(g, 'rx="2"', '')))/6)::text
    FROM (SELECT glyph_svg((unrank(set_compositions(2),0)).value) g) s $q$),
  ('glyphs','block ORDER matters: {2}|{1} (rank 2) renders "2" then "1", the reverse of {1}|{2} (rank 1)','eq','2,1|1,2','box order = composition order, not member-position order',$q$
    SELECT (SELECT string_agg(m[1], ',') FROM (SELECT regexp_matches(glyph_svg((unrank(set_compositions(2),2)).value), '<text[^>]*>([0-9]+)</text>', 'g') m) a)
        || '|' ||
           (SELECT string_agg(m[1], ',') FROM (SELECT regexp_matches(glyph_svg((unrank(set_compositions(2),1)).value), '<text[^>]*>([0-9]+)</text>', 'g') m) b) $q$),
  ('glyphs','set_composition_blocks_svg on the empty composition (n=0) renders no boxes, no cells','eq','-1 -1 3 30|0|0','set_compositions(0) has one element: the empty composition',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' ||
           ((length(g) - length(replace(g, 'rx="4"', '')))/6)::text || '|' ||
           ((length(g) - length(replace(g, 'rx="2"', '')))/6)::text
    FROM (SELECT set_composition_blocks_svg(ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches set_composition to set_composition_blocks_svg','eq','true','carrier→helper wiring, same pattern as composition/permutation/word',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,1])::set_composition) = set_composition_blocks_svg(ARRAY[2,1]))::text $q$);
