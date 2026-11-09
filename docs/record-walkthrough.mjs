import { chromium } from '/tmp/claude-0/-home-user-patient-journey-by-htpn/b357526a-476a-52af-996d-8569fb615651/scratchpad/verify/node_modules/playwright/index.mjs'
const DIR = '/tmp/claude-0/-home-user/b357526a-476a-52af-996d-8569fb615651/scratchpad/frames'
const SAMPLES = '/home/user/htpn-clinical-checker/dfu/samples/'
const FPS = 8
let n = 0, shooting = true, t0 = 0
const marks = []; const mark = m => { marks.push([((Date.now()-t0)/1000).toFixed(1), m]); }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto('http://127.0.0.1:4180/dfu/', { waitUntil: 'networkidle' })
await p.waitForTimeout(700)

t0 = Date.now()
const shooter = (async () => { while (shooting) {
  const due = t0 + (n*1000)/FPS, w = due - Date.now()
  if (w > 0) await new Promise(r => setTimeout(r, w))
  try { await p.screenshot({ path: `${DIR}/f${String(n).padStart(5,'0')}.jpg`, type:'jpeg', quality:80 }) } catch {}
  n++ } })()
const beat = ms => p.waitForTimeout(ms)
const show = async (sel, ms, block='center') => {
  try { await p.evaluate(s => document.querySelector(s)?.scrollIntoView({block:'center', behavior:'smooth'}), sel) } catch {}
  await beat(ms)
}

/* 1 — the gate */
mark('gate'); await beat(7000)
await p.evaluate(() => document.querySelectorAll('input[type=checkbox]').forEach(c => { c.checked = true; c.dispatchEvent(new Event('change',{bubbles:true})) }))
await beat(1200)
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /continue|enter|start/i.test(x.textContent))?.click())
await beat(1600); mark('tool')

/* 2 — orientation: a portrait phone photo, then an off-centre landscape */
await show('.samples', 1200, 'start')
mark('orientation')
await p.setInputFiles('#poolInput, input[type=file][accept*="image"]', SAMPLES + 'portrait_phone.jpg').catch(()=>{})
await beat(300)
const pick = async (name) => {
  const btn = p.locator(`.sample[data-src*="${name}"]`).first()
  if (await btn.count()) { await btn.scrollIntoViewIfNeeded(); await btn.click(); return true }
  return false
}
await pick('portrait_phone')
await p.waitForFunction(() => document.querySelectorAll('#autoFind .find').length > 0, null, {timeout:60000}).catch(()=>{})
await beat(1500); mark('portrait loaded')
await show('#shot, canvas, .shotwrap', 5000)

await pick('landscape_offcentre')
await p.waitForFunction(() => document.querySelectorAll('#autoFind .find').length > 0, null, {timeout:60000}).catch(()=>{})
await beat(1200); mark('landscape loaded')
await show('#shot, canvas, .shotwrap', 4500)

/* 3 — the working image: slough, necrosis, peri-wound erythema */
await pick('sloughy_heel_ulcer')
await p.waitForFunction(() => document.querySelectorAll('#autoFind .find').length > 0, null, {timeout:60000})
await beat(1500); mark('working image')

/* 4 — the outline */
await show('canvas, .shotwrap', 8000)
mark('outline')

/* 5 — tissue map */
await show('#tissueLegend', 3000)
await show('#measureRead', 6000); mark('tissue')

/* 6 — the three signs the examiner must answer */
await show('#pubResult', 2000)
const taps = p.locator('#pubResult select, #pubResult button')
mark('signs asked'); await beat(8000)

/* 7 — infection probability */
await show('#autoFind', 9000); mark('probability')

/* 8 — transfer learning: the model card */
await p.evaluate(() => setStudyMode(true)); await beat(400)
await show('#modelCard', 1200)
await beat(9000); mark('transfer learning')

/* 9 + 10 — grading: human in the loop, depth and ischaemia */
await p.locator('#tabGrading').click(); await beat(1500)
await show('#hitl', 8000); mark('human in the loop')
await show('#askFind', 1500)
const qs = p.locator('#askFind .askrow select')
for (const [i,v] of [[0,'yes'],[1,'tendon'],[2,'pos'],[5,'yes']]) {
  if (await qs.nth(i).count()) { await qs.nth(i).selectOption(v).catch(()=>{}); await beat(1700) }
}
mark('answered'); await beat(3000)
await show('#resultState, #gradeCard', 6000); mark('grade')

/* 11 — the antibiotic, from the National Antimicrobial Guideline */
await show('#abxBox', 9000); mark('antibiotic')

/* 12 — study team: upload a folder or single images */
await p.locator('#tabTrain').click(); await beat(1500)
await show('#poolInput, .uploadrow, #dirInput', 1200)
await beat(6000); mark('upload')

/* 13 — label every variable, one by one */
await p.setInputFiles('#poolInput', [SAMPLES+'sloughy_heel_ulcer.jpg', SAMPLES+'necrotic_forefoot_ulcer.jpg'])
await p.waitForFunction(() => { const c=document.getElementById('labelCard'); return c && !c.classList.contains('hidden') }, null, {timeout:25000})
await beat(900)
await p.locator('#labGrader').selectOption({ label: 'Dr Naim Bin Abdul Malek' }).catch(()=>{})
await beat(1500); mark('grader')
await show('#labFeats', 1200)
const sel = p.locator('#labFeats select')
for (const lab of ['Slough','Necrosis (eschar)','Peri-wound erythema','Pus','Abscess','Wet gangrene']) {
  await sel.selectOption({ label: lab }).catch(()=>{})
  await p.evaluate(() => document.getElementById('labFeats')?.scrollIntoView({block:'center'}))
  await beat(1500)
}
mark('labels'); await beat(2000)

/* 14 — segmentation: draw the tissue map */
const maskSum = p.locator('summary', { hasText: /Draw the tissue map/i }).first()
if (await maskSum.count()) { await maskSum.scrollIntoViewIfNeeded(); await beat(500); await maskSum.click(); await beat(800)
  await maskSum.scrollIntoViewIfNeeded(); await beat(7000); mark('segmentation') }

/* microbiology */
const micro = p.locator('summary', { hasText: /Microbiology/i }).first()
if (await micro.count()) { await micro.scrollIntoViewIfNeeded(); await beat(400); await micro.click(); await beat(700)
  await micro.scrollIntoViewIfNeeded(); await beat(6000); mark('microbiology') }

/* 15 — export, and the case log comparison */
await show('#labExport', 5000); mark('export')
await p.locator('#tabData').click(); await beat(1800)
await show('#logCard', 9000); mark('comparison')

shooting = false; await shooter
console.log('frames', n, '=', (n/FPS).toFixed(0)+'s | errors', errs.slice(0,2))
marks.forEach(([t,m]) => console.log('  '+t+'s  '+m))
await ctx.close(); await b.close()
