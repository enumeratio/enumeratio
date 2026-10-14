# Reads JSON [[z, s, a], ...] on stdin; prints JSON of the true |Im|/|Re| of the principal-value
# Lerch sum  sum z^n (n+a)^(-s)  (the shader's definition), computed in mpmath at 20 digits.
import sys, json
from mpmath import mp, mpf, mpc, power, fabs

mp.dps = 20
out = []
for z, s, a in json.load(sys.stdin):
    z, s, a = mpf(z), mpf(s), mpf(a)
    tot = mpc(0)
    zp = mpf(1)
    n = 0
    while True:
        b = a + n
        if b != 0:
            tot += zp * power(mpc(b), -s)
        zp *= z
        n += 1
        if fabs(zp) < mpf(10) ** -18 or n > 20000:
            break
    out.append(float(fabs(tot.imag) / fabs(tot.real)) if tot.real != 0 else float("inf"))
json.dump(out, sys.stdout)
