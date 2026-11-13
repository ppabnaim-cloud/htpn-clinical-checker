# Live release check — v11.3 — 2026-11-13

**VERDICT: FAIL — 24 of 25 checks passed; node exited 1.**
**Live build stamp served: `build 2026-11-13 · v11.3`**

## Command and exit code

```
node docs/release-check.mjs https://htpn-clinical-checker.vercel.app > /tmp/live.log 2>&1; echo "exit=$?"
```

Run from the repository root at commit `edcb216` ("Release check asserts on rendered text, not on the source file").

- **node exit code: 1**
- stdout and stderr were captured together into a single log; the exit code was taken from `$?` on the `node` command itself, not through a pipe.
- **Total wall-clock time: 108 seconds (1 min 48 s).**

## Complete output (verbatim)

```

Wound Vision release check
  target : https://htpn-clinical-checker.vercel.app/dfu/
  expect : v11.3

  build stamp served: build 2026-11-13 · v11.3
  samples found: 7
    sample 1: abstained (confidence below the threshold)
    sample 2: abstained (confidence below the threshold)
    sample 3: Image-pattern estimate: 76 %
    sample 4: abstained (confidence below the threshold)
    sample 5: Image-pattern estimate: 8 %
    sample 6: Image-pattern estimate: 79 %
    sample 7: Image-pattern estimate: 74 %
  grading sub-tabs: Wagner0/5 | Texas0/4 | Antibiotic0/8

  states visited: 17

  source scan (comments stripped) — advisory, never fails the run:
    ok    "likelihood of infection" appears only in comments
    ok    "0 of 5 criteria seen here" appears only in comments
    ok    "The model declined to classify this image" appears only in comments
    nothing reachable found outside comments

  ────────────────────────────────────────────────────────────────────────
  PASS  build stamp is v11.3
  PASS  segmentation model loads
  PASS  at least one sample present
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
  FAIL  no page errors  — Cannot read properties of undefined (reading 'backend')
  PASS  no console errors
  PASS  no failed requests
  PASS  no HTTP >= 400
  ────────────────────────────────────────────────────────────────────────
  24 of 25 checks passed

  FAILED:
    no page errors — Cannot read properties of undefined (reading 'backend')

```

## Checks that did not pass

| Check | Detail printed by the script |
| --- | --- |
| `no page errors` | `Cannot read properties of undefined (reading 'backend')` |

All other 24 checks passed, including every `visible:` / `never visible:` text assertion, `no console errors`, `no failed requests` and `no HTTP >= 400`.

## Build stamp

```
build stamp served: build 2026-11-13 · v11.3
```

The `build stamp is v11.3` check passed.

## Per-sample lines (all seven)

| Sample | Result |
| --- | --- |
| 1 | abstained (confidence below the threshold) |
| 2 | abstained (confidence below the threshold) |
| 3 | Image-pattern estimate: 76 % |
| 4 | abstained (confidence below the threshold) |
| 5 | Image-pattern estimate: 8 % |
| 6 | Image-pattern estimate: 79 % |
| 7 | Image-pattern estimate: 74 % |

Three samples abstained (1, 2, 4); four rendered an `Image-pattern estimate` (3, 5, 6, 7).

## Source scan (verbatim)

```
  source scan (comments stripped) — advisory, never fails the run:
    ok    "likelihood of infection" appears only in comments
    ok    "0 of 5 criteria seen here" appears only in comments
    ok    "The model declined to classify this image" appears only in comments
    nothing reachable found outside comments
```

No `WARN` was raised. All three entries are `ok`, and the scan concluded "nothing reachable found outside comments".

## Notes

- The script did not crash: it completed its full sweep (17 states visited, 7 samples, 3 grading sub-tabs) and exited 1 because of the assertion failure, not because the check "could not run" (which would be exit 2).
- The failure is a page-level JavaScript error surfaced during the run — `Cannot read properties of undefined (reading 'backend')` — recorded against the `no page errors` check. Notably `no console errors` passed, so the error was captured via the page-error channel rather than as a console message.
- No attempt was made to diagnose or fix the application, per the brief.
