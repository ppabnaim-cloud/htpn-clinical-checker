# Live release check — v11.13

**PASS. All 40 automated checks passed (node exit 0) against the live deployment, backend `webgl`, and all three manual items — model-card figures, formulary arm scoping, case log on the Dashboard — behaved as specified.**
**No `'backend'` page error appeared; no page errors, console errors or failed requests of any kind were observed across either arm.**

Live build stamp served by `https://htpn-clinical-checker.vercel.app/dfu/`:

```
build 2026-11-13 · v11.13
```

Repository tip under test: `4c3c7f5` ("Merge v11.13: model card revised, formulary scoped to arm, case log on the Dashboard").
Neither `dfu/index.html` nor any model file was modified by this run.

---

## 1 · Automated release check

Command:

```
node docs/release-check.mjs https://htpn-clinical-checker.vercel.app --expect v11.13 > /tmp/live7.log 2>&1; echo "exit=$?"
```

- **node exit code: 0** (read from `$?` on the `node` command itself, not through a pipe)
- **wall-clock: 59 s**
- **result: 40 of 40 checks passed**

The deployment was already serving v11.13 on the first attempt, so no retry wait was needed.

### Complete stdout, verbatim

```

Wound Vision release check
  target : https://htpn-clinical-checker.vercel.app/dfu/
  expect : v11.13

  build stamp served: build 2026-11-13 · v11.13
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
  PASS  build stamp is v11.13
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
  ────────────────────────────────────────────────────────────────────────
  40 of 40 checks passed
```

### Failing checks

**None.** All 40 checks passed, so there is no failure detail to report.

### `tf backend` line

```
  tf backend: webgl
```

### Per-sample lines (all seven)

```
    sample 1: abstained (confidence below the threshold)
    sample 2: Image-pattern estimate: 84 %
    sample 3: Image-pattern estimate: 76 %
    sample 4: abstained (confidence below the threshold)
    sample 5: Image-pattern estimate: 8 %
    sample 6: Image-pattern estimate: 79 %
    sample 7: Image-pattern estimate: 74 %
```

Two of seven samples abstained, consistent with the 0.70 confidence threshold the model card states.

---

## Method for items 2–4

A separate Playwright run drove the live deployment in a fresh browser context per arm: entry gate acknowledged (`#ack1`, `#ack2`, Continue), models awaited to `ready` so that `fillModelCard()` had run, then study mode entered **through the UI** — clicking the Study team tab, typing passcode `12345678` into the gate and submitting. The passcode is a mode switch, not a security control. `textContent` was then read directly off the live DOM. Page errors, console errors and HTTP failures were captured throughout both arms.

---

## 2 · The model card reads its figures from the model cards

All five entries rendered real figures. **None read `Loading…` and none contained `not found`**, so every model card was fetched successfully over HTTP at render time.

### `#mcLabels` — verbatim

> Demonstrator labels are WEAK LABELS, not a clinical diagnosis. Severity comes from wound area in the expert masks. Infection is a colour proxy: "suspected" when slough fraction > 0.10 OR necrosis fraction > 0.15 of the wound bed, "none" when slough < 0.01 AND necrosis < 0.02, and images between the two thresholds are excluded from the infection loss entirely. Derived from FUSeg wound masks plus HSV colour thresholds. NOT from clinical diagnosis, tissue culture, or any clinician adjudication. Peri-wound redness was in the first version of the rule and was removed because healthy granulation is also red. The grading session and the Train tab exist precisely to replace all of this.

Required thresholds confirmed: **slough fraction > 0.10** and **necrosis fraction > 0.15**, both quoted explicitly.

### `#mcPerf` — verbatim

> Whole-photo classifier — severity AUC 0.93, accuracy 84 %; infection AUC 0.80, accuracy 75 %. Wound-crop classifier — severity AUC 0.96, accuracy 93 %; infection AUC 0.83, accuracy 82 %. Cropping to the segmented wound is what accounts for the difference. Segmentation — Dice 0.85, IoU 0.76 on 190 held-out images. All figures describe agreement with the weak labels, not clinical accuracy.

### `#mcTissue` — verbatim

> 3-fold cross-validated by case over all 104 usable images, so every image is scored once on a model that never saw it: granulation 0.711, slough 0.495, mean 0.603 over the two classes that can be scored at all. necro, pus, pale never occur in the released annotations, so they cannot be scored and are not in that mean. Slough is the weak class: its percentages should not be presented to clinicians as reliable. Architecture is not the lever — Attention U-Net and DeepLabV3+ were both tried and neither beat this.

Required figures confirmed: **granulation 0.711**, **slough 0.495**, **mean 0.603**, **104 images**, **3 folds**.

### `#mcCal` — verbatim

> Identity plus horizontal, vertical and both flips, probabilities averaged. Infection AUC 0.834 -> 0.863; severity 0.963 -> 0.965. The infection head DECLINES TO ANSWER below a confidence of 0.7, which keeps 66 % of images at 89 % accuracy against 83 % if every image were forced to an answer. An abstention is shown as no estimate at all, and must not be read as a negative. Fitted on the FUSeg validation split against WEAK labels. Refit on clinician-adjudicated, culture-confirmed data before any clinical claim.

Required content confirmed: the **0.7 abstention threshold** is stated, and the entry states explicitly that **"An abstention is shown as no estimate at all, and must not be read as a negative."**

### `#mcVer` — verbatim

> App build 2026-11-13 · v11.13. Segmentation ec6c04985254 · Tissue 03c64607abbe · Whole-photo classifier 1a69624511de · Wound-crop classifier ddbbc08b6cfb. These are sha256 over each model's weights and topology, and the case log records the classifier hash on every row, so a retrain can never be pooled with what came before.

Required content confirmed: carries the **build (`2026-11-13 · v11.13`)** and **four weight hashes** — Segmentation `ec6c04985254`, Tissue `03c64607abbe`, Whole-photo classifier `1a69624511de`, Wound-crop classifier `ddbbc08b6cfb`.

### `#mcTissueN` — verbatim

> 104

Reads **104**, as required.

---

## 3 · The antibiotic formulary shows only its own arm

Severity rows are rendered as `<details><summary>` entries inside `#nagRows`. The quoted text is the full summary `textContent`, which includes the trailing status chip. Both arms were loaded in a fresh browser context, so the rows are populated from the bundled `NAG_DEFAULT`, not from anything this session stored.

### `?arm=dfu` (`DISEASE === 'dfu'`)

Exactly **three** rows, all diabetic foot:

```
Diabetic foot · mild filled in
Diabetic foot · moderate filled in
Diabetic foot · severe filled in
```

**No pressure-injury row is present.** Status line: `3 of 3 severities filled in. These are live in the assessment panel now.`

### `?arm=pi` (`DISEASE === 'pi'`)

Exactly **one** row:

```
Pressure injury · systemic infection filled in
```

**No diabetic-foot rows are present.** Status line: `1 of 1 severities filled in. These are live in the assessment panel now.`

### `NAG_SEV.length`

| Arm | `NAG_SEV.length` | Rows rendered |
|---|---|---|
| `?arm=dfu` | **4** | 3 |
| `?arm=pi` | **4** | 1 |

**`NAG_SEV.length` is 4 in both arms**, as required. In both arms the underlying array still holds all four entries —

```
['Diabetic foot · mild', 'Diabetic foot · moderate', 'Diabetic foot · severe', 'Pressure injury · systemic infection']
```

— while `nagSev()` returns only the current arm's subset. The filtering is therefore display only: no stored formulary data is discarded, so a team filling in both arms on one device loses nothing by switching arms.

---

## 4 · The case log is on the Dashboard

Walking up from `#logCard` to the nearest ancestor whose `id` starts with `tab-`:

```
#logCard → tab-data
```

**The containing tab is `tab-data` (Dashboard), not `tab-train` (Study team)** — as required.

`#logCard` itself renders with non-zero dimensions. All three controls are present and visible within it, confirmed with the Dashboard tab open:

| Control | Selector | Present | Visible | Rendered text |
|---|---|---|---|---|
| Export CSV | `#logCard #exportCsv` | yes | yes | `Export CSV` |
| Import CSV | `#logCard #importCsv` (its `<label>` wrapper) | yes | yes | `Import CSV` |
| Copy for Sheets | `#logCard #copyTsv` | yes | yes | `Copy for Sheets` |

The Import CSV control is a hidden `<input type="file">` inside a visible `<label>` styled as a button, which is why visibility is asserted against the label's bounding box rather than the input.

---

## 5 · The `'backend'` page error

**It did not appear.** Across this run — the 40-check release check plus both formulary arms driven to completion in study mode — the following were all empty:

- page errors: **none** (`PASS no page errors` in the release check; zero `pageerror` events in the items 2–4 run)
- console errors: **none**
- failed requests / HTTP ≥ 400: **none**

There is consequently no stack to quote. This extends the record: the error remains absent and unlocated.

---

## Summary

| Item | Result |
|---|---|
| Live build stamp | `build 2026-11-13 · v11.13` |
| Release check | node exit **0**, **40 of 40 passed**, backend `webgl`, 59 s |
| Model card (5 entries) | all rendered real figures; no `Loading…`, no `not found`; `#mcTissueN` = 104 |
| Formulary `?arm=dfu` | 3 diabetic-foot rows, 0 pressure-injury rows, `NAG_SEV.length` = 4 |
| Formulary `?arm=pi` | 1 pressure-injury row, 0 diabetic-foot rows, `NAG_SEV.length` = 4 |
| Case log | `#logCard` in `tab-data`; Export CSV, Import CSV, Copy for Sheets all present and visible |
| `'backend'` page error | did not appear |
