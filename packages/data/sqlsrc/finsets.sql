-- requires: realizer, subsets, utilities
-- finsets — finite sets of positive integers with NO ambient ground (Lean's `Finset ℕ`): the unified `finset` carrier
-- (defined in subsets.sql) at n = NULL, i.e. α = ℕ — vs `subsets`' finite n (α = Fin n). Same carrier, so notation /
-- membership / ops / glyphs are all SHARED; only the fiber differs. UNBOUNDED, ≅ ℕ — ranked by the CHARACTERISTIC
-- NUMBER (bit i ↦ member i): {} ↔ 0, {1} ↔ 1, {1,3} ↔ 101₂ = 5. `subsets(n)` is this collection's bounded window
-- (ground kept); the forget_ground map drops n → NULL to move from there to here.

-- the ℕ-bijection: characteristic number ⇄ member set (bit i−1 set ⇔ i ∈ the set); the finset has no ground (n = NULL).
CREATE FUNCTION finset_unrank(r numeric) RETURNS finset LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE res int[] := '{}'; i int := 1; x numeric := r; BEGIN
    WHILE x > 0 LOOP
      IF mod(x, 2) = 1 THEN res := res || i; END IF;
      x := trunc(x / 2); i := i + 1;
    END LOOP;
    RETURN ROW(res, NULL)::finset;
  END $$;
-- round() strips numeric ^'s fp noise; exact for modest members (a true big-int power for huge members is a follow-up).
CREATE FUNCTION finset_rank(s finset) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(round(2::numeric ^ (m - 1))), 0) FROM unnest((s).members) m $$;

CREATE TYPE finsets_fiber AS (unit unit);   -- singleton fiber (ungraded, unbounded)
CREATE FUNCTION fiber_elements(f finsets_fiber, element_limit int) RETURNS SETOF finset LANGUAGE sql STABLE AS $$
  SELECT finset_unrank(r) FROM generate_series(0, element_limit - 1) r $$;   -- the r-th finite set = r's bit-set
CREATE FUNCTION contains_in_fiber(f finsets_fiber, v finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- α = ℕ (n NULL); distinct sorted positives
  SELECT (v).n IS NULL
     AND NOT EXISTS (SELECT 1 FROM unnest((v).members) m WHERE m < 1)
     AND coalesce((v).members, '{}') = coalesce((SELECT array_agg(DISTINCT m ORDER BY m) FROM unnest((v).members) m), '{}') $$;
CREATE FUNCTION fiber_symbol(f finsets_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Pfin(ℕ)' $$;   -- finite subsets of ℕ

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f finsets_fiber, rank rank_index) RETURNS finset LANGUAGE sql IMMUTABLE AS $fu$ SELECT finset_unrank(rank) $fu$;
INSERT INTO base_collection VALUES ('finsets', 'finset', true);   -- unbounded, ungraded (Lean Finset ℕ)
SELECT base_realize('finsets');

-- forget_ground: subsets (finset over Fin n) → finsets (finset over ℕ) — drop the ground (n → NULL). One-way (the
-- ground can't be recovered), so NOT a bijection: the precise sense in which the two collections aren't equinumerous.
CREATE FUNCTION finset_forget_ground(s finset) RETURNS finset LANGUAGE sql IMMUTABLE AS $$ SELECT ROW((s).members, NULL)::finset $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('subsets','forget_ground','finset_forget_ground','finsets','Forget the ground',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('finsets','first eight off the floor (characteristic-number order)','eq','{},{1},{2},{1,2},{3},{1,3},{2,3},{1,2,3}','r ↦ r''s bit-set',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(finsets(), 8) e $q$),
  ('finsets','unrank(5) = {1,3} (101₂)','eq','{1,3}','the characteristic number decodes to its bit positions',$q$
    SELECT notation((unrank(finsets(), 5)).value) $q$),
  ('finsets','rank ∘ unrank = id (r = 0..20)','eq','true','the ℕ-bijection round-trips',$q$
    SELECT bool_and(finset_rank(finset_unrank(r)) = r)::text FROM generate_series(0,20) r $q$),
  ('finsets','cardinality = infinity (unbounded, ≅ ℕ)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(finsets())::text $q$),
  ('finsets','contains via <@: {1,3} ∈, {} ∈, {0,2} ∉ (0 not positive)','eq','true|true|false','distinct sorted positives, no ground',$q$
    SELECT (ROW(ARRAY[1,3], NULL)::finset <@ finsets())::text || '|' ||
           (ROW('{}'::int[], NULL)::finset <@ finsets())::text || '|' ||
           (ROW(ARRAY[0,2], NULL)::finset <@ finsets())::text $q$),
  ('finsets','forget_ground: {1,3} of [5] ↦ {1,3}, whose rank is 5','eq','{1,3}|5','the ground is dropped (n → NULL)',$q$
    SELECT notation(finset_forget_ground(ROW(ARRAY[1,3], 5)::finset)) || '|' ||
           finset_rank(finset_forget_ground(ROW(ARRAY[1,3], 5)::finset))::text $q$);
