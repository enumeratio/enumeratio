-- requires: realizer, utilities
-- subexcedant_seqs — subexcedant sequences: words (a₁,…,aₙ) with 1 ≤ aᵢ ≤ i. There are 1·2·⋯·n = n! of them (a
-- factorial-base / "odometer" number system), so they biject with permutations — a sibling of lehmer_codes with a
-- different bounding rule (aᵢ ≤ i here, vs the Lehmer code's aᵢ ≤ n−i). Its own carrier; enumerated in lex order.
CREATE TYPE subexcedant_seq AS (terms int[]);
CREATE FUNCTION notation(s subexcedant_seq) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((s).terms, ',') $$;

CREATE TYPE subexcedant_seqs_fiber AS (n natural_number);
CREATE FUNCTION fiber_elements(f subexcedant_seqs_fiber, element_limit int) RETURNS SETOF subexcedant_seq LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build(terms, pos) AS (                       -- grow position by position: aᵢ ∈ [1, i]
    SELECT ARRAY[]::int[], 0
    UNION ALL
    SELECT terms || v, pos + 1 FROM build, LATERAL generate_series(1, pos + 1) v WHERE pos < (f).n::int
  )
  SELECT ROW(terms)::subexcedant_seq FROM build WHERE pos = (f).n::int ORDER BY terms LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f subexcedant_seqs_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT factorial((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f subexcedant_seqs_fiber, s subexcedant_seq) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((s).terms,1),0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((s).terms,1) i WHERE (s).terms[i] < 1 OR (s).terms[i] > i) $$;

INSERT INTO base_collection VALUES ('subexcedant_seqs', 'subexcedant_seq');
INSERT INTO base_grade VALUES ('subexcedant_seqs', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f subexcedant_seqs_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Sub(' || (f).n::int || ')' $$;
SELECT base_realize('subexcedant_seqs');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('subexcedant_seqs','count = n! for n=0..6','eq','1,1,2,6,24,120,720','aᵢ ∈ [1,i] ⇒ 1·2·⋯·n choices',$q$
    SELECT string_agg(cardinality(subexcedant_seqs(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('subexcedant_seqs','subexcedant_seqs(3) = the 6 sequences in lex order','eq','1,1,1|1,1,2|1,1,3|1,2,1|1,2,2|1,2,3','a₁=1, a₂∈{1,2}, a₃∈{1,2,3}',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(subexcedant_seqs(3)) e $q$),
  ('subexcedant_seqs','contains via <@: (1,2,3) ∈, (1,1,4) ∉ (a₃=4 > 3), (1,3,1) ∉ (a₂=3 > 2)','eq','true|false|false','the subexcedant bound',$q$
    SELECT (ROW(ARRAY[1,2,3])::subexcedant_seq <@ subexcedant_seqs(3))::text || '|' ||
           (ROW(ARRAY[1,1,4])::subexcedant_seq <@ subexcedant_seqs(3))::text || '|' ||
           (ROW(ARRAY[1,3,1])::subexcedant_seq <@ subexcedant_seqs(3))::text $q$);
