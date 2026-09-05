-- requires: realizer
-- stern_diatomic_sequence (A002487) — Stern's diatomic series / fusc: s(0)=0, s(1)=1, s(2n)=s(n),
-- s(2n+1)=s(n)+s(n+1): 0,1,1,2,1,3,2,3,1,4,3,5,2,5,3,4,… UNGRADED, UNBOUNDED numeric sequence.
-- Iterative fusc (bit-reversal): a←1,b←0; scan the bits of n LSB-first, odd bit → b+=a, even bit → a+=b; result b.

CREATE FUNCTION stern_term(r int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 1; b numeric := 0; m int := r; BEGIN
    WHILE m > 0 LOOP
      IF m % 2 = 1 THEN b := a + b; ELSE a := a + b; END IF;
      m := m / 2;
    END LOOP;
    RETURN b;
  END $$;

CREATE TYPE stern_diatomic_sequence_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f stern_diatomic_sequence_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT stern_term(r) FROM generate_series(0, element_limit-1) r $$;

INSERT INTO base_collection VALUES ('stern_diatomic_sequence', 'numeric', true);   -- unbounded, ungraded
-- semi-decidable membership: non-monotonic, so a scan can't prove absence past a bound. The max value over the first
-- 2^m terms is Fibonacci(m+1), so every value <= 10 occurs within the first 256 terms (max there = fib(9)=34); a miss
-- for v <= 10 is a real absence (e.g. a negative or non-integer v), v > 10 is unknown.
INSERT INTO base_bounded_membership VALUES ('stern_diatomic_sequence', 10, 256);
SELECT base_realize('stern_diatomic_sequence');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('stern_diatomic_sequence','first sixteen — A002487','eq','0,1,1,2,1,3,2,3,1,4,3,5,2,5,3,4','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(stern_diatomic_sequence(), 16) e $q$),
  ('stern_diatomic_sequence','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(stern_diatomic_sequence()) f LIMIT 1) FROM fibers(stern_diatomic_sequence()) $q$),
  ('stern_diatomic_sequence','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(stern_diatomic_sequence())::text $q$),
  ('stern_diatomic_sequence','recurrence: s(2n)=s(n), s(2n+1)=s(n)+s(n+1) for n=1..7','eq','true','the defining two-term recurrence',$q$
    SELECT bool_and(
        (unrank(stern_diatomic_sequence(), 2*n)).value   = (unrank(stern_diatomic_sequence(), n)).value
    AND (unrank(stern_diatomic_sequence(), 2*n+1)).value = (unrank(stern_diatomic_sequence(), n)).value + (unrank(stern_diatomic_sequence(), n+1)).value)
    FROM generate_series(1,7) n $q$),
  ('stern_diatomic_sequence','bounded membership — a value within the ceiling is a member (fusc hits every positive integer)','eq','true|true','7 = s(19); via <@ and contains',$q$
    SELECT (7 <@ stern_diatomic_sequence())::text || '|' || contains(stern_diatomic_sequence(), 3::numeric)::text $q$),
  ('stern_diatomic_sequence','bounded membership — a value below the ceiling that never occurs is definitely absent','eq','false','−1 is not a fusc value; fully covered ⇒ false, no false negative',$q$
    SELECT ((-1) <@ stern_diatomic_sequence())::text $q$),
  ('stern_diatomic_sequence','bounded membership — past the ceiling the answer is unknown (NULL)','eq','true','100 > 10; a scan can never prove absence for a non-monotonic sequence',$q$
    SELECT (contains(stern_diatomic_sequence(), 100::numeric) IS NULL)::text $q$),
  ('stern_diatomic_sequence','it is bounded_membership, NOT decidable','eq','bounded_membership:t decidable:f','the trait records the weaker guarantee',$q$
    SELECT string_agg(t || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection='stern_diatomic_sequence' AND trait=t) THEN 't' ELSE 'f' END, ' ' ORDER BY t)
    FROM unnest(ARRAY['bounded_membership','decidable']) t $q$);
