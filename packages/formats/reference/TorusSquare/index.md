---
name: TorusSquare
domain: Graphics
signature: TorusSquare(p, q)
summary: The torus as a square with its opposite edges glued, and the torus knot T(p, q) on it as a straight line of slope q/p; held inert and drawn as a diagram `GraphicsBox`.
signatures:
  - call: TorusSquare(p, q)
    description: held inert; drawn as the glued square with T(p, q) on it, two dials counting the windings, and a point that travels on the page's clock
    library: enumeratio-formats
    type: (any*) -> any
---

- `Phase -> 0.32` pins the point to a phase in `[0, 1)`; `Clock -> False` leaves it off the clock.
- `Dials -> False` drops the two circle factors beside the square.
- `ColorFunction -> "set1"` names the discrete scheme whose first two colors mark the two circles.
- It has no Wolfram counterpart: Wolfram draws a torus knot in space (`KnotData`), not on the glued square.
