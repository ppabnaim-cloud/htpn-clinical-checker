# Building a clinical AI prototype: a transferable playbook

Written so a new chat can start on a **different clinical topic** and reach the same standard
without re-deriving any of it. Nothing below is specific to the diabetic foot ulcer; the wound
work is used only as the worked example, with its real numbers, so each rule has evidence
attached rather than being an assertion.

Prepared for Dr Naim Bin Abdul Malek, HTPN. 9 November 2026.

---

## 0. How to use this in a new chat

Paste section 1 and section 2 at the start, then add the three lines under "Fill this in".
Everything after section 2 is reference the assistant can read when it needs it, so attach the
whole file rather than pasting it all.

### Fill this in

```
TOPIC            the clinical question, in one sentence
WHAT A CAMERA    which findings an image could plausibly carry
  CAN SEE
WHAT IT CANNOT   which findings need hands, history, or a laboratory
REFERENCE        what counts as truth, and who decides it
  STANDARD
PUBLISHED RULE   the scoring system, staging or guideline that already defines
                 the output, if one exists
```

That last row decides most of the architecture. If a published rule exists, the model should
not predict the output: it should supply the inputs the rule is made of, and the rule computes
the answer. If no rule exists, say so, because then the project is a prediction study with all
the extra obligations that implies.

---

## 1. The pattern

A clinical decision-support prototype that is honest about what it knows, built as a single
HTML file that runs entirely in the browser.

**Pipeline.** Four roles, not four models for their own sake.

| Role | What it does | Why it is separate |
|---|---|---|
| Localise | Find the region of interest in the photograph | Everything downstream improves when it is not reading the whole frame |
| Characterise | Classify or segment inside that region | It is the only part a camera can answer |
| Decide | Apply the published rule to the findings | Auditable, and does not need training data |
| Act | Show the guideline-sourced next step | Entered by the clinical team, never written into the code |

**Division of labour.** The model supplies what the camera can see. The clinician supplies the
rest. The interface must make it obvious which is which on every line.

**Privacy as an architectural constraint, not a policy.** Inference runs in the page; there is
no upload endpoint in the client. This is worth stating because it caps model size: a backbone
too large to ship to a phone is unavailable to you whatever it scores in a paper. Decide early
whether that constraint is real, because it rules out most of the leaderboard.

---

## 2. The rules that matter most

These were all adopted after something went wrong. They transfer unchanged to any topic.

### Clinical safety

1. **A model may escalate a concern, never clear one.** An uncalibrated probability is evidence
   that something may be wrong. It is never evidence that nothing is. Low model output must not
   be able to produce a reassuring headline.
2. **The headline may never contradict the evidence shown above it.** If a row says a sign is
   present, no summary beneath it may say there are none. This is the single most dangerous
   defect class in this kind of interface, and it is easy to ship by accident, because the
   verdict and the findings are usually computed in different places.
3. **State the conclusion as a count against named criteria**, not as a model output, whenever
   the guideline defines one. A clinician can check a count at the bedside. They cannot check a
   probability.
4. **Every displayed finding carries its provenance** — which model, or which rule, or "your
   examination supplies this". A number whose origin is not visible will be over-trusted.
5. **An uncalibrated estimate, if shown at all, goes below the checkable evidence**, labelled as
   an estimate from training data rather than a finding on this patient.
6. **Treatment guidance is entered by the clinical team from the national guideline**, displayed
   with source, edition and who entered it. Never hard-code a dose.

### Measurement

7. **Split by patient, never by image.** Serial photographs of one lesion are not independent.
   Enforce it in the filename convention from day one, because it cannot be recovered later.
8. **Cross-validate on small data.** A single split on ~100 images is anecdote. In this project
   fold-to-fold macro Dice ranged 0.45 to 0.68 on identical settings.
9. **Weak labels must be named as weak everywhere** they appear: in the model card, in the
   interface, in the paper. Labels derived from other labels are demonstrators.
10. **Report negative results.** Most things tried here did not work, and knowing that is what
    stopped the same ideas being retried.

### Claims

11. **State what would refute the claim.** It is what separates a claim from an assertion, and
    it pre-empts the reviewer who goes looking.
12. **A second reference standard is a second axis, not a better truth.** Where the guideline
    defines the diagnosis clinically, a laboratory anchor is a different standard, and the
    disagreement between them is the finding of interest.
13. **No clinical benefit claim without outcome data.** Keep the manuscript consistent with the
    app's own disclaimer.

---

## 3. Technical lessons, with the evidence

These are the ones that cost real time to find. Expect each to recur on a new topic.

### 3.1 Serve the model the geometry it was trained on

The single largest effect measured in this project, twice, in two different models.

The viewer letterboxed the photograph so the whole limb stayed visible, and handed that same
letterboxed frame to a segmenter trained on a centre crop. On 195 validation photographs with
expert masks:

| input geometry | Dice | recall | precision |
|---|---|---|---|
| letterbox | 0.677 | 0.709 | 0.711 |
| centre crop | 0.745 | 0.782 | 0.771 |

Better on precision *and* recall, so it was not a trade. The mechanism is scale: a 4:3 frame
reached the model at 75 % of its training scale and a 9:16 phone frame at 56 %.

The same fault, worse, in the tissue model. It was trained on crops where labelled tissue fills
13.8 % of the frame and was being served whole photographs where it fills about 1.5 %:

| tissue share of frame | Dice, main class |
|---|---|
| 13.8 % (as trained) | 0.783 |
| 4.9 % | 0.652 |
| 1.7 % (as served) | 0.126 |

Cropping to the region of interest and projecting the result back took mean Dice from 0.075 to
0.434, better on 15 of 16 held-out images and worse on none.

**Rule.** Display geometry and model geometry are separate decisions. Show the clinician the
whole frame; serve the model the geometry of its training set; map the output back.

**Check on any new topic:** read the training script's preprocessing, then read the inference
path, and confirm they match. They usually do not.

### 3.2 Localise before you classify

Cropping to the detected region before classification, same data and backbone:

| input | AUC | accuracy |
|---|---|---|
| whole frame | 0.927 | 0.841 |
| region crop with 60 % margin | 0.963 | 0.925 |

The target occupied a median 2.3 % of the frame, so the whole-frame model was spending most of
its capacity on background. Expect this wherever the finding is small in the picture.

### 3.3 The monitored metric decides what you train

A macro-Dice metric averaged over every class. For a class with no pixels in the data and none
predicted, the score was `1e-6/1e-6 = 1.0`, so absent classes each contributed a constant 1.0 —
and the moment the model emitted a single pixel of one, that channel fell to zero and the metric
dropped by far more than any real improvement. Early stopping with `restore_best_weights` was
therefore selecting epochs on whether an untrainable class stayed silent.

The symptom was that every configuration had exactly one collapsed fold, and the fold moved
between configurations. Read as recipe effects those results are contradictory; read as a
selection rule firing on noise they are one fault three times. Fixing the metric improved the
weak class from 0.438 to 0.495 and removed every collapse.

**Rule.** Score only the classes the data actually teaches, and print which ones.

### 3.4 One pixel must not declare a class trainable

Pseudo-labelling put 17 hallucinated pixels of an absent class into a training set of 29.6
million — 0.000057 % — and `(y == i).sum() > 0` reported that class as present. Two effects: the
macro metric averaged over a class the evaluation data lacks, and the class list written into the
model card is what the app reads to decide which classes it may trust the model for. A class
listed there switches off the fallback rule.

**Rule.** Require a meaningful share, not a non-zero count. Real classes are percent-scale.

### 3.5 Check the split you inherited

The dataset shipped 94 training and 16 test images in separate directories. The loader globbed
recursively and dealt all 110 into one random split, so about 13 of the 16 official test images
were trained on. Every figure measured on that "held-out" set was optimistic.

**Rule.** Before quoting any inherited benchmark number, print which files were in which split.

### 3.6 Architecture is rarely the lever at deployable size

Measured identically, three-fold cross-validated:

| architecture | parameters | macro Dice |
|---|---|---|
| MobileNetV2-UNet | 5.93M | 0.603 |
| Attention U-Net | 6.14M | 0.598 |
| DeepLabV3+ | 7.45M | 0.572 |

The dataset's own authors report a far larger architecture gap, but their best model uses a
~45M-parameter transformer backbone, roughly 90 MB in float16 against the 12 MB this app ships.
The gap lives at a size the privacy constraint forbids.

**Rule.** Fix geometry, labels and the metric before touching the architecture. On a small
medical dataset they are worth an order of magnitude more.

### 3.7 Semi-supervised learning: cap the ratio

Pseudo-labelling 600 unlabelled images against ~70 real ones is a ratio of 8:1, and the student
learns to imitate the teacher. Capped and uncapped runs both gained only 0.01 to 0.03, inside the
fold spread. Three things are needed to make it even testable: the teacher must exclude the fold
the student is scored on, low-confidence pixels must carry an **ignore** label that contributes
no loss, and the ratio must be capped.

### 3.8 Threshold tuning is usually a dead end

Leave-one-fold-out selection of a per-class probability multiplier chose 1.0 on every fold. If a
class is imprecise rather than under-claimed, no threshold recovers it.

### 3.9 A change that adds a required input must check that a user can supply it

The one in this list that reached production.

The peri-wound redness measure was rebuilt to match the guideline, which defines the sign as
erythema reaching **more than 0.5 cm** from the wound margin. The old measure could not express
that: its band was a proportional annulus about 0.15 cm wide at an ordinary scale, and it
reported a mean, which an unaffected majority drags below threshold while a real patch sits
inside it. The replacement measures a distance properly. It was cross-checked at two scales on
seven photographs, it reported censoring at the band edge, and it was right.

It was also unusable. A distance in centimetres needs a ruler scale, and the control that sets
one was gated to the study team. So the shipped behaviour was: the row reads "Set a scale", and
the button that would set it is invisible. One of the five diagnostic criteria had become
permanently unanswerable in ordinary use, and the app was instructing clinicians to press
something they could not see. That went out and was merged.

Every check passed, because every check set the scale **directly in the page** and none asked
whether a person could. The measurement was correct and the product was broken, and those are
different properties.

It surfaced by accident: the walkthrough recorder stalled for 72 seconds between two chapters,
which was the browser automation waiting out actionability timeouts on controls that were not
visible. A tool driving the interface the way a person does found in one run what reasoning and
unit checks had missed twice.

**Rule.** When a change introduces a new required input, trace where it comes from before
declaring the change done: who supplies it, through which control, and is that control
reachable by the person who now needs it. Then exercise that path end to end in the interface.
A new dependency is a new failure mode even when the thing depending on it is correct.

---

## 4. The study design behind the labels

Applies to any project whose contribution is a measurement rather than an algorithm.

**Prevalence binds the design, not sample size.** Simulated Cohen's kappa for one binary sign,
two graders at 90 % sensitivity and 95 % specificity, 4,000 runs per cell:

| prevalence | n = 100 | n = 400 |
|---|---|---|
| 30 % | kappa 0.71, CI width 0.30 | kappa 0.72, CI width 0.15 |
| 15 % | kappa 0.63, CI width 0.41 | kappa 0.63, CI width 0.20 |
| 5 % | kappa 0.42, CI width 0.61 | kappa 0.41, CI width 0.31 |

At 5 % prevalence kappa sits near 0.41 however many images are labelled, and falls below 0.40 in
about 47 % of runs with good graders. Enlarging the sample does not fix it; enriching it does.

**The protocol that follows:** 150–200 images enriched to 25–30 % prevalence per sign, at least
40 positives each; report observed agreement, PABAK and the 2x2 table alongside kappa; written
case definitions and about 20 jointly labelled calibration images before the graders separate;
no conferring afterwards, because two reconciled readings are one reading; and an untouched
image is **excluded** from training, never read as a negative.

---

## 5. What the assistant should do, and what it should refuse to do

Working practices that produced the results above. Worth stating in the new chat.

- **Read the figure from the artefact, not from memory.** Model cards, metrics files and the
  code are the source. A number quoted from the conversation is a number that has drifted.
- **Verify through the shipped path, not the test harness.** A harness that calls the model
  directly can pass while the application is broken. Confirm the deployed code reproduces it.
- **Set nothing in the page that a user would have to set themselves.** A check that assigns
  the input directly is testing the maths, not the product. If the feature needs a scale, a
  selection or a permission, the check performs the action a clinician would and fails if the
  control is unreachable. This is the error that reached production here; see 3.9.
- **Suspect the test before the code, and the code before the model.** Several apparent bugs
  here were faults in the measurement: a test reading the page mid-render, a filename list
  invented rather than listed, a metric averaging over absent classes.
- **Run one heavy job at a time.** Two concurrent training runs on a 15 GB box lost a fold to
  the out-of-memory killer.
- **Checkpoint long runs to disk.** A container restart lost a 40-minute run that had written
  nothing until the end.
- **Say when a result is negative, and leave the deployed thing alone.** Most experiments here
  did not justify a change.
- **Never let a commit message say only what changed.** It should say what was measured, what
  was rejected, and why, because that is what stops the idea being retried.

---

## 6. Environment notes that save an hour

Specific to this cloud setup; check each still holds.

- Playwright and Chromium are pre-installed; ESM needs `createRequire` because the package is
  global, not in the repository.
- `ffmpeg` is available. For screen recordings, write an ffconcat manifest with real per-frame
  durations rather than assuming a frame rate: a 1080p screenshot takes 100–250 ms and a fixed
  rate silently distorts time.
- Separate virtualenvs are needed for training and for TensorFlow.js conversion; they pin
  conflicting numpy and protobuf versions. Save the Keras model before attempting conversion.
- Outbound HTTPS is allowlisted per environment. A deployed site will not be reachable unless
  its host is added, and a running session usually cannot be moved to another environment.
- Model shards keep the same filenames across retrains, so set `must-revalidate` on them. A
  browser holding an old shard beside a new manifest loads the wrong weights at the right
  shapes, silently.

---

## 7. A seed prompt for the new chat

```
I am building a clinical decision-support prototype on a new topic. Attached is a playbook
from a previous project; follow its rules, especially the safety rules in section 2 and the
geometry lesson in 3.1.

TOPIC: <one sentence>
WHAT A CAMERA CAN SEE: <...>
WHAT IT CANNOT: <...>
REFERENCE STANDARD: <...>
PUBLISHED RULE, if any: <...>

Start by telling me which parts of the pattern do not transfer to this topic and why, before
writing any code. I would rather hear that the approach is wrong than have it adapted silently.
```

That last sentence matters. The most useful thing in this project was being told that a claim
would not survive review, that a recipe change had made things worse, and that an apparent bug
was in the test rather than the code. Ask for that explicitly, because the default is agreement.

---

## 8. What this playbook cannot give you

The prototype it came from has **no validated diagnostic performance**. Its segmentation models
are validated on public data; its classifiers rest on weak labels with no clinician adjudication
and no laboratory reference; and the three findings that matter most clinically have no detector
at all and are supplied by the examiner. The transferable content here is architecture, method
and discipline. The clinical evidence has to be earned separately on every new topic, and the
fastest way to lose a reviewer is to carry over a number that was never validated.
