import asyncio, sys
from playwright.async_api import async_playwright
# Strings that must never reach a clinician on the public Assess tab.
# Gaps found the hard way: the app says "% of the frame", not "% of frame", so the first
# version of this list matched nothing while the string sat on screen. Match on fragments.
BANNED = ['Dice', 'of frame', 'of the frame', 'Share of the frame', 'onfidence', 'Grad-CAM',
          'What the classifier actually saw', 'resized to 224', 'out_relu', 'MobileNet',
          'occlusion', 'held-out', 'Heatmap explains', 'How to read this', 'What this shows',
          'AUC', 'weak labels', 'P = ', 'set a scale', 'Dice', 'px', 'a*']
async def main():
    bad = 0
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for arm in ['dfu','pi']:
            pg = await (await b.new_context(viewport={'width':820,'height':1300})).new_page()
            errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(f'http://localhost:8777/?arm={arm}'); await pg.wait_for_timeout(2000)
            await pg.evaluate("() => document.getElementById('gate').classList.add('hidden')")
            await pg.wait_for_function("() => typeof active!=='undefined' && active && backbone", timeout=60000)
            # UNLOCKED, on the public tab — the case that leaked three times before
            await pg.evaluate("() => setStudyMode(true)")
            await pg.evaluate("() => { const s=document.querySelector('.sample'); if (s) s.click(); }")
            await pg.wait_for_function("() => typeof lastPred!=='undefined' && lastPred", timeout=90000)
            await pg.click('#tabAssess'); await pg.wait_for_timeout(900)
            # Per element, not innerText on the container: innerText falls back to textContent
            # for anything not being rendered, so a container-level read reported hidden strings
            # as leaks and sent me hunting for text that was never on screen.
            hits = await pg.evaluate('''(words) => { const out = [];
              document.querySelectorAll('#tab-assess *').forEach(el => {
                if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
                const own = [...el.childNodes].filter(n => n.nodeType === 3)
                              .map(n => n.textContent).join(' ');
                words.forEach(w => { if (own.toLowerCase().includes(w.toLowerCase()))
                  out.push(w + '  <- #' + (el.id || el.tagName.toLowerCase()) + ': ' + own.trim().slice(0, 60)); });
              });
              return out; }''', BANNED)
            print(f'--- {arm}: PUBLIC tab while UNLOCKED ---')
            if hits:
                for h in hits: print('   LEAK:', h)
            else:
                print('   leaked: nothing')
            bad += len(hits)
            print('   size line:', ' '.join((await pg.inner_text('#sizeBox')).split())[:110])
            # and the full tab must still have them
            await pg.click('#tabAssessFull'); await pg.wait_for_timeout(900)
            txt2 = await pg.inner_text('#tab-assess')
            present = [w for w in BANNED if w.lower() in txt2.lower()]  # presence only; container read is fine here
            print(f'   full tab shows {len(present)} of {len(BANNED)} technical items')
            if not present: bad += 1; print('   !! full tab shows nothing technical')
            if errs: bad += 1; print('   PAGE ERRORS:', errs[:2])
        await b.close()
    print('\nLEAK TEST:', 'PASS' if bad == 0 else f'FAIL ({bad})')
    sys.exit(1 if bad else 0)
asyncio.run(main())
