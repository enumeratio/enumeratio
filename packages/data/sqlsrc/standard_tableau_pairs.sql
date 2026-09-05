-- requires: realizer, utilities, permutations, standard_tableaux, maps-bijections
-- standard_tableau_pairs — the RSK codomain: pairs (P,Q) of same-shape standard Young tableaux with n cells. RSK is a
-- bijection permutations(n) ↔ {(P,Q) : P,Q SYT of a common shape λ ⊢ n}, so |standard_tableau_pairs(n)| = n!. This
-- collection gives that codomain a home, closing the RSK map (perm ⇄ SYT-pair) — see issue #66 / #30.
--
-- The carrier `standard_tableau_pair` and the two maps (perm_rsk forward, standard_tableau_pair_to_perm = rsk_inverse
-- back) already live in maps-bijections.sql; this file reuses them. The floor is the perm↔pair bijection itself:
-- enumerate permutations(n) in rank order and push each through perm_rsk, so pair rank = preimage permutation rank.

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE standard_tableau_pairs_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f standard_tableau_pairs_fiber, element_limit int) RETURNS SETOF standard_tableau_pair LANGUAGE sql STABLE AS $$
  SELECT perm_rsk((e).value)                                          -- the RSK image of each permutation, in perm rank order
  FROM elements(permutations((f).size), element_limit) e              -- propagate the limit inward: elements() defaults to 5000, which silently truncated n! > 5000 (n≥8… and n=7 at 5040)
  ORDER BY ordinality(e)
  LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f standard_tableau_pairs_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT factorial((f).size::int) $$;                                 -- n!, since RSK is a bijection with permutations
-- membership: both tableaux are SYT with n cells AND share a shape (equal sorted row-length multiset).
CREATE FUNCTION contains_in_fiber(f standard_tableau_pairs_fiber, v standard_tableau_pair) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).p <@ standard_tableaux((f).size)
     AND (v).q <@ standard_tableaux((f).size)
     AND ( SELECT array_agg(c ORDER BY c) FROM (SELECT count(*) c FROM unnest(((v).p).row_word) r GROUP BY r) s )
         IS NOT DISTINCT FROM
         ( SELECT array_agg(c ORDER BY c) FROM (SELECT count(*) c FROM unnest(((v).q).row_word) r GROUP BY r) s ) $$;

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('standard_tableau_pairs', 'standard_tableau_pair');
INSERT INTO base_grade VALUES ('standard_tableau_pairs', 1, 'size', NULL, NULL);
-- direct unrank: the fiber is RSK applied to S_n in perm-rank order, so the ord-th pair is RSK of the ord-th
-- permutation — jump straight there via the permutation unrank (RSK is a bijection S_n ↔ same-shape SYT pairs).
CREATE FUNCTION fiber_unrank(f standard_tableau_pairs_fiber, rank rank_index) RETURNS standard_tableau_pair LANGUAGE sql IMMUTABLE AS $fu$
  SELECT perm_rsk(permutation_unrank_lex((f).size::int, rank::bigint)) $fu$;
SELECT base_realize('standard_tableau_pairs');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableau_pairs','anchor: |standard_tableau_pairs(n)| = n! for n=0..6 is 1,1,2,6,24,120,720','eq','1,1,2,6,24,120,720','RSK is a bijection with permutations',$q$
    SELECT string_agg(cardinality(standard_tableau_pairs(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('standard_tableau_pairs','same count as permutations: |standard_tableau_pairs(5)| = |permutations(5)| = 120','eq','120|120','n! either way',$q$
    SELECT cardinality(standard_tableau_pairs(5))::text || '|' || cardinality(permutations(5))::text $q$),
  ('standard_tableau_pairs','RSK round-trips through the collection: pair→perm→pair over standard_tableau_pairs(n), n=0..5','eq','true','perm_rsk ∘ standard_tableau_pair_to_perm = id on the pairs',$q$
    SELECT bool_and(perm_rsk(standard_tableau_pair_to_perm((e).value)) = (e).value)::text
    FROM generate_series(0,5) n, LATERAL elements(standard_tableau_pairs(n)) e $q$),
  ('standard_tableau_pairs','a worked instance: 2413 → its RSK pair → back to 2413','eq','(1,3/2,4 ; 1,2/3,4)|2413','perm_rsk then standard_tableau_pair_to_perm',$q$
    SELECT notation(perm_rsk(ROW(ARRAY[2,4,1,3])::permutation)) || '|' ||
           one_line(standard_tableau_pair_to_perm(perm_rsk(ROW(ARRAY[2,4,1,3])::permutation))) $q$),
  ('standard_tableau_pairs','contains via <@: the 2413 pair ∈ standard_tableau_pairs(4); a mismatched-shape pair ∉','eq','true|false','same-shape SYT pair is a member; differing shapes are not',$q$
    SELECT (perm_rsk(ROW(ARRAY[2,4,1,3])::permutation) <@ standard_tableau_pairs(4))::text || '|' ||
           (ROW(ROW(ARRAY[0,0,0])::standard_tableau, ROW(ARRAY[0,1,2])::standard_tableau)::standard_tableau_pair
              <@ standard_tableau_pairs(3))::text $q$),
  ('standard_tableau_pairs','range constructor standard_tableau_pairs(0,3): fibers unfold to sizes 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(standard_tableau_pairs(0,3)) f $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableau_pairs','fiber_unrank(standard_tableau_pairs(4), 0..23) are all members (accel floor)','eq','true','RSK-of-perm unrank lands inside the n!=24 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(standard_tableau_pairs(4)) f), ord::rank_index) <@ standard_tableau_pairs(4))::text
      FROM generate_series(0, cardinality(standard_tableau_pairs(4))::int - 1) ord $q$);
