-- requires: evil_numbers, realizer
-- thue_morse_numbers (A010060) — the Thue–Morse sequence t(n) = parity of the binary digit-sum of n:
-- 0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0,… UNGRADED, UNBOUNDED numeric sequence (same shape as fibonacci_numbers).
-- Fixed point of 0↦01, 1↦10; self-similar: t(2n)=t(n), t(2n+1)=1−t(n). Reuses binary_popcount from evil_numbers.

CREATE FUNCTION thue_morse_term(r term_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT mod(binary_popcount(r::numeric), 2)::numeric $$;

CREATE TYPE thue_morse_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f thue_morse_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT thue_morse_term(r) FROM generate_series(0, element_limit-1) r $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f thue_morse_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT thue_morse_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('thue_morse_numbers', 'numeric', true);   -- unbounded, ungraded
-- semi-decidable membership: non-monotonic (0,1,1,0,…), so a scan can't prove absence generically. Values are 0/1, both
-- present within the first 4 terms; a miss for v <= 1 is a real absence, v > 1 is unknown. (Handled uniformly with the
-- other non-monotonic sequences via the bounded scan rather than a bespoke {0,1} test.)
INSERT INTO base_bounded_membership VALUES ('thue_morse_numbers', 1, 4);
SELECT base_realize('thue_morse_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('thue_morse_numbers','first sixteen — A010060','eq','0,1,1,0,1,0,0,1,1,0,0,1,0,1,1,0','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(thue_morse_numbers(), 16) e $q$),
  ('thue_morse_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(thue_morse_numbers()) f LIMIT 1) FROM fibers(thue_morse_numbers()) $q$),
  ('thue_morse_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(thue_morse_numbers())::text $q$),
  ('thue_morse_numbers','self-similar recurrence: t(2n)=t(n), t(2n+1)=1−t(n) for n=0..7','eq','true','the defining doubling relation',$q$
    SELECT bool_and(
        (unrank(thue_morse_numbers(), 2*n)).value   = (unrank(thue_morse_numbers(), n)).value
    AND (unrank(thue_morse_numbers(), 2*n+1)).value = 1 - (unrank(thue_morse_numbers(), n)).value)
    FROM generate_series(0,7) n $q$),
  ('thue_morse_numbers','bounded membership — 0 and 1 are members within the ceiling','eq','true|true','both appear in the first 4 terms; via <@ and contains',$q$
    SELECT (0 <@ thue_morse_numbers())::text || '|' || contains(thue_morse_numbers(), 1::numeric)::text $q$),
  ('thue_morse_numbers','bounded membership — past the ceiling the answer is unknown (NULL)','eq','true','2 > 1; the bounded scan does not assert absence',$q$
    SELECT (contains(thue_morse_numbers(), 2::numeric) IS NULL)::text $q$),
  ('thue_morse_numbers','it is bounded_membership, NOT decidable','eq','bounded_membership:t decidable:f','the trait records the weaker guarantee',$q$
    SELECT string_agg(t || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection='thue_morse_numbers' AND trait=t) THEN 't' ELSE 'f' END, ' ' ORDER BY t)
    FROM unnest(ARRAY['bounded_membership','decidable']) t $q$);
