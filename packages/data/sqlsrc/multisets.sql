-- requires: subsets, realizer, utilities, algebra
-- multisets — the k-element MULTISETS over [n], repetition allowed (mathlib `Sym (Fin n) k`; a `Multiset (Fin n)` of
-- card k). Count = the multichoose ((n multichoose k) = C(n+k−1, k)). Foundational: Lean builds `Finset` as a
-- `Multiset` with `Nodup`, and integer partitions are multisets of positive parts — so `k_subsets` is the
-- multiplicity-≤-1 (repetition-free) refinement of THIS, and `integer_partitions` a multiset over ℕ+ graded by sum.
-- Built by the STARS-AND-BARS bijection to the k-subsets of [n+k−1]: a multiset {a₁ ≤ … ≤ a_k} ↔ the subset
-- {aᵢ + (i−1)} (strictly increasing), so we borrow subset_unrank_colex and subtract the offsets back off.

CREATE TYPE multiset AS (elements int[], n int);   -- sorted ASCENDING with repetition, each in [1,n]; ground-aware
CREATE FUNCTION notation(m multiset) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '{' || array_to_string((m).elements, ',') || '}' $$;

CREATE FUNCTION multiset_unrank(n int, k int, ord bigint) RETURNS multiset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT s - (o - 1) FROM unnest((subset_unrank_colex(n + k - 1, k, ord)).members)
                     WITH ORDINALITY AS t(s, o) ORDER BY o), n)::multiset $$;

CREATE TYPE multisets_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n (ground), k (size)
CREATE FUNCTION fiber_elements(f multisets_fiber, element_limit int) RETURNS SETOF multiset LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN (f).n = 0 THEN ROW(ARRAY[]::int[], 0)::multiset ELSE multiset_unrank((f).n::int, (f).k::int, ord) END
    FROM generate_series(0, CASE WHEN (f).n = 0 THEN (CASE WHEN (f).k = 0 THEN 1 ELSE 0 END)
                                 ELSE binomial((f).n::int + (f).k::int - 1, (f).k::int)::int END - 1) ord
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f multisets_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  -- ((0,0)) = 1 — the empty multiset over the empty ground — but the multichoose spells it C(−1, 0), and binomial's
  -- k > n guard reads that as 0, so the n=0 fiber went missing (#254). ((0,k)) = 0 for k > 0 either way.
  SELECT CASE WHEN (f).n = 0 THEN (CASE WHEN (f).k = 0 THEN 1 ELSE 0 END)::numeric
              ELSE binomial((f).n::int + (f).k::int - 1, (f).k::int)::numeric END $$;   -- (n multichoose k)
CREATE FUNCTION contains_in_fiber(f multisets_fiber, m multiset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- ground-aware: same n, ⊆ [n] w/ repetition, size k, sorted
  SELECT (m).n = (f).n::int
     AND coalesce(array_length((m).elements, 1), 0) = (f).k::int
     AND NOT EXISTS (SELECT 1 FROM unnest((m).elements) e WHERE e < 1 OR e > (f).n::int)
     AND (m).elements = (SELECT array_agg(e ORDER BY e) FROM unnest((m).elements) e) $$;
CREATE FUNCTION fiber_symbol(f multisets_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '((' || (f).n::int || ',' || (f).k::int || '))' $$;   -- the multichoose symbol ((n,k))

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f multisets_fiber, rank rank_index) RETURNS multiset LANGUAGE sql IMMUTABLE AS $fu$ SELECT multiset_unrank((f).n::int, (f).k::int, rank) $fu$;
INSERT INTO base_collection VALUES ('multisets', 'multiset');
INSERT INTO base_grade VALUES ('multisets', 1, 'n', NULL, NULL), ('multisets', 2, 'k', '0', NULL);   -- k unbounded (unlike k_subsets, capped at n)
SELECT base_realize('multisets');

-- ── mathlib Multiset notation layer (issue #18) ─────────────────────────────────────────────────────────────
-- Lift Lean's clean Multiset surface onto the carrier: the multiplicity-exponent repr (∏ aᵢ^{mult}), the additive
-- union s + t (Multiset (+), multiplicities add), cardinality (Multiset.card), membership (∈) and the sub-multiset
-- order ≤ (Multiset.le). Registered generically — base_operation vocab + base_type_operation impls, the exp repr a
-- base_repr row — not bespoke one-offs.

-- multiplicity-exponent repr — each distinct element ascending, its multiplicity a superscript exponent (1 omitted),
-- ·-joined; empty ↦ ∅. e.g. {1,1,2,3} ↦ 1²·2·3. Registered as the `exponential` base_repr alongside the brace form.
CREATE FUNCTION multiset_frequency(m multiset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(e::text || CASE WHEN c > 1 THEN translate(c::text, '0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹') ELSE '' END,
                             '·' ORDER BY e), '∅')
    FROM (SELECT e, count(*)::int c FROM unnest((m).elements) e GROUP BY e) g $$;

-- additive union (Multiset (+)): merge with multiplicity, re-sort ascending; the ground is shared (coalesce keeps it).
CREATE FUNCTION multiset_add(a multiset, b multiset) RETURNS multiset LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT e FROM (SELECT unnest((a).elements) e UNION ALL SELECT unnest((b).elements)) u ORDER BY e),
             coalesce((a).n, (b).n))::multiset $$;
CREATE OPERATOR + (LEFTARG = multiset, RIGHTARG = multiset, FUNCTION = multiset_add, COMMUTATOR = +);
-- the additive identity: the empty multiset (∅ = 0).
CREATE FUNCTION multiset_zero() RETURNS multiset LANGUAGE sql IMMUTABLE AS $$ SELECT ROW('{}'::int[], NULL)::multiset $$;

-- cardinality (Multiset.card): the element count WITH multiplicity.
CREATE FUNCTION multiset_card(m multiset) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(array_length((m).elements, 1), 0) $$;
-- membership (∈): e occurs in m (multiplicity ≥ 1).
CREATE FUNCTION multiset_mem(e int, m multiset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT e = ANY((m).elements) $$;
-- sub-multiset order (Multiset.le, a ≤ b): every element's multiplicity in a is ≤ its multiplicity in b.
CREATE FUNCTION multiset_le(a multiset, b multiset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM (SELECT e, count(*) c FROM unnest((a).elements) e GROUP BY e) ca
     WHERE ca.c > (SELECT count(*) FROM unnest((b).elements) e WHERE e = ca.e)) $$;

-- register the two representations (canonical brace form + the exponential multiplicity form)
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('multisets','braces','notation','Brace notation',true),
  ('multisets','exponential','multiset_frequency','Exponential (multiplicity) notation',false);

-- register the operations: the carrier is a commutative monoid under + (∅ the identity) and a poset under ≤; plus the
-- generic card / mem ops (new vocab, reusable by finset et al.). base_type_operation.symbol shows + / ∅ additively.
INSERT INTO base_operation VALUES ('card','|·|',1,'cardinality (size)'), ('mem','∈',2,'membership')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO base_type_structure VALUES ('multiset','commutative_monoid'), ('multiset','poset');
INSERT INTO base_type_operation (type, op, symbol, impl_fn) VALUES
  ('multiset','op','+','multiset_add'), ('multiset','id','∅','multiset_zero'),
  ('multiset','le','≤','multiset_le'), ('multiset','card','|·|','multiset_card'), ('multiset','mem','∈','multiset_mem');
-- (mathlib anchors for these ops live in references.sql — base_reference is defined there, downstream of every collection.)

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('multisets','|multisets(n,2)| = C(n+1,2) for n=1..5 (A000217, triangular)','eq','1,3,6,10,15','multichoose (n,2)',$q$
    SELECT string_agg(cardinality(multisets(n,2))::text, ',' ORDER BY n) FROM generate_series(1,5) n $q$),
  ('multisets','multisets(3,2) = the 6 size-2 multisets over [3], via stars-and-bars','eq','{1,1},{1,2},{2,2},{1,3},{2,3},{3,3}','repetition allowed; C(4,2)=6',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(multisets(3,2)) e $q$),
  ('multisets','cardinality(multisets(4,3)) = 20 = C(6,3) (multichoose)','eq','20','(4 multichoose 3)',$q$
    SELECT cardinality(multisets(4,3))::text $q$),
  ('multisets','contains via <@: {1,1} ∈ multisets(3,2), {1,4} ∉, {1,2,3} ∉ (wrong size)','eq','true|false|false','repetition ok; ⊆ [n]; size k',$q$
    SELECT (ROW(ARRAY[1,1], 3)::multiset <@ multisets(3,2))::text || '|' ||
           (ROW(ARRAY[1,4], 3)::multiset <@ multisets(3,2))::text || '|' ||
           (ROW(ARRAY[1,2,3], 3)::multiset <@ multisets(3,2))::text $q$),
  ('multisets','k_subsets is the repetition-free refinement: the distinct-element multisets of multisets(3,2) = k_subsets(3,2)','eq','{1,2},{1,3},{2,3}','multiplicity ≤ 1',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(multisets(3,2)) e
     WHERE (SELECT count(DISTINCT x) FROM unnest(((e).value).elements) x) = 2 $q$);

-- mathlib Multiset notation-layer assertions (issue #18)
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('multisets','multiplicity-exponent repr (mathlib Multiset): {1,1,2,3} ↦ 1²·2·3','eq','1²·2·3','distinct elements ascending, multiplicity a superscript exponent',$q$
    SELECT multiset_frequency(ROW(ARRAY[1,1,2,3], 3)::multiset) $q$),
  ('multisets','additive union (Multiset +): {1,1,2} + {2,3} = {1,1,2,2,3}','eq','{1,1,2,2,3}','multiplicities add; re-sorted ascending',$q$
    SELECT notation(ROW(ARRAY[1,1,2], 3)::multiset + ROW(ARRAY[2,3], 3)::multiset) $q$),
  ('multisets','∅ is the additive identity: m + ∅ = m','eq','1²·2·3','the empty multiset is the monoid unit',$q$
    SELECT multiset_frequency(ROW(ARRAY[1,1,2,3], 3)::multiset + multiset_zero()) $q$),
  ('multisets','cardinality counts WITH multiplicity (Multiset.card): |{1,1,2}| = 3','eq','3','array length, not the distinct count',$q$
    SELECT multiset_card(ROW(ARRAY[1,1,2], 3)::multiset)::text $q$),
  ('multisets','membership ∈: 2 ∈ {1,1,2}, 5 ∉','eq','true|false','occurs with multiplicity ≥ 1',$q$
    SELECT multiset_mem(2, ROW(ARRAY[1,1,2],3)::multiset)::text || '|' || multiset_mem(5, ROW(ARRAY[1,1,2],3)::multiset)::text $q$),
  ('multisets','sub-multiset order ≤ (Multiset.le): {1,2} ≤ {1,1,2,3}, {1,1} ≰ {1,2,3}','eq','true|false','multiplicity-wise ≤ (second fails: 1 appears twice on the left, once on the right)',$q$
    SELECT multiset_le(ROW(ARRAY[1,2],3)::multiset, ROW(ARRAY[1,1,2,3],3)::multiset)::text || '|' ||
           multiset_le(ROW(ARRAY[1,1],3)::multiset, ROW(ARRAY[1,2,3],3)::multiset)::text $q$),
  ('multisets','the op registry knows at least the multiset carrier''s ≤ ∈ + |·| ∅ (a floor — more ops may be added)','eq','true','base_type_operation rows for the multiset type',$q$
    SELECT (array_agg(symbol) @> ARRAY['≤','∈','+','|·|','∅'])::text FROM base_type_operation WHERE type = 'multiset' $q$),
  ('multisets','multiset is at least a commutative monoid (under +) and a poset (under ≤) (a floor — more structures may be added)','eq','true','base_type_structure memberships',$q$
    SELECT (array_agg(structure) @> ARRAY['commutative_monoid','poset'])::text FROM base_type_structure WHERE type = 'multiset' $q$),
  ('multisets','the exponential repr is registered as data (base_repr)','eq','multiset_frequency','render_fn on the exponential row',$q$
    SELECT render_fn FROM base_repr WHERE collection = 'multisets' AND repr = 'exponential' $q$),
  ('multisets','mathlib anchor for the additive union (base_reference)','eq','Multiset.instAdd','the hard pointer for s + t',$q$
    SELECT identity FROM base_reference WHERE subject='multiset_add' AND system='mathlib4' $q$),
  ('multisets','the empty ground: ((0,0)) = 1 and ((0,k)) = 0','eq','1|1|0|0','#254 — C(−1,0) read as 0 lost the empty multiset',$q$
    SELECT cardinality(multisets(0,0))::text || '|' || (SELECT count(*) FROM elements(multisets(0,0)) e)::text || '|' ||
           cardinality(multisets(0,3))::text || '|' || (SELECT count(*) FROM elements(multisets(0,3)) e)::text $q$);
