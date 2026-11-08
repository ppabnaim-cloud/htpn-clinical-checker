import asyncio, sys
from playwright.async_api import async_playwright

# The Assess tab is for clinicians. The split against Assess (full) is instrumentation, not
# vocabulary: Wagner, Texas, IWGDF grades and the NAG regimen all belong on Assess, because the
# reader is a prescriber. What does not belong is the research apparatus — it is noise at the
# bedside and it is what the study team, not the clinician, is looking at.
#
# Gaps found the hard way: the app says "% of the frame", not "% of frame", so the first
# version of this list matched nothing while the string sat on screen. Match on fragments.
BANNED = ['Dice', 'of frame', 'of the frame', 'Share of the frame', 'onfidence', 'Grad-CAM',
          'What the classifier actually saw', 'resized to 224', 'out_relu', 'MobileNet',
          'occlusion', 'held-out', 'Heatmap explains', 'How to read this', 'What this shows',
          'AUC', 'weak labels', 'P = ', 'set a scale', 'px', 'a*', 'ms on',
          'Classification scheme', 'Compare',
          'Longest dimension', 'Segmentation confidence']

# What the Assess tab must carry, in pipeline order. A leak test only catches what creeps in;
# these catch what falls out.
# Split by pane, because the clinical read is split by tab now: Findings is what the camera
# sees, Grading is what the examination adds and what follows from it.
MUST_FINDINGS = [
        ('the signs-of-infection list', ['Peri-wound erythema']),
        ('the tissue composition',      ['Granulation']),
        ('an infection verdict',        ['LIKELY INFECTION', 'NO SIGNS OF INFECTION', 'AWAITING YOUR EXAMINATION']),
        # Every tissue row names its source, whichever produced it: the Lab colour estimate or
        # a trained segmenter. Printing either without provenance gave the estimate more
        # authority than the rows the examiner fills in, and it is the weaker of the two.
        ('provenance on the tissue rows', ['colour estimate', 'tissue model'])]
MUST_GRADING = [
        ('the antibiotic panel', ['Antibiotics']),
        ('the grading',          ['Meggitt', 'NPIAP'])]


async def main():
    bad = 0
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for arm in ['dfu', 'pi']:
            pg = await (await b.new_context(viewport={'width': 820, 'height': 1300})).new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'http://localhost:8777/?arm={arm}')
            await pg.wait_for_timeout(2000)
            await pg.evaluate("() => document.getElementById('gate').classList.add('hidden')")
            await pg.wait_for_function("() => typeof active!=='undefined' && active && backbone", timeout=60000)
            # UNLOCKED, on the Assess tab — the case that leaked three times before
            await pg.evaluate("() => setStudyMode(true)")
            # the second sample, not the first: sample A is a tiny wound whose tissue map comes
            # back sparse, so it exercises the abstain path rather than the whole pipeline
            await pg.evaluate("() => { const s=document.querySelectorAll('.sample');"
                              " (s[1] || s[0]).click(); }")
            await pg.wait_for_function("() => typeof lastPred!=='undefined' && lastPred", timeout=90000)
            await pg.click('#tabFindings')
            await pg.wait_for_timeout(900)

            print(f'--- {arm}: FINDINGS tab while UNLOCKED ---')

            # Per element, not innerText on the container: innerText falls back to textContent
            # for anything not being rendered, so a container-level read reported hidden strings
            # as leaks and sent me hunting for text that was never on screen.
            hits = await pg.evaluate('''(words) => { const out = [];
              document.querySelectorAll('#tab-findings *').forEach(el => {
                if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
                const own = [...el.childNodes].filter(n => n.nodeType === 3)
                              .map(n => n.textContent).join(' ');
                words.forEach(w => { if (own.toLowerCase().includes(w.toLowerCase()))
                  out.push(w + '  <- #' + (el.id || el.tagName.toLowerCase()) + ': ' + own.trim().slice(0, 60)); });
              });
              return out; }''', BANNED)
            if hits:
                for h in hits:
                    print('   LEAK:', h)
            else:
                print('   leaked: nothing')
            bad += len(hits)

            shown = await pg.evaluate("() => document.getElementById('tab-findings').innerText")
            low = shown.lower()
            for what, options in MUST_FINDINGS:
                if not any(o.lower() in low for o in options):
                    bad += 1
                    print(f'   MISSING: {what} — none of {options}')
            verdict = await pg.evaluate(
                "() => { const v = document.querySelector('#pubResult .verdict b');"
                " return v ? v.innerText.trim() : '(no verdict block)'; }")
            print('   verdict:', verdict)

            # the Grading pane carries what the examination drives
            await pg.click('#tabGrading')
            await pg.wait_for_timeout(900)
            glow = (await pg.inner_text('#tab-grading')).lower()
            for what, options in MUST_GRADING:
                if not any(o.lower() in glow for o in options):
                    bad += 1
                    print(f'   MISSING from Grading: {what} — none of {options}')

            # Technical detail is a switch now, not a tab. With it on, the research apparatus
            # must come back; with it off, none of it may be on screen. That is the same
            # guarantee the Assess (full) tab used to give.
            await pg.evaluate("() => setDetail(true)")
            await pg.wait_for_timeout(700)
            txt2 = await pg.inner_text('#tab-grading') + await pg.evaluate(
                "() => { openTab('findings'); return document.getElementById('tab-findings').innerText; }")
            await pg.wait_for_timeout(500)
            txt2 = txt2 + await pg.inner_text('#tab-findings')
            present = [w for w in BANNED if w.lower() in txt2.lower()]  # presence only; container read is fine here
            print(f'   with technical detail on: {len(present)} of {len(BANNED)} items back')
            if not present:
                bad += 1
                print('   !! technical detail on shows nothing technical')
            if errs:
                bad += 1
                print('   PAGE ERRORS:', errs[:2])
        await b.close()
    print('\nLEAK TEST:', 'PASS' if bad == 0 else f'FAIL ({bad})')
    sys.exit(1 if bad else 0)

asyncio.run(main())
