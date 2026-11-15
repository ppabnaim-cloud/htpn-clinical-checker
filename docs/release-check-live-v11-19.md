# Live release check — v11.19

Ran `node docs/release-check.mjs --expect v11.19 https://htpn-clinical-checker.vercel.app/dfu/` against the deployed site at https://htpn-clinical-checker.vercel.app/dfu/ on 2026-11-15, at commit 59d663d ("v11.19: name the unit on every dashboard figure; list every grader; count ungraded images"). Process exit code: 0.

```

Wound Vision release check
  target : https://htpn-clinical-checker.vercel.app/dfu/
  expect : v11.19

  build stamp served: build 2026-11-15 · v11.19
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

  seeded log: 6 rows rendered, 1 agreement chip(s)
    | clinician W3 RC_101.JPG · 11/14/2026, 2:14:04 PM · still needs culture, outcome, skin type
    | clinician W3 RC_102.JPG · 11/13/2026, 2:14:04 PM · Staph aureus
    | model suspected · clinician W3 RC_103.JPG · 11/12/2026, 2:14:04 PM · E. coli agrees with C&S
    | model none · clinician W3 RC_104.JPG · 11/11/2026, 2:14:04 PM · still needs culture, outcome
    | clinician W3 RC_140.JPG · 10/6/2026, 2:14:04 PM · still needs culture, outcome, skin type
    | clinician ? RC_105.JPG · 11/10/2026, 2:14:04 PM · still needs culture, outcome

  source scan (comments stripped) — advisory, never fails the run:
    ok    "likelihood of infection" appears only in comments
    ok    "0 of 5 criteria seen here" appears only in comments
    ok    "The model declined to classify this image" appears only in comments
    nothing reachable found outside comments

  ────────────────────────────────────────────────────────────────────────
  PASS  build stamp is v11.19
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
  PASS  the readiness table fits its card on a desktop
  PASS  the readiness table has a line for ungraded images
  PASS  the case-log tile names its unit as rows
  PASS  the case-log tile also gives the image count
  PASS  the tissue tile says cases, not class ticks
  PASS  the bare Graders tile is gone
  PASS  no sideways page scroll at 390px · findings
  PASS  no sideways page scroll at 390px · grading
  PASS  no sideways page scroll at 390px · study team
  PASS  no sideways page scroll at 390px · dashboard
  PASS  the readiness table scrolls inside its card on a phone
  ────────────────────────────────────────────────────────────────────────
  60 of 60 checks passed

```
