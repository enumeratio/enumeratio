import { BigDecimal } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { barnesGBig } from "../src/barnes-g-big.ts";
import { lerchPhiBig } from "../src/lerch-big.ts";
import { stieltjesGammaBig } from "../src/stieltjes-big.ts";

// The arbitrary-precision kernels behind LerchPhi, PolyLog, BarnesG and StieltjesGamma, each
// against mpmath at 60 digits (mp.dps = 60; decimal arguments given to mpmath as strings, so
// both sides read the same exact decimal). 50 digits are asked for and 45 compared: the last
// few carry the kernel's guard, not a promise.

const DIGITS = 50;
const COMPARED = 45;

const agrees = (ours: BigDecimal | undefined, mpmath: string): void => {
  expect(ours?.toPrecision(COMPARED).toString()).toBe(new BigDecimal(mpmath).toPrecision(COMPARED).toString());
};

const at = <T>(fn: () => T): T => {
  const saved = BigDecimal.precision;
  BigDecimal.precision = 60;
  try {
    return fn();
  } finally {
    BigDecimal.precision = saved;
  }
};

const third = () => BigDecimal.ONE.div(3);

test("LerchPhi: inside the disk, a growing-then-shrinking series, and outside it", () => {
  at(() => {
    agrees(
      lerchPhiBig(new BigDecimal("0.5"), new BigDecimal(2), third(), DIGITS),
      "9.34347465937593951855554965803529326551940732164584772514612",
    );
    // s < 0: the terms grow before the ratio falls below 1; z < 0: they alternate.
    agrees(
      lerchPhiBig(new BigDecimal("-0.9"), new BigDecimal("-1.5"), new BigDecimal("2.5"), DIGITS),
      "1.48424384077360738068777395904571770032725962944458049681027",
    );
    expect(lerchPhiBig(new BigDecimal(2), new BigDecimal(2), BigDecimal.ONE, DIGITS)).toBeUndefined();
  });
});

test("BarnesG: near 1, and reached by the recurrence up and down", () => {
  at(() => {
    agrees(barnesGBig(new BigDecimal("0.5"), DIGITS), "0.603244281209446206191429224534702079883003420389459765387769");
    agrees(barnesGBig(new BigDecimal("7.3"), DIGITS), "204559.791949272870551283619621883605369086814928488982777458");
    agrees(
      barnesGBig(new BigDecimal("-2.7"), DIGITS),
      "0.035749958472220338971192316586847538316024811829979621440619",
    );
    expect(barnesGBig(new BigDecimal(-2), DIGITS)).toBeUndefined();
  });
});

test("StieltjesGamma: the classical constants and a shifted one", () => {
  at(() => {
    agrees(
      stieltjesGammaBig(1, BigDecimal.ONE, DIGITS),
      "-0.0728158454836767248605863758749013191377363383343379525990066",
    );
    agrees(
      stieltjesGammaBig(5, BigDecimal.ONE, DIGITS),
      "0.000793323817301062701753334877444444830731539404584887075734256",
    );
    agrees(stieltjesGammaBig(2, third(), DIGITS), "3.61916390961896362988718221618594170329408335142691980717624");
  });
});
