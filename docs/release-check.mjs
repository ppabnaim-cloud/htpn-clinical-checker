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
/* Read the version from the BUILD constant, and fall back to the footer markup for builds
   before v11.10.

   This regressed once and silently, which is the only way it could have mattered. Until v11.10
   the version was literal text inside the footer span, so a regex over the markup found it.
   v11.10 emptied that span and had JavaScript write BUILD into it at start-up -- a good change
   for the app, because the footer and the case log can no longer disagree, and an invisible
   break for this file, because the markup regex stopped matching. EXPECT became undefined, the
   run printed "(not specified)", and the build-stamp assertion quietly stopped existing. A
   check that cannot fail is worse than no check, and this one had stopped being able to fail
   without anything saying so. Caught by a live run that was given --expect explicitly and
   happened to look at where the default came from. */
const stampOf = html => {
  const b = html.match(/const BUILD = '([^']+)'/)
  if (b) return b[1]
  return (html.match(/id="buildStamp"[^>]*>([^<]+)</) || [, ''])[1]
    .replace(/&middot;/g, '·').trim()
}
const EXPECT = expectIx >= 0 ? args[expectIx + 1] : (stampOf(localHtml).match(/v[\d.]+/) || [])[0]
if (expectIx < 0 && !EXPECT) {
  console.error('\n  refusing to run: no --expect given and no version could be read from'
    + ' dfu/index.html.\n  That is how the build-stamp check silently stopped checking once'
    + ' before. Pass --expect vX.Y.\n')
  process.exit(2)
}

/* Phrases a user MUST be able to see somewhere in the app. */
const REQUIRED = [
  'Image-pattern estimate',
  'no IWGDF criterion assessed yet',
  'require clinical examination and are not in any photograph',
  'not independent evidence of infection',
  'What is this estimate, and what was it trained on?',
  'slough fraction > 0.10 OR necrosis fraction > 0.15',
  'LIKELY INFECTION',
  'AWAITING YOUR EXAMINATION',
  /* The explainability table (v11.4). Its whole job is to make the app's boundary visible:
     which of the five criteria a photograph can reach, and which are physical findings it
     cannot. A later edit that quietly drops it would leave "2 of 5" meaning nothing again. */
  'This screen can reach two of',
  'Peri-wound erythema beyond 0.5 cm',
  'no detector is trained yet',
  'clinical examination',
  'either is severe',
  '1,000 everyday object classes',
  /* v11.7: the provenance table lost its instrumentation rows. This sentence is what
     remains of the caveat, so it is now the thing worth guarding. */
  'not whether the wound is infected'
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
  /* APP is resolved below; the seeded-log stage further down opens its own context so the
     main run is never contaminated by a populated log. */

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

  /* VISIBLE, not merely written. The check above reads textContent, which a hidden element
     still has. For most of this app's life the stamp carried `study-hide`, so a tester could
     not read the version off the screen while this assertion passed anyway -- and the same
     blind spot is what let the default --expect silently stop working. Assert what a person
     can actually see. */
  const stampSeen = await page.evaluate(`(() => {
    const el = document.getElementById('buildStamp')
    if (!el) return 'no element'
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') return 'hidden by css'
    if (el.offsetParent === null) return 'not laid out'
    const t = (el.textContent || '').trim()
    if (!t) return 'empty'
    return document.body.innerText.includes(t) ? 'ok' : 'not in rendered text'
  })()`)
  check('build stamp is visible to a tester', stampSeen === 'ok', stampSeen)

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

  // ── D2. the case log, with a log in it ─────────────────────────────────────────
  /* Everything above runs against an EMPTY case log, because a fresh browser profile has one.
     That left the whole case-log path unvisited, and it is where a real defect lived for an
     unknown length of time: culture_positive was written only when organisms were entered, so a
     fresh row carried `undefined`, and the guards on it tested `!== null`, which undefined
     passes. An uncultured row counted as having a culture result and drew an "agrees with C&S"
     chip against a culture that did not exist. Forty checks passed throughout.

     So the log is seeded and the card is read. The seed covers the states the card can report,
     and the chip assertion is deliberately two-sided: EXACTLY ONE row has both a culture and a
     prediction, so exactly one chip must appear. "No chips" would pass if the feature were
     deleted, and that is not what we want to know.

     This runs in a separate browser context. Nothing is written to anyone's real profile, and
     the context is discarded with the run. */
  const ctx2 = await browser.newContext({ viewport: { width: 760, height: 1400 } })
  const pg2 = await ctx2.newPage()
  const seedErrors = []
  pg2.on('pageerror', e => seedErrors.push(e.message))
  pg2.on('console', m => { if (m.type() === 'error') seedErrors.push('console: ' + m.text()) })

  await pg2.goto(`${APP}?arm=dfu`, { waitUntil: 'domcontentloaded' })
  await pg2.waitForTimeout(1500)

  /* Read the key from the page rather than hardcoding it, so a rename cannot leave this
     silently seeding a key nothing reads — which would look exactly like a pass. */
  const logKey = await pg2.evaluate(`typeof LOG_KEY !== 'undefined' ? LOG_KEY : ''`)
  check('the case-log storage key is readable', !!logKey, logKey || 'LOG_KEY not found')

  if (logKey) {
    await pg2.evaluate(`(() => {
      const now = Date.now(), day = 86400000, K = ${JSON.stringify(logKey)}
      const mk = (i, over) => Object.assign({
        id: 'RC|' + i, when: new Date(now - i * day).toISOString(),
        case_id: 'P' + (100 + i), image: 'RC_' + (100 + i) + '.JPG',
        disease: 'diabetic foot ulcer', grader: 'Release Check', gt_wagner: '3',
        gt_grade: '', gt_stage: '', ai_label: '', organisms: [], outcome: '',
        skin_type: '', thumb: '', sheet_sent: null, p_infection: null
        /* culture_positive is deliberately ABSENT from the defaults. That is how rows written
           before v11.15 actually look, and absence — not null — is what the original defect
           turned on: the guards tested "!== null", which "undefined" passes. Seeding it as null
           hides the very fault this stage exists to catch, and did: the first version of this
           seed set it to null, the defect was put back in a throwaway copy, and the check
           passed anyway. */
      }, over || {})
      localStorage.setItem(K, JSON.stringify([
        mk(1),                                                                  // needs everything
        mk(2, { organisms: ['Staph aureus'], culture_positive: true,
                outcome: 'Healed', skin_type: 'IV',
                sheet_sent: new Date().toISOString() }),                        // culture, no prediction
        mk(3, { organisms: ['E. coli'], culture_positive: true,
                p_infection: 0.81, ai_label: 'suspected', skin_type: 'III' }),  // BOTH -> the one chip
        /* THE PROBE. A prediction, and no culture_positive key at all. A correct guard draws no
           chip here; the old "!== null" guard draws one, giving two chips and failing below. */
        mk(4, { p_infection: 0.42, ai_label: 'none', skin_type: 'II' }),
        mk(40),                                                                 // predates tracking
        /* An image in the log with NO Wagner grade. It exercises the "No Wagner grade" line of
           the readiness table, which is the only place such an image is visible at all, and it
           renders that line's longer caption — the string whose width, under the old nowrap
           label rule, pushed Both and Target off the right of the card on a desktop. Without an
           ungraded row seeded here the width check could not see that fault: it passed with the
           fault restored, which is exactly the kind of check this file exists not to have. */
        mk(5, { gt_wagner: '', skin_type: 'V' })
      ]))
      localStorage.setItem(K + '_exported', String(now - 27 * day))
      localStorage.setItem(K + '_sheettrack', String(now - 5 * day))
      localStorage.setItem('wound_vision_sheet_url', 'https://script.google.com/macros/s/RELEASECHECK/exec')
    })()`)

    await pg2.reload({ waitUntil: 'domcontentloaded' })
    await pg2.waitForTimeout(1800)
    try {
      if (await pg2.isVisible('#ack1')) { await pg2.check('#ack1'); await pg2.check('#ack2') }
      if (await pg2.isVisible('#enter')) {
        await pg2.waitForSelector('#enter:not([disabled])', { timeout: 15000 })
        await pg2.click('#enter')
      }
    } catch (e) { /* gate already passed in this profile */ }
    await pg2.waitForTimeout(1200)

    // the case log is on the Dashboard, which is study-gated
    await pg2.evaluate(`(() => { try { setStudyMode(true) } catch (e) {} })()`)
    await pg2.waitForTimeout(400)
    try { await pg2.click('#tabData') } catch (e) { /* reported by the checks below */ }
    await pg2.waitForTimeout(1200)

    const seen = await pg2.evaluate(`(() => ({
      /* \\s, not \s. This string is a TEMPLATE LITERAL evaluated in the page, so JavaScript
         resolves \s to a plain "s" before the regex is ever compiled: /\s+/ silently became
         /s+/ and the whitespace collapse turned into an s-remover. "still needs" came back as
         " till need ", and the assertion looking for "still needs" failed on text the app had
         rendered perfectly. */
      rows: [...document.querySelectorAll('#logList li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim()),
      chips: document.querySelectorAll('#logList .agree').length,
      storage: (document.getElementById('logStorage') || {}).innerText || '',
      dash: (document.getElementById('tab-data') || {}).innerText || ''
    }))()`)

    const rowText = seen.rows.join(' | ')
    log(`\n  seeded log: ${seen.rows.length} rows rendered, ${seen.chips} agreement chip(s)`)
    seen.rows.forEach(r => log('    | ' + r.slice(0, 120)))

    check('seeded log renders its rows', seen.rows.length >= 5, `${seen.rows.length} rows`)
    check('no "model ?" placeholder', !/model \?/.test(rowText),
          (rowText.match(/model \?/g) || []).length + ' occurrence(s)')
    check('an incomplete row says what it needs', /still needs/.test(rowText))
    check('exactly one agreement chip, on the row with culture AND prediction',
          seen.chips === 1, seen.chips + ' chips — 0 means the comparison never renders, 2 means it fires on a row with no culture result')
    check('storage note leads with the risk', /There is no server/.test(seen.storage), seen.storage.slice(0, 90))
    check('storage note reports Sheet coverage', /Confirmed written to the Google Sheet/.test(seen.storage))
    check('storage note separates export from send', /Last CSV export/.test(seen.storage))
    check('no page or console errors with a populated log', seedErrors.length === 0, seedErrors.join(' | '))

    /* The readiness table must fit its card on a DESKTOP. It briefly did not: `td.lab` was
       nowrap with no cap, so the longest caption in the table set the class column's width for
       every row and pushed Both and Target off the right of the card. Nothing caught it,
       because the phone check deliberately permits that table to scroll inside its wrapper —
       correct behaviour at 390px, a fault at 760. So the width is asserted at both ends. */
    const deskRmx = await pg2.evaluate(`(() => {
      const w = document.querySelector('.rmxwrap'), t = document.querySelector('.rmx')
      if (!w || !t) return null
      const th = [...t.querySelectorAll('tr')[0].querySelectorAll('th')]
      return { wrap: w.clientWidth, tbl: Math.round(t.getBoundingClientRect().width),
               scrolls: w.scrollWidth > w.clientWidth + 1,
               lastCol: th.length ? th[th.length - 1].innerText.trim() : '' }
    })()`)
    check('the readiness table fits its card on a desktop',
          !!deskRmx && !deskRmx.scrolls,
          deskRmx ? `table ${deskRmx.tbl}px in a ${deskRmx.wrap}px card; last column "${deskRmx.lastCol}"`
                  : 'no .rmx on the dashboard')

    const rmxText = await pg2.evaluate(`(() => (document.getElementById('readyMatrix') || {}).innerText || '')()`)
    const tileText = await pg2.evaluate(`(() => (document.getElementById('dashTiles') || {}).innerText || '')()`)
    /* An image logged with no Wagner grade appears in no Wagner row, so without this line the
       column simply summed to less than the log and nothing said why. */
    check('the readiness table has a line for ungraded images', /No Wagner grade/.test(rmxText),
          rmxText.slice(0, 80).replace(/\s+/g, ' '))
    /* Rows and images are different numbers and both are on this screen. Each must name which. */
    check('the case-log tile names its unit as rows', /Case-log rows/.test(tileText))
    check('the case-log tile also gives the image count', /\d+ images? \u00b7 one row per grader/.test(tileText),
          (tileText.match(/Case-log rows[\s\S]{0,60}/) || [''])[0].replace(/\s+/g, ' '))
    check('the tissue tile says cases, not class ticks', /Cases with tissue findings/.test(tileText))
    /* Superseded by the table, which names every grader and splits them per class. */
    check('the bare Graders tile is gone', !/^Graders$/m.test(tileText))

    /* The targets were a blanket 40 placeholder for two builds. They are now per class and
       carry a stated basis, so the thing to protect is that the basis is on the screen next to
       the numbers — a target with no stated derivation is the "default 40" problem wearing
       different digits. */
    const tgt = await pg2.evaluate(`(() => {
      const t = document.querySelector('.rmx')
      if (!t) return null
      const vals = {}
      t.querySelectorAll('input[data-rmx]').forEach(i => { vals[i.dataset.rmx] = i.value })
      const withWhy = [...t.querySelectorAll('td.t')].filter(c => c.querySelector('input'))
      return { vals, titled: withWhy.filter(c => (c.title || '').length > 5).length,
               total: withWhy.length }
    })()`)
    check('targets differ by class rather than one blanket number',
          !!tgt && new Set(Object.values(tgt.vals)).size > 1,
          tgt ? JSON.stringify(tgt.vals) : 'no target inputs found')
    /* RELATIVE, not absolute. The first version of this check asserted those four equal 40 and
       so passed under a blanket 40 for every class — the very placeholder it exists to catch.
       What matters is that the signs which can escalate care are held to a HIGHER bar than an
       ordinary class, which a uniform table cannot satisfy however large its number. */
    const HIGH = ['pus', 'abscess', 'wet_gangrene', 'periwound_erythema']
    const ORD  = ['w1', 'w2', 'w3', 'granulation', 'necrosis']
    const lowMax = tgt ? Math.max(...ORD.map(k => Number(tgt.vals[k]) || 0)) : 0
    check('signs that can escalate care are held to a higher target than ordinary classes',
          !!tgt && HIGH.every(k => (Number(tgt.vals[k]) || 0) > lowMax),
          tgt ? `escalating: ${HIGH.map(k => k + '=' + tgt.vals[k]).join(' ')} vs highest ordinary ${lowMax}` : '')
    check('every target states its basis', !!tgt && tgt.total > 0 && tgt.titled === tgt.total,
          tgt ? `${tgt.titled} of ${tgt.total} target cells carry a reason` : '')
    check('the table says the target does not size a training set',
          /does not size a training set/i.test(rmxText), rmxText.slice(-160).replace(/\s+/g, ' '))
  }
  await ctx2.close()

  /* ── D2. does the page fit a phone? ───────────────────────────────────────
     Added because a 27px horizontal page overflow lived on EVERY tab in study mode and no check
     noticed: 49 checks all read text, and text reads the same whether or not the page scrolls
     sideways under it. On a phone a sideways page drags the whole app out from under a thumb.

     It measures documentElement.scrollWidth against clientWidth, which is the browser's own
     answer, and it names the widest offending element so a failure is diagnosable rather than
     merely red. Elements inside an overflow-x container are excluded deliberately: a wide table
     that scrolls INSIDE its card is correct behaviour, not a fault, and counting it would make
     this check fire on the thing it is supposed to permit.

     Study mode is on, because that is what reveals the lock pill that caused the original fault,
     and the tester's view would have passed. */
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 1200 } })
  const pg3 = await ctx3.newPage()
  await pg3.goto(`${APP}?arm=dfu`, { waitUntil: 'domcontentloaded' })
  await pg3.waitForTimeout(1500)
  try {
    if (await pg3.isVisible('#ack1')) { await pg3.check('#ack1'); await pg3.check('#ack2') }
    if (await pg3.isVisible('#enter')) {
      await pg3.waitForSelector('#enter:not([disabled])', { timeout: 12000 })
      await pg3.click('#enter')
    }
  } catch (e) { /* the measurements below report whatever state we reached */ }
  await pg3.waitForTimeout(600)
  await pg3.evaluate(`(() => { try { setStudyMode(true) } catch (e) {} })()`)
  await pg3.waitForTimeout(400)

  for (const [sel, label] of [['#tabFindings', 'findings'], ['#tabGrading', 'grading'],
                              ['#tabTrain', 'study team'], ['#tabData', 'dashboard']]) {
    try { await pg3.click(sel) } catch (e) { continue }
    await pg3.waitForTimeout(700)
    const m = await pg3.evaluate(`(() => {
      const vw = document.documentElement.clientWidth
      let worst = null
      document.querySelectorAll('*').forEach(el => {
        const b = el.getBoundingClientRect()
        if (!(b.width > 0) || b.right <= vw + 1) return
        const st = getComputedStyle(el)
        if (st.display === 'none' || el.offsetParent === null) return
        /* Walk up for a scroll container. If one exists, this element is clipped and is not
           what moves the page. */
        let q = el.parentElement
        while (q) {
          const ov = getComputedStyle(q).overflowX
          if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') return
          q = q.parentElement
        }
        const id = el.tagName + (el.id ? '#' + el.id : '')
        if (!worst || b.right > worst.right) worst = { id, right: Math.round(b.right) }
      })
      return { vw, sw: document.documentElement.scrollWidth, worst }
    })()`)
    const over = m.sw > m.vw
    check(`no sideways page scroll at 390px · ${label}`, !over,
          over ? `scrollWidth ${m.sw} vs ${m.vw}` +
                 (m.worst ? ` — widest unclipped: ${m.worst.id} right=${m.worst.right}` : '')
               : `scrollWidth ${m.sw}`)
  }

  /* And the wide table must still scroll inside its own card rather than be cut off, which is
     the behaviour the exclusion above assumes. Asserting it here keeps that assumption honest. */
  const rmx = await pg3.evaluate(`(() => {
    const w = document.querySelector('.rmxwrap'), t = document.querySelector('.rmx')
    if (!w || !t) return null
    return { wrap: w.clientWidth, tbl: Math.round(t.getBoundingClientRect().width),
             scrollable: w.scrollWidth > w.clientWidth + 1 }
  })()`)
  check('the readiness table scrolls inside its card on a phone',
        !!rmx && rmx.scrollable && rmx.wrap <= 390,
        rmx ? `table ${rmx.tbl}px in a ${rmx.wrap}px wrapper, scrollable=${rmx.scrollable}`
            : 'no .rmxwrap / .rmx on the page')
  await ctx3.close()

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
