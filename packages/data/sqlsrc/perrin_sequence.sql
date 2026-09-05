-- requires: realizer
-- perrin_sequence — the UNGRADED / infinite Perrin numbers. P(0)=3, P(1)=0, P(2)=2, P(n)=P(n-2)+P(n-3) for n>=3:
-- 3,0,2,3,2,5,5,7,10,12,17,22,29,... No grades ⇒ one empty-address fiber; unbounded ⇒ cardinality = ∞.
-- Carrier numeric. No simple membership test (unlike Fibonacci's 5n²±4 square test), and non-monotonic (3,0,2,3,2,…),
-- so a scan-until-≥v would give false negatives. Instead a BOUNDED-scan contains via base_bounded_membership: decides
-- membership for v <= the value ceiling, returns NULL past it (semi-decidable). See realizer.sql.

CREATE FUNCTION perrin_term(r term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 3; b numeric := 0; c numeric := 2; t numeric; i int; BEGIN
    IF r = 0 THEN RETURN a; END IF;
    IF r = 1 THEN RETURN b; END IF;
    IF r = 2 THEN RETURN c; END IF;
    FOR i IN 3..r LOOP t := a + b; a := b; b := c; c := t; END LOOP; RETURN c;
  END $$;

CREATE TYPE perrin_sequence_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f perrin_sequence_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT perrin_term(r) FROM generate_series(0, element_limit-1) r $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f perrin_sequence_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT perrin_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('perrin_sequence', 'numeric', true);   -- unbounded, ungraded
-- semi-decidable membership: every Perrin value <= 100 occurs within the first 64 terms (the tail is non-decreasing
-- from index 4, reaching 119 at index 17), so a miss for v <= 100 is a real absence; v > 100 is unknown.
INSERT INTO base_bounded_membership VALUES ('perrin_sequence', 100, 64);
SELECT base_realize('perrin_sequence');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perrin_sequence','first 11 terms via the realized floor','eq','3,0,2,3,2,5,5,7,10,12,17','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(perrin_sequence(), 11) e $q$),
  ('perrin_sequence','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(perrin_sequence()) f LIMIT 1) FROM fibers(perrin_sequence()) $q$),
  ('perrin_sequence','unrank(9) = 12','eq','12','off the floor',$q$
    SELECT (unrank(perrin_sequence(), 9)).value::text $q$),
  ('perrin_sequence','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(perrin_sequence())::text $q$),
  ('perrin_sequence','recurrence holds: P(n) = P(n-2) + P(n-3) for a middle run of terms','eq','true','structural invariant over the floor',$q$
    SELECT bool_and(v.value = p2.value + p3.value)
    FROM elements(perrin_sequence(), 11) v
    JOIN elements(perrin_sequence(), 11) p2 ON lower(p2.rank) = lower(v.rank) - 2
    JOIN elements(perrin_sequence(), 11) p3 ON lower(p3.rank) = lower(v.rank) - 3
    WHERE lower(v.rank) >= 3 $q$),
  ('perrin_sequence','bounded membership — a Perrin value within the ceiling is a member','eq','true|true','90 = P(16); via <@ and contains',$q$
    SELECT (90 <@ perrin_sequence())::text || '|' || contains(perrin_sequence(), 29::numeric)::text $q$),
  ('perrin_sequence','bounded membership — a non-Perrin value below the ceiling is definitely absent','eq','false|false','1 and 4 are not Perrin numbers; fully covered by the scan ⇒ false, no false negative',$q$
    SELECT (1 <@ perrin_sequence())::text || '|' || contains(perrin_sequence(), 4::numeric)::text $q$),
  ('perrin_sequence','bounded membership — past the ceiling the answer is unknown (NULL), never a false negative','eq','true','200 > 100; a scan can never prove absence for a non-monotonic sequence',$q$
    SELECT (contains(perrin_sequence(), 200::numeric) IS NULL)::text $q$),
  ('perrin_sequence','it is bounded_membership, NOT decidable (semi-decidable only)','eq','bounded_membership:t decidable:f','the trait records the weaker guarantee',$q$
    SELECT string_agg(t || ':' || CASE WHEN EXISTS (SELECT 1 FROM base_collection_trait WHERE collection='perrin_sequence' AND trait=t) THEN 't' ELSE 'f' END, ' ' ORDER BY t)
    FROM unnest(ARRAY['bounded_membership','decidable']) t $q$);
