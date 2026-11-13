# Live release check — v11.11 on the Vercel deployment

**PASS — 39 of 39 checks passed, node exit code 0.**
**Live build stamp served: `build 2026-11-13 · v11.11`, tf backend `webgl`.**

First live run since v11.4. Seven builds landed in between (v11.5 → v11.11) and nothing
regressed: no check failed, no page error, no console error, no failed request, no HTTP ≥ 400.

- Target: `https://htpn-clinical-checker.vercel.app/dfu/`
- Repository tip checked against: `1fc470d` ("Capture the grader's unaided call before the app can contaminate it (v11.11)")
- Run date: 13 November 2026

## 1 · The release check

```
node docs/release-check.mjs https://htpn-clinical-checker.vercel.app --expect v11.11 > /tmp/live4.log 2>&1; echo "exit=$?"
```

- **node exit code: 0** (read from `$?` on the node command itself, not through a pipe)
- **Wall-clock time: 75 s** (the 20-minute allowance was not needed; the deployment was already
  warm and every inference settled well inside its 120 s timeout)
- Deployment was serving v11.11 on the first attempt — no retry loop was required.

Complete stdout:

```
Wound Vision release check
  target : https://htpn-clinical-checker.vercel.app/dfu/
  expect : v11.11

  build stamp served: build 2026-11-13 · v11.11
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
  PASS  build stamp is v11.11
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
  PASS  visible: "This screen can reach two of"
  PASS  visible: "Peri-wound erythema beyond 0.5 cm"
  PASS  visible: "no detector is trained yet"
  PASS  visible: "clinical examination"
  PASS  visible: "either is severe"
  PASS  visible: "1,000 everyday object classes"
  PASS  visible: "not whether the wound is infected"
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
  39 of 39 checks passed
```

### Failing checks

None. There is no failure detail string to report.

### Backend and per-sample lines

```
  tf backend: webgl
```

All seven samples, verbatim:

```
    sample 1: abstained (confidence below the threshold)
    sample 2: Image-pattern estimate: 84 %
    sample 3: Image-pattern estimate: 76 %
    sample 4: abstained (confidence below the threshold)
    sample 5: Image-pattern estimate: 8 %
    sample 6: Image-pattern estimate: 79 %
    sample 7: Image-pattern estimate: 74 %
```

Two samples abstained (1 and 4). That is the abstention threshold doing its job, not a fault —
the check asserts each sample *finishes inference*, which all seven did.

### The `'backend'` page error

**It did not appear.** `no page errors` passed with an empty detail string, and a separate
browser probe of the same deployment also recorded `PAGE_ERRORS=0`. So there is no stack to
quote, and the record still has no stack for `Cannot read properties of undefined (reading
'backend')`.

That absence is now the fourth consecutive clean observation: it failed the first live run of
v11.3, then was absent across twenty-nine inferences in three later sessions, and is absent
again here across seven sample inferences plus ten batch-predict inferences. The error handler
is in place and would have captured six stack frames had it fired. Nothing in this run narrows
down what caused it in v11.3; it remains unexplained rather than fixed.

## 2 · Does the footer build stamp still render?

**Yes — the JavaScript writes the stamp correctly on the live page.** Observed values, read
from the deployment after passing the entry gate:

| What was read | Observed on the live page |
| --- | --- |
| `#buildStamp` element exists | `true` |
| `#buildStamp.textContent` | `build 2026-11-13 · v11.11` |
| `#buildStamp.innerHTML` | `build 2026-11-13 · v11.11` |
| `BUILD` | `2026-11-13 · v11.11` |
| `CARDS['Wound-crop model'].weights_sha256` | `ddbbc08b6cfbf2bc48eaf5d783f72e105c84658853d010dc632b9c276d630312` |
| `Object.keys(CARDS)` | `Whole-photo model \| Wound-crop model` |

Both `BUILD` and `CARDS['Wound-crop model'].weights_sha256` are readable from the page, neither
threw, and the version is therefore not invisible: the start-up line ran and populated the empty
span.

### One thing worth knowing, which the pass does not tell you

The span is **not visible to a non-study user**, and was not before this change either. It
carries `class="study-hide"`, and `setStudyMode(false)` adds `study-only`, which is
`display:none !important`. On the live page in the `?arm=dfu` tester view the element measures
0 × 0, `offsetParent` is `null`, and `document.body.innerText` does not contain `v11.11`.

This is pre-existing design, not a v11.11 regression — `git show` confirms the span has carried
`study-hide` at every build back to v11.4. But it means the release check's assertion, which
reads `textContent`, proves the *write* succeeded and not that anyone can *see* the stamp. If the
intent is that a tester can read the build off the screen, that is a separate change.

Two small corrections to the brief, both verified against history:

- The stamp moved from literal markup to a JS-written `BUILD` constant at **v11.10**
  (`e985f5f`), not v11.11. v11.11 inherits it and bumps the string.
- A side effect of that move: `release-check.mjs` derives its default `EXPECT` by regexing the
  stamp out of the *local* `dfu/index.html` markup. With the span now empty, that regex no
  longer matches, so a run without `--expect` falls through to "(not specified)" and silently
  stops comparing versions. This run passed `--expect v11.11` explicitly, so it was unaffected,
  but the default path is now a no-op and worth repairing.

## 3 · The two new tools against the deployment

Both ran against the live site for the first time. Both behaved correctly.

### batch-predict

The clone carries no study images, so the app's own ten samples were fetched over HTTP from
`https://htpn-clinical-checker.vercel.app/dfu/samples/` (all returned HTTP 200) into a scratch
directory.

```
printf 'image,px_per_cm\n*,38.2\n' > /tmp/scales.csv
node docs/batch-predict.mjs /tmp/imgs --base https://htpn-clinical-checker.vercel.app --scales /tmp/scales.csv --out /tmp/predictions.csv
```

Exit code **0**, wall-clock **97 s**.

- **Build printed:** `2026-11-13 · v11.11`
- **Model sha printed:** `ddbbc08b6cfbf2bc` (truncated by the tool; full value
  `ddbbc08b6cfbf2bc48eaf5d783f72e105c84658853d010dc632b9c276d630312`, identical to the sha read
  off the page in item 2)
- **10 of 10 images produced a prediction**
- **10 carry an erythema distance** (see the caveat below)

Per-image lines, verbatim:

```
  [  1/10] landscape_offcentre.jpg            AWAITING YOUR EXAMINATION    79 %  ery 2.513 cm
  [  2/10] large_ankle_ulcer.jpg              AWAITING YOUR EXAMINATION    80 %  ery 0.471 cm
  [  3/10] necrotic_forefoot_ulcer.jpg        AWAITING YOUR EXAMINATION    35 %  ery 2.513 cm
  [  4/10] pi_cavity.jpg                      AWAITING YOUR EXAMINATION    6 %  ery 2.408 cm
  [  5/10] pi_granulating.jpg                 AWAITING YOUR EXAMINATION    0 %  ery 0.366 cm
  [  6/10] pi_sloughy.jpg                     AWAITING YOUR EXAMINATION    4 %  ery 2.513 cm
  [  7/10] plantar_eschar_ulcer.jpg           AWAITING YOUR EXAMINATION    9 %  ery 2.408 cm
  [  8/10] portrait_phone.jpg                 AWAITING YOUR EXAMINATION    76 %  ery 0.209 cm
  [  9/10] sloughy_heel_ulcer.jpg             AWAITING YOUR EXAMINATION    87 %  ery 0.105 cm
  [ 10/10] small_leg_ulcer.jpg                AWAITING YOUR EXAMINATION    52 %  ery 0.89 cm
```

Every row reports `AWAITING YOUR EXAMINATION`, which is correct: no examiner finding was
supplied, so no criterion is confirmed and the app may not conclude anything.

**`app_build` and `model_sha` are populated on all ten rows**, with a single distinct value each
(`2026-11-13 · v11.11` and `ddbbc08b…630312`), so `join-labels` raises no "do not pool these"
warning.

**Censoring at the band limit is correct.** The search band is 2.5 cm; at 38.2 px/cm the
quantised saturation distance is 2.513 cm. All three rows that reach it carry
`ery_censored = true`, and no row below it does:

| image | `ery_cm` | `ery_censored` | `ery_state` |
| --- | --- | --- | --- |
| landscape_offcentre.jpg | 2.513 | **true** | present |
| necrotic_forefoot_ulcer.jpg | 2.513 | **true** | present |
| pi_sloughy.jpg | 2.513 | **true** | present |
| pi_cavity.jpg | 2.408 | false | present |
| plantar_eschar_ulcer.jpg | 2.408 | false | present |
| small_leg_ulcer.jpg | 0.89 | false | present |
| large_ankle_ulcer.jpg | 0.471 | false | absent |
| sloughy_heel_ulcer.jpg | 0.105 | false | absent |
| pi_granulating.jpg | 0.366 | false | **unmeasurable** |
| portrait_phone.jpg | 0.209 | false | **unmeasurable** |

**One finding that is not a failure but matters for the analysis file.** Two rows carry a numeric
`ery_cm` while `ery_state` is `unmeasurable`. In the app, `unmeasurable` means the ring or
reference region held fewer than 50 pixels, and the interface then shows the clinician *no*
distance at all — but `tissueMap` still returns `extentCm`, and batch-predict writes it out. So
the tool's closing count, "10 carry an erythema distance", overstates the number of
interpretable measurements: on these data it is 8, not 10. Anyone pooling `ery_cm` should filter
on `ery_state` first. The honest blank the tool's own header comment promises for
`needs-scale` is not applied to `unmeasurable`.

### join-labels

A synthetic case log was built with the required awkward cases: two graders on
`pi_granulating.jpg`, one image with no prediction (`P999_never_captured.jpg`), seven
predictions with no label, a `case_id` column, and free text in `sensitivity_notes` carrying
both a comma and escaped double quotes.

```
node docs/join-labels.mjs /tmp/caselog.csv /tmp/predictions.csv --out /tmp/merged.csv
```

**Exit code 1**, as specified, because one label row went unmatched.

Summary, verbatim:

```
  wrote /tmp/merged.csv

  label rows           4
  distinct images      3
  distinct patients    3
  double-graded images 1
  rows with an app prediction  3 of 4
  !  1 label rows had NO prediction: P999_never_captured.jpg
  !  8 predictions matched no label: landscape_offcentre.jpg, necrotic_forefoot_ulcer.jpg, pi_cavity.jpg, pi_sloughy.jpg, plantar_eschar_ulcer.jpg, … (+3)
  predictions with an erythema distance  10 of 10

  Analyse per image (or per patient via case_id), never per label row:
  1 images carry more than one grader, so label rows are not independent.
```

Verified in `/tmp/merged.csv`:

- **Free text survived intact.** Every `sensitivity_notes` value round-tripped byte-for-byte,
  including `Grader A: "mostly granulating", no erythema seen` — comma and both quotes preserved
  through write and re-parse.
- **Colliding columns were prefixed `app_`.** `when` and `model` exist in both files and appear
  as `app_when` and `app_model`; the graders' own `when` and `model` are untouched
  (`2026-11-13T09:00:00Z` / `human-eye` survive beside `2026-11-13T15:01:21.664Z` /
  `Wound-crop model`). Note that `app_build` is the prediction file's own column name and is not
  a collision rename — the only true collisions here were `when` and `model`.
- **The unjoined row's prediction cells are empty, not zero.** Every prediction column on the
  `P999_never_captured.jpg` row is the empty string: `app_when`, `app_model`, `app_build`,
  `model_sha`, `p_infection`, `p_severe`, `ery_cm`, `ery_censored`, `verdict`,
  `criteria_count`, `inference_ms`, `probs`, `frac_gran`. No `0` or `0.000` appears in any of
  them, and `prediction_joined = no`.
- **The one-to-many join is right.** Both `pi_granulating.jpg` rows carry the same prediction
  (`p_infection = 0.003345042816363275`, `ery_cm = 0.366`) and `n_graders_for_image = 2`, so the
  non-independence is visible in the file rather than inferred.

## Summary

| Item | Result |
| --- | --- |
| Release check | 39/39 passed, exit 0, 75 s |
| Live build stamp | `build 2026-11-13 · v11.11` |
| tf backend | `webgl` |
| `'backend'` page error | Did not appear; no stack to record |
| Footer stamp rendered | Yes — written by JS; hidden by `study-hide` outside study mode, as in every build since v11.4 |
| batch-predict | Clean: exit 0, 10/10 predictions, build and sha populated, band-limit censoring correct |
| join-labels | Clean: exit 1 by design on the unmatched label row, quoting and prefixing correct, blanks not zeros |

Two things to pick up separately, neither of which failed this run: `release-check.mjs`'s
default `EXPECT` no longer resolves from the local markup, and batch-predict writes `ery_cm` on
rows the app itself treats as unmeasurable.
