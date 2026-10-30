---
order: 12
title: Controls from the expression
---

# Controls from the expression

notatio draws a control for a variable without being told how. The free symbols of an
expression each get a control, chosen from what is known about the symbol, and the same
choice serves a [`Manipulate`](/docs/components/manipulate), a prose panel and a
[worksheet](/docs/components/worksheet).

## What decides a control

For each symbol, in order of precedence:

1. **The author's hint**: a control tuple in `params` (`{n, 1, 20}`, `{b, Boolean}`).
2. **The engine's declared type or assumption**: `integer` steps by one, `boolean` is a
   checkbox, `complex` a 2D pad, and a bounded type such as `integer<1..>` (what an assumption
   `n > 0` leaves) gives the bounds.
3. **A letter convention**, where a host turns it on (worksheets do): `n`, `m` and `k` are
   integers, `z` is complex.
4. **A real slider from −10 to 10**, widened only as far as a starting value needs.

A control-type hint (slider, stepper, knob) applies only when it suits the symbol's domain.

| Domain                                          | Control                                     |
| ----------------------------------------------- | ------------------------------------------- |
| real, integer                                   | slider                                      |
| boolean                                         | checkbox                                    |
| string                                          | input field                                 |
| complex                                         | 2D pad                                      |
| finite list of values                           | setter bar (up to five), else popup menu    |
| bare symbols (`Natural`, `Adic`)                | the same choices, binding the symbol itself |
| lattice point (Gaussian or Eisenstein integers) | integer 2D pad, binding `Tuple(a, b)`       |

## `Manipulate` without tuples

`Manipulate(body)` with no control tuples gives every free symbol of the body a control. A bare
symbol after the body names just that one.

<Story
  title="Sliders for a and b">
<notatio-out format="epsil" value='Manipulate(Plot(a * Sin(b * x), (x, -6.283, 6.283)))' />
</Story>

<Story
  title="Only b is a control">
<notatio-out format="epsil" value='Manipulate(Plot(a * Sin(b * x), (x, -6.283, 6.283)), b)' />
</Story>

In `params`, `{b, Boolean}`, `{s, String}` and `{z, Complex}` are the non-numeric tuples. The
lowering itself has no engine, so it writes real sliders. `<notatio-manipulate>` then refines
the symbols named in its `infer` attribute against the engine's declarations: a symbol
declared `integer` gets a whole-number slider, one declared `boolean` a checkbox.

## Scope

Inference reads the declarations of the enclosing notebook or dynamic module. A declaration
made in one notebook types the controls there and nowhere else.

## Prose panels

A `prose` panel with `Variables -> Automatic` gives each hole in the sentence the control its
type calls for: a whole-number knob for an integer, a toggler for a boolean, a 2D pad for a
complex variable, an integer pad for a lattice point. A hole over bare-name choices binds the
symbol, and a `knob` option on it scrubs through the names.

## Worksheets

A worksheet takes integer-ness and bounds from a declared type or, with letter conventions
(on in worksheets, off elsewhere), from the symbol's letter. A value-based range is unchanged,
and `n := 3` gets a whole-number slider.

## From a signature

A head's typed signature and an example of it make controls too: this is the
[Try it panel](/docs/frontend/try-it) on every symbol page. The record fields it reads are in
[Reference records](/docs/entry/record-fields).
