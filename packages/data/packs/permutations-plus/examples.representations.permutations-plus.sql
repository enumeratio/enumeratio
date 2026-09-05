-- requires: representations, signed_permutations, surjections, parking_functions
-- permutations-plus half of sqlsrc/representations.sql (#283 phase 3 extraction) — the signed_permutations/
-- surjections/parking_functions base_repr rows, their katex render functions (each takes a permutations-plus
-- carrier type as its parameter, so it can't even CREATE FUNCTION loading core alone), and their examples.
-- base_repr.collection REFERENCES base_collection, so the rows would also FK-fail loading core alone.

-- katex spelling of the signed_permutation default one-line window: bar each negative entry (\overline{k}, the
-- standard hyperoctahedral-group convention — Björner–Brenti's bar notation for B_n) and wrap the whole window as
-- a parenthesized tuple, e.g. {-2,1,-3} → "(\overline{2},1,\overline{3})" — matches the render-corpus oracle.
-- asciimath coincides with the unicode default (bare "-2,1,-3") — no asciimath sibling needed.
CREATE FUNCTION signed_permutation_katex(x signed_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || coalesce(string_agg(CASE WHEN v < 0 THEN '\overline{' || (-v) || '}' ELSE v::text END, ',' ORDER BY o), '') || ')'
  FROM unnest((x).image) WITH ORDINALITY t(v, o) $$;

-- katex spelling of the surjection default comma-word notation: the same parenthesized-tuple move as
-- perm_oneline_katex/composition_parts_katex (representations.sql), e.g. "1,2,3" → "(1,2,3)" — matches the
-- render-corpus oracle. asciimath coincides with the unicode default (bare comma word) — no asciimath sibling needed.
CREATE FUNCTION surjection_tuple_katex(w surjection) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((w).values, ',') || ')' $$;

-- katex spelling of the parking_function default comma-sequence notation: same parenthesized-tuple move as
-- surjection_tuple_katex above, e.g. "1,1,1" → "(1,1,1)" — matches the render-corpus oracle. asciimath coincides
-- with the unicode default (bare comma sequence) — no asciimath sibling needed.
CREATE FUNCTION parking_function_tuple_katex(p parking_function) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((p).spots, ',') || ')' $$;

-- #141: three collections with NO prior base_repr row at all — render_fn='notation' is their unconditional
-- default, so `canonical=true` holds uniformly for every collection that inherits it (surjections to
-- surjections_onto_k, parking_functions to non_decreasing_parking_functions).
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('signed_permutations','oneline','notation','One-line notation (barred negatives)',true),
  ('surjections','tuple','notation','Surjection word',true),
  ('parking_functions','tuple','notation','Preference sequence',true);
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, medium) VALUES
  ('signed_permutations','oneline','signed_permutation_katex','One-line notation (KaTeX, barred negatives)',false,'latex'),
  ('surjections','tuple','surjection_tuple_katex','Surjection word (KaTeX tuple)',false,'latex'),
  ('parking_functions','tuple','parking_function_tuple_katex','Preference sequence (KaTeX tuple)',false,'latex');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','the default (unicode) signed_permutation notation is unchanged: {-3,-2,-1} → -3,-2,-1','eq','-3,-2,-1','plain minus signs, no bars',$q$
    SELECT notation(ROW(ARRAY[-3,-2,-1])::signed_permutation) $q$),
  ('representations','base_repr medium dispatch on signed_permutations: oneline resolves to notation at unicode, signed_permutation_katex at latex','eq','notation|signed_permutation_katex','same (collection,repr), two medium rows',$q$
    SELECT (SELECT render_fn FROM base_repr_resolved WHERE collection = 'signed_permutations' AND repr = 'oneline' AND medium = 'unicode') || '|' ||
           (SELECT render_fn FROM base_repr_resolved WHERE collection = 'signed_permutations' AND repr = 'oneline' AND medium = 'latex') $q$),
  ('representations','the default (unicode) surjection notation is unchanged: 1,2,3 → 1,2,3 (bare word)','eq','1,2,3','no parens at unicode',$q$
    SELECT notation(ROW(ARRAY[1,2,3])::surjection) $q$),
  ('representations','the surjection tuple repr is CARRIER-inherited: surjections_onto_k resolves it at unicode and latex','eq','true','base_repr_resolved carries the surjections-registered repr to its restriction sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'surjections_onto_k' AND repr = 'tuple' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'surjections_onto_k' AND repr = 'tuple' AND medium = 'latex'))::text $q$),
  ('representations','the default (unicode) parking_function notation is unchanged: 1,1,1 → 1,1,1 (bare sequence)','eq','1,1,1','no parens at unicode',$q$
    SELECT notation(ROW(ARRAY[1,1,1])::parking_function) $q$),
  ('representations','the parking_function tuple repr is CARRIER-inherited: non_decreasing_parking_functions resolves it at unicode and latex','eq','true','base_repr_resolved carries the parking_functions-registered repr to its restriction sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'non_decreasing_parking_functions' AND repr = 'tuple' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'non_decreasing_parking_functions' AND repr = 'tuple' AND medium = 'latex'))::text $q$);
