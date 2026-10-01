# Design: graphics, space, and where the packages should sit

Status: **draft / thinking**. Written after `<notatio-worksheet>` landed, because the
worksheet has started to need things that do not have an obvious home — and the answer
to "where does this go" keeps being "wherever the worksheet is". That is the smell this
note is about.

## 1. Where we are

A worksheet is reactive cells plus a screen. The screen composites _layers_, ordered by
dimension, and today a layer is one of four things:

| layer    | drawn by                 | comes from                            |
| -------- | ------------------------ | ------------------------------------- |
| portrait | `<notatio-complex-plot>` | a cell free in `z` (WebGPU canvas)    |
| surface  | `<notatio-plot-3d>`      | a cell free in `x` and `y` (SVG)      |
| curve    | `<notatio-plot>`         | a cell free in `x` (SVG)              |
| image    | `<img>`                  | a cell evaluating to `Image` (raster) |

Three of those four are _elements the worksheet knows about by name_. Only the last is
a value. That asymmetry is the current design debt: the screen special-cases renderers
rather than compositing graphics.

`Image(uri)` and `Rasterize(graphic)` exist (`@enumeratio/formats`), and
`@enumeratio/raster` turns SVG into PNG where a native renderer is available.

## 2. What `Image` is and is not

Wolfram's `Image` has several signatures; the one that matters here is
`Image[graphics]` — wrap a graphics object and it becomes a raster. Ours takes a URI,
which is enough to _display_ a picture and not enough to _be_ one in that sense: there
is no pixel array to index, no arithmetic over it, and no way to ask a plot for its
image other than by rendering it to SVG first.

So `Image` is not the wrong shape — it is the right shape, missing its most useful
signature. What is actually missing underneath it is the thing that signature consumes:
a **graphics object**. Right now a plot is an element, not a value, so there is nothing
for `Image[…]` or `Rasterize[…]` to take that is not already a serialized document.

That is the fork, stated plainly: **make graphics values first, then `Image` over them.**

Wolfram already names the one we have: domain colouring is **`ComplexPlot`**. Ours is a
projection kind called "portrait" — a description of the picture rather than of the
operation that makes it. When a plot becomes a value, `ComplexPlot[f, {z, ...}]` is the
head it should be, and "portrait" becomes what the screen calls the layer it draws.
The same reading applies to the rest of the table in §1: `Plot`, `Plot3D`, `ComplexPlot`
are operations producing graphics; curve, surface and field are what a projection makes
of them.

## 3. Graphics objects and coordinate frames

The generalisation to aim at, from the outside in:

- A **graphics object** is geometry of some dimension — 0d points, 1d curves, 2d
  surfaces and fields, 3d solids — together with a **coordinate frame** saying what its
  coordinates mean. Optionally with a time axis, which makes an animation or a time
  series the same kind of thing as a static picture rather than a special case.
- A **space** holds graphics objects that share (or can be mapped into) a frame.
- A **screen** is a _projection_ of a space from a particular perspective: a camera
  position, orientation and direction. A 2-D graphic is then not a different kind of
  thing from a 3-D one — it is a camera looking straight on at a plane, at a standard
  distance. This is already the model `space.ts` encodes, but only for framing, and
  only over renderers rather than over values.

The payoff is not generality for its own sake. It is that "overlay these two pictures",
"drop into 3-space and rotate", "scrub this through time", and "put a polytope that
lives in Helmert coordinates next to a function of a real variable" all stop being
separate features and become one operation with different arguments.

The practical near-term target remains modest: overlaid raster and vector layers in one
screen. The principles matter because the 2-D canvas is embedded in a 3-D space which is
embedded in something larger, and we can only ever show a projection of it. Getting the
embedding right early is much cheaper than retrofitting it.

### Open questions

- What carries the frame — the graphics object, or its membership in a space?
- Is a time axis a frame dimension, or a separate parameterisation? (A time _series_ and
  an animation want different things from it.)
- How does a projection decline? Not everything can be shown from every perspective, and
  silently drawing nothing is what the worksheet did before panes reported themselves.
- Does an opaque field hide what is beneath it _in the space_, or only in the projection?
  Currently the latter, which is right for a domain colouring and wrong for a solid.

## 4. Cells as values

The same argument applies one level up. A cell is currently a record in an element's
state. Wolfram has `Cell`, with `CellGroup`, options and styles; `In` and `Out` are
symbols. If ours were values too, then a worksheet is a _document_ that can be built,
transformed and serialized by expressions rather than only by typing into it — and the
notebook/worksheet split stops being two elements that happen to share `reactive.ts`.

Worth noting the cost honestly: this is the point where a document format starts to
exist, and document formats are expensive to change later.

## 5. Where things should live

Current homes, and what is wrong with them:

- `@enumeratio/components` holds the web components **and** the reactive core
  (`reactive.ts`), the space model (`space.ts`), the layer stacking, and the projection
  inference. Those last three are not about the DOM at all — they are the model a
  worksheet is a _view_ of. They are in elements because elements is where the worksheet
  is.
- `@enumeratio/formats` holds `Image` and `Rasterize` because it already owned
  `ImageValue`. Formats is about import/export; graphics heads are a stretch there.
- `@enumeratio/raster` is a single function, correctly scoped, Node-only.

A plausible split — **not a decision, a starting point for one**:

| package                  | holds                                                      |
| ------------------------ | ---------------------------------------------------------- |
| `@enumeratio/graphics`   | graphics objects, frames, `Image`, `Rasterize`, projection |
| `@enumeratio/document`   | `Cell`, `In`, `Out`, the reactive core, worksheet model    |
| `@enumeratio/components` | web components only — views over the two above             |
| `@enumeratio/raster`     | unchanged: the native rasterizer                           |

The test for whether that split is right is whether the CLI can use `graphics` and
`document` without pulling in a DOM, and whether `elements` shrinks to views. If either
fails, the seam is in the wrong place.

### Sequencing

Layout should follow the fork in §2, not lead it. Moving files first would only relocate
the current shape. The order that seems right:

1. Make graphics values (§3) inside `elements`, where the consumer already is.
2. Let the worksheet composite _those_ rather than named renderers — at which point
   `space.ts`, the stacking and the inference stop touching the DOM at all.
3. Extract, once the seam is visible rather than guessed at.

## 6. Smaller things this turned up

- `Auto` currently resolves to fixed per-projection defaults. An automatic framing
  computed from what is actually drawn is the natural home for the "backed by an
  expression" idea — the auto rule becomes a default binding you can read and override.
- Slider ranges are a guess with editable endpoints. Same story: `Auto` proper wants to
  know something about the expression.
- A live GPU field wants to stay a canvas, not become a snapshot. Whatever `Image` grows
  into, "render this expression continuously" and "here is a picture" should not collapse
  into each other.
