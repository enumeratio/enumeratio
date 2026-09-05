-- requires: realizer, utilities
-- egyptian_fractions(k) — sets of k DISTINCT unit-fraction denominators 1 ≤ d₁<d₂<…<d_k with Σ 1/dᵢ = 1, graded
-- by k (this is the family A002966 counts — k=1 has exactly one, 1/1; k=2 has none; k=3 has exactly one, proven
-- unique: 1/2+1/3+1/6; k≥4 grows quickly). SMALL k ONLY (per #231) — the search space grows fast even with the
-- tight per-step bound below, so this floor is only exercised at k≤5 in the examples. Fresh carrier: no existing
-- collection shapes a distinct-denominator unit-fraction set.
CREATE TYPE egyptian_fraction AS (denominators int[]);
CREATE FUNCTION notation(e egyptian_fraction) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT string_agg('1/' || d::text, '+' ORDER BY o) FROM unnest((e).denominators) WITH ORDINALITY t(d,o)), '') $$;

-- exact check (no floating point): Σ 1/dᵢ = 1 ⟺ Σ (Π d)/dᵢ = Π d — each term is an EXACT integer since dᵢ | Πd.
CREATE FUNCTION egyptian_fraction_sums_to_one(d int[]) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length(d,1),0); prod numeric := 1; total numeric := 0; i int; BEGIN
    IF n = 0 THEN RETURN false; END IF;
    FOR i IN 1..n LOOP prod := prod * d[i]; END LOOP;
    FOR i IN 1..n LOOP total := total + prod / d[i]; END LOOP;
    RETURN total = prod;
  END $$;

-- the search: remaining target remaining_num/remaining_den (a reduced fraction), count_left terms still to place,
-- each > min_next. Bounds per step: next term d must have 1/d ≤ remaining (d ≥ ⌈den/num⌉) and the OTHER
-- count_left-1 terms (all > d, so all ≥ d+1... but bounding by d itself is the standard loose bound) can't exceed
-- the remaining target (d ≤ count_left·den/num) — both are the classical Egyptian-fraction search bounds.
CREATE FUNCTION egyptian_fractions_search(remaining_num bigint, remaining_den bigint, min_next int, count_left int)
RETURNS SETOF int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE d int; lo int; hi int; g bigint; nn bigint; nd bigint; a bigint; b bigint; t bigint; sub int[]; BEGIN
    IF count_left = 0 THEN
      IF remaining_num = 0 THEN RETURN NEXT ARRAY[]::int[]; END IF;
      RETURN;
    END IF;
    IF remaining_num <= 0 THEN RETURN; END IF;
    lo := greatest(min_next + 1, ceil(remaining_den::numeric / remaining_num::numeric)::int);
    hi := floor(count_left * remaining_den::numeric / remaining_num::numeric)::int;
    FOR d IN lo..hi LOOP
      nn := remaining_num * d - remaining_den;   -- remaining − 1/d, over common denominator remaining_den·d
      nd := remaining_den * d;
      a := abs(nn); b := nd;                      -- reduce by gcd (inline: numbers can exceed gcd_int's int range)
      WHILE b <> 0 LOOP t := a % b; a := b; b := t; END LOOP;
      g := greatest(a, 1);
      IF nn <> 0 THEN nn := nn / g; nd := nd / g; END IF;
      FOR sub IN SELECT * FROM egyptian_fractions_search(nn, nd, d, count_left - 1) LOOP
        RETURN NEXT ARRAY[d] || sub;
      END LOOP;
    END LOOP;
  END $$;

CREATE TYPE egyptian_fractions_fiber AS (k natural_number);   -- typed fiber; axis: k (the term count)
CREATE FUNCTION fiber_elements(f egyptian_fractions_fiber, element_limit int) RETURNS SETOF egyptian_fraction LANGUAGE sql STABLE AS $$
  SELECT ROW(t.denoms)::egyptian_fraction
    FROM egyptian_fractions_search(1, 1, 0, (f).k::int) AS t(denoms)
   ORDER BY t.denoms
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f egyptian_fractions_fiber, v egyptian_fraction) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE d int[] := (v).denominators; n int := coalesce(array_length(d,1),0); i int; BEGIN
    IF n <> (f).k::int THEN RETURN false; END IF;
    FOR i IN 1..n-1 LOOP IF d[i] >= d[i+1] THEN RETURN false; END IF; END LOOP;
    RETURN egyptian_fraction_sums_to_one(d);
  END $$;

INSERT INTO base_collection VALUES ('egyptian_fractions', 'egyptian_fraction');
INSERT INTO base_grade VALUES ('egyptian_fractions', 1, 'k', '1', NULL);
CREATE FUNCTION fiber_symbol(f egyptian_fractions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Egypt(' || (f).k::int || ')' $$;
SELECT base_realize('egyptian_fractions');

-- ── stats ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION egyptian_fractions_largest_denominator(e egyptian_fraction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (e).denominators[coalesce(array_length((e).denominators,1),0)] $$;
CREATE FUNCTION egyptian_fractions_smallest_denominator(e egyptian_fraction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (e).denominators[1] $$;
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('egyptian_fractions','largest_denominator','egyptian_fractions_largest_denominator','Largest denominator','natural_numbers'),
  ('egyptian_fractions','smallest_denominator','egyptian_fractions_smallest_denominator','Smallest denominator','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('egyptian_fractions','k=1 has exactly one decomposition (1/1); k=2 has none; k=3''s unique decomposition is proven unique (A002966(3)=1)','eq','1|0|1',NULL,$q$
    SELECT cardinality(egyptian_fractions(1))::text || '|' || cardinality(egyptian_fractions(2))::text || '|' || cardinality(egyptian_fractions(3))::text $q$),
  ('egyptian_fractions','k=4 and k=5 each have several decompositions (a floor, not a pin)','eq','true|true',NULL,$q$
    SELECT (cardinality(egyptian_fractions(4)) >= 3)::text || '|' || (cardinality(egyptian_fractions(5)) >= 14)::text $q$),
  ('egyptian_fractions','k=1: the only decomposition is 1/1','eq','1/1',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(egyptian_fractions(1)) e $q$),
  ('egyptian_fractions','k=2: none (1/a+1/b=1, a<b has no solution)','eq','0',NULL,$q$
    SELECT cardinality(egyptian_fractions(2))::text $q$),
  ('egyptian_fractions','k=3''s unique decomposition is 1/2+1/3+1/6','eq','1/2+1/3+1/6',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(egyptian_fractions(3)) e $q$),
  ('egyptian_fractions','every decomposition for k=1..5 truly sums to 1, strictly increasing denominators','eq','true','the defining invariant',$q$
    SELECT bool_and((e).value <@ egyptian_fractions(k)) FROM generate_series(1,5) k, LATERAL elements(egyptian_fractions(k)) e $q$),
  ('egyptian_fractions','smallest/largest denominator of 1/2+1/3+1/6','eq','2|6',NULL,$q$
    SELECT egyptian_fractions_smallest_denominator(ROW(ARRAY[2,3,6])::egyptian_fraction)::text || '|'
        || egyptian_fractions_largest_denominator(ROW(ARRAY[2,3,6])::egyptian_fraction)::text $q$),
  ('egyptian_fractions','contains: {2,3,6} ∈ egyptian_fractions(3), {2,3,7} (doesn''t sum to 1) ∉','eq','true|false',NULL,$q$
    SELECT (ROW(ARRAY[2,3,6])::egyptian_fraction <@ egyptian_fractions(3))::text || '|'
        || (ROW(ARRAY[2,3,7])::egyptian_fraction <@ egyptian_fractions(3))::text $q$);
