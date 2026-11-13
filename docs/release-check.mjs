/* Release check for Wound Vision.
 *
 *   node docs/release-check.mjs                                        # local, port 8777
 *   node docs/release-check.mjs https://htpn-clinical-checker.vercel.app
 *   node docs/release-check.mjs <base> --expect v11.3
 *
 * Serve locally first if you are checking a working copy:
 *   python3 -m http.server 8777 --directory dfu
 *
 * Exits 0 if everything passes, 1 otherwise, so it can gate a deploy.
 *
 *
 * WHY THIS IS NOT A GREP
 * ──────────────────────
 * The 13 November deployment check asserted that certain retired phrases no longer appear in
 * the app, and did it by searching the served HTML. It reported two of them as still present.
 * They were: in source comments, written deliberately to record what the wording used to be
 * and why it changed. Nothing reached a user. The check was wrong, not the app.
 *
 * That failure mode is structural. A text search over a single-file app cannot tell a string
 * in a comment from a string in a template literal, so it will keep producing false alarms
 * for as long as the file documents its own history — which is a property worth keeping. And
 * a false alarm on a safety check is not harmless: a check that cries wolf gets ignored, and
 * then it is no longer a check.
 *
 * So the authoritative assertion here is made against RENDERED TEXT: the script drives the
 * real app in a real browser, visits the states a clinician can reach, and reads
 * document.body.innerText at each one. A phrase is "present" if a user can see it and
 * "absent" if no visited state shows it.
 *
 *
 * WHAT THE DOM CHECK CANNOT DO, STATED PLAINLY
 * ────────────────────────────────────────────
 * It only proves absence in the states it visits. A phrase reachable only through some
 * combination this script never produces would pass unnoticed. That is a real limit and it
 * cannot be engineered away, only narrowed by visiting more states.
 *
 * So a second, weaker scan runs alongside it over the source with comments stripped. It
 * covers the states the browser pass never reaches. It is heuristic — the comment stripping
 * is regex-based, and a `//` inside a string literal can still confuse it — so it is reported
 * as a WARNING and never fails the run on its own. When the two disagree, the DOM result is
 * the one to believe, and the disagreement is worth reading rather than suppressing.
 */
import { createRequire } from 'node:module'
// Playwright is installed globally in this environment, not in the repository, and ESM
// resolution does not look there. createRequire uses CommonJS resolution, which does.
const { chromium } = createRequire(import.meta.url)('playwright')
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const BASE = (args.find(a => a.startsWith('http')) || 'http://127.0.0.1:8777').replace(/\/$/, '')
const expectIx = args.indexOf('--expect')
const REPO = new URL('..', import.meta.url).pathname

/* The expected build stamp defaults to whatever the working tree says, so a live check
   compares the deployment against the code in hand without anyone typing a version number
   and getting it wrong. */
const localHtml = (() => { try { return readFileSync(`${REPO}/dfu/index.html`, 'utf8') } catch { return '' } })()
const stampOf = html => (html.match(/id="buildStamp"[^>]*>([^<]+)</) || [, ''])[1]
  .replace(/&middot;/g, '·').trim()
const EXPECT = expectIx >= 0 ? args[expectIx + 1] : (stampOf(localHtml).match(/v[\d.]+/) || [])[0]

/* Phrases a user MUST be able to see somewhere in the app. */
const REQUIRED = [
  'Image-pattern estimate',
  'no IWGDF criterion assessed yet',
  'require clinical examination and are not in any photograph',
  'not independent evidence of infection',
  'What is this estimate, and what was it trained on?',
  'slough fraction > 0.10 OR necrosis fraction > 0.15',
  'LIKELY INFECTION',
  'AWAITING YOUR EXAMINATION'
]

/* Phrases a user must NEVER see. Each one is here because it was shipped and was wrong.
   `likelihood of infection` claimed the score measured infection when its training label was
   a slough/necrosis colour proxy. `0 of 5 criteria seen here` implied five criteria had been
   checked when the screen can reach two. `flagged by the model` headlined a diagnosis on an
   uncalibrated proxy. `no signs of infection` is a clearance this app may never give. */
const FORBIDDEN = [
  'likelihood of infection',
  '0 of 5 criteria seen here',
  'flagged by the model',
  'no signs of infection',
  'The model declined to classify this image'
]

const log = (...a) => console.log(...a)
const results = []
const check = (name, ok, detail) => { results.push({ name, ok, detail }); return ok }

const main = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 560, height: 1400 } })

  const pageErrors = [], consoleErrors = [], badResponses = [], failedRequests = []
  /* The stack, not just the message. The first live run failed on "Cannot read properties
     of undefined (reading 'backend')" and the message alone said nothing about where it
     came from or whether it mattered. A check that reports a fault it cannot locate sends
     someone hunting. */
  page.on('pageerror', e => pageErrors.push(
    e.message + (e.stack ? '\n        ' + e.stack.split('\n').slice(0, 6).join('\n        ') : '')))
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('requestfailed', r => failedRequests.push(`${r.url()} — ${(r.failure() || {}).errorText}`))
  page.on('response', r => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`) })

  /* Every state the browser visits contributes its rendered text here. The union is what the
     REQUIRED and FORBIDDEN lists are tested against. */
  const seenText = []
  const capture = async label => {
    const t = await page.evaluate('document.body.innerText')
    seenText.push({ label, text: t })
    return t
  }

  /* The app lives at /dfu/ when the repository root is served (and on the deployment), but
     at / when someone serves the dfu directory itself, which is the quicker thing to do
     while developing. Guessing wrong gives a 404 and a dead entry gate twenty seconds later,
     which reads as a broken app rather than a wrong URL. So resolve it once, here. */
  let APP = `${BASE}/dfu/`
  try {
    if (!(await fetch(APP, { method: 'GET' })).ok) APP = `${BASE}/`
  } catch { APP = `${BASE}/` }

  log(`\nWound Vision release check\n  target : ${APP}\n  expect : ${EXPECT || '(not specified)'}\n`)

  // ── load and pass the entry gate ────────────────────────────────────────────────────────
  await page.goto(`${APP}?arm=dfu`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  for (const id of ['#ack1', '#ack2']) { const el = await page.$(id); if (el) await page.check(id) }
  await page.waitForSelector('#enter:not([disabled])', { timeout: 20000 })
  await page.click('#enter')
  await capture('gate passed')

  // ── A. build stamp ──────────────────────────────────────────────────────────────────────
  const liveStamp = await page.evaluate(
    `(document.getElementById('buildStamp')||{}).textContent || ''`).then(s => s.trim())
  log(`  build stamp served: ${liveStamp || '(none)'}`)
  if (EXPECT) check(`build stamp is ${EXPECT}`, liveStamp.includes(EXPECT), liveStamp)
  else log('  (no --expect and no local build stamp to compare against — reporting only)')

  // ── models must load, or nothing below means anything ───────────────────────────────────
  const loaded = await page.waitForFunction(
    () => typeof segModel !== 'undefined' && segModel, null, { timeout: 180000 }
  ).then(() => true).catch(() => false)
  if (!check('segmentation model loads', loaded)) { await finish(browser); return }

  // ── B. visit the reachable states, collecting rendered text ─────────────────────────────
  /* Which backend actually ran. WebGL and the CPU fallback do not give identical numbers, so
     a figure compared between two runs is only comparable if this matches. */
  const backend = await page.evaluate(
    `(() => { try { return tf.getBackend() } catch (e) { return 'unavailable: ' + e.message } })()`)
  log(`  tf backend: ${backend}`)

  const samples = await page.$$('button.sample[data-dis="dfu"]')
  log(`  samples found: ${samples.length}`)
  check('at least one sample present', samples.length > 0, `${samples.length}`)

  /* Wait for the INFERENCE, not for a stopwatch. The first version slept a flat 13 s after
     each click. Locally that was enough and every sample reported its estimate; over the
     network the first live run showed sample 2 abstaining where the same build scored it 84 %
     on localhost, because the panel was read while the previous state was still on screen.
     A fixed sleep turns a slow network into a false finding, which is the one thing a release
     check must never do. So the token below is captured before the click and the run waits for
     the app's own `lastPred` to be replaced. */
  for (let i = 0; i < samples.length; i++) {
    await page.evaluate('window.__rcPrev = (typeof lastPred === "undefined" ? null : lastPred)')
    await (await page.$$('button.sample[data-dis="dfu"]'))[i].click()
    const settled = await page.waitForFunction(
      `typeof lastPred !== 'undefined' && lastPred && lastPred !== window.__rcPrev
       && typeof lastTissue !== 'undefined' && lastTissue !== null`,
      null, { timeout: 120000 }).then(() => true).catch(() => false)
    if (!check(`sample ${i + 1} finishes inference`, settled, 'timed out after 120 s')) continue
    await page.waitForTimeout(900)            // let the renderers run after the state lands
    const t = await capture(`sample ${i + 1} · default`)
    const est = (t.match(/Image-pattern estimate: \d+ %/) || [])[0]
    log(`    sample ${i + 1}: ${est || 'abstained (confidence below the threshold)'}`)

    // the provenance table only exists when the head did not abstain
    const det = await page.$('#pubResult details.prov')
    if (det) {
      await page.evaluate(`document.querySelector('#pubResult details.prov').open = true`)
      await page.waitForTimeout(250)
      await capture(`sample ${i + 1} · provenance open`)
    }
  }

  /* The infected verdict, reached through the interface rather than by poking at internals.
     A release check that stubs the app's own state stops being a check on the app. */
  const setTap = async (k, v) => {
    const sel = await page.$(`#pubResult select.tapsel[data-s="${k}"]`)
    if (!sel) return false
    await page.selectOption(`#pubResult select.tapsel[data-s="${k}"]`, v)
    await page.waitForTimeout(600)
    return true
  }
  if (await setTap('pus', 'y')) await capture('pus present · one criterion')
  if (await setTap('abscess', 'y')) await capture('pus + abscess · severe')
  const infectedSeen = seenText.some(s => s.text.includes('LIKELY INFECTION'))
  check('examiner-confirmed severe sign still escalates', infectedSeen)
  await setTap('pus', ''); await setTap('abscess', '')

  // ── grading sub-tabs ────────────────────────────────────────────────────────────────────
  await page.click('#tabGrading')
  await page.waitForTimeout(800)
  const tabs = await page.evaluate(
    `[...document.querySelectorAll('#gradeTabBar button')].map(b => [b.dataset.g, b.innerText.replace(/\\s+/g,' ').trim()])`)
  log(`  grading sub-tabs: ${tabs.map(t => t[1]).join(' | ') || '(none)'}`)
  check('three grading sub-tabs render', tabs.length === 3, tabs.map(t => t[1]).join(' | '))
  for (const [key, label] of tabs) {
    await page.click(`#gradeTabBar button[data-g="${key}"]`)
    await page.waitForTimeout(500)
    const n = await page.evaluate(`document.querySelectorAll('#askFind select').length`)
    await capture(`grading · ${key}`)
    const want = { wagner: 5, texas: 4, abx: 8 }[key]
    if (want) check(`${key} tab asks ${want} questions`, n === want, `asked ${n}`)
  }

  // ── C. the assertions, against rendered text only ───────────────────────────────────────
  const all = seenText.map(s => s.text).join('\n\u0000\n')
  log(`\n  states visited: ${seenText.length}`)

  for (const phrase of REQUIRED) {
    const where = seenText.filter(s => s.text.includes(phrase)).map(s => s.label)
    check(`visible: "${phrase}"`, where.length > 0,
          where.length ? `${where.length} state(s), first: ${where[0]}` : 'never rendered')
  }
  for (const phrase of FORBIDDEN) {
    const where = seenText.filter(s => s.text.includes(phrase)).map(s => s.label)
    check(`never visible: "${phrase}"`, where.length === 0,
          where.length ? `RENDERED IN: ${where.join(', ')}` : 'not in any visited state')
  }

  // ── D. runtime health ───────────────────────────────────────────────────────────────────
  check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '))
  check('no failed requests', failedRequests.length === 0, failedRequests.join(' | '))
  check('no HTTP >= 400', badResponses.length === 0, badResponses.join(' | '))

  // ── E. the weaker source scan, for states the browser never reached ─────────────────────
  const served = await (await fetch(APP)).text()
  const stripped = served
    .replace(/<!--[\s\S]*?-->/g, ' ')          // HTML comments
    .replace(/\/\*[\s\S]*?\*\//g, ' ')         // JS block comments
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1') // JS line comments, sparing https://
  log('\n  source scan (comments stripped) — advisory, never fails the run:')
  let warned = 0
  for (const phrase of FORBIDDEN) {
    const inRaw = served.includes(phrase), inCode = stripped.includes(phrase)
    if (inCode) { warned++; log(`    WARN  "${phrase}" survives outside comments — look at it`) }
    else if (inRaw) log(`    ok    "${phrase}" appears only in comments`)
  }
  if (!warned) log('    nothing reachable found outside comments')

  await finish(browser)
}

const finish = async browser => {
  await browser.close()
  const failed = results.filter(r => !r.ok)
  log('\n  ' + '─'.repeat(72))
  for (const r of results) log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? '  — ' + r.detail : ''}`)
  log('  ' + '─'.repeat(72))
  log(`  ${results.length - failed.length} of ${results.length} checks passed\n`)
  if (failed.length) {
    log('  FAILED:')
    for (const r of failed) log(`    ${r.name}${r.detail ? ' — ' + r.detail : ''}`)
    log('')
  }
  process.exit(failed.length ? 1 : 0)
}

main().catch(async e => { console.error('\n  release check could not run:', e.message, '\n'); process.exit(2) })
