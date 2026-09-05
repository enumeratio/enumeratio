-- requires: rational_numbers, realizer, utilities
-- pythagorean_triples(hypotenuse) — (a,b,c) with a²+b²=c², 0<a<b<c, graded by c. A fresh composite carrier (not a
-- restriction of an existing one — no parent carrier fits a 3-int constrained triple, per audit §3.2's "no bespoke
-- carrier when a parent's carrier fits": there is no parent here). Some c host several triples (25 hosts (7,24,25)
-- AND (15,20,25)); no closed form for the count, so this floor has no accel — direct search per fiber.
CREATE TYPE pythagorean_triple AS (leg_a int, leg_b int, hypotenuse int);   -- leg_a < leg_b < hypotenuse
CREATE FUNCTION notation(t pythagorean_triple) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || (t).leg_a::text || ',' || (t).leg_b::text || ',' || (t).hypotenuse::text || ')' $$;

CREATE TYPE pythagorean_triples_fiber AS (hypotenuse natural_number);   -- typed fiber; axis: hypotenuse

-- FLOOR: for each a in 1..c-1, b is determined (b² = c²-a²) — take it only when it's a perfect square, > a.
CREATE FUNCTION fiber_elements(f pythagorean_triples_fiber, element_limit int) RETURNS SETOF pythagorean_triple LANGUAGE sql STABLE AS $$
  SELECT ROW(a, b, c)::pythagorean_triple
    FROM (SELECT (f).hypotenuse::int AS c) p,
         LATERAL generate_series(1, c - 1) a,
         LATERAL (SELECT round(sqrt((c*c - a*a)::numeric))::int AS b) sq
   WHERE c*c - a*a > 0 AND sq.b * sq.b = c*c - a*a AND sq.b > a AND sq.b < c
   ORDER BY a
   LIMIT element_limit $$;

CREATE FUNCTION contains_in_fiber(f pythagorean_triples_fiber, v pythagorean_triple) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).hypotenuse = (f).hypotenuse::int
     AND (v).leg_a > 0 AND (v).leg_a < (v).leg_b AND (v).leg_b < (v).hypotenuse
     AND (v).leg_a * (v).leg_a + (v).leg_b * (v).leg_b = (v).hypotenuse * (v).hypotenuse $$;

INSERT INTO base_collection VALUES ('pythagorean_triples', 'pythagorean_triple');
INSERT INTO base_grade VALUES ('pythagorean_triples', 1, 'hypotenuse', NULL, NULL);
CREATE FUNCTION fiber_symbol(f pythagorean_triples_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Pyth(' || (f).hypotenuse::int || ')' $$;
SELECT base_realize('pythagorean_triples');

-- ── stats: legs, area, primitivity ────────────────────────────────────────────────────────────────────────
CREATE FUNCTION pythagorean_triples_shorter_leg(t pythagorean_triple) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (t).leg_a $$;
CREATE FUNCTION pythagorean_triples_longer_leg(t pythagorean_triple) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (t).leg_b $$;
CREATE FUNCTION pythagorean_triples_area(t pythagorean_triple) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT ((t).leg_a * (t).leg_b) / 2 $$;   -- a·b is always even
CREATE FUNCTION pythagorean_triples_is_primitive(t pythagorean_triple) RETURNS int LANGUAGE sql IMMUTABLE AS $$   -- 0/1 (no min/max(boolean))
  SELECT (gcd_int((t).leg_a, (t).leg_b) = 1)::int $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('pythagorean_triples','shorter_leg','pythagorean_triples_shorter_leg','Shorter leg','natural_numbers'),
  ('pythagorean_triples','longer_leg','pythagorean_triples_longer_leg','Longer leg','natural_numbers'),
  ('pythagorean_triples','area','pythagorean_triples_area','Area','natural_numbers'),
  ('pythagorean_triples','is_primitive','pythagorean_triples_is_primitive','Is primitive (gcd(a,b)=1)','natural_numbers');

-- ── map: Euclid's generating pair (m,n), m>n>0, gcd(m,n)=1, opposite parity — a=m²−n², b=2mn, c=m²+n². Only the
-- ODD leg is m²−n² (the even leg is always 2mn), so identify it by parity rather than by a<b order. PARTIAL: only
-- defined (non-NULL) on PRIMITIVE triples — a non-primitive triple has no single Euclid pair of its own (it's a
-- multiple of one). Encoded as rational_number(m,n) — reduced since gcd(m,n)=1, a natural reuse of that carrier.
CREATE FUNCTION pythagorean_triples_generating_pair(t pythagorean_triple) RETURNS rational_number LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE odd_leg int; m2 numeric; n2 numeric; m int; n int; BEGIN
    IF gcd_int((t).leg_a, (t).leg_b) <> 1 THEN RETURN NULL; END IF;                 -- primitive only
    odd_leg := CASE WHEN (t).leg_a % 2 = 1 THEN (t).leg_a ELSE (t).leg_b END;
    m2 := ((t).hypotenuse + odd_leg) / 2.0; n2 := ((t).hypotenuse - odd_leg) / 2.0;
    m := round(sqrt(m2))::int; n := round(sqrt(n2))::int;
    IF m*m <> m2 OR n*n <> n2 OR n <= 0 THEN RETURN NULL; END IF;
    RETURN rational_number(m, n);
  END $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('pythagorean_triples','generating_pair','pythagorean_triples_generating_pair','rational_numbers','Euclid generating pair (m,n)',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('pythagorean_triples','hypotenuse 25 hosts two triples: (7,24,25) and (15,20,25)','eq','(7,24,25),(15,20,25)',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(pythagorean_triples(25)) e $q$),
  ('pythagorean_triples','hypotenuse 5 hosts the primitive (3,4,5)','eq','(3,4,5)',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(pythagorean_triples(5)) e $q$),
  ('pythagorean_triples','no triples for a non-hypotenuse like 6 or 7','eq','0|0',NULL,$q$
    SELECT cardinality(pythagorean_triples(6))::text || '|' || cardinality(pythagorean_triples(7))::text $q$),
  ('pythagorean_triples','every element up to hypotenuse 100 satisfies a²+b²=c²','eq','true','the defining invariant',$q$
    SELECT bool_and(((e).value).leg_a^2 + ((e).value).leg_b^2 = ((e).value).hypotenuse^2)
    FROM generate_series(1,100) h, LATERAL elements(pythagorean_triples(h)) e $q$),
  ('pythagorean_triples','area of (3,4,5) is 6; is_primitive true','eq','6|1',NULL,$q$
    SELECT pythagorean_triples_area(ROW(3,4,5)::pythagorean_triple)::text || '|' || pythagorean_triples_is_primitive(ROW(3,4,5)::pythagorean_triple)::text $q$),
  ('pythagorean_triples','(15,20,25) is NOT primitive (it is 5·(3,4,5))','eq','0',NULL,$q$
    SELECT pythagorean_triples_is_primitive(ROW(15,20,25)::pythagorean_triple)::text $q$),
  ('pythagorean_triples','generating pair of (3,4,5) is (m,n)=(2,1)','eq','2',NULL,$q$
    SELECT notation(pythagorean_triples_generating_pair(ROW(3,4,5)::pythagorean_triple)) $q$),
  ('pythagorean_triples','generating pair of (5,12,13) is (m,n)=(3,2)','eq','3/2',NULL,$q$
    SELECT notation(pythagorean_triples_generating_pair(ROW(5,12,13)::pythagorean_triple)) $q$),
  ('pythagorean_triples','generating pair is NULL for the non-primitive (15,20,25)','eq','',NULL,$q$
    SELECT coalesce(notation(pythagorean_triples_generating_pair(ROW(15,20,25)::pythagorean_triple)), '') $q$),
  ('pythagorean_triples','contains: (3,4,5) ∈ pythagorean_triples(5), (4,3,5) (unsorted legs) ∉','eq','true|false',NULL,$q$
    SELECT (ROW(3,4,5)::pythagorean_triple <@ pythagorean_triples(5))::text || '|' || (ROW(4,3,5)::pythagorean_triple <@ pythagorean_triples(5))::text $q$);
