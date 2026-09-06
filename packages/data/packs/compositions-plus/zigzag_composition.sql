-- requires: integer_compositions, realizer
-- zigzag_composition — ALTERNATING compositions of n: parts p₁,…,pₖ whose consecutive steps strictly alternate
-- direction (up-down p₁<p₂>p₃<… or down-up p₁>p₂<p₃>…). A single part is trivially alternating; equal adjacent
-- parts are excluded. Both orientations counted. Count 1,1,1,3,4,7,12,19,29,48 for n=0..9 (brute-force verified over
-- the floor; the precursor's "…,30,…" note was an off-by-one). A base_restrict
-- of integer_compositions: same carrier + grade [n], the gap-cut floor filtered to alternating compositions, realizer
-- re-ranks.

-- alternating ⇔ no two adjacent parts equal AND no two consecutive steps in the same direction (product of the two
-- successive differences is never > 0; no-equal already forbids a zero difference, so surviving triples must flip sign).
CREATE FUNCTION is_zigzag_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_series(1, coalesce(array_length((v).parts,1),0) - 1) i
                     WHERE (v).parts[i] = (v).parts[i+1])                                        -- no equal adjacent parts
     AND NOT EXISTS (SELECT 1 FROM generate_series(2, coalesce(array_length((v).parts,1),0) - 1) i
                     WHERE ((v).parts[i] - (v).parts[i-1]) * ((v).parts[i+1] - (v).parts[i]) > 0) $$;  -- no two same-direction steps

SELECT base_restrict('zigzag_composition', 'integer_compositions', 'is_zigzag_composition');
CREATE FUNCTION fiber_symbol(f zigzag_composition_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Zig(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('zigzag_composition');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('zigzag_composition','count for n=0..9: 1,1,1,3,4,7,12,19,29,48','eq','1,1,1,3,4,7,12,19,29,48','alternating compositions (brute-force verified)',$q$
    SELECT string_agg(cardinality(zigzag_composition(n))::text, ',' ORDER BY n) FROM generate_series(0,9) n $q$),
  ('zigzag_composition','zigzag compositions of 4, parent mask order','eq','4,1+3,3+1,1+2+1','2+2 (equal), 1+1+2, 2+1+1, 1+1+1+1 excluded',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(zigzag_composition(4)) e $q$),
  ('zigzag_composition','zigzag compositions of 3, in order','eq','3,1+2,2+1','1+1+1 excluded (equal adjacent parts)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(zigzag_composition(3)) e $q$),
  ('zigzag_composition','every composition of n=0..7 truly alternates (the defining invariant)','eq','true','no equal adjacent parts + strictly alternating steps across the floor',$q$
    SELECT bool_and(is_zigzag_composition((e).value)) FROM elements(zigzag_composition(0,7)) e $q$),
  ('zigzag_composition','contains via <@: 1+2+1 ∈ zigzag_composition(4), 2+2 ∉ (equal parts), 1+1+2 ∉ (no ascent then equal)','eq','true|false|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,2,1])::composition <@ zigzag_composition(4))::text || '|' ||
           (ROW(ARRAY[2,2])::composition   <@ zigzag_composition(4))::text || '|' ||
           (ROW(ARRAY[1,1,2])::composition <@ zigzag_composition(4))::text $q$);
