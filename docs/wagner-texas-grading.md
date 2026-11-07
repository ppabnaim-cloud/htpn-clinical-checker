# Grading a diabetic foot ulcer — Wagner and Texas

**Wound Vision · guide for the study team**
Deep Learning Healthcare Project, Hospital Tengku Permaisuri Norashikin

---

## The principle

Both scales are **definitions applied to findings**, not opinions about a photograph. You do not
grade the image; you answer seven questions about the patient and the grade follows
mechanically. The app does the last step for you, which is why two graders using it should
reach the same grade from the same findings.

Where graders actually disagree is almost never about what a word means. It is about
**precedence** — which finding outranks which. That is what most of this guide is.

---

## What each scale reads

| Question | Wagner | Texas grade | Texas stage |
|---|:--:|:--:|:--:|
| Break in the skin | ✓ | ✓ | |
| Depth on probing | ✓ | ✓ | |
| Probe-to-bone | ✓ | | |
| Abscess / osteomyelitis | ✓ | | |
| Gangrene | ✓ | | |
| Clinically infected | | | ✓ |
| Ischaemic limb | | | ✓ |

Two consequences worth holding on to:

- **Wagner can resolve on fewer answers than Texas.** Texas returns no stage at all until *both*
  infection and perfusion are answered.
- **Gangrene has no place in Texas.** A foot with localised gangrene is Wagner 4; its Texas
  grade is still whatever the depth says.

---

## One depth answer, two different boundaries

This is the single most common source of divergence between the two scales, and it is not a
mistake in either of them — they genuinely draw the line in different places.

| Depth on probing | Wagner | Texas grade |
|---|:--:|:--:|
| No break in the skin | 0 | 0 |
| Superficial | 1 | 1 |
| To tendon or capsule | 2 | 2 |
| **To joint** | **2** | **3** |
| To bone | 2 | **3** |

Wagner grade 2 is a deep ulcer to tendon, capsule, ligament *or joint*. Texas puts the joint
with bone, in grade 3. That is why the app asks about the joint as its own answer rather than
bundling it with tendon.

> **Note for anyone who graded before November 2026.** The depth question used to offer a single
> option reading *"To tendon, capsule or joint"*, which graded every joint-penetrating ulcer
> Texas 2. Their Wagner grade was and remains correct. If you recorded any ulcer that penetrated
> a joint, re-open it and change the depth answer to **To joint** so the Texas grade corrects to
> 3.

---

## Wagner precedence, in the order it is applied

1. Gangrene of the whole foot → **5**
2. Localised gangrene → **4**
3. Abscess, purulent collection or confirmed osteomyelitis, **or** probe-to-bone positive →
   **3**, however shallow the ulcer looks
4. No break in the skin → **0** (an at-risk or healed foot)
5. Otherwise depth decides: tendon, capsule, joint or bone → **2**; superficial → **1**

**A Wagner grade below 4 is provisional until gangrene is answered,** because gangrene outranks
everything below it. The panel says *Still needed: gangrene* when that is the case. Read it
rather than scrolling past it.

Worked examples, taken from the app:

| Findings | Wagner | Texas |
|---|---|---|
| Superficial, probe-to-bone **positive** | **3** | 1A |
| Superficial, **localised gangrene** | **4** | 1A |
| Superficial, infected, ischaemic | 1 | **1D** |
| Superficial, infected, perfusion **not assessed** | 1 | *no stage* |

Note how Wagner moves sharply in the first two rows while Texas does not, and how Texas moves in
the third while Wagner does not. They are measuring different things; disagreement between them
is not an error.

---

## Texas is two independent axes

| Axis | Driven by |
|---|---|
| **Grade 0–3** | Depth, and nothing else. Probe-to-bone, abscess and gangrene do not move it. |
| **Stage A–D** | Infection × ischaemia. **A** neither · **B** infected · **C** ischaemic · **D** both. |

So a superficial infected ulcer is **1B** — not grade 2 because it is infected.

And Texas gives **no stage at all** until both infection and perfusion are answered. Choosing
*Not assessed* for ischaemia leaves it undetermined. That is correct behaviour, not a fault: a
stage invented from an unknown perfusion is worse than no stage.

---

## The five that go wrong most often

1. **Grading depth from the photograph.** Wagner 1 against 2 is depth *on probing*. If nobody
   probed it, leave it unanswered — the app will say what is outstanding.
2. **Missing that probe-to-bone outranks depth.** A shallow-looking ulcer that probes to bone is
   Wagner 3, not Wagner 1.
3. **Reading Wagner 0 as "looks healed".** Wagner 0 is intact or fully epithelialised skin — an
   at-risk foot. Red but unbroken is still 0.
4. **Letting infection raise the Texas grade.** It raises the *stage*. The grade is depth and
   only depth.
5. **Guessing perfusion.** Ischaemia means absent pulses, ABPI below 0.9, or toe pressure below
   30 mmHg. No photograph shows any of them. *Not assessed* is an honest answer and beats a
   wrong stage.

---

## Workflow in step B

1. **Set your name first.** The grader field gates everything else. A grading with no name on it
   is not a reference standard, and the case log keys on grader — so two people grading the same
   image produce two rows, which is what makes κ computable.
2. **Tick what is present in the image** — wound bed, signs of infection, other.
3. **Open *What only your examination supplies*** and answer the seven questions. The grade is
   computed below them as you go, and names what is still outstanding.
4. **Press *Use as the label for this image*** once a grade is settled, so the computed grade
   becomes the stored label rather than a separately typed one.
5. **Flag anything you are unsure of** rather than guessing. Filter to *Flagged for review*
   later. A guessed grade enters the reference standard looking exactly like a confident one.

Files are not kept between sessions — a browser cannot hold on to files you picked. Your labels
*are* kept. Re-select the same images in step A each sitting and every tick reattaches to the
right image.

---

## Second grading, and why it matters

Every accuracy figure in this app is **agreement with one clinician's opinion**. Wagner grading
has documented inter-observer disagreement. Without a double-graded subset there is no way to
say whether a model that disagrees with you is wrong, or is reading the wound the way your
colleague would have.

To build it: open a case in the log, fill in **Reviewer** and their grade. The dashboard computes
Cohen's κ from those pairs.

| | |
|---|---|
| Target | **100–150** double-graded cases |
| Statistic | Cohen's κ, not raw agreement |
| Why not raw | 85 % raw agreement can be κ = 0.3 when one grade dominates the set |

κ interpretation as the dashboard reports it: < 0.21 slight · 0.21–0.40 fair · 0.41–0.60
moderate · 0.61–0.80 substantial · > 0.80 almost perfect.

---

## Checklist

- [ ] Grader name set before any ticking
- [ ] Depth answered from **probing**, not from the image
- [ ] Joint depth recorded as **To joint**, not as tendon
- [ ] Gangrene answered, so the Wagner grade is not provisional
- [ ] Ischaemia answered or honestly marked *not assessed*
- [ ] Grade pushed with *Use as the label for this image*
- [ ] Uncertain images flagged rather than guessed
- [ ] Second grader recorded on the κ subset

---

*This guide is also in the app: Study team tab, step B, "How to grade — Wagner and Texas".
The companion guide for training a findings head is `docs/findings-head-training.md`.*
