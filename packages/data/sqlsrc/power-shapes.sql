-- requires: number-theory, utilities
-- exponent-vector shape helpers (on top of factorize/Ω/ω) for the power/sphenic families.

CREATE FUNCTION exponent_gcd(n numeric) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE g int := 0; e int; BEGIN FOREACH e IN ARRAY (factorize(n)).powers LOOP g := gcd_int(g, e); END LOOP; RETURN g; END $$;
CREATE FUNCTION is_powerful(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- every prime exponent >= 2 (1 vacuously)
  SELECT n >= 1 AND coalesce((SELECT bool_and(e >= 2) FROM unnest((factorize(n)).powers) e), true) $$;
CREATE FUNCTION is_perfect_power(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- m^k, k>=2 ⇔ gcd(exps) >= 2
  SELECT n = 1 OR (n >= 4 AND exponent_gcd(n) >= 2) $$;
CREATE FUNCTION is_achilles(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_powerful(n) AND NOT is_perfect_power(n) $$;
CREATE FUNCTION is_sphenic(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT big_omega(n) = 3 AND little_omega(n) = 3 $$;   -- 3 distinct primes
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('power-shapes','exponent_gcd: 72=2^3·3^2 → gcd(3,2)=1 (powerful, not a perfect power)','eq','1|true|false','achilles',$q$
    SELECT exponent_gcd(72)::text || '|' || is_powerful(72)::text || '|' || is_perfect_power(72)::text $q$);
