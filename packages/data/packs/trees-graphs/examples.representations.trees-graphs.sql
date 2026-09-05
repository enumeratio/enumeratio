-- requires: representations, perfect_matchings
-- trees-graphs half of sqlsrc/representations.sql (#283 phase 3 extraction) — perfect_matchings' arc notation
-- (its render function takes a `trees-graphs`-pack carrier type as its parameter, so it can't even CREATE FUNCTION
-- loading core alone), its fiber_symbol_katex overload (perfect_matchings_fiber, same DDL-time trap), their
-- base_repr row, and the three examples calling either directly. base_repr.collection REFERENCES base_collection,
-- so the repr row would also FK-fail loading core alone.

-- perfect matching as arcs: the pairs [a1,b1,a2,b2,…] read as (a1,b1)(a2,b2)…. Inherited by non_crossing_matchings.
CREATE FUNCTION perfect_matching_arcs(m perfect_matching) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg('(' || (m).pairs[2*i-1] || ',' || (m).pairs[2*i] || ')', '' ORDER BY i), '')
  FROM generate_series(1, coalesce(array_length((m).pairs,1),0)/2) i $$;

INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('perfect_matchings','arcs','perfect_matching_arcs','Arc notation',false);

CREATE FUNCTION fiber_symbol_katex(f perfect_matchings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '\mathrm{M}([' || (2 * (f).n::int) || '])' $$; -- M([2n]) (asciimath spelling coincides with unicode)

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','arc notation: the matching [1,4,2,3] → (1,4)(2,3)','eq','(1,4)(2,3)','perfect matching pairs as arcs',$q$
    SELECT perfect_matching_arcs(ROW(ARRAY[1,4,2,3])::perfect_matching) $q$),
  ('representations','fiber symbol M([2n]) katex uses upright \mathrm{M}; the asciimath spelling coincides with unicode M([4])','eq','M([4])|\mathrm{M}([4])','perfect-matching ambient symbol — only the katex form is distinct',$q$
    SELECT fiber_symbol((unrank(perfect_matchings(2),0)).fiber) || '|' || fiber_symbol_katex((unrank(perfect_matchings(2),0)).fiber) $q$);
