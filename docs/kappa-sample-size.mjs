/* Monte-Carlo precision of Cohen's kappa for ONE binary sign, two graders.
   Planning question: how many images must both graders label before the
   kappa for "pus", "abscess" or "wet gangrene" has a usable confidence
   interval? The binding constraint is PREVALENCE, not n: a sign present in
   5% of images contributes almost no information per image. */
function kappa(a, b) {                       // a, b: arrays of 0/1
  const n = a.length
  let n11 = 0, n00 = 0, n10 = 0, n01 = 0
  for (let i = 0; i < n; i++) {
    if (a[i] && b[i]) n11++; else if (!a[i] && !b[i]) n00++
    else if (a[i] && !b[i]) n10++; else n01++
  }
  const po = (n11 + n00) / n
  const pa1 = (n11 + n10) / n, pb1 = (n11 + n01) / n
  const pe = pa1 * pb1 + (1 - pa1) * (1 - pb1)
  return pe === 1 ? NaN : (po - pe) / (1 - pe)
}
/* Two graders, each with sensitivity se and specificity sp against a latent
   truth with prevalence p, erring independently. */
function trial(n, p, se, sp) {
  const a = [], b = []
  for (let i = 0; i < n; i++) {
    const truth = Math.random() < p
    const r = () => truth ? (Math.random() < se ? 1 : 0) : (Math.random() < 1 - sp ? 1 : 0)
    a.push(r()); b.push(r())
  }
  return kappa(a, b)
}
const SIMS = 4000
console.log('prevalence  n     median κ   95% CI width   P(κ undefined or <0.4)')
for (const p of [0.30, 0.15, 0.05]) {
  for (const n of [50, 100, 200, 400]) {
    const ks = []
    let bad = 0
    for (let s = 0; s < SIMS; s++) {
      const k = trial(n, p, 0.90, 0.95)
      if (!Number.isFinite(k)) { bad++; continue }
      ks.push(k); if (k < 0.4) bad++
    }
    ks.sort((x, y) => x - y)
    const q = f => ks[Math.floor(f * ks.length)]
    console.log(
      String(p).padEnd(11), String(n).padEnd(6),
      q(0.5).toFixed(2).padEnd(10),
      (q(0.975) - q(0.025)).toFixed(2).padEnd(14),
      (100 * bad / SIMS).toFixed(0) + '%')
  }
}
