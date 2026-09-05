-- requires: subsets, realizer, utilities, algebra
-- boolean_algebra — the Boolean algebra / lattice 2^[n]: all 2ⁿ subsets of [n] under ⊆, with ∪ (join), ∩ (meet),
-- complement, ⊥=∅, ⊤=[n]. BORROWS the subsets carrier + floor + count verbatim (the elements ARE the subsets); this
-- is the ALGEBRA reading of that same data — the atoms are the singletons, the rank of an element is its cardinality,
-- and the whole thing is the free Boolean algebra on n generators. Sibling of simplex (its non-empty subspace).

-- ── borrow the subsets engines verbatim (all 2ⁿ subsets, (k, colex) order) ──────────────────────────────
CREATE TYPE boolean_algebra_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows subsets' floor)
CREATE FUNCTION fiber_elements(f boolean_algebra_fiber, element_limit int) RETURNS SETOF finset LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::subsets_fiber, element_limit) v LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f boolean_algebra_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fiber_count(ROW((f).n)::subsets_fiber) $$;
CREATE FUNCTION contains_in_fiber(f boolean_algebra_fiber, v finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::subsets_fiber, v) $$;

INSERT INTO base_collection VALUES ('boolean_algebra', 'finset');
INSERT INTO base_grade VALUES ('boolean_algebra', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f boolean_algebra_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'B(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('boolean_algebra');

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('boolean_algebra','rank','cardinality','Rank (cardinality) in the lattice','natural_numbers');

-- ── the LATTICE structure — what makes boolean_algebra its own construction, not just borrowed subsets ──────────────
-- The finset carrier is a DISTRIBUTIVE LATTICE under ∪ (join) / ∩ (meet), always. The BOUNDED finset (a subset of [n])
-- is moreover a BOOLEAN ALGEBRA: it gains a COMPLEMENT ¬A = [n]\A, which needs the ground n. So finsets (α = ℕ) are a
-- distributive lattice but NOT boolean — no complement in an unbounded set. The construction (bounded vs not), not the
-- 2ⁿ count, decides which operations exist. These are ops mathlib proves laws about (`BooleanAlgebra`), so we inherit them.
CREATE FUNCTION finset_join(a finset, b finset) RETURNS finset LANGUAGE sql IMMUTABLE AS $$   -- A ∪ B
  SELECT ROW(ARRAY(SELECT DISTINCT unnest((a).members || (b).members) ORDER BY 1), coalesce((a).n, (b).n))::finset $$;
CREATE FUNCTION finset_meet(a finset, b finset) RETURNS finset LANGUAGE sql IMMUTABLE AS $$   -- A ∩ B
  SELECT ROW(ARRAY(SELECT m FROM (SELECT unnest((a).members) m INTERSECT SELECT unnest((b).members)) t ORDER BY m), coalesce((a).n, (b).n))::finset $$;
CREATE FUNCTION finset_complement(s finset) RETURNS finset LANGUAGE sql IMMUTABLE AS $$   -- ¬A = [n] \ A; NULL when α = ℕ (unbounded ⇒ no complement)
  SELECT CASE WHEN (s).n IS NULL THEN NULL::finset
    ELSE ROW(ARRAY(SELECT i FROM generate_series(1, (s).n) i WHERE NOT (i = ANY((s).members)) ORDER BY 1), (s).n)::finset END $$;

INSERT INTO base_type_structure VALUES ('finset', 'distributive_lattice');   -- ∪ ∩ always; the bounded instances are boolean_algebra
INSERT INTO base_type_operation (type, op, symbol, impl_fn) VALUES
  ('finset','join','∪','finset_join'), ('finset','meet','∩','finset_meet');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('boolean_algebra','|B(n)| = 2ⁿ for n=0..5','eq','1,2,4,8,16,32','the Boolean lattice on n generators',$q$
    SELECT string_agg(cardinality(boolean_algebra(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('boolean_algebra','B(3) elements in (rank, colex) order','eq','000,100,010,001,110,101,011,111','⊥=∅ up to ⊤=[3], by rank (bit registers)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(boolean_algebra(3)) e $q$),
  ('boolean_algebra','the atoms of B(3) are the singletons (rank 1)','eq','100,010,001','minimal non-⊥ elements',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(boolean_algebra(3)) e WHERE cardinality((e).value) = 1 $q$),
  ('boolean_algebra','rank distribution over B(4) is the binomials C(4,k)','eq','1,4,6,4,1','elements of each rank k = C(n,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (
      SELECT cardinality((e).value) k, count(*) c FROM elements(boolean_algebra(4)) e GROUP BY 1) s $q$),
  ('boolean_algebra','contains via <@: {1,3} ∈ B(4), {1,5} ∉ B(4)','eq','true|false','borrowed contains engine',$q$
    SELECT (ROW(ARRAY[1,3], 4)::finset <@ boolean_algebra(4))::text || '|' || (ROW(ARRAY[1,5], 4)::finset <@ boolean_algebra(4))::text $q$),
  ('boolean_algebra','join ∪ and meet ∩ over B(4): {1,2}∪{2,3}=1110, {1,2}∩{2,3}=0100','eq','1110|0100','the lattice ops (distributive lattice)',$q$
    SELECT notation(finset_join(ROW(ARRAY[1,2],4)::finset, ROW(ARRAY[2,3],4)::finset)) || '|' ||
           notation(finset_meet(ROW(ARRAY[1,2],4)::finset, ROW(ARRAY[2,3],4)::finset)) $q$),
  ('boolean_algebra','complement ¬ over B(4): ¬{1,3}=0101, and ⊤=1111, ⊥=0000','eq','0101|1111|0000','the boolean ops (needs the bounded ground)',$q$
    SELECT notation(finset_complement(ROW(ARRAY[1,3],4)::finset)) || '|' ||
           notation(finset_complement(ROW('{}'::int[],4)::finset)) || '|' ||
           notation(finset_complement(ROW(ARRAY[1,2,3,4],4)::finset)) $q$),
  ('boolean_algebra','a BORROWED BooleanAlgebra fact: De Morgan ¬(A∪B) = ¬A∩¬B over B(4)','eq','true','a mathlib law, for free by alignment',$q$
    SELECT (finset_complement(finset_join(ROW(ARRAY[1,2],4)::finset, ROW(ARRAY[2,3],4)::finset))
          = finset_meet(finset_complement(ROW(ARRAY[1,2],4)::finset), finset_complement(ROW(ARRAY[2,3],4)::finset)))::text $q$),
  ('boolean_algebra','construction decides the ops: complement is NULL for a finset of ℕ (no bounded ground)','eq','true','finsets are a distributive lattice but NOT boolean',$q$
    SELECT (finset_complement(ROW(ARRAY[1,3], NULL::int)::finset) IS NULL)::text $q$);
