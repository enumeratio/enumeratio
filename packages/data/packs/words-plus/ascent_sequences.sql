-- requires: realizer
-- ascent_sequences — sequences (x_1,...,x_n) with x_1 = 0 and, for i >= 2, 0 <= x_i <= 1 + asc(x_1..x_{i-1}),
-- where asc counts strict ascents (positions j with x_j < x_{j+1}). Counted by the Fishburn numbers:
-- 1,1,2,5,15,53,... for n=0,1,2,3,4,5 (n=0 is the single empty sequence).
--
-- Single grade [n]. Provides the floor (build terms left-to-right, carrying the running ascent count as state)
-- plus a contains engine that recomputes the same invariant prefix-by-prefix; base_realize generates
-- handle/fiber/element + constructor (incl. the (lo,hi) range form) + the full surface.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE ascent_sequence AS (terms int[]);
CREATE FUNCTION notation(s ascent_sequence) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((s).terms, ',') $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: grow (terms so far, running ascent count, length) state. x_1 = 0 (asc=0 for a length-1 prefix); each
-- subsequent term a is chosen in [0, 1+asc], and the new ascent count adds 1 iff a exceeds the prior (last)
-- term. Emitted in lexicographic order of terms (plain array comparison IS lex order at a fixed length n).
CREATE TYPE ascent_sequences_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f ascent_sequences_fiber, element_limit int) RETURNS SETOF ascent_sequence LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(terms, asc_ct, len) AS (
      SELECT ARRAY[0], 0, 1 WHERE (f).n::int >= 1
    UNION ALL
      SELECT g.terms || a.v, g.asc_ct + (a.v > g.terms[g.len])::int, g.len + 1
      FROM gen g, generate_series(0, g.asc_ct + 1) AS a(v)
      WHERE g.len < (f).n::int
  )
  SELECT ROW(terms)::ascent_sequence FROM (
      SELECT terms FROM gen WHERE len = (f).n::int
    UNION ALL
      SELECT ARRAY[]::int[] WHERE (f).n::int = 0
  ) t
  ORDER BY terms
  LIMIT element_limit $$;

-- contains: recompute the running ascent count left-to-right and check every term stays within [0, 1+asc-so-far],
-- with x_1 required to be 0 when n>=1. No closed-form fiber_count is given — the floor IS the count (Fishburn).
CREATE FUNCTION contains_in_fiber(f ascent_sequences_fiber, v ascent_sequence) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).terms, 1), 0) = (f).n::int
     AND ((f).n::int = 0 OR (v).terms[1] = 0)
     AND NOT EXISTS (
       SELECT 1 FROM generate_series(2, (f).n::int) i
       WHERE (v).terms[i] < 0
          OR (v).terms[i] > 1 + coalesce((
                SELECT count(*) FROM generate_series(1, i - 2) j
                WHERE (v).terms[j] < (v).terms[j + 1]
              ), 0)
     ) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('ascent_sequences', 'ascent_sequence');
INSERT INTO base_grade VALUES ('ascent_sequences', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f ascent_sequences_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'AS(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('ascent_sequences');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ascent_sequences','cardinality anchor = Fishburn numbers for n=0..5 (floor count)','eq','1,1,2,5,15,53','no closed form; counting the floor',$q$
    SELECT string_agg(cardinality(ascent_sequences(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('ascent_sequences','n=0 ⇒ one empty sequence','eq','1|','Fishburn(0)=1, the empty word',$q$
    SELECT count(*)::text || '|' || notation((unrank(ascent_sequences(0), 0)).value) FROM elements(ascent_sequences(0)) e $q$),
  ('ascent_sequences','n=3 in lex order (5 sequences)','eq','0,0,0|0,0,1|0,1,0|0,1,1|0,1,2','all five length-3 ascent sequences',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(ascent_sequences(3)) e $q$),
  ('ascent_sequences','structural invariant: every n=4 sequence validates against contains_in_fiber','eq','true','self-consistency: floor ⊆ contains',$q$
    SELECT bool_and(contains_in_fiber(ROW(4)::ascent_sequences_fiber, (e).value))::text FROM elements(ascent_sequences(4)) e $q$),
  ('ascent_sequences','contains: 0,1,2 ∈ ascent_sequences(3), 0,2,1 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[0,1,2])::ascent_sequence <@ ascent_sequences(3))::text || '|' ||
           (ROW(ARRAY[0,2,1])::ascent_sequence <@ ascent_sequences(3))::text $q$),
  ('ascent_sequences','floor generates 53 sequences at n=5 (cardinality via counting)','eq','53','Fishburn(5), independent double-check',$q$
    SELECT count(*)::text FROM elements(ascent_sequences(5)) e $q$),
  ('ascent_sequences','range handle: cardinality(ascent_sequences(0,3)) = 9','eq','9','1+1+2+5 summed over fibers',$q$
    SELECT cardinality(ascent_sequences(0,3))::text $q$),
  ('ascent_sequences','unrank first/last of n=3','eq','0,0,0|0,1,2','ranks 0 and 4',$q$
    SELECT notation((unrank(ascent_sequences(3), 0)).value) || '|' ||
           notation((unrank(ascent_sequences(3), 4)).value) $q$);
