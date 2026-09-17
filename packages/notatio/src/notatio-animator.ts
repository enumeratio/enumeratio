import { defineControl } from "./controls.ts";
import { NotatioSlider } from "./notatio-slider.ts";

/**
 * `<notatio-animator name="t" min="0" max="6.28" step="0.05">` -- Wolfram's `Animator`:
 * a `<notatio-slider>` that plays. The play button and the readout are on by default
 * and the sweep cycles unless told otherwise -- an animator's job is to run, not to
 * stop at the end. Hold the button for the speed and loop.
 */
export class NotatioAnimator extends NotatioSlider {
  constructor() {
    super();
    this.play = true;
    this.readout = true;
    this.loop = "cycle";
  }
}

defineControl("notatio-animator", NotatioAnimator);
