// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal, ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";
import { airyBig, besselKYBig, expIntegralEiBig, logIntegralBig } from "../src/special-big.ts";

// Each value against mpmath (mp.dps = 80, arguments as exact decimals). 45 digits are compared: the
// last few carry the guard.

const COMPARED = 45;
const d = (x: string | number) => new BigDecimal(x);
const at = <T>(digits: number, fn: () => T): T => {
  const saved = BigDecimal.precision;
  BigDecimal.precision = digits;
  try {
    return fn();
  } finally {
    BigDecimal.precision = saved;
  }
};
const agrees = (ours: BigDecimal | undefined, expected: string): void => {
  expect(ours?.toPrecision(COMPARED).toString()).toBe(d(expected).toPrecision(COMPARED).toString());
};

test("AiryAi and AiryBi: either side of 0, and where the series cancels", () => {
  at(70, () => {
    agrees(airyBig("Ai", d(2), 50), "0.0349241304232743791353220807918076097610602138975832071886699");
    agrees(airyBig("Bi", d(2), 50), "3.29809499997821471028060442522345242200397596340362078768292");
    agrees(airyBig("Ai", d("-3.5"), 50), "-0.375533823140431911934396951580170239543268576378264063902563");
    agrees(airyBig("Bi", d("-3.5"), 50), "0.168939837481058611843442769540943269911562243926304070915824");
    agrees(airyBig("Ai", d(20), 50), "1.69167286867054031355356021250935132237001809255761409461027e-27");
  });
});

test("ExpIntegralEi and LogIntegral", () => {
  at(70, () => {
    agrees(expIntegralEiBig(d(2), 50), "4.9542343560018901633795051302270352755180535624200420545271");
    agrees(expIntegralEiBig(d("-2.5"), 50), "-0.0249149178702697354956280122746096359458483847114273770119345");
    agrees(logIntegralBig(d(2), 50), "1.04516378011749278484458888919461313652261557815120157583291");
    agrees(logIntegralBig(d("0.3"), 50), "-0.157414902894689477246345474186445446827553365926573621415841");
    expect(logIntegralBig(d(1), 50)).toBeUndefined();
    expect(expIntegralEiBig(d(0), 50)).toBeUndefined();
  });
});

test("LogIntegral near 1 and near its zero, where ln x is the weak link", () => {
  at(90, () => {
    agrees(logIntegralBig(d("1.0000000000001"), 50), "-29.356390544021011031627376821230998934438812794012");
    agrees(logIntegralBig(d("1.4"), 50), "-0.1449910047903065638201169133225021882717998829452");
    agrees(
      logIntegralBig(d("1.45136923488338105028396848589202744949303228364"), 50),
      "-2.15186674439324278237935765187949422095460384813211389336599e-47",
    );
  });
});

test("a call the kernel declines is native's, as it was", () => {
  const ce = new ComputeEngine();
  declareAnalytic(ce);
  const at50 = (expr: unknown): unknown => ce.box(["N", expr, 50] as never).evaluate().json;
  const native = new ComputeEngine();
  for (const call of [
    ["ExpIntegralEi", 0],
    ["LogIntegral", 1],
    ["LogIntegral", 0],
    ["LogIntegral", -2],
    ["AiryAi", 150],
    ["ExpIntegralEi", -1000],
    ["BesselK", 300, 2],
    ["BesselY", 0, -1],
  ])
    expect(at50(call), JSON.stringify(call)).toEqual(native.box(["N", call, 50] as never).evaluate().json);
});

test("BesselK and BesselY of integer order", () => {
  at(70, () => {
    agrees(besselKYBig("K", 0, d(4), 50), "0.0111596760858530242697451959798334892250090238884743405382553");
    agrees(besselKYBig("Y", 0, d(1), 50), "0.0882569642156769579829267660235151628278175230906755467110438");
    agrees(besselKYBig("K", 2, d("0.7"), 50), "3.6613299608091528385402696981650674146983113168059259925632");
    agrees(besselKYBig("Y", 3, d("2.5"), 50), "-0.756055496753670996837902977229297969826797597217828206922965");
    agrees(besselKYBig("Y", -3, d("2.5"), 50), "0.756055496753670996837902977229297969826797597217828206922965");
    expect(besselKYBig("K", 0, d(-1), 50)).toBeUndefined();
    expect(besselKYBig("K", 1.5, d(1), 50)).toBeUndefined();
  });
});

test("heavy cancellation gets its digits or declines, never noise", () => {
  at(90, () => {
    // K_0(300) = 3.7e-132 against terms of 1e130; Ei(-300) and Bi(-100) likewise.
    agrees(besselKYBig("K", 0, d(300), 50), "3.72369485488914326325221016776093700221284398710116415479342e-132");
    agrees(besselKYBig("Y", 5, d(300), 50), "0.0319459040298030229228769940259816372757317984758033892121756");
    agrees(expIntegralEiBig(d(-300), 50), "-1.7103842768045101157188773714693906847997891642764234154043e-133");
    agrees(airyBig("Bi", d(-100), 50), "0.0242738876801601316056674728863468350042750497472819055739495");
    // More digits would be lost than a kernel carries.
    expect(besselKYBig("K", 0, d(1000), 50)).toBeUndefined();
    expect(airyBig("Ai", d(150), 50)).toBeUndefined();
  });
});

test("N(f, 50) reaches them through the heads", () => {
  const ce = new ComputeEngine();
  declareAnalytic(ce);
  const digits = (expr: unknown): string =>
    (ce.box(["N", expr, 50] as never).evaluate().json as unknown as { num: string }).num;
  expect(digits(["AiryAi", 2]).startsWith("0.03492413042327437913532208079180760976106021389758")).toBe(true);
  expect(digits(["BesselK", 0, 4]).startsWith("0.011159676085853024269745195979833489225009023888")).toBe(true);
  expect(digits(["BesselY", 0, 1]).startsWith("0.088256964215676957982926766023515162827817523090")).toBe(true);
  expect(digits(["ExpIntegralEi", 2]).startsWith("4.9542343560018901633795051302270352755180535624")).toBe(true);
  expect(digits(["LogIntegral", 2]).startsWith("1.0451637801174927848445888891946131365226155781")).toBe(true);
});
