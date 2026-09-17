"""
Record a ~30 s walk-through of the DFU Vision prototype on a phone-sized viewport.

  1. serve the app:   (cd dfu && python -m http.server 8765)
  2. record:          python ml/record_demo.py  -> dfu/demo/dfu-demo.mp4 (+ .webm)

Needs: pip install playwright imageio-ffmpeg  (uses the Chromium that Playwright finds; set CHROME=/path/to/chrome to override)
"""
import asyncio, os, glob, shutil, subprocess, sys, time
from playwright.async_api import async_playwright
URL = os.environ.get("URL", "http://127.0.0.1:8765/index.html")
OUT = os.path.join(os.path.dirname(__file__), "..", "dfu", "demo")
W, H = 390, 844

async def main():
    t_ready = 0.0
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        if os.environ.get("CHROME"): kw["executable_path"] = os.environ["CHROME"]
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={"width": W, "height": H}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                  record_video_dir=OUT, record_video_size={"width": W, "height": H})
        page = await ctx.new_page()
        wait = lambda ms: page.wait_for_timeout(ms)
        t0 = time.time()
        await page.goto(URL)
        await page.wait_for_selector("#modelPill.ok", timeout=120000)   # model loads behind the gate
        t_ready = time.time() - t0 + 0.3                                   # trim the loading period from the final cut
        # 1 · disclaimer + acquisition protocol
        await wait(1500)
        await page.evaluate("document.querySelector('.protocol').scrollIntoView({behavior:'smooth',block:'center'})"); await wait(1800)
        await page.evaluate("document.querySelector('#enter').scrollIntoView({behavior:'smooth',block:'end'})"); await wait(700)
        await page.check("#ack1"); await wait(500); await page.check("#ack2"); await wait(600); await page.click("#enter"); await wait(1200)
        # 2 · capture: tap the sloughy sample (stands in for a photo taken in clinic)
        await page.hover(".sample >> nth=1"); await wait(400); await page.click(".sample >> nth=1")
        await page.wait_for_function(
            "() => document.getElementById('status').classList.contains('hidden')"
            " && document.getElementById('timing').textContent.trim() !== ''", timeout=180000)
        await wait(1800)
        # 3 · Grad-CAM
        # overlay modes are 0 = photo, 1 = wound outline, 2 = Grad-CAM
        await page.click('#camToggle button[data-v="1"]'); await wait(2000)      # the wound outline
        await page.evaluate("document.getElementById('woundPanel').scrollIntoView({behavior:'smooth',block:'center'})")
        await wait(1800)
        await page.click('#camToggle button[data-v="2"]'); await wait(2000)      # Grad-CAM, with its legend
        await page.click('#camToggle button[data-v="1"]'); await wait(700)
        # 4 · results + Texas grid
        await page.evaluate("document.querySelector('.texas').scrollIntoView({behavior:'smooth',block:'center'})"); await wait(1800)
        await page.click('#ischChips .chip[data-v="1"]'); await wait(1300)
        await page.click('#ischChips .chip[data-v="0"]'); await wait(700)
        # 5 · ground truth: clinician class + tissue culture & sensitivity
        await page.evaluate("document.querySelector('#truth').scrollIntoView({behavior:'smooth',block:'start'})"); await wait(1200)
        await page.select_option("#gtGrade", "3"); await wait(400); await page.select_option("#gtStage", "B"); await wait(400)
        await page.select_option("#gtPtb", "Positive"); await wait(300); await page.fill("#gtDate", "2026-09-08"); await wait(400)
        await page.click('#orgChips .chip[data-v="MRSA"]'); await wait(350); await page.click('#orgChips .chip[data-v="Pseudomonas"]'); await wait(500)
        await page.fill("#gtNotes", "MRSA: sensitive to vancomycin, doxycycline. Pseudomonas: sensitive to piperacillin-tazobactam."); await wait(700)
        await page.click("#saveCase"); await wait(2000)
        # 6 · the dataset readiness dashboard on the Train tab
        await page.click("#tabTrain"); await wait(900)
        await page.evaluate("document.getElementById('readiness').scrollIntoView({behavior:'smooth',block:'start'})")
        await wait(2200)
        await ctx.close(); await b.close()
    webm = sorted(glob.glob(os.path.join(OUT, "*.webm")), key=os.path.getmtime)[-1]

    shutil.move(webm, os.path.join(OUT, "dfu-demo.webm"))
    try:
        import imageio_ffmpeg; ff = imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        ff = shutil.which("ffmpeg")
    if ff:
        subprocess.run([ff, "-y", "-loglevel", "error", "-ss", f"{t_ready:.2f}", "-i", os.path.join(OUT, "dfu-demo.webm"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-movflags", "+faststart", os.path.join(OUT, "dfu-demo.mp4")], check=True)
        print("wrote", os.path.join(OUT, "dfu-demo.mp4"))
    else:
        print("ffmpeg not found; webm only")

if __name__ == "__main__":
    asyncio.run(main())
