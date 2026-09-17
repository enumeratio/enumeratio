import { defineControl } from "./controls.ts";
import { NotatioSlider } from "./notatio-slider.ts";

/**
 * `<notatio-vertical-slider name="k" min="0" max="1">` -- Wolfram's `VerticalSlider`: a
 * `<notatio-slider>` standing up, with up/down as its arrows. Everything else -- range,
 * gears, `readout`, `play`, `loop` -- is the slider's.
 */
export class NotatioVerticalSlider extends NotatioSlider {
  constructor() {
    super();
    this.axis = "y";
  }
}

defineControl("notatio-vertical-slider", NotatioVerticalSlider);
