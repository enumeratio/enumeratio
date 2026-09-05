-- requires: realizer, number-theory, arithmetic
-- omega_ordinals — the ordinals below ω^ω, over the `omega_ordinal` carrier (flat CNF coefficient array). Carries the
-- omega_ordinal arithmetic (non-commutative + ·) and the omega_ordinal order — browse + evaluate ω-arithmetic in the explorer.
--
-- ENUMERATION IS A CONVENIENCE ORDER, not the omega_ordinal order. The ordinals < ω^ω are well-ordered of order type ω^ω,
-- so no flat ℕ-list can respect that order (you'd never reach ω). To enumerate all of them we use the one clean
-- computable bijection ℕ ↔ finite-sequences-of-ℕ: the prime-exponent code. rank r ↦ factor n = r+1, read the
-- exponent of the k-th prime as coordinate k (0 if absent), then REVERSE that rank-ascending vector into CNF
-- (highest power first). Yields 0, 1, ω, 2, ω², ω+1, ω³, 3, … — every omega_ordinal < ω^ω exactly once, in a scrambled
-- (code) order. The PROPER (omega_ordinal-order) view is a future GRADED sibling over this same carrier: grade by leading
-- degree, order lexicographically — an order-isomorphic sibling, not a re-enumeration.
CREATE FUNCTION omega_ordinal_from_rank(r term_index) RETURNS omega_ordinal LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n numeric := r + 1;                        -- shift so rank 0 ↦ n=1 ↦ empty ↦ omega_ordinal 0
  fz factorization; np int; k int; i int;
  vec int[]; cnf numeric[] := '{}';
BEGIN
  IF n = 1 THEN RETURN '{}'::omega_ordinal; END IF;                      -- omega_ordinal 0
  fz := factorize(n);
  np := array_length((fz).primes, 1);
  k := prime_counting((fz).primes[np]);                           -- rank of the largest prime factor = CNF length
  vec := array_fill(0, ARRAY[k]);                                 -- dense exponent vector, indexed by prime rank
  FOR i IN 1..np LOOP
    vec[ prime_counting((fz).primes[i]) ] := (fz).powers[i];
  END LOOP;
  FOR i IN REVERSE k..1 LOOP cnf := cnf || vec[i]::numeric; END LOOP;   -- reverse: rank-ascending ↦ CNF (power-descending)
  RETURN cnf::omega_ordinal;                                            -- cnf[1] = largest-prime exponent > 0 ⇒ canonical
END $$;

CREATE TYPE omega_ordinals_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f omega_ordinals_fiber, element_limit int) RETURNS SETOF omega_ordinal LANGUAGE sql STABLE AS $$
  SELECT omega_ordinal_from_rank(r) FROM generate_series(0, element_limit - 1) r $$;
CREATE FUNCTION contains_in_fiber(f omega_ordinals_fiber, v omega_ordinal) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NOT NULL AND (array_length(v, 1) IS NULL OR v[1] > 0) $$;   -- canonical CNF (empty, or positive leading coeff)

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f omega_ordinals_fiber, rank rank_index) RETURNS omega_ordinal LANGUAGE sql IMMUTABLE AS $fu$ SELECT omega_ordinal_from_rank(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('omega_ordinals', 'omega_ordinal', true);   -- unbounded, ungraded
SELECT base_realize('omega_ordinals');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('omega_ordinals','first eight in the convenience (prime-code) order','eq','0, 1, ω, 2, ω^2, ω + 1, ω^3, 3','not the omega_ordinal order',$q$
    SELECT string_agg(notation((e).value), ', ' ORDER BY ordinality(e)) FROM elements(omega_ordinals(), 8) e $q$),
  ('omega_ordinals','unrank(4) = ω^2 (off the floor)','eq','ω^2','the 5th code point',$q$
    SELECT notation((unrank(omega_ordinals(), 4)).value) $q$),
  ('omega_ordinals','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(omega_ordinals())::text $q$),
  ('omega_ordinals','contains: ω+1 ∈, but non-canonical {0,1} ∉ (via <@)','eq','true|false','canonical CNF only',$q$
    SELECT (ARRAY[1,1]::omega_ordinal <@ omega_ordinals())::text || '|' ||
           (ARRAY[0,1]::omega_ordinal <@ omega_ordinals())::text $q$),
  ('omega_ordinals','it carries the non-commutative arithmetic: 1 + ω = ω (left absorption)','eq','ω','ω+1 would survive',$q$
    SELECT notation(ARRAY[1]::omega_ordinal + ARRAY[1,0]::omega_ordinal) $q$),
  ('omega_ordinals','the code is injective: first 100 ranks give 100 distinct ordinals','eq','100','bijection sanity',$q$
    SELECT count(DISTINCT (e).value::text)::text FROM elements(omega_ordinals(), 100) e $q$);
