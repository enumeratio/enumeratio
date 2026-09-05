-- requires: realizer, algebra
-- modular_residues — ℤ/mℤ: the residues {0,1,…,m−1} mod m. |modular_residues(m)| = m — the modulus IS the size/grade
-- (like dyck_paths' semilength). The carrier carries BOTH the residue and its modulus, so a value knows which ring it
-- lives in and ℤ/mℤ arithmetic (+ − ·, a commutative ring per modulus) is well-defined on the value itself.

-- ── carrier: (residue, modulus) ──────────────────────────────────────────────────────────────────────────
CREATE TYPE modular_residue AS (residue int, modulus int);
CREATE FUNCTION notation(x modular_residue) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (x).residue::text $$;                                  -- the residue; the ring (mod m) is context
CREATE FUNCTION mod_reduce(r int, m int) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT ((r % m) + m) % m $$;   -- into 0..m−1

-- ── commutative-ring arithmetic (per modulus; operands must share m) ─────────────────────────────────────
CREATE FUNCTION mod_add(a modular_residue, b modular_residue) RETURNS modular_residue LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (a).modulus = (b).modulus THEN ROW(mod_reduce((a).residue + (b).residue, (a).modulus), (a).modulus)::modular_residue END $$;
CREATE FUNCTION mod_mul(a modular_residue, b modular_residue) RETURNS modular_residue LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (a).modulus = (b).modulus THEN ROW(mod_reduce((a).residue * (b).residue, (a).modulus), (a).modulus)::modular_residue END $$;
CREATE FUNCTION mod_neg(a modular_residue) RETURNS modular_residue LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(mod_reduce(-(a).residue, (a).modulus), (a).modulus)::modular_residue $$;
CREATE FUNCTION mod_sub(a modular_residue, b modular_residue) RETURNS modular_residue LANGUAGE sql IMMUTABLE AS $$
  SELECT mod_add(a, mod_neg(b)) $$;
CREATE OPERATOR + (LEFTARG = modular_residue, RIGHTARG = modular_residue, FUNCTION = mod_add, COMMUTATOR = +);
CREATE OPERATOR * (LEFTARG = modular_residue, RIGHTARG = modular_residue, FUNCTION = mod_mul, COMMUTATOR = *);
CREATE OPERATOR - (LEFTARG = modular_residue, RIGHTARG = modular_residue, FUNCTION = mod_sub);
CREATE OPERATOR - (RIGHTARG = modular_residue, FUNCTION = mod_neg);

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────────
CREATE TYPE modular_residues_fiber AS (modulus natural_number);   -- typed fiber; axis: modulus
-- FLOOR: every residue of ℤ/mℤ in natural order 0,1,…,m−1, each tagged with its modulus.
CREATE FUNCTION fiber_elements(f modular_residues_fiber, element_limit int) RETURNS SETOF modular_residue LANGUAGE sql STABLE AS $$
  SELECT ROW(i, (f).modulus::int)::modular_residue FROM generate_series(0, greatest((f).modulus::int, 0) - 1) i ORDER BY i LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f modular_residues_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest((f).modulus::int, 0)::numeric $$;                       -- |ℤ/mℤ| = m
CREATE FUNCTION contains_in_fiber(f modular_residues_fiber, v modular_residue) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).modulus = (f).modulus::int AND (v).residue >= 0 AND (v).residue < (f).modulus::int $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f modular_residues_fiber, rank rank_index) RETURNS modular_residue LANGUAGE sql IMMUTABLE AS $fu$ SELECT ROW(rank::int, (f).modulus::int)::modular_residue $fu$;
INSERT INTO base_collection VALUES ('modular_residues', 'modular_residue');
INSERT INTO base_grade VALUES ('modular_residues', 1, 'modulus', NULL, NULL);
SELECT base_realize('modular_residues');

-- register the CARRIER in the algebra lattice: a commutative ring (per modulus)
INSERT INTO base_type_structure VALUES ('modular_residue', 'commutative_ring');
INSERT INTO base_type_operation (type, op, symbol, impl_fn) VALUES
  ('modular_residue', 'add', '+', 'mod_add'), ('modular_residue', 'mul', '·', 'mod_mul'), ('modular_residue', 'neg', '−', 'mod_neg');

-- ── quadratic residues: modular sqrt below the bound (CS thread, issue #44) ──────────────────────────────
-- Finite modulus ⇒ decidable by construction: a is a QR mod m iff ∃x∈{0..m−1}: x²≡a. mod_sqrts lists those roots
-- (the "square roots below the modulus bound"); mod_is_quadratic_residue tests existence; mod_sqrt_count = |roots|.
CREATE FUNCTION mod_sqrts(a modular_residue) RETURNS SETOF modular_residue LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(x, (a).modulus)::modular_residue FROM generate_series(0, greatest((a).modulus, 0) - 1) x
   WHERE (x::bigint * x % (a).modulus) = mod_reduce((a).residue, (a).modulus) ORDER BY x $$;   -- x²≡a, x below m
CREATE FUNCTION mod_is_quadratic_residue(a modular_residue) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT EXISTS (SELECT 1 FROM mod_sqrts(a)) $$;
CREATE FUNCTION mod_sqrt_count(a modular_residue) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM mod_sqrts(a) $$;                          -- 0 ⇔ non-residue; the QR indicator = sign
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('modular_residues','sqrt_count','mod_sqrt_count','Number of square roots','natural_numbers');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('modular_residues','cardinality anchor: |ℤ/mℤ| = m for m=1..7 (accel)','eq','1,2,3,4,5,6,7','|modular_residues(m)| = m',$q$
    SELECT string_agg(cardinality(modular_residues(m))::text, ',' ORDER BY m) FROM generate_series(1,7) m $q$),
  ('modular_residues','modulus 7 in natural order','eq','0,1,2,3,4,5,6','the residues 0..m−1',$q$
    SELECT string_agg(((e).value).residue::text, ',' ORDER BY ordinality(e)) FROM elements(modular_residues(7)) e $q$),
  ('modular_residues','every generated residue r satisfies 0 <= r < m','eq','true','structural check',$q$
    SELECT bool_and(((e).value).residue >= 0 AND ((e).value).residue < 7)::text FROM elements(modular_residues(7)) e $q$),
  ('modular_residues','range handle: cardinality(modular_residues(2,4)) = 9','eq','9','2+3+4 summed over fibers',$q$
    SELECT cardinality(modular_residues(2,4))::text $q$),
  ('modular_residues','fibers(modular_residues(2,4)) unfold to m = 2,3,4','eq','2,3,4','the grade range',$q$
    SELECT string_agg((f).modulus::text, ',' ORDER BY (f).modulus) FROM fibers(modular_residues(2,4)) f $q$),
  ('modular_residues','ring ℤ/5ℤ: 3 + 4 = 2 and 3 · 4 = 2 (reduced mod 5)','eq','2|2','arithmetic on the carrier',$q$
    SELECT notation(ROW(3,5)::modular_residue + ROW(4,5)::modular_residue) || '|' ||
           notation(ROW(3,5)::modular_residue * ROW(4,5)::modular_residue) $q$),
  ('modular_residues','ring ℤ/7ℤ: −3 = 4, and (5 − 6) = 6','eq','4|6','negation + subtraction',$q$
    SELECT notation(- ROW(3,7)::modular_residue) || '|' ||
           notation(ROW(5,7)::modular_residue - ROW(6,7)::modular_residue) $q$),
  ('modular_residues','registered as a commutative ring','eq','true',NULL,$q$
    SELECT EXISTS(SELECT 1 FROM base_type_structure WHERE type='modular_residue' AND structure='commutative_ring')::text $q$),
  ('modular_residues','element carries a TYPED point fiber + ordinality','eq','7|3','unrank(modular_residues(7),3)',$q$
    SELECT (unrank(modular_residues(7), 3)).fiber.modulus::text || '|' || ordinality(unrank(modular_residues(7), 3))::text $q$),
  ('modular_residues','contains: 3 ∈ modular_residues(7), 7 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(3,7)::modular_residue <@ modular_residues(7))::text || '|' ||
           (ROW(7,7)::modular_residue <@ modular_residues(7))::text $q$),
  ('modular_residues','quadratic residue mod 7: 2 is a QR (∃x:x²≡2), 3 is not','eq','true|false','x²≡a, decidable on a finite modulus',$q$
    SELECT mod_is_quadratic_residue(ROW(2,7)::modular_residue)::text || '|' ||
           mod_is_quadratic_residue(ROW(3,7)::modular_residue)::text $q$),
  ('modular_residues','modular sqrt below the bound: √2 mod 7 = {3,4} (3²=4²=2)','eq','3,4','the roots x∈0..m−1 with x²≡a',$q$
    SELECT string_agg((r).residue::text, ',' ORDER BY (r).residue) FROM mod_sqrts(ROW(2,7)::modular_residue) r $q$),
  ('modular_residues','Σ #sqrt over ℤ/7ℤ = 7: every x is the sqrt of exactly one a=x²','eq','7','the sqrt_count stat sums back to the modulus',$q$
    SELECT sum(mod_sqrt_count((e).value))::text FROM elements(modular_residues(7)) e $q$),
  ('modular_residues','QR count mod 7 = 4 = (p+1)/2 incl. 0 (the residues {0,1,2,4})','eq','4','#{ a : a is a QR } for odd prime p',$q$
    SELECT count(*)::text FROM elements(modular_residues(7)) e WHERE mod_is_quadratic_residue((e).value) $q$),
  ('modular_residues','sqrt_count registered as a stat (⇒ has_stats)','eq','true','base_stat row',$q$
    SELECT EXISTS(SELECT 1 FROM base_stat WHERE collection='modular_residues' AND stat_id='sqrt_count')::text $q$);
