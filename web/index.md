---
layout: home
hero:
  name: notatio
  text: Write mathematics, see it work
  tagline: A notebook for mathematics you can compute, draw and check, live in your browser, on top of enumeratio, a catalogue where every object has a home and every claim a test.
  actions:
    - theme: brand
      text: Open a worksheet
      link: /worksheet/
    - theme: alt
      text: Explore the collections
      link: /reference/collections/
    - theme: alt
      text: Read the docs
      link: /docs/
features:
  - title: Collections, ranked and unranked
    details: Subsets, permutations, partitions, Dyck paths, tableaux, trees — lazy indexed families with closed-form counts, so <code>Count</code> and <code>At</code> never build the list. Browse the <a href="/reference/collections/">collections</a>.
  - title: Structure, not special cases
    details: <code>Min</code> works on anything with an order, <code>Floor</code> on anything with ticks, whether it's a number, a string, a partition under dominance or a type you declare yourself. Heads require structure and types provide it, after <a href="/playground/inspirations/mathlib">Mathlib</a>.
  - title: Numbers and functions, exactly
    details: Residues, numerals and adèles over bigints; special functions to arbitrary precision; algebras from Clifford to Hecke. Every head is in the <a href="/reference/symbol/">symbol reference</a>.
  - title: Checked, not claimed
    details: Every symbol crosswalks to Wikipedia, MathWorld, the DLMF, Fungrim, the OEIS, Wolfram, Sage and more — and where a claim can be computed, it is. <a href="/reference/statistics/">Statistics</a> and <a href="/reference/maps/">maps</a> are checked against FindStat by value.
  - title: Live in the page
    details: A reactive <a href="/worksheet/">worksheet</a>, and plots, glyphs and controls as <a href="/reference/component/">components</a> for plain HTML, Vue or React — with the same evaluation at the <a href="/docs/cli/">command line</a>.
---

<style>
.VPFeature .details a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
