/* Run the real app over a folder of images and write one CSV row per image.
 *
 *   python3 -m http.server 8777 --directory dfu          # or --directory . for /dfu/
 *   node docs/batch-predict.mjs <imageDir> [options]
 *
 *   --out <file>        where to write the CSV        (default predictions.csv)
 *   --base <url>        app to drive                  (default http://127.0.0.1:8777)
 *   --scales <file>     CSV of image,px_per_cm        (optional, see SCALE below)
 *   --limit <n>         stop after n images           (for a trial run)
 *
 *
 * WHY THIS DRIVES THE BROWSER INSTEAD OF CALLING THE MODELS DIRECTLY
 * ─────────────────────────────────────────────────────────────────
 * The obvious implementation is a Python script that loads the Keras weights and runs them.
 * It would be faster and it would be measuring the wrong thing. What a clinician sees is not
 * the classifier output: it is the output after letterbox-vs-crop geometry, the ROI box with
 * its 60 % margin, four-view test-time augmentation, the abstention threshold, the tissue
 * model with the colour rule filling in classes it was never trained on, and the CIELAB
 * erythema measurement with its distance transform and contiguity search. Almost none of that
 * lives in the weights. A second implementation would drift from the first, and the
 * comparison would then be against a system no one is using.
 *
 * So this loads the deployed page and reads the app's own state after each image. Same code,
 * same numbers, by construction.
 *
 *
 * THE GRADERS MUST NOT HAVE SEEN THIS
 * ───────────────────────────────────
 * This is the second half of a blind design. Step B in the app deliberately does not run the
 * models while a grader labels, because a grader who can see the app's answer is being
 * measured for anchoring, not agreement. The predictions are produced here, afterwards, and
 * joined to the labels by docs/join-labels.mjs. Run this AFTER labelling is finished, never
 * before, and never on a machine a grader is using.
 *
 *
 * SCALE
 * ─────
 * Erythema extent is the one criterion the app measures, and it is a DISTANCE, so it needs a
 * pixels-per-centimetre scale that normally comes from the clinician tapping a ruler. That
 * cannot be automated from an image alone.
 *
 * Without --scales, every row reports ery_state = "needs-scale" and ery_cm empty. That is an
 * honest blank, not a zero, and it means the app's only continuous measurement is missing from
 * the comparison. If the study photographs include a ruler, measure px_per_cm once per image
 * (or once per capture protocol, if the distance is fixed) and pass them in:
 *
 *     image,px_per_cm
 *     P014_v1.jpg,38.2
 *     P015_v1.jpg,41.0
 *
 * A single protocol-wide value can be given as  *,38.2  as the only row.
 */
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'

const args = process.argv.slice(2)
const flag = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt }
const DIR = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'))
const OUT = flag('out', 'predictions.csv')
const BASE = flag('base', 'http://127.0.0.1:8777').replace(/\/$/, '')
const SCALES = flag('scales', null)
const LIMIT = +flag('limit', 0) || 0

if (!DIR || !existsSync(DIR)) {
  console.error('\n  usage: node docs/batch-predict.mjs <imageDir> [--out f] [--base url] [--scales f] [--limit n]\n')
  process.exit(2)
}

const IMG_RE = /\.(jpe?g|png|webp|bmp)$/i
const images = readdirSync(DIR).filter(f => IMG_RE.test(f)).sort()
if (!images.length) { console.error(`  no images in ${DIR}`); process.exit(2) }

/* px-per-cm per image, or one wildcard row for a fixed capture protocol. */
const scales = {}
if (SCALES) {
  for (const line of readFileSync(SCALES, 'utf8').split(/\r?\n/).slice(1)) {
    const [img, px] = line.split(',').map(x => (x || '').trim())
    if (img && px) scales[img] = +px
  }
}
const scaleFor = name => scales[name] ?? scales['*'] ?? null

/* The CSV columns match the app's own case-log schema, so a joined file imports straight back
   into the Dashboard without renaming anything. */
const COLS = ['image', 'when', 'app_build', 'model', 'model_sha', 'ai_label',
              'p_severe', 'p_infection', 'probs', 'wound_area_frac', 'roi_source_px',
              'seg_found', 'tissue_src', 'frac_gran', 'frac_slough', 'frac_necro',
              'ery_state', 'ery_cm', 'ery_censored', 'px_per_cm',
              'criteria_count', 'verdict', 'inference_ms', 'note']

const csvCell = v => {
  const t = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
}

const main = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 560, height: 1400 } })
  const errs = []
  page.on('pageerror', e => errs.push(e.message))

  let APP = `${BASE}/dfu/`
  try { if (!(await fetch(APP)).ok) APP = `${BASE}/` } catch { APP = `${BASE}/` }
  console.log(`\n  app    : ${APP}\n  images : ${images.length} in ${resolve(DIR)}`)
  console.log(`  scales : ${SCALES ? SCALES : 'none — ery_cm will be blank for every row'}\n`)

  await page.goto(`${APP}?arm=dfu`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  for (const id of ['#ack1', '#ack2']) { const el = await page.$(id); if (el) await page.check(id) }
  await page.waitForSelector('#enter:not([disabled])', { timeout: 20000 })
  await page.click('#enter')
  await page.waitForFunction(() => typeof segModel !== 'undefined' && segModel, null, { timeout: 180000 })

  const build = await page.evaluate(`typeof BUILD !== 'undefined' ? BUILD : ''`)
  const sha = await page.evaluate(
    `(() => { try { const c = CARDS['Wound-crop model'] || CARDS['Whole-photo model'] || {};
                    return c.weights_sha256 || '' } catch (e) { return '' } })()`)
  console.log(`  build  : ${build}\n  model  : ${sha.slice(0, 16)}\n`)

  const rows = []
  const list = LIMIT ? images.slice(0, LIMIT) : images

  for (let i = 0; i < list.length; i++) {
    const name = list[i]
    const px = scaleFor(name)
    let note = ''
    try {
      /* Capture the app's own prediction object before the click so the wait below can tell a
         finished inference from a stale one. A fixed sleep here would silently record the
         PREVIOUS image's result against this image's filename, which is the worst possible
         failure for a file whose whole purpose is to be joined on filename. */
      await page.evaluate('window.__bpPrev = (typeof lastPred === "undefined" ? null : lastPred)')
      await page.setInputFiles('#fileInput', join(DIR, name))

      const ok = await page.waitForFunction(
        `typeof lastPred !== 'undefined' && lastPred && lastPred !== window.__bpPrev
         && typeof lastTissue !== 'undefined' && lastTissue !== null`,
        null, { timeout: 120000 }).then(() => true).catch(() => false)
      if (!ok) { note = 'inference did not finish within 120 s'; rows.push({ image: name, note }); continue }

      /* Apply the scale, then re-run the tissue pass so the erythema distance is measured
         rather than left unmeasurable. This is the same path the ruler button takes. */
      if (px) {
        await page.evaluate(`(async () => { pxPerCm = ${px};
          lastTissue = await tissueMap(lastSeg); renderTissue(lastTissue);
          renderLayerPick(); renderPublic(); })()`)
        await page.waitForTimeout(700)
      }

      const rec = await page.evaluate(`(() => {
        const t = lastTissue || {}, p = lastPred || {}
        const v = document.querySelector('#pubResult .verdict')
        const basis = v ? (v.querySelector('span') || {}).innerText || '' : ''
        const m = basis.match(/(\\d+) of the 5 IWGDF criteria/)
        return {
          when: new Date().toISOString(),
          model: (typeof active !== 'undefined' && active && active.name) || '',
          ai_label: p.infection ? (p.infection[1] >= 0.5 ? 'suspected' : 'none') : '',
          p_severe: p.grade ? p.grade[1] : null,
          p_infection: p.infection ? p.infection[1] : null,
          probs: p.probs ? p.probs.map(x => x.toFixed(4)).join(';') : '',
          wound_area_frac: (typeof lastSeg !== 'undefined' && lastSeg) ? lastSeg.areaFrac ?? null : null,
          roi_source_px: (typeof lastBox !== 'undefined' && lastBox) ? Math.round(lastBox.s) : null,
          seg_found: (typeof lastSeg !== 'undefined' && lastSeg) ? !!lastSeg.found : false,
          tissue_src: t.src || '',
          frac_gran: t.frac ? t.frac.gran : null,
          frac_slough: t.frac ? t.frac.slough : null,
          frac_necro: t.frac ? t.frac.necro : null,
          ery_state: t.eryState || '',
          /* A distance is only reported when the app would report one. eryState is
             'unmeasurable' when too few ring cells survived the skin test, and in that state
             the app's row reads "Not assessed" -- but extentCm is still computed and non-null
             underneath. Copying it into the CSV would hand an analyst a number the app itself
             declines to show, and it would be averaged as a measurement. Blank means "the app
             could not measure this", which is the truth. */
          ery_cm: (t.eryState === 'unmeasurable' || t.extentCm === null || t.extentCm === undefined)
                  ? null : +t.extentCm.toFixed(3),
          ery_censored: t.extentCensored === undefined ? null : !!t.extentCensored,
          px_per_cm: typeof pxPerCm === 'number' ? Math.round(pxPerCm) : null,
          criteria_count: m ? +m[1] : null,
          verdict: v ? ((v.querySelector('b') || {}).innerText || '') : '',
          inference_ms: p.ms === undefined ? null : Math.round(p.ms)
        }
      })()`)

      rows.push({ image: name, app_build: build, model_sha: sha, ...rec, note })
      const est = rec.p_infection === null ? 'abstained/none' : (rec.p_infection * 100).toFixed(0) + ' %'
      console.log(`  [${String(i + 1).padStart(3)}/${list.length}] ${name.padEnd(34)} ${rec.verdict.padEnd(28)} ${est}`
                  + (rec.ery_cm !== null ? `  ery ${rec.ery_cm} cm` : ''))
    } catch (e) {
      rows.push({ image: name, note: 'error: ' + e.message })
      console.log(`  [${String(i + 1).padStart(3)}/${list.length}] ${name.padEnd(34)} ERROR ${e.message}`)
    }
  }

  const csv = [COLS.join(',')].concat(
    rows.map(r => COLS.map(c => csvCell(r[c])).join(','))).join('\n') + '\n'
  writeFileSync(OUT, csv)

  const done = rows.filter(r => !r.note).length
  const withEry = rows.filter(r => r.ery_cm !== null && r.ery_cm !== undefined).length
  console.log(`\n  wrote ${OUT}`)
  console.log(`  ${done} of ${rows.length} images produced a prediction`)
  console.log(`  ${withEry} carry an erythema distance`
              + (withEry === 0 ? '  <- no --scales given, so the app\'s only continuous measurement is absent' : ''))
  if (errs.length) console.log(`  page errors: ${errs.length} — ${errs[0]}`)
  await browser.close()
  process.exit(done === rows.length ? 0 : 1)
}

main().catch(e => { console.error('\n  batch-predict could not run:', e.message, '\n'); process.exit(2) })
