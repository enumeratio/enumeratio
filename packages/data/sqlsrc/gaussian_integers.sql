-- requires: realizer, algebra
-- Gaussian integers ℤ[i] = { a + bi : a, b ∈ ℤ } — a commutative ring, and a clean showcase of the algebra registry
-- on a 2-D carrier (the value-addressed number carrier the roadmap's fraction / Gaussian-plane family builds on).
CREATE TYPE gaussian_integer AS (re int, im int);

CREATE FUNCTION notation(g gaussian_integer) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN (g).im = 0 THEN (g).re::text
    WHEN (g).re = 0 THEN CASE WHEN (g).im = 1 THEN 'i' WHEN (g).im = -1 THEN '-i' ELSE (g).im::text || 'i' END
    ELSE (g).re::text || CASE WHEN (g).im = 1 THEN '+i' WHEN (g).im = -1 THEN '-i'
                              WHEN (g).im > 0 THEN '+' || (g).im::text || 'i' ELSE (g).im::text || 'i' END
  END $$;

-- ── commutative-ring arithmetic; norm N(a+bi) = a²+b² is multiplicative (the Euclidean gauge) ────────────────
CREATE FUNCTION gaussian_add(a gaussian_integer, b gaussian_integer) RETURNS gaussian_integer LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((a).re + (b).re, (a).im + (b).im)::gaussian_integer $$;
CREATE FUNCTION gaussian_mul(a gaussian_integer, b gaussian_integer) RETURNS gaussian_integer LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((a).re * (b).re - (a).im * (b).im, (a).re * (b).im + (a).im * (b).re)::gaussian_integer $$;
CREATE FUNCTION gaussian_neg(a gaussian_integer) RETURNS gaussian_integer LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(-(a).re, -(a).im)::gaussian_integer $$;
CREATE FUNCTION gaussian_sub(a gaussian_integer, b gaussian_integer) RETURNS gaussian_integer LANGUAGE sql IMMUTABLE AS $$
  SELECT gaussian_add(a, gaussian_neg(b)) $$;
CREATE FUNCTION gaussian_norm(g gaussian_integer) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (g).re * (g).re + (g).im * (g).im $$;
CREATE OPERATOR + (LEFTARG = gaussian_integer, RIGHTARG = gaussian_integer, FUNCTION = gaussian_add, COMMUTATOR = +);
CREATE OPERATOR * (LEFTARG = gaussian_integer, RIGHTARG = gaussian_integer, FUNCTION = gaussian_mul, COMMUTATOR = *);
CREATE OPERATOR - (LEFTARG = gaussian_integer, RIGHTARG = gaussian_integer, FUNCTION = gaussian_sub);
CREATE OPERATOR - (RIGHTARG = gaussian_integer, FUNCTION = gaussian_neg);

-- register in the algebra lattice: a commutative ring (NOT ordered — ℂ carries no compatible total order)
INSERT INTO base_type_structure VALUES ('gaussian_integer', 'commutative_ring');
INSERT INTO base_type_operation (type, op, symbol, impl_fn) VALUES
  ('gaussian_integer', 'add', '+', 'gaussian_add'), ('gaussian_integer', 'mul', '·', 'gaussian_mul'),
  ('gaussian_integer', 'neg', '−', 'gaussian_neg');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gaussian_integers','ℤ[i]: (1+i)² = 2i','eq','2i','1 + 2i + i² = 2i',$q$
    SELECT notation(ROW(1,1)::gaussian_integer * ROW(1,1)::gaussian_integer) $q$),
  ('gaussian_integers','ℤ[i]: (3+2i) + (1−4i) = 4−2i','eq','4-2i',NULL,$q$
    SELECT notation(ROW(3,2)::gaussian_integer + ROW(1,-4)::gaussian_integer) $q$),
  ('gaussian_integers','the norm is multiplicative: N((2+i)(1+i)) = N(2+i)·N(1+i) = 5·2 = 10','eq','10|10',NULL,$q$
    SELECT gaussian_norm(ROW(2,1)::gaussian_integer * ROW(1,1)::gaussian_integer)::text || '|' ||
           (gaussian_norm(ROW(2,1)::gaussian_integer) * gaussian_norm(ROW(1,1)::gaussian_integer))::text $q$),
  ('gaussian_integers','registered as a commutative ring (so a ring, semiring, …)','eq','true',NULL,$q$
    SELECT EXISTS(SELECT 1 FROM base_type_structure ts JOIN base_structure_closure c ON c.structure = ts.structure
                  WHERE ts.type = 'gaussian_integer' AND c.is_a = 'ring')::text $q$);

-- ── the collection: ℤ[i] as an enumerable, browsable set (the ring companion above, made a first-class collection) ─
-- Enumerated by the Cantor diagonal over ℕ² composed with the ℕ↔ℤ zigzag on each coordinate — a bijection ℕ→ℤ²,
-- so a finite prefix spirals out from the origin. (The natural presentation is the 2-D lattice picker; this linear
-- order just makes it a valid collection.) Unbounded, one infinite fiber.
CREATE TYPE gaussian_integers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f gaussian_integers_fiber, element_limit int) RETURNS SETOF gaussian_integer LANGUAGE sql STABLE AS $$
  SELECT ROW(
           CASE WHEN i % 2 = 0 THEN i / 2 ELSE -((i + 1) / 2) END,                         -- re = zigzag(i)
           CASE WHEN (d - i) % 2 = 0 THEN (d - i) / 2 ELSE -((d - i + 1) / 2) END           -- im = zigzag(d − i)
         )::gaussian_integer
  FROM generate_series(0, ceil(sqrt(2.0 * greatest(element_limit, 1)))::int + 1) d,         -- diagonals 0..D, D ≳ √(2·limit)
       LATERAL generate_series(0, d) i
  ORDER BY d, i LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f gaussian_integers_fiber, v gaussian_integer) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NOT NULL $$;                            -- every Gaussian integer is reached (the enumeration is a bijection)

INSERT INTO base_collection VALUES ('gaussian_integers', 'gaussian_integer', true);   -- unbounded, ungraded
SELECT base_realize('gaussian_integers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gaussian_integers','the enumeration spirals from 0 (first eight)','eq','0,-i,-1,i,-1-i,1,-2i,-1+i','Cantor × zigzag',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(gaussian_integers(), 8) e $q$),
  ('gaussian_integers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(gaussian_integers())::text $q$),
  ('gaussian_integers','contains: 2−3i ∈ (via <@)','eq','true','every Gaussian integer belongs',$q$
    SELECT (ROW(2,-3)::gaussian_integer <@ gaussian_integers())::text $q$);

-- ── stats (#231): norm (already used above for the ring's multiplicativity), real_part, imaginary_part —
-- gaussian_integers had 0 registered stats before this; sums_of_two_squares (a restriction-by-norm) reuses them.
CREATE FUNCTION gaussian_integers_real_part(g gaussian_integer) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (g).re $$;
CREATE FUNCTION gaussian_integers_imaginary_part(g gaussian_integer) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT (g).im $$;
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('gaussian_integers','norm','gaussian_norm','Norm (a²+b²)','natural_numbers'),
  ('gaussian_integers','real_part','gaussian_integers_real_part','Real part','integer_numbers'),
  ('gaussian_integers','imaginary_part','gaussian_integers_imaginary_part','Imaginary part','integer_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gaussian_integers','norm/real_part/imaginary_part of 3−4i: 25|3|-4','eq','25|3|-4',NULL,$q$
    SELECT gaussian_norm(ROW(3,-4)::gaussian_integer)::text || '|' || gaussian_integers_real_part(ROW(3,-4)::gaussian_integer)::text
        || '|' || gaussian_integers_imaginary_part(ROW(3,-4)::gaussian_integer)::text $q$);
