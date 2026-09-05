-- requires: realizer, little_schroder_numbers
-- total_partitions — Schröder's fourth problem: the ways to totally bracket/hierarchically group a row of n
-- items, equivalently rooted ORDERED (plane) trees with n leaves where every internal node has ≥2 children
-- (series-reduced: no unary nodes). Single grade [n = number of leaves], n≥1. count = the little Schröder /
-- super-Catalan numbers s(n) (A001003): 1,1,3,11,45,197,903 for n=1..7 — borrowed directly from the already-
-- realized little_schroder_numbers sequence (its s(0..6) IS this collection's n=1..7, shifted by one: n leaves
-- ⇔ little_schroder_number(n-1)).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
-- a total_partition is a token word over the implicit (unbracketed) root: 0 = leaf, 1 = open a new bracket
-- (internal node), 2 = close it (only ever legal once that node holds ≥2 direct children). The root itself is
-- never bracketed — its children are whatever sits at word-depth 0 — so n=3's flat grouping "abc" (root with
-- 3 children, no brackets at all) is a legal, distinct partition alongside "(ab)c" and "a(bc)".
CREATE TYPE total_partition AS (steps int[]);
CREATE FUNCTION notation(t total_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(sym, '' ORDER BY o), '')
  FROM (
    SELECT o, CASE s WHEN 1 THEN '(' WHEN 2 THEN ')'
                     ELSE chr(96 + sum(CASE WHEN s = 0 THEN 1 ELSE 0 END) OVER (ORDER BY o)::int) END AS sym
    FROM unnest((t).steps) WITH ORDINALITY AS x(s, o)
  ) q $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: grow every token word by trying all three moves at each step, carrying a STACK of per-open-node direct
-- child counts (stack[1] = the implicit root's count) rather than a scalar depth — arity is unbounded per node
-- (unlike binary_trees/k_ary_trees), so validity of a close depends on how many direct children its node has
-- collected, not just how deep we are. A leaf increments the current (top) frame's count; an open pushes a
-- fresh 0-count frame; a close is legal only with ≥2 accumulated and pops, crediting the parent frame with the
-- just-closed subtree as one child. A completion is a state back at the root frame (stack length 1) with all n
-- leaves placed and the root itself holding ≥2 children — except n=1, whose single leaf IS the whole tree with
-- no brackets, root count 1. Emitted DESC on the raw token array: since '(' (1) sorts after leaf (0) and before
-- close (2) only in position, DESC ordering tries the bracket-first branch first, matching the (ab)c / a(bc) /
-- abc order Schröder's original problem is usually presented in.
CREATE TYPE total_partitions_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f total_partitions_fiber, element_limit int) RETURNS SETOF total_partition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, stack, leaves) AS (
      SELECT ARRAY[]::int[], ARRAY[0], 0
    UNION ALL
      SELECT
        g.steps || c.tok,
        CASE c.tok
          WHEN 0 THEN g.stack[1:array_length(g.stack,1)-1] || (g.stack[array_length(g.stack,1)] + 1)
          WHEN 1 THEN g.stack || 0
          ELSE        g.stack[1:array_length(g.stack,1)-2] || (g.stack[array_length(g.stack,1)-1] + 1)
        END,
        g.leaves + CASE WHEN c.tok = 0 THEN 1 ELSE 0 END
      FROM gen g CROSS JOIN (VALUES (0), (1), (2)) AS c(tok)
      WHERE (c.tok = 0 AND g.leaves < (f).n::int)                                             -- room for another leaf
         OR (c.tok = 1 AND (f).n::int - g.leaves >= 2                                          -- a new node needs ≥2 leaves left to give it
                        AND array_length(g.stack,1) < (f).n::int - 1)                          -- and non-root nesting is capped at n-2 (the all-binary "caterpillar" is the deepest possible tree on n leaves)
         OR (c.tok = 2 AND array_length(g.stack,1) > 1 AND g.stack[array_length(g.stack,1)] >= 2)  -- ≥2 direct children so far
  )
  SELECT ROW(steps)::total_partition FROM gen
  WHERE array_length(stack,1) = 1
    AND leaves = (f).n::int
    AND (stack[1] >= 2 OR ((f).n::int = 1 AND stack[1] = 1))
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f total_partitions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int < 1 THEN 0::numeric ELSE little_schroder_number(((f).n::int - 1)::term_index) END $$;

-- contains: replay the same stack simulation as the floor, but as a structural checker over an arbitrary word —
-- reject on the first illegal move (a close with <2 children, a close of the (unbracketable) root, a symbol
-- outside {0,1,2}, more leaves than n), then require the walk to end back at the root with exactly n leaves
-- placed and the root itself satisfying the same ≥2-children rule (or the n=1 single-leaf exception).
CREATE FUNCTION contains_in_fiber(f total_partitions_fiber, v total_partition) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := (f).n::int;
    steps int[] := coalesce((v).steps, ARRAY[]::int[]);
    len int := coalesce(array_length(steps, 1), 0);
    stack int[] := ARRAY[0];
    leaves int := 0;
    i int; tok int; depth int;
  BEGIN
    IF n < 1 THEN RETURN false; END IF;
    FOR i IN 1..len LOOP
      tok := steps[i];
      IF tok NOT IN (0, 1, 2) THEN RETURN false; END IF;
      IF tok = 0 THEN
        leaves := leaves + 1;
        IF leaves > n THEN RETURN false; END IF;
        depth := array_length(stack, 1);
        stack[depth] := stack[depth] + 1;
      ELSIF tok = 1 THEN
        stack := stack || 0;
      ELSE
        depth := array_length(stack, 1);
        IF depth <= 1 OR stack[depth] < 2 THEN RETURN false; END IF;
        stack := stack[1:depth - 1];
        stack[depth - 1] := stack[depth - 1] + 1;
      END IF;
    END LOOP;
    depth := array_length(stack, 1);
    RETURN depth = 1 AND leaves = n AND (stack[1] >= 2 OR (n = 1 AND stack[1] = 1));
  END $$;

-- declare it as DATA + realize (fiber_unrank deferred — selfcert checks fiber_count == count(elements) instead)
INSERT INTO base_collection VALUES ('total_partitions', 'total_partition');
INSERT INTO base_grade VALUES ('total_partitions', 1, 'n', '1', NULL);   -- n ranges from 1
CREATE FUNCTION fiber_symbol(f total_partitions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'TP(' || (f).n::int || ')' $$;
SELECT base_realize('total_partitions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('total_partitions','cardinality anchor = little Schröder s(n-1) for n=1..7 (accel)','eq','1,1,3,11,45,197,903','A001003, offset by one leaf',$q$
    SELECT string_agg(cardinality(total_partitions(n))::text, ',' ORDER BY n) FROM generate_series(1,7) n $q$),
  ('total_partitions','n=1 ⇒ one single-leaf tree, no brackets','eq','1|a','the trivial partition',$q$
    SELECT count(*)::text || '|' || notation((unrank(total_partitions(1), 0)).value) FROM elements(total_partitions(1)) e $q$),
  ('total_partitions','n=2 ⇒ one partition: ab (only one way to group 2 items)','eq','ab','no brackets possible with only 2 leaves',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(total_partitions(2)) e $q$),
  ('total_partitions','n=3 in emit order: (ab)c, a(bc), abc','eq','(ab)c,a(bc),abc','the three bracketings of 3 items',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(total_partitions(3)) e $q$),
  ('total_partitions','floor generates 11 partitions at n=4 (independent of the accel)','eq','11','counted off the floor',$q$
    SELECT count(*)::text FROM elements(total_partitions(4)) e $q$),
  ('total_partitions','floor generates 45 partitions at n=5','eq','45','counted off the floor',$q$
    SELECT count(*)::text FROM elements(total_partitions(5)) e $q$),
  ('total_partitions','cardinality(total_partitions(5)) = 45 (accel)','eq','45','closed-form via little_schroder_number',$q$
    SELECT cardinality(total_partitions(5))::text $q$),
  ('total_partitions','every generated word is a valid series-reduced bracketing (contains, self-check)','eq','true','structural round-trip via <@',$q$
    SELECT bool_and((e).value <@ total_partitions(4))::text FROM elements(total_partitions(4)) e $q$),
  ('total_partitions','contains: (ab)c ∈ total_partitions(3), a(b)c ∉ (unary bracket, only 1 child)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[1,0,0,2,0])::total_partition <@ total_partitions(3))::text || '|' ||
           (ROW(ARRAY[0,1,0,2,0])::total_partition <@ total_partitions(3))::text $q$),
  ('total_partitions','contains: a wrapped-whole-tree "(abc)" is NOT distinct from abc — rejected as a redundant unary root','eq','false','root itself may never be the sole bracketed child',$q$
    SELECT (ROW(ARRAY[1,0,0,0,2])::total_partition <@ total_partitions(3))::text $q$),
  ('total_partitions','global order across fibers = (n, ordinality): total_partitions(1,2)','eq','a|ab','n ascending, lex within',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY e) FROM elements(total_partitions(1,2)) e $q$),
  ('total_partitions','range handle: cardinality(total_partitions(1,4)) = 16','eq','16','1+1+3+11 summed over fibers',$q$
    SELECT cardinality(total_partitions(1,4))::text $q$);
