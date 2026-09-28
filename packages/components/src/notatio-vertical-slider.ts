import { NotatioSlider } from "./notatio-slider.ts";
import { defineControl } from "./define.ts";

/**
 * `<VerticalSlider name="k" min="0" max="1">` -- Wolfram's `VerticalSlider`: a
 * `<Slider>` standing up, with up/down as its arrows. Everything else -- range,
 * gears, `readout`, `play`, `loop` -- is the slider's.
 */
export class NotatioVerticalSlider extends NotatioSlider {
  constructor() {
    super();
    this.axis = "y";
  }
}

defineControl("notatio-vertical-slider", NotatioVerticalSlider);
