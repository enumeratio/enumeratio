-- requires: realizer, utilities
-- decorated_permutations — permutations of [n] in which each FIXED POINT is decorated with a sign ± (a FindStat
-- collection; sage DecoratedPermutations(n)). Carried as the signed one-line word: word[i] = p(i), positive, except
-- a fixed point p(i)=i may be stored as +i (a "loop") or −i (an "anti-loop"). Rendered comma-separated (e.g. -1,2).
-- count = Σ_{p∈S_n} 2^{fix(p)} = 1,2,5,16,65,326,… (counted from the floor). The floor is a permutation builder with a
-- sign fork: filling position i, place any unused value v; if v = i (a fixed point) it forks into +i and −i.

-- ── carrier ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE decorated_permutation AS (word int[]);                  -- signed image; a negative entry is a decorated fixed point
CREATE FUNCTION notation(d decorated_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((d).word, ',') $$;

-- ── the engines a collection provides ──────────────────────────────────────────────────────────────────
CREATE TYPE decorated_permutations_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f decorated_permutations_fiber, element_limit int) RETURNS SETOF decorated_permutation LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS w, ARRAY(SELECT generate_series(1, (f).size::int)) AS avail
    UNION ALL
    SELECT b.w || val, array_remove(b.avail, absval)
      FROM build b,
           LATERAL unnest(b.avail) AS absval,                        -- the value placed at position |w|+1
           LATERAL unnest(CASE WHEN absval = coalesce(array_length(b.w,1),0) + 1                 -- a fixed point ⇒ sign fork
                               THEN ARRAY[absval, -absval] ELSE ARRAY[absval] END) AS val
     WHERE coalesce(array_length(b.w,1),0) < (f).size::int
  )
  SELECT ROW(w)::decorated_permutation FROM build
   WHERE coalesce(array_length(w,1),0) = (f).size::int
   ORDER BY w
   LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f decorated_permutations_fiber, v decorated_permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).word,1),0) = (f).size::int
     AND coalesce((SELECT array_agg(abs(x) ORDER BY abs(x)) FROM unnest((v).word) x), ARRAY[]::int[]) = ARRAY(SELECT generate_series(1, (f).size::int))  -- |word| is a permutation (coalesce: array_agg over the empty n=0 word is NULL, not '{}')
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).word,1) i WHERE (v).word[i] < 0 AND abs((v).word[i]) <> i) $$;   -- signs only on fixed points

-- ── declare as DATA + realize ──────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('decorated_permutations', 'decorated_permutation');
INSERT INTO base_grade VALUES ('decorated_permutations', 1, 'size', NULL, NULL);
SELECT base_realize('decorated_permutations');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('decorated_permutations','anchor: |decorated_permutations(n)| for n=0..5 is 1,2,5,16,65,326','eq','1,2,5,16,65,326','Σ over S_n of 2^(fixed points)',$q$
    SELECT string_agg(cardinality(decorated_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('decorated_permutations','the 5 decorated permutations of [2]','eq','-1,-2,-1,2,1,-2,1,2,2,1','the identity 4 ways (signs on both fixed points) + the transposition',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(decorated_permutations(2)) e $q$),
  ('decorated_permutations','n=1: the two decorations of the single fixed point, +1 and -1','eq','-1,1','a loop and an anti-loop',$q$
    SELECT string_agg(render(e), ',' ORDER BY ordinality(e)) FROM elements(decorated_permutations(1)) e $q$),
  ('decorated_permutations','contains via <@: -1,2 ∈ decorated_permutations(2) (1 is a fixed point); -2,1 ∉ (2 is not fixed)','eq','true|false','signs allowed only on fixed points',$q$
    SELECT (ROW(ARRAY[-1,2])::decorated_permutation <@ decorated_permutations(2))::text || '|' ||
           (ROW(ARRAY[-2,1])::decorated_permutation <@ decorated_permutations(2))::text $q$),
  ('decorated_permutations','undecorated count: exactly n! elements have no sign (the plain permutations)','eq','6','of decorated_permutations(3), 3! have all-positive words',$q$
    SELECT count(*)::text FROM elements(decorated_permutations(3)) e WHERE NOT EXISTS (SELECT 1 FROM unnest(((e).value).word) x WHERE x < 0) $q$),
  ('decorated_permutations','range constructor decorated_permutations(0,3): fibers unfold to sizes 0,1,2,3','eq','0,1,2,3','the (lo,hi) range form',$q$
    SELECT string_agg((f).size::text, ',' ORDER BY (f).size) FROM fibers(decorated_permutations(0,3)) f $q$);
