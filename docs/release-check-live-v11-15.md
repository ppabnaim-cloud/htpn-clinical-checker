# Live release check — v11.15

**Verdict: PASS. 49 of 49 checks passed against the live deployment, node exit code 0, TensorFlow backend `webgl`, and the agreement chip count is exactly 1 — the v11.15 fix holds in production.**
**The seed does not leak: a fresh browser context shows 0 rows in `#logList`, and the `'backend'` page error did not appear.**

Live build stamp served: `build 2026-11-14 · v11.15` (matches the working tree's `BUILD = '2026-11-14 · v11.15'`).

## 1 · The run

```
node docs/release-check.mjs https://htpn-clinical-checker.vercel.app --expect v11.15 > /tmp/live8.log 2>&1
```

| | |
|---|---|
| node exit code | **0** (read from `$?` on the node command itself, not through a pipe) |
| wall-clock | **80 s** |
| checks | **49 of 49 passed**, 0 failed |
| tf backend | `webgl` |
| date run | 2026-11-14 |

No check failed, so there is no failure detail to report.

### `tf backend` and the seven per-sample lines, verbatim

```
  tf backend: webgl
  samples found: 7
    sample 1: abstained (confidence below the threshold)
    sample 2: Image-pattern estimate: 84 %
    sample 3: Image-pattern estimate: 76 %
    sample 4: abstained (confidence below the threshold)
    sample 5: Image-pattern estimate: 8 %
    sample 6: Image-pattern estimate: 79 %
    sample 7: Image-pattern estimate: 74 %
```

Two of the seven abstained and five returned an estimate. That is the expected
shape of this sample set and matches earlier runs; abstention is the model
declining a low-confidence image, not a fault.

### Complete stdout, verbatim

```
Wound Vision release check
  target : https://htpn-clinical-checker.vercel.app/dfu/
  expect : v11.15

  build stamp served: build 2026-11-14 · v11.15
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

  seeded log: 5 rows rendered, 1 agreement chip(s)
    | clinician W3 RC_101.JPG · 11/13/2026, 1:30:05 AM · still needs culture, outcome, skin type
    | clinician W3 RC_102.JPG · 11/12/2026, 1:30:05 AM · Staph aureus
    | model suspected · clinician W3 RC_103.JPG · 11/11/2026, 1:30:05 AM · E. coli agrees with C&S
    | model none · clinician W3 RC_104.JPG · 11/10/2026, 1:30:05 AM · still needs culture, outcome
    | clinician W3 RC_140.JPG · 10/5/2026, 1:30:05 AM · still needs culture, outcome, skin type

  source scan (comments stripped) — advisory, never fails the run:
    ok    "likelihood of infection" appears only in comments
    ok    "0 of 5 criteria seen here" appears only in comments
    ok    "The model declined to classify this image" appears only in comments
    nothing reachable found outside comments

  ────────────────────────────────────────────────────────────────────────
  PASS  build stamp is v11.15
  PASS  build stamp is visible to a tester
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
  PASS  the case-log storage key is readable
  PASS  seeded log renders its rows
  PASS  no "model ?" placeholder
  PASS  an incomplete row says what it needs
  PASS  exactly one agreement chip, on the row with culture AND prediction
  PASS  storage note leads with the risk
  PASS  storage note reports Sheet coverage
  PASS  storage note separates export from send
  PASS  no page or console errors with a populated log
  ────────────────────────────────────────────────────────────────────────
  49 of 49 checks passed
```

The raw log is committed alongside this report as `docs/release-check-live-v11-15.log`.

## 2 · The nine seeded-log checks

These nine had never run against the deployment before. All nine passed.

| Check | Result |
|---|---|
| the case-log storage key is readable | PASS |
| seeded log renders its rows | PASS |
| no "model ?" placeholder | PASS |
| an incomplete row says what it needs | PASS |
| **exactly one agreement chip, on the row with culture AND prediction** | **PASS** |
| storage note leads with the risk | PASS |
| storage note reports Sheet coverage | PASS |
| storage note separates export from send | PASS |
| no page or console errors with a populated log | PASS |

### The chip count — the single most important fact in this report

```
  seeded log: 5 rows rendered, 1 agreement chip(s)
```

**Exactly 1.** That is the required value and it is two-sided:

- **0 chips** would have meant the agreement comparison never renders at all —
  the feature silently absent while a one-sided assertion passed.
- **2 chips** would have meant the comparison fires on a row holding a
  prediction but no culture result, which is precisely the defect v11.15 fixed.
  The seed plants that probe deliberately: row 4 carries `p_infection: 0.42`
  and `ai_label: 'none'` with the `culture_positive` key **absent altogether**,
  not set to `null`. The old guard tested `!== null`, which `undefined` passes,
  so it drew a chip there. The current build does not.

The five seeded rows as rendered, verbatim:

```
    | clinician W3 RC_101.JPG · 11/13/2026, 1:30:05 AM · still needs culture, outcome, skin type
    | clinician W3 RC_102.JPG · 11/12/2026, 1:30:05 AM · Staph aureus
    | model suspected · clinician W3 RC_103.JPG · 11/11/2026, 1:30:05 AM · E. coli agrees with C&S
    | model none · clinician W3 RC_104.JPG · 11/10/2026, 1:30:05 AM · still needs culture, outcome
    | clinician W3 RC_140.JPG · 10/5/2026, 1:30:05 AM · still needs culture, outcome, skin type
```

Reading those five rows against what the seed planted confirms the guard is
discriminating on the right thing rather than passing by luck:

- Row 3 (`RC_103`) is the only row with **both** a culture result (`E. coli`,
  `culture_positive: true`) and a prediction (`p_infection: 0.81`), and it is
  the only row carrying the agreement chip — `E. coli agrees with C&S`.
- Row 4 (`RC_104`) is the probe. It shows `model none`, so the prediction *is*
  rendered, and it still draws no chip. The chip's absence is therefore the
  guard working, not the prediction failing to render.
- Row 2 (`RC_102`) has a culture and no prediction: no chip, correctly, and no
  `model ?` placeholder.
- Rows 1 and 5 state what they still need rather than showing blanks.

## 3 · The seeding does not leak

The seed writes to `localStorage` in a throwaway Playwright context. Verified
it does not persist into real browser state.

Method: a **fresh** browser context against
`https://htpn-clinical-checker.vercel.app/dfu/?arm=dfu`, entry gate passed,
study mode entered by typing the passcode `12345678` into the real passcode
dialogue and clicking Unlock (a mode switch, not a security control — as the
app's own note says), then the Dashboard opened and `#logList` counted.

```
gate passed                             : true
LOG_KEY                                 : dfu_vision_cases_v1
localStorage[LOG_KEY]                   : (null — key absent)
all localStorage keys                   : ["wv_detail_v1","wound_vision_study_mode",
                                           "wv_usage_v1","dfu_vision_cases_v1_sheettrack"]
passGate visible after Dashboard click  : true
passGate visible after unlock           : false
studyMode                               : true
#logList present                        : true
tab-data visible                        : true
ROWS IN #logList (fresh context)        : 0
agreement chips                         : 0
#logList innerText                      : ""
errors captured                         : 0
```

**Rows seen: 0.** Required value. No contamination.

Three things make that a real negative rather than a page that simply failed to
render:

1. `#logList` is present and `tab-data` is visible, so the card did render — it
   rendered empty.
2. Study mode was genuinely entered through the passcode dialogue
   (`passGate` appeared on the Dashboard click, disappeared after Unlock,
   `studyMode === true`), so the Dashboard was not merely still gated.
3. `localStorage[LOG_KEY]` is `null` — the key is absent, not an empty array —
   and `wound_vision_sheet_url`, which the seed sets, is likewise absent.

One key in the fresh profile does share the log's prefix:
`dfu_vision_cases_v1_sheettrack`. That is not seed residue. The app writes it
itself on first load if it is missing — `dfu/index.html:6010`:

```js
try { if (!localStorage.getItem(LOG_KEY + '_sheettrack')) localStorage.setItem(LOG_KEY + '_sheettrack', String(Date.now())); } catch(e){}
```

The other three keys (`wv_detail_v1`, `wound_vision_study_mode`, `wv_usage_v1`)
are this session's own first-run state, written by passing the gate and
entering study mode.

## 4 · The `'backend'` page error

**Did not appear.** Still absent.

The release check reported `PASS no page errors`, `PASS no console errors` and
`PASS no page or console errors with a populated log`. The separate fresh-context
run of item 2 captured 0 page errors and 0 console errors, and a search of both
message and stack text for `backend` returned 0 matches.

Running total: absent across 60 inferences in seven sessions (53 in six, plus
the 7 in this run), never located. Nothing to quote. It remains unreproduced
rather than fixed, so the next check should keep watching for it; page errors
here carry six stack frames, which is what to capture if it ever fires.

## Summary

| | |
|---|---|
| node exit code | 0 |
| checks | 49 / 49 passed, 0 failed |
| agreement chips | **1** (required: exactly 1) |
| rows in a fresh context | **0** (required: 0) |
| tf backend | `webgl` |
| live build stamp | `build 2026-11-14 · v11.15` |
| `'backend'` page error | did not appear |
