-- requires: integer_compositions, realizer
-- triangular_composition — compositions of n into TRIANGULAR parts {1,3,6,10,15,…} (ordered sums, order matters).
-- Count = A023361: 1,1,1,2,3,4,7,11,16,25,40,61,94 for n=0..12. A base_restrict of integer_compositions: same
-- carrier + grade [n], the gap-cut floor filtered to all-triangular-part compositions, realizer re-ranks. A part p
-- is triangular iff 8p+1 is a perfect square (p = k(k+1)/2 ⇔ 8p+1 = (2k+1)²).

CREATE FUNCTION is_triangular_composition(v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE trunc(sqrt((8*p + 1)::numeric))^2 <> 8*p + 1) $$;   -- empty composition qualifies vacuously

-- accel hook (#172): a(n) = Σ_{triangular t≤n} a(n−t), a(0)=1 (A023361) — a DP over the O(√n) triangular numbers
-- up to n, polynomial instead of the exponential composition floor.
CREATE FUNCTION triangular_composition_count(f integer_compositions_fiber) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := (f).n::int; dp numeric[] := ARRAY[1::numeric]; i int; k int; t int; s numeric; BEGIN   -- dp[i+1] = a(i)
    IF n < 0 THEN RETURN NULL; END IF;
    FOR i IN 1..n LOOP
      s := 0; k := 1; t := 1;
      WHILE t <= i LOOP s := s + dp[i - t + 1]; k := k + 1; t := k * (k + 1) / 2; END LOOP;
      dp := dp || s;
    END LOOP;
    RETURN dp[n + 1];
  END $$;

SELECT base_restrict('triangular_composition', 'integer_compositions', 'is_triangular_composition', count_fn => 'triangular_composition_count');
CREATE FUNCTION fiber_symbol(f triangular_composition_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'TriCom(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('triangular_composition');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('triangular_composition','count for n=0..12: 1,1,1,2,3,4,7,11,16,25,40,61,94 (A023361)','eq','1,1,1,2,3,4,7,11,16,25,40,61,94','compositions into triangular parts',$q$
    SELECT string_agg(cardinality(triangular_composition(n))::text, ',' ORDER BY n) FROM generate_series(0,12) n $q$),
  ('triangular_composition','compositions of 3 into triangular parts, in order','eq','3,1+1+1','1+2 and 2+1 excluded (2 is not triangular)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(triangular_composition(3)) e $q$),
  ('triangular_composition','every part is triangular across the fiber (n=0..8)','eq','true','the defining invariant across the floor',$q$
    SELECT bool_and(is_triangular_composition((e).value)) FROM elements(triangular_composition(0,8)) e $q$),
  ('triangular_composition','contains via <@: 1+3 ∈ triangular_composition(4), 2+2 ∉ (2 not triangular)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,3])::composition <@ triangular_composition(4))::text || '|' ||
           (ROW(ARRAY[2,2])::composition <@ triangular_composition(4))::text $q$);
