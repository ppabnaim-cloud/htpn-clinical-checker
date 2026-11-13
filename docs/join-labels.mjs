/* Join the app's predictions to the graders' labels.
 *
 *   node docs/join-labels.mjs <caselog.csv> <predictions.csv> [--out merged.csv]
 *
 * <caselog.csv>     exported from the Dashboard tab — one row per image PER GRADER
 * <predictions.csv> written by docs/batch-predict.mjs — one row per image
 *
 * The result is one row per label row, with the app's columns filled in, ready to import back
 * into the Dashboard or to read into R or Python for the analysis.
 *
 *
 * THE JOIN IS ONE-TO-MANY, AND THAT IS THE POINT
 * ──────────────────────────────────────────────
 * Two graders labelling the same photograph produce two rows. Both get the same prediction,
 * because the app saw the photograph once. That is correct, and it has a consequence that is
 * easy to get wrong in the analysis afterwards: THE ROWS ARE NOT INDEPENDENT. Treating 2n
 * label rows as 2n observations will give confidence intervals roughly √2 too narrow and a
 * kappa computed against the wrong denominator.
 *
 * So the file carries `n_graders_for_image` on every row, and the summary prints how many
 * images are double-graded. Analyse agreement per image-pair, and anything model-vs-reference
 * per image after adjudication — never per label row. And split by PATIENT, not by image:
 * `case_id` is what to group on, because P014_v1 and P014_v2 are the same foot.
 *
 *
 * WHAT A MISS MEANS
 * ─────────────────
 * Unmatched label rows mean the batch pass never saw that image — usually a renamed file or an
 * image the graders had and the prediction folder did not. Unmatched predictions mean the
 * reverse. Both are reported with examples rather than counted silently, because a quiet 12 %
 * miss rate is how a validation set ends up smaller than the paper says it is.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename } from 'node:path'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d }
const files = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'))
const [LABELS, PREDS] = files
const OUT = flag('out', 'merged.csv')

if (!LABELS || !PREDS || !existsSync(LABELS) || !existsSync(PREDS)) {
  console.error('\n  usage: node docs/join-labels.mjs <caselog.csv> <predictions.csv> [--out merged.csv]\n')
  process.exit(2)
}

/* A real CSV reader: the case log contains free-text fields (revision_log, sensitivity_notes)
   that can hold commas, quotes and newlines, and splitting on commas would shred them. */
const parseCsv = text => {
  const rows = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const head = rows.shift() || []
  return rows.filter(r => r.some(x => x !== ''))
             .map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])))
}
const csvCell = v => {
  const t = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
}

const labels = parseCsv(readFileSync(LABELS, 'utf8'))
const preds = parseCsv(readFileSync(PREDS, 'utf8'))
if (!labels.length) { console.error('  no rows in ' + LABELS); process.exit(2) }
if (!preds.length) { console.error('  no rows in ' + PREDS); process.exit(2) }

/* Match on the filename alone, case-insensitively and without any directory part. Graders'
   exports and a prediction folder routinely disagree about path and case but not about name. */
const key = s => basename(String(s || '').trim()).toLowerCase()
const byImage = new Map()
for (const p of preds) byImage.set(key(p.image), p)

/* Columns the prediction file owns. Anything else in the label row is left untouched. */
const PRED_COLS = Object.keys(preds[0]).filter(c => c !== 'image')
const perImage = new Map()
for (const l of labels) perImage.set(key(l.image), (perImage.get(key(l.image)) || 0) + 1)

const merged = []
const missLabel = [], usedPred = new Set()
for (const l of labels) {
  const k = key(l.image)
  const p = byImage.get(k)
  if (p) usedPred.add(k); else missLabel.push(l.image)
  const out = { ...l, n_graders_for_image: perImage.get(k) }
  for (const c of PRED_COLS) {
    /* Prefix anything that would collide with a label column the graders own, so a prediction
       can never overwrite a human's answer. `when` and `model` exist in both files. */
    const name = (c in l) ? 'app_' + c : c
    out[name] = p ? p[c] : ''
  }
  out.prediction_joined = p ? 'yes' : 'no'
  merged.push(out)
}
const missPred = preds.map(p => p.image).filter(i => !usedPred.has(key(i)))

const cols = [...new Set(merged.flatMap(Object.keys))]
writeFileSync(OUT, [cols.join(',')]
  .concat(merged.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\n') + '\n')

/* ── what the analyst needs to know before trusting the file ───────────────────────────── */
const images = new Set(labels.map(l => key(l.image)))
const doubled = [...perImage.values()].filter(n => n > 1).length
const cases = new Set(labels.map(l => (l.case_id || '').trim().toUpperCase()).filter(Boolean))
const joined = merged.filter(r => r.prediction_joined === 'yes').length
const builds = new Set(preds.map(p => p.app_build).filter(Boolean))
const shas = new Set(preds.map(p => p.model_sha).filter(Boolean))
const withEry = preds.filter(p => p.ery_cm !== '').length

const show = (list, n = 5) => list.slice(0, n).join(', ') + (list.length > n ? `, … (+${list.length - n})` : '')

console.log(`\n  wrote ${OUT}\n`)
console.log(`  label rows           ${labels.length}`)
console.log(`  distinct images      ${images.size}`)
console.log(`  distinct patients    ${cases.size}${cases.size ? '' : '   <- no case_id anywhere: you cannot split by patient'}`)
console.log(`  double-graded images ${doubled}`)
console.log(`  rows with an app prediction  ${joined} of ${labels.length}`)
if (missLabel.length) console.log(`  !  ${missLabel.length} label rows had NO prediction: ${show([...new Set(missLabel)])}`)
if (missPred.length) console.log(`  !  ${missPred.length} predictions matched no label: ${show(missPred)}`)
console.log(`  predictions with an erythema distance  ${withEry} of ${preds.length}`
            + (withEry === 0 ? '   <- no scale was supplied to batch-predict' : ''))
if (builds.size > 1) console.log(`  !  predictions span ${builds.size} app builds: ${[...builds].join(' / ')} — do not pool these`)
if (shas.size > 1) console.log(`  !  predictions span ${shas.size} model weights: ${[...shas].map(x => x.slice(0, 12)).join(' / ')} — do not pool these`)
console.log(`\n  Analyse per image (or per patient via case_id), never per label row:`)
console.log(`  ${doubled} images carry more than one grader, so label rows are not independent.\n`)

process.exit(missLabel.length ? 1 : 0)
