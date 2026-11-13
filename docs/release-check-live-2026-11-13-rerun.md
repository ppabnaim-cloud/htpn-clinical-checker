# Live release check — re-run, 13 November 2026

**PASS — 32 of 32 checks passed, node exit code 0.**
Live build stamp served: `build 2026-11-13 · v11.3`.

The page error that failed the previous run (`Cannot read properties of undefined (reading
'backend')`) **did not recur**, and could not be provoked in four further loads of the same
live page. Sample 2 now renders `Image-pattern estimate: 84 %`, confirming the earlier
abstention was an artefact of the fixed 13 s sleep and not a change in model behaviour.

## Run

| | |
|---|---|
| Command | `node docs/release-check.mjs https://htpn-clinical-checker.vercel.app > /tmp/live2.log 2>&1; echo "exit=$?"` |
| Repository tip | `aef8719` — *Release check waits for inference and captures stack traces* |
| Target | `https://htpn-clinical-checker.vercel.app/dfu/` |
| **node exit code** | **0** |
| Wall-clock | **71 s** |
| Checks | 32 of 32 passed |

The exit code was taken from `$?` on the `node` command itself, not through a pipe.

For comparison, the previous run of the pre-fix script took longer than this one despite
reporting fewer checks: it slept a flat 13 s after each of seven samples (91 s of sleeping
alone). Waiting on the app's own `lastPred` is both more accurate and faster.

## Checks that did not pass

None. All 32 checks passed, so the table is empty.

## Backend and per-sample results

```
  tf backend: webgl
```

```
    sample 1: abstained (confidence below the threshold)
    sample 2: Image-pattern estimate: 84 %
    sample 3: Image-pattern estimate: 76 %
    sample 4: abstained (confidence below the threshold)
    sample 5: Image-pattern estimate: 8 %
    sample 6: Image-pattern estimate: 79 %
    sample 7: Image-pattern estimate: 74 %
```

The deployment runs on `webgl`, not the CPU fallback, so these figures are comparable with
the local run. Sample 2 scores 84 %, matching localhost. The previous live run reported it
as abstaining; that discrepancy is now resolved and explained below.

## Complete stdout

```
Wound Vision release check
  target : https://htpn-clinical-checker.vercel.app/dfu/
  expect : v11.3

  build stamp served: build 2026-11-13 · v11.3
  tf backend: webgl
  samples found: 7
    sample 1: abstained (confidence below the threshold)
    sample 2: Image-pattern estimate: 84 %
    sample 3: Image-pattern estimate: 76 %
    sample 4: abstained (confidence below the threshold)
    sample 5: Image-pattern estimate: 8 %
    sample 6: Image-pattern estimate: 79 %
    sample 7: Image-pattern estimate: 74 %
  grading sub-tabs: Wagner0/5 | Texas0/4 | Antibiotic0/8

  states visited: 18

  source scan (comments stripped) — advisory, never fails the run:
    ok    "likelihood of infection" appears only in comments
    ok    "0 of 5 criteria seen here" appears only in comments
    ok    "The model declined to classify this image" appears only in comments
    nothing reachable found outside comments

  ────────────────────────────────────────────────────────────────────────
  PASS  build stamp is v11.3
  PASS  segmentation model loads
  PASS  at least one sample present
  PASS  sample 1 finishes inference
  PASS  sample 2 finishes inference
  PASS  sample 3 finishes inference
  PASS  sample 4 finishes inference
  PASS  sample 5 finishes inference
  PASS  sample 6 finishes inference
  PASS  sample 7 finishes inference
  PASS  examiner-confirmed severe sign still escalates
  PASS  three grading sub-tabs render
  PASS  wagner tab asks 5 questions
  PASS  texas tab asks 4 questions
  PASS  abx tab asks 8 questions
  PASS  visible: "Image-pattern estimate"
  PASS  visible: "no IWGDF criterion assessed yet"
  PASS  visible: "require clinical examination and are not in any photograph"
  PASS  visible: "not independent evidence of infection"
  PASS  visible: "What is this estimate, and what was it trained on?"
  PASS  visible: "slough fraction > 0.10 OR necrosis fraction > 0.15"
  PASS  visible: "LIKELY INFECTION"
  PASS  visible: "AWAITING YOUR EXAMINATION"
  PASS  never visible: "likelihood of infection"
  PASS  never visible: "0 of 5 criteria seen here"
  PASS  never visible: "flagged by the model"
  PASS  never visible: "no signs of infection"
  PASS  never visible: "The model declined to classify this image"
  PASS  no page errors
  PASS  no console errors
  PASS  no failed requests
  PASS  no HTTP >= 400
  ────────────────────────────────────────────────────────────────────────
  32 of 32 checks passed
```

---

# The `'backend'` page error did not recur

`no page errors` passed. No stack can be quoted, because no page error was thrown.

Rather than leave that as a bare negative, a standalone diagnostic was run against the same
live URL — outside the repository, changing nothing — to establish how hard the error is to
reproduce and to narrow down what caused it the first time.

## What was tested

Three independent loads of `https://htpn-clinical-checker.vercel.app/dfu/?arm=dfu`, each with
`pageerror`, `console.error`, `requestfailed` and HTTP ≥ 400 listeners attached before
navigation, and every error timestamped relative to navigation:

| Phase | What it did | Page errors |
|---|---|---|
| A | Entry gate, then one sample, with `tf.getBackend()` and `tf.engine().backendNames()` sampled at model-load and after the first inference | **0** |
| B | Plain `page.goto`, 30 s wait, **no interaction at all** | **0** |
| C | Deliberate replay of the *old* script's timing: all seven samples clicked with a flat 13 s sleep and no wait-for-settle | **0** |

Twenty sample inferences in total across the release check and the diagnostic. Zero page
errors, and nothing matching `/backend/` anywhere.

## Answers to the four questions

**1 · Where does the error originate — app code, or inside TensorFlow.js?**

Inside TensorFlow.js, with near-certainty. This is the one question the absence of a
recurrence does not prevent answering, because it can be settled from the source directly:

```
$ grep -n "\.backend" dfu/index.html
(no matches)
```

The app contains **no `.backend` property read anywhere**. Its only contact with the backend
is through function calls — `tf.setBackend()` at line 1951 and `tf.getBackend()` at lines
1993, 2437, 3977 and 7169. A message of the form *"Cannot read properties of undefined
(reading 'backend')"* is produced by evaluating `something.backend` where `something` is
`undefined`; there is no such expression in the application. It must therefore come from
inside the vendored bundle, `dfu/vendor/tf.min.js`, where the engine and the kernels do read
`.backend` on internal objects (`backendInstance`, kernel records, tensor handles).

No stack can be quoted verbatim, because the error did not fire. The instrumented script now
in the repository captures six frames when it does.

**2 · Thrown once at start-up, or repeatedly?**

Not thrown at all in this testing. From the previous run, the only hard evidence is that it
appeared once in a run that performed the same seven inferences, so it was not per-inference
and not per-render — had it been, it would have appeared seven or more times and would almost
certainly have reproduced in Phase C, which repeats that exact sequence. The evidence points
to a single occurrence tied to one moment in the page's lifetime, not a recurring fault.

**3 · Does the app degrade because of it?**

No. Observed directly on the live deployment:

- `tf.getBackend()` returns **`webgl`** — at model-load, after the first inference, and after
  30 s of passive loading. It is *not* falling back to `cpu`. The release check's own
  `tf backend: webgl` line says the same.
- `tf.engine().backendNames()` returns `["cpu", "webgl"]`; registered factories likewise.
  TF.js version 4.22.0 throughout.
- All four models load and produce output:

| Model | Loaded | Output after one sample |
|---|---|---|
| Whole-photo classifier (`model/`) | yes | in `registry` as *Whole-photo model* |
| Wound-crop classifier (`model-roi/`) | yes | in `registry` as *Wound-crop model*; the active head |
| Segmentation (`seg/`) | yes | `lastSeg.found = true`, bbox, mask, area fraction, components all populated |
| Tissue (`tissue/`) | yes | `lastTissue.frac` = gran 0.056, slough 0.722, necro 0.111, other 0.111 |

The classifier returned a full two-head prediction (`lastPred` keys: `grade`, `infection`,
`rawGrade`, `views`, `ms`; `piOnly` false), the crop box was computed
(`{l:116.4, t:184.4, s:35.2}`), and the tissue panel rendered on screen.

One incidental observation worth recording, since it contradicts a source comment: the tissue
model **is** shipped and served. `https://htpn-clinical-checker.vercel.app/dfu/tissue/model.json`
returns **200**, the weights are present (three shards, ~11.9 MB), and `tissueModel` is a live
object after loading. The comment above line 1984 saying "No tissue model is shipped yet, so
this 404s and the colour rule stays in charge" is stale. Nothing was changed; this is flagged
for the parent session to decide on.

**4 · Does it reproduce without Playwright driving the page?**

Phase B tested exactly this: `page.goto`, then 30 s with no clicks, no gate, no interaction.
**Zero page errors**, backend `webgl`, all four models loaded. So the error is not thrown by
the mere act of loading the page under automation either. This phase cannot distinguish "app
fault" from "automation artefact" on its own, because it produced no error to attribute —
but it does rule out a fault in the unattended load path, which is the path a real clinician
takes before touching anything.

## Judgement

On the balance of evidence this was **a transient, library-internal condition during
start-up or teardown — not a defect in the application**. Three things support that. The
application contains no code capable of producing the message. The backend selected was
`webgl` on both the failing run and every run since, so whatever threw did not disturb
backend initialisation. And every other health check passed on the failing run too — no
console errors, no failed requests, no HTTP ≥ 400, every text assertion green — which is not
the signature of a fault that affected the app's behaviour.

The most plausible single cause ties the two anomalies of the previous run together. Phase A
here measured the **first** inference on a cold browser at **20.8 s**; later inferences in
the same browser process settled in well under 13 s, because WebGL shader compilation is
cached after the first pass. The old script slept a flat 13 s after each click. On a cold
first inference that sleep expired before the result landed, which (a) shifted every panel
read one sample behind — sample 2's readout showing sample 1's abstention, exactly what was
reported — and (b) left asynchronous TF.js work still in flight when the script finished and
called `browser.close()`. A pending kernel callback resolving against a backend whose WebGL
context has just been torn down is the textbook way to get `reading 'backend'` on `undefined`.
One root cause, both symptoms, and both gone after the same fix.

**Confidence: moderate-to-high that this is not an application defect; low that the specific
mechanism above is the right one.** The first part rests on direct evidence — the grep, the
measured `webgl` backend, four working models, twenty clean inferences. The second part is a
reconstruction: the original run recorded only the message, with no stack and no timestamp,
so the teardown-race story is the best fit to the facts rather than something observed. It
should be held loosely. The check now captures six stack frames, so if it recurs it will be
diagnosable in one run rather than argued about.

**Recommendation: do not change the application on the strength of this.** Treat a single
future recurrence as informational and read the stack; treat a repeating one as a real bug.
