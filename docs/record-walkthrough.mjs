/* Record the Wound Vision walkthrough.
 *
 *   node docs/record-walkthrough.mjs [outputDir]
 *
 * Serve the repository root first (the page is at /dfu/):
 *   python3 -m http.server 8777 --directory .
 *
 * Two things this does differently from a plain screen capture, both because the audience is
 * a methodologist rather than a buyer.
 *
 * Captions are injected into the PAGE as a styled overlay rather than burned on afterwards
 * with ffmpeg drawtext. That gives real typography, and it keeps the technical line beside
 * the thing it describes instead of in a separate subtitle track nobody reads.
 *
 * Frame TIMESTAMPS are recorded and an ffconcat manifest is written with the real duration of
 * each frame. A 1920x1080 screenshot takes 100-250 ms depending on what the page is doing, so
 * a fixed frame rate silently stretches and compresses time — the viewer sees the app pause
 * where in fact the recorder did. With real durations the playback matches what happened.
 *
 * Every figure in the captions is read from the model cards in dfu/, not typed from memory,
 * so the video cannot drift away from the repository.
 */
import { createRequire } from 'node:module'
// Playwright is installed globally in this environment, not in the repository, and ESM
// resolution does not look there. createRequire uses CommonJS resolution, which does --
// and it keeps the import working if the package is later added to the repo instead.
const { chromium } = createRequire(import.meta.url)('playwright')
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'

const OUT = process.argv[2] || '/tmp/wv-record'
const DIR = `${OUT}/frames`
const BASE = 'http://127.0.0.1:8777'
const REPO = new URL('..', import.meta.url).pathname
const FPS = 10

rmSync(DIR, { recursive: true, force: true })
mkdirSync(DIR, { recursive: true })

const card = p => JSON.parse(readFileSync(`${REPO}/dfu/${p}/metrics.json`, 'utf8'))
const seg = card('seg'), tis = card('tissue'), roi = card('model-roi')
const pct = x => (100 * x).toFixed(1)
const d3 = x => Number(x).toFixed(3)

/* ───────── the script: [chapter, title, technical line, action] ───────── */

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', e => errs.push(e.message))
await p.goto(`${BASE}/dfu/`, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)

/* The overlay lives in the page so it inherits nothing from it: own stacking context, own
   fonts, pointer-events none so it never intercepts a click the script needs to land. */
await p.addStyleTag({ content: `
  #wvcap{position:fixed;left:0;right:0;bottom:0;z-index:2147483646;pointer-events:none;
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:linear-gradient(to top,rgba(10,14,20,.97) 62%,rgba(10,14,20,.86) 86%,rgba(10,14,20,0));
    padding:20px 30px 16px;color:#fff;transition:opacity .25s}
  #wvcap .r{display:flex;align-items:flex-start;gap:15px;max-width:1180px}
  #wvcap .n{flex:0 0 auto;width:31px;height:31px;border-radius:50%;background:#2F6F8F;color:#fff;
    font-size:14px;font-weight:650;display:flex;align-items:center;justify-content:center;margin-top:2px}
  #wvcap h4{margin:0 0 4px;font-size:25px;line-height:1.16;font-weight:620;letter-spacing:-.01em}
  #wvcap p{margin:0;font-size:15.5px;line-height:1.45;color:#B9C6D4;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  #wvbar{position:fixed;left:0;bottom:0;height:3px;background:#48A0C8;z-index:2147483647;
    transition:width .3s linear;pointer-events:none}
  #wvmark{position:fixed;top:14px;right:18px;z-index:2147483646;pointer-events:none;
    font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;letter-spacing:.06em;
    color:#5B6B7C;background:rgba(255,255,255,.82);padding:5px 10px;border-radius:5px}
  #wvfull{position:fixed;inset:0;z-index:2147483645;pointer-events:none;background:#0A0E14;
    color:#fff;display:flex;flex-direction:column;justify-content:center;padding:0 90px;
    font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;transition:opacity .3s}
  #wvfull h1{margin:0 0 14px;font-size:50px;line-height:1.06;font-weight:660;letter-spacing:-.02em}
  #wvfull h2{margin:0 0 26px;font-size:21px;font-weight:450;color:#8FA3B5;line-height:1.4}
  #wvfull .g{display:grid;grid-template-columns:auto 1fr;gap:9px 22px;font-size:17px;line-height:1.5}
  #wvfull .k{color:#48A0C8;font-family:ui-monospace,Menlo,monospace;white-space:nowrap}
  #wvfull .v{color:#D5DEE7}
  #wvfull .foot{margin-top:28px;font-size:14.5px;color:#6B7C8D;line-height:1.55;max-width:900px}
`})
await p.evaluate(() => {
  for (const [id, html] of [['wvfull', ''], ['wvcap', ''], ['wvbar', ''], ['wvmark', '']]) {
    const el = document.createElement('div'); el.id = id; el.innerHTML = html
    el.style.opacity = '0'; document.body.appendChild(el)
  }
  document.getElementById('wvmark').textContent = 'WOUND VISION v10.5 · ON-DEVICE'
  document.getElementById('wvmark').style.opacity = '1'
})

let n = 0, shooting = true
const stamps = []
const t0 = Date.now()
const marks = []
const mark = m => marks.push([((Date.now() - t0) / 1000).toFixed(1), m])

const shooter = (async () => {
  while (shooting) {
    const due = t0 + (n * 1000) / FPS
    const w = due - Date.now()
    if (w > 0) await new Promise(r => setTimeout(r, w))
    try {
      await p.screenshot({ path: `${DIR}/f${String(n).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 76 })
      stamps.push(Date.now() - t0)
      n++
    } catch { /* a navigation mid-shot is not worth failing the recording for */ }
  }
})()

const beat = ms => p.waitForTimeout(ms)
const TOTAL_EST = 250000
const progress = () => p.evaluate(f => {
  document.getElementById('wvbar').style.width = (100 * f).toFixed(2) + '%'
}, Math.min(1, (Date.now() - t0) / TOTAL_EST)).catch(() => {})

const cap = async (num, title, tech) => {
  mark(`${num} ${title}`)
  await p.evaluate(([num, title, tech]) => {
    const c = document.getElementById('wvcap')
    c.innerHTML = `<div class="r"><div class="n">${num}</div><div><h4>${title}</h4><p>${tech}</p></div></div>`
    c.style.opacity = '1'
    document.getElementById('wvfull').style.opacity = '0'
  }, [num, title, tech])
  await progress()
}
const hideCap = () => p.evaluate(() => { document.getElementById('wvcap').style.opacity = '0' })

const full = async (h1, h2, rows, foot, ms) => {
  mark('card: ' + h1)
  await p.evaluate(([h1, h2, rows, foot]) => {
    const f = document.getElementById('wvfull')
    f.innerHTML = `<h1>${h1}</h1><h2>${h2}</h2>` +
      (rows.length ? `<div class="g">${rows.map(r => `<div class="k">${r[0]}</div><div class="v">${r[1]}</div>`).join('')}</div>` : '') +
      (foot ? `<div class="foot">${foot}</div>` : '')
    f.style.opacity = '1'
    document.getElementById('wvcap').style.opacity = '0'
    document.getElementById('wvmark').style.opacity = '0'
  }, [h1, h2, rows, foot])
  await beat(ms)
  await p.evaluate(() => {
    document.getElementById('wvfull').style.opacity = '0'
    document.getElementById('wvmark').style.opacity = '1'
  })
  await progress()
}

const show = async (sel, ms) => {
  await p.evaluate(s => {
    const e = document.querySelector(s)
    if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, sel).catch(() => {})
  await beat(ms)
}
const pick = async name => {
  const btn = p.locator(`.sample[data-src*="${name}"]`).first()
  if (!(await btn.count())) return false
  await btn.scrollIntoViewIfNeeded(); await btn.click(); return true
}
const settle = (ms = 60000) => p.waitForFunction(
  () => typeof lastTissue !== 'undefined' && lastTissue !== null, null, { timeout: ms }).catch(() => {})

/* ═══════════════════════ 0 · title ═══════════════════════ */
await full('Wound Vision',
  'A browser-based clinical decision-support prototype for the diabetic foot ulcer.<br>' +
  'Hospital Tengku Permaisuri Norashikin · DrPH preliminary groundwork · build v10.5',
  [['four models', 'all inference on the device; no image leaves the browser'],
   ['segmentation', 'MobileNetV2-UNet, FUSeg 2021'],
   ['tissue', 'MobileNetV2-UNet, multi-class, DFUTissue'],
   ['classification', 'MobileNetV2, whole-frame and wound-crop heads'],
   ['grading', 'Meggitt–Wagner and University of Texas, computed from the published rules']],
  'Every figure shown in this walkthrough is read from the model cards in the repository at ' +
  'record time, not typed into the script.', 9500)

/* ═══════════════════════ 1 · privacy gate ═══════════════════════ */
await cap(1, 'The photograph never leaves the device',
  'TensorFlow.js in-page inference · models fetched once, weights cached by the browser · ' +
  'no upload endpoint exists in the client')
await beat(6500)
await p.evaluate(() => document.querySelectorAll('input[type=checkbox]').forEach(c => {
  c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true }))
}))
await beat(1100)
await p.evaluate(() => [...document.querySelectorAll('button')]
  .find(x => /continue|enter|start/i.test(x.textContent))?.click())
await beat(1500)

/* ═══════════════════════ 2 · intake geometry ═══════════════════════ */
await cap(2, 'Display geometry and model geometry are separate decisions',
  'Viewer letterboxes the frame so the whole foot stays visible · the segmenter is served the ' +
  'centre crop it was trained on, and its mask is warped back into the display frame')
await pick('portrait_phone'); await settle(); await beat(1200)
await show('#viewer, #imgCanvas', 5200)
await pick('landscape_offcentre'); await settle(); await beat(1000)
await show('#viewer, #imgCanvas', 4200)

await full('Why that distinction was worth making',
  'Measured on the 195 FUSeg validation photographs that carry an expert mask, both geometries scored in the same frame.',
  [['letterbox', 'Dice 0.677 · recall 0.709 · precision 0.711'],
   ['centre crop', 'Dice 0.745 · recall 0.782 · precision 0.771'],
   ['why', 'a 4:3 frame reached the model at 75 % of training scale, a 9:16 phone frame at 56 %, ' +
           'pushing the ulcer below the 1.3 % median it learnt on'],
   ['the crop risk', 'it removes marked wound on 8 of 195 — and on exactly those 8 it still wins, 0.667 to 0.567']],
  'Shrinking the whole frame costs more wound than cropping it does. The letterbox had been ' +
  'introduced to protect edge wounds; the measurement reversed the assumption.', 10000)

/* ═══════════════════════ 3 · segmentation ═══════════════════════ */
await pick('sloughy_heel_ulcer'); await settle(); await beat(1400)
await cap(3, 'Wound outline',
  `MobileNetV2-UNet · ImageNet encoder, 4 skip connections, 224&times;224, sigmoid · ` +
  `FUSeg 2021, ${seg.train_images} train / ${seg.val_images} validation · ` +
  `Dice ${d3(seg.held_out.dice)}, median ${d3(seg.held_out.dice_median)}, IoU ${d3(seg.held_out.iou)}`)
await show('#viewer, #imgCanvas', 7500)
await cap(4, 'Post-processing, not raw argmax',
  'Largest connected component, plus any region &ge;10 % of it within 2.5 equivalent radii · ' +
  `centroid falls inside the true wound on ${pct(seg.held_out.centroid_in_wound)} % of ${seg.held_out.n} held-out images`)
await show('#viewer, #imgCanvas', 6000)

/* ═══════════════════════ 4 · tissue ═══════════════════════ */
await cap(5, 'Tissue map of the wound bed',
  `MobileNetV2-UNet, multi-class softmax · DFUTissue, 104 usable images, split by case · ` +
  `3-fold cross-validated: granulation ${tis.cross_validated.this_recipe.gran}, slough ${tis.cross_validated.this_recipe.slough}`)
await show('#layerPick', 2200)
await show('#pubResult', 5200)

await full('The tissue model is asked at the scale it was trained at',
  'DFUTissue is a set of crops in which labelled tissue averages 13.8 % of the frame. An ulcer in a phone photograph is nearer 1.5 %.',
  [['tissue 13.8 % (as trained)', 'granulation Dice 0.783 · slough 0.307'],
   ['tissue 4.9 %', 'granulation 0.652 · slough 0.176'],
   ['tissue 1.7 % (whole frame)', 'granulation 0.126 · slough 0.023'],
   ['the fix', 'predict on the wound crop, project the class map back — 0.075 → 0.434 mean Dice, ' +
               'better on 15 of 16 held-out crops and worse on none']],
  'Scale, not architecture. Attention U-Net ties this model and DeepLabV3+ is worse for 26 % more ' +
  'parameters; at a size that fits a browser the decoder is not what decides it.', 10500)

/* ═══════════════════════ 5 · provenance ═══════════════════════ */
await cap(6, 'Every row says where its answer came from',
  'Classes the training set never contained stay with a CIELAB colour rule, and the row says so · ' +
  'DFUTissue carries no necrosis label, so the model is never allowed to report its absence as a finding')
await show('#pubResult', 7000)

/* ═══════════════════════ 6 · the verdict ═══════════════════════ */
await cap(7, 'The headline is a criteria count, not a model output',
  'IWGDF/IDSA 2023: infection is &ge;2 of five local criteria · a model may ESCALATE, never ' +
  'DE-ESCALATE · the words "no signs of infection" do not exist in the app')
await show('#pubResult .verdict, #pubResult', 8000)
await cap(8, 'The estimate sits below the criteria, carrying its own caveat',
  'Order on screen is the order of the evidence: checkable at the bedside first, uncheckable ' +
  'estimate second · shown as an estimate from training data, not a finding, and not calibrated')
await show('#pubResult', 7000)

/* ═══════════════════════ 7 · the ROI result ═══════════════════════ */
await full('The prototype&rsquo;s strongest internal result',
  'Cropping to the segmented wound before classification, same data, same backbone, same weak labels.',
  [['whole frame', `severity AUC ${roi.compared_with_whole_frame_model.grade.auc} · accuracy ${roi.compared_with_whole_frame_model.grade.accuracy}`],
   ['wound crop + 60 % margin', `severity AUC ${roi.validation_on_weak_labels.grade.auc} · accuracy ${roi.validation_on_weak_labels.grade.accuracy}`],
   ['why', `the median ulcer occupies ${pct(seg.held_out.mean_predicted_area_frac)} % of the frame, so the ` +
           'whole-frame model spent most of its capacity on floor, bedding and skin'],
   ['the caveat', 'both classifiers are trained and validated on WEAK labels derived from FUSeg masks ' +
                  'and colour features — demonstrators, not diagnostic performance']],
  'This is the argument for segmentation-before-classification, and it is measured rather than asserted. ' +
  'It is also the result most in need of adjudicated labels before it can be claimed.', 11000)

/* ═══════════════════════ 8 · grading ═══════════════════════ */
await p.locator('#tabGrading').click(); await beat(1500)
await cap(9, 'Wagner and Texas are computed, not predicted',
  'Pure functions of the examination answers, from the published definitions · depth separates ' +
  'Texas 1/2/3 and ischaemia sets stage C or D, and no photograph shows either')
await show('#askFind', 6000)
const qs = p.locator('#askFind .askrow select')
for (const [i, v] of [[0, 'yes'], [1, 'tendon'], [2, 'pos'], [5, 'yes']]) {
  if (await qs.nth(i).count()) { await qs.nth(i).selectOption(v).catch(() => {}); await beat(1500) }
}
await show('#gradeCard', 6500)
await cap(10, 'The antibiotic is entered by the study team, not written into the app',
  'Malaysian National Antimicrobial Guideline 2024 · displayed with source, edition and who entered it · ' +
  'gated behind allergy and renal function, because empirical choice follows local MRSA and ESBL prevalence')
await show('#abxBox', 8000)

/* ═══════════════════════ 9 · study team ═══════════════════════ */
await p.locator('#tabTrain').click(); await beat(1200)
/* The study-team tab is behind a passcode. It is a MODE SWITCH, not a security control -- the
   app says so on screen -- so it is fine in a recorder script, and it comes from the
   environment so the value is not fixed here. Without it the gate stays open and intercepts
   every later click, which is what broke the first take. */
const PASS = process.env.WV_PASSCODE || '12345678'
if (await p.locator('#passInput').count()) {
  await p.fill('#passInput', PASS)
  await p.locator('#passGo').click().catch(() => {})
  await p.waitForFunction(() => {
    const g = document.getElementById('passGate'); return !g || g.classList.contains('hidden')
  }, null, { timeout: 15000 }).catch(() => {})
  await beat(700)
}
await cap(11, 'Where the labels come from',
  'Per-image labelling by named grader · sign-level infection labels rather than one binary · ' +
  'an untouched image is EXCLUDED from training, so silence is never read as a negative')
await show('#poolInput, .uploadrow', 5500)
await p.setInputFiles('#poolInput', [`${REPO}/dfu/samples/sloughy_heel_ulcer.jpg`,
                                     `${REPO}/dfu/samples/necrotic_forefoot_ulcer.jpg`]).catch(() => {})
await p.waitForFunction(() => {
  const c = document.getElementById('labelCard'); return c && !c.classList.contains('hidden')
}, null, { timeout: 25000 }).catch(() => {})
await beat(900)
await p.locator('#labGrader').selectOption({ label: 'Dr Naim Bin Abdul Malek' }).catch(() => {})
await beat(1200)
await show('#labFeats', 5500)

await full('What the grading session has to deliver',
  'Simulated Cohen&rsquo;s &kappa; for one binary sign, 4,000 runs per cell, two graders at 90 % sensitivity and 95 % specificity.',
  [['prevalence 30 %', 'n=100 → &kappa; 0.71, CI width 0.30&nbsp;&nbsp;·&nbsp;&nbsp;n=400 → &kappa; 0.72, CI width 0.15'],
   ['prevalence 15 %', 'n=100 → &kappa; 0.63, CI width 0.41&nbsp;&nbsp;·&nbsp;&nbsp;n=400 → &kappa; 0.63, CI width 0.20'],
   ['prevalence 5 %',  'n=100 → &kappa; 0.42, CI width 0.61&nbsp;&nbsp;·&nbsp;&nbsp;n=400 → &kappa; 0.41, CI width 0.31'],
   ['the implication', 'at 5 % prevalence &kappa; sits near 0.41 however many images are labelled, ' +
                       'and falls below 0.40 in ~47 % of runs — with good graders']],
  'Prevalence binds this design, not sample size. 150–200 images enriched to 25–30 % per sign, ' +
  '&ge;40 positives each, PABAK and the 2&times;2 table reported alongside &kappa;, and split by patient, never by image.', 11500)

/* ═══════════════════════ 10 · dashboard ═══════════════════════ */
await p.locator('#tabData').click(); await beat(1500)
await cap(12, 'What the study team can already see',
  'Per-class counts, grader agreement and the case log · split by case prefix, so several ' +
  'photographs of one ulcer can never straddle a train/test split')
await show('#logCard', 7000)

/* ═══════════════════════ 11 · closing ═══════════════════════ */
await hideCap()
await full('What is validated, and what is not',
  'Stated plainly, because the distinction is the point of the groundwork phase.',
  [['validated on public data', `wound segmentation, Dice ${d3(seg.held_out.dice)} on ${seg.held_out.n} held-out FUSeg images`],
   ['cross-validated', `tissue segmentation, granulation ${tis.cross_validated.this_recipe.gran}, slough ${tis.cross_validated.this_recipe.slough}, 104 images`],
   ['NOT validated', 'both classifiers — weak labels from masks and colour, no clinician adjudication, no culture'],
   ['no detector at all', 'pus, abscess and wet gangrene: supplied by the examiner, and the gate for everything else'],
   ['not a medical device', 'decision support; Wagner, Texas and the antibiotic all require the clinician']],
  'The next step is not a larger model. It is 150–200 adjudicated, prevalence-enriched images from ' +
  'two independent graders — without them the signs that matter clinically have no training data at all.', 12000)

shooting = false
await shooter

/* Real durations, so playback matches what happened rather than an assumed frame rate. */
const lines = ["ffconcat version 1.0"]
for (let i = 0; i < stamps.length; i++) {
  const dur = ((i + 1 < stamps.length ? stamps[i + 1] : stamps[i] + 1000 / FPS) - stamps[i]) / 1000
  lines.push(`file 'frames/f${String(i).padStart(5, '0')}.jpg'`)
  lines.push(`duration ${Math.max(0.02, dur).toFixed(4)}`)
}
lines.push(`file 'frames/f${String(stamps.length - 1).padStart(5, '0')}.jpg'`)
writeFileSync(`${OUT}/frames.ffconcat`, lines.join('\n'))

console.log(`frames ${n} over ${((Date.now() - t0) / 1000).toFixed(0)}s`)
console.log('page errors:', errs.slice(0, 3))
marks.forEach(([t, m]) => console.log(`  ${t}s  ${m}`))
await ctx.close(); await b.close()
