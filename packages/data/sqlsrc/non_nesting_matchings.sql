-- requires: perfect_matchings, catalan_numbers, realizer
-- non_nesting_matchings — perfect matchings of {1..2n} with NO nesting: no two pairs (a,b),(c,d) with a<c<d<b
-- (one arc entirely inside another). The nesting-dual of non_crossing_matchings; like it, counted by Catalan(n).
-- A base_restrict of perfect_matchings (same flattened-pairs carrier). [The crossing/nesting duality again — a
-- matching avoids crossings or avoids nestings, both Catalan, the chord-diagram echo of non_crossing/non_nesting
-- set partitions.]
CREATE FUNCTION is_non_nesting_matching(m perfect_matching) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM generate_series(1, coalesce(array_length((m).pairs,1),0) / 2) p,
         generate_series(1, coalesce(array_length((m).pairs,1),0) / 2) q
    WHERE (m).pairs[2*p-1] < (m).pairs[2*q-1]      -- a_p < a_q …
      AND (m).pairs[2*q]   < (m).pairs[2*p]        -- … and b_q < b_p  ⇒ arc q nested inside arc p
  ) $$;

SELECT base_restrict('non_nesting_matchings', 'perfect_matchings', 'is_non_nesting_matching');
CREATE FUNCTION fiber_symbol(f non_nesting_matchings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'NNM(' || (f).n::int || ')' $$;
SELECT wire_set_notation('non_nesting_matchings');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_nesting_matchings','COUNT anchor: Catalan(n) for n=0..5','eq','1,1,2,5,14,42','non-nesting matchings, like non-crossing, are Catalan',$q$
    SELECT string_agg(cardinality(non_nesting_matchings(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('non_nesting_matchings','the nested matching (1,4)(2,3) ∉, the crossing (1,3)(2,4) ∈','eq','false|true','crossing ≠ nesting: the crossing one survives here',$q$
    SELECT (ROW(ARRAY[1,4,2,3])::perfect_matching <@ non_nesting_matchings(2))::text || '|' ||
           (ROW(ARRAY[1,3,2,4])::perfect_matching <@ non_nesting_matchings(2))::text $q$);
