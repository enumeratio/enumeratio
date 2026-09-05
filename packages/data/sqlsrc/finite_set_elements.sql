-- requires: realizer
-- finite_set_elements — the ELEMENTS (atoms) of the finite ordered set [n] = {1,…,n}, written "i:n". In bijection
-- with modular_residues(n) — it IS the underlying set of ℤ/nℤ. (The finite SETS themselves are subsets = Lean's
-- Finset [n].) Ported from pg-enumeratio/sqlsrc/39-finsets.sql (+ 56-finsets-engines.sql). |finite_set_elements(n)|
-- = n, NOT 1 — this is the ONE collection that counts the ATOMS of the ground set rather than the STRUCTURES
-- built over it: every other collection has a single empty STRUCTURE at grade 0, but finite_set_elements(0) is EMPTY,
-- since [0] has no atoms. This is the base object of the composition tower — words, tuples, subsets and
-- partitions are all structures over a finite set, each carrying its ground set as its own size. Single grade [n].
-- Floor = the n atoms of [n], in natural order (rank r ↦ atom r+1). A labelling/alphabet (which glyphs name
-- the atoms) is a printer option, not part of the carrier — out of scope here.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE finite_set_element AS (atom int, size int);            -- atom ∈ [1,size] of ground set [size]; self-complete
CREATE FUNCTION notation(x finite_set_element) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (x).atom::text || ':' || (x).size::text $$;            -- "3:5" = atom 3 of [5]

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE finite_set_elements_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: the n atoms of [n], in natural order (rank r ↦ atom r+1).
CREATE FUNCTION fiber_elements(f finite_set_elements_fiber, element_limit int) RETURNS SETOF finite_set_element LANGUAGE sql STABLE AS $$
  SELECT ROW(a, (f).n::int)::finite_set_element FROM generate_series(1, (f).n::int) a LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f finite_set_elements_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT greatest((f).n::int, 0)::numeric $$;                   -- |finite_set_elements(n)| = n (not 1 — see header)
CREATE FUNCTION contains_in_fiber(f finite_set_elements_fiber, v finite_set_element) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).size = (f).n::int AND (v).atom BETWEEN 1 AND (f).n::int $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('finite_set_elements', 'finite_set_element');
INSERT INTO base_grade VALUES ('finite_set_elements', 1, 'n', NULL, NULL);
SELECT base_realize('finite_set_elements');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('finite_set_elements','count anchor |finite_set_elements(n)| = n for n=0..5 (accel)','eq','0,1,2,3,4,5','the ATOMS of [n], not structures',$q$
    SELECT string_agg(cardinality(finite_set_elements(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('finite_set_elements','finite_set_elements(5) enumerated: the 5 atoms of [5]','eq','1:5,2:5,3:5,4:5,5:5','the realized floor for fiber [5]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(finite_set_elements(5)) e $q$),
  ('finite_set_elements','finite_set_elements(0) is EMPTY, not the one empty structure','eq','0','[0] has no atoms — unlike every other collection at grade 0',$q$
    SELECT cardinality(finite_set_elements(0))::text $q$),
  ('finite_set_elements','floor generates 5 atoms at n=5 (cardinality via counting, no accel)','eq','5','independent of the accel',$q$
    SELECT count(*)::text FROM elements(finite_set_elements(5)) e $q$),
  ('finite_set_elements','unrank first/last atom of [5]','eq','1:5|5:5','ranks 0 and 4',$q$
    SELECT notation((unrank(finite_set_elements(5), 0)).value) || '|' ||
           notation((unrank(finite_set_elements(5), 4)).value) $q$),
  ('finite_set_elements','element carries a TYPED point fiber + ordinality','eq','5|2','unrank(finite_set_elements(5), 2)',$q$
    SELECT (unrank(finite_set_elements(5), 2)).fiber.n::text || '|' || ordinality(unrank(finite_set_elements(5), 2))::text $q$),
  ('finite_set_elements','range handle: cardinality(finite_set_elements(1,5)) = 1+2+3+4+5','eq','15','summed over fibers n=1..5',$q$
    SELECT cardinality(finite_set_elements(1,5))::text $q$),
  ('finite_set_elements','fibers(finite_set_elements(1,3)) unfold to n = 1,2,3','eq','1,2,3','the grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(finite_set_elements(1,3)) f $q$),
  ('finite_set_elements','every element of finite_set_elements(5) is an atom in [1,5] of a size-5 ground set','eq','true','the defining invariant',$q$
    SELECT bool_and(((e).value).atom BETWEEN 1 AND 5 AND ((e).value).size = 5)::text FROM elements(finite_set_elements(5)) e $q$),
  ('finite_set_elements','contains via <@: atom 3:5 ∈ finite_set_elements(5), 6:5 ∉ (out of range), 3:4 ∉ (wrong ground set)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(3,5)::finite_set_element <@ finite_set_elements(5))::text || '|' ||
           (ROW(6,5)::finite_set_element <@ finite_set_elements(5))::text || '|' ||
           (ROW(3,4)::finite_set_element <@ finite_set_elements(5))::text $q$);
