-- requires: realizer
-- powers_of_two — an UNGRADED / infinite collection (carrier numeric), like catalan_numbers/bell_numbers. The floor
-- is 2^n = 1,2,4,8,16,… (OEIS A000079), built by exact integer doubling so no numeric scale creeps in. This is the
-- ROW-SUM sequence of Pascal's triangle: Σ_k C(n,k) = 2^n, so cardinality(k_subsets(n)) = 2^n — the alias identity
-- asserted in triangle_slices. Provides a rank-agnostic contains (is v an exact power of two?).

CREATE FUNCTION power_of_two(r int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE c numeric := 1; i int; BEGIN
    IF r < 0 THEN RETURN NULL; END IF;
    FOR i IN 1..r LOOP c := c * 2; END LOOP;                                          -- exact integer doubling
    RETURN c;
  END $$;
CREATE TYPE powers_of_two_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f powers_of_two_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT power_of_two(r) FROM generate_series(0, element_limit - 1) r $$;                       -- rank r (0-based) → 2^r
-- membership via the generic monotonic-scan contains synthesized from fiber_unrank (non-decreasing sequence)

-- direct unrank (capability layer 3): the ord-th term IS 2^ord.
CREATE FUNCTION fiber_unrank(f powers_of_two_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT power_of_two(rank::int) $$;
INSERT INTO base_collection VALUES ('powers_of_two', 'numeric', true);                         -- unbounded, ungraded
INSERT INTO base_monotonic_sequence VALUES ('powers_of_two');   -- non-decreasing: synth a scanning contains
SELECT base_realize('powers_of_two');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('powers_of_two','first terms via the realized floor','eq','1,2,4,8,16,32,64,128','elements over the one infinite fiber (n=0..7)',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(powers_of_two(), 8) e $q$),
  ('powers_of_two','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(powers_of_two()) f LIMIT 1) FROM fibers(powers_of_two()) $q$),
  ('powers_of_two','unrank(10) = 1024','eq','1024','rank 10 (0-based)',$q$
    SELECT (unrank(powers_of_two(), 10)).value::text $q$),
  ('powers_of_two','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(powers_of_two())::text $q$),
  ('powers_of_two','contains is rank-agnostic: 64 ∈, 48 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (64::numeric <@ powers_of_two())::text || '|' || (48::numeric <@ powers_of_two())::text $q$);
