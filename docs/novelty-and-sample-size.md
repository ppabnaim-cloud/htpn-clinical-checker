# Wound Vision — where it sits in the literature, and how many images to label

Prepared 9 November 2026 for Dr Naim Bin Abdul Malek, HTPN.
Written to answer three questions: what has been done already, what has not,
and how many labelled images the next step needs.

**Please verify every citation against the publisher's record before
submission.** The papers below were found by literature search and their
claims are summarised from abstracts and indexed text, not from a full read
of each. Volume, issue and page numbers in particular must be confirmed.

---

## 1. The honest answer on novelty

> **The claim "first in the world to match ground truth and training data for
> infection" will not survive a reviewer, and should not be made.**

A reviewer in this field will think of the Diabetic Foot Ulcer Challenge
within seconds. DFUC2021 released **15,683 ulcer image patches labelled for
infection and ischaemia** — 5,955 labelled for training, 3,994 unlabelled,
5,734 for test — in four classes: infection only, ischaemia only, both, and
neither (Yap et al., 2021). The dataset and the baseline techniques were
published in *Computers in Biology and Medicine*, a Q1 journal (Goyal et al.,
2020). Photograph-based infection labels paired with trained models are five
years old.

Making the stronger claim costs more than it gains. A reviewer who catches one
overstatement reads the rest of the paper looking for others.

**But there is a real gap, and it is yours.** It is narrower, it is specific,
and it is defensible:

| # | The gap | Evidence it is open |
|---|---|---|
| 1 | **Infection labels in existing datasets are clinician judgement, not microbiology.** DFUC2021 was annotated by a consultant physician assigning "infection / ischaemia / both / none" from the photograph. No published DFU image dataset was found that pairs each photograph with a **tissue culture and sensitivity result**. | Search returned no photo + culture dataset; DFUC labels are expert visual annotation (Goyal et al., 2020; Yap et al., 2021). |
| 2 | **The DFUC authors themselves say the visual label is weak.** They report that infection "is hard to recognize from the foot images even by experienced medical experts" and propose that ground truth from clinical tests would improve future models. | Goyal et al. (2020). This is the strongest sentence available to you: the field's own dataset authors naming the gap you are filling. |
| 3 | **Performance on visually-labelled infection is modest.** The best DFUC2021 four-class result reported macro precision 0.57, recall 0.62, F1 0.55. | Challenge results (Yap et al., 2021; Galdran et al., 2021). A ceiling this low is consistent with a noisy label, which supports (1) and (2). |
| 4 | **Sign-level labels do not exist.** Public wound datasets label *tissue* — granulation, slough, necrosis, eschar, epithelialisation, maceration, tendon, bone — on the red–yellow–black scheme. A search returned **no dataset labelling pus, abscess or wet gangrene as classes.** Infection, where present, is one image-level binary. | Kabir et al. (WoundTissue); wound-bed segmentation benchmarks (2025–2026). |
| 5 | **Skin type.** DFUC images come from Lancashire Teaching Hospitals, a predominantly Fitzpatrick I–III population. Erythema, the cardinal sign of infection, presents differently on Fitzpatrick IV–VI. | Dataset provenance (Goyal et al., 2020). Your app records Fitzpatrick type per image; almost nothing else does. |
| 6 | **Grading is predicted, not derived.** Published work predicts Wagner or Texas from the image. Wound Vision computes them from the bedside findings the published definitions are made of, and uses the model only for what a camera can see. | Design difference, verifiable from the app. |

### What you can claim, and defend

> To our knowledge, this is the first diabetic foot ulcer image dataset in
> which (a) infection is labelled at the level of the individual clinical
> sign — purulent discharge, abscess and wet gangrene — rather than as a
> single binary, (b) each case carries a tissue culture and sensitivity
> result as an independent reference standard, and (c) Fitzpatrick skin type
> is recorded for every image, in a Southeast Asian population.

Three qualifications, all load-bearing:

- **"To our knowledge"** is doing real work. Keep it.
- **Culture is not a perfect reference standard and you must say so.**
  Deep tissue and bone cultures agree only about 52% of the time, and 21% of
  cases grow organisms only on deep tissue culture. More importantly, IWGDF
  and IDSA define diabetic foot infection as a **clinical** diagnosis from
  signs — so a culture-anchored label is a *different* reference standard
  from the guideline one, not a better version of it. Frame it as a second,
  independent axis. A reviewer who thinks you are claiming culture is truth
  will reject the paper.
- **Do not claim clinical benefit.** You have no outcome data. The app's own
  disclaimer already says this; keep the paper consistent with it.

---

## 2. How many images do the two graders need to label?

### The short answer

**For tomorrow's session: 150–200 images, both graders, the same set, independently.**

That is the number for a *publishable inter-rater reliability statistic*, not
for training. It is also the number at which the session stops being a pilot.

### Why — and the problem nobody mentions

I simulated Cohen's κ for one binary sign, two graders each at 90%
sensitivity and 95% specificity against a latent truth, 4,000 runs per cell:

| Prevalence of the sign | n = 50 | n = 100 | n = 200 | n = 400 |
|---|---|---|---|---|
| **30%** (e.g. pus) | κ 0.71, CI width **0.44** | κ 0.71, CI width **0.30** | κ 0.72, CI width **0.21** | κ 0.72, CI width **0.15** |
| **15%** (e.g. abscess) | κ 0.63, CI width **0.60** | κ 0.63, CI width **0.41** | κ 0.63, CI width **0.28** | κ 0.63, CI width **0.20** |
| **5%** (e.g. wet gangrene) | κ 0.39, CI width **0.85** | κ 0.42, CI width **0.61** | κ 0.41, CI width **0.43** | κ 0.41, CI width **0.31** |

Read the bottom row carefully. **At 5% prevalence, κ sits around 0.41 and
stays there however many images you label** — and in ~47% of runs it lands
below 0.40, which reads as "poor agreement" in a results table. The graders in
that simulation are *good*: 90% sensitive, 95% specific. This is the
first-order kappa paradox: when one category is rare, chance agreement is
already high, so κ is dragged down no matter how well the raters actually
perform.

**Adding images does not fix it. Changing the sample does.**

### What to do instead

1. **Enrich the set.** Do not hand them a consecutive series. Pre-screen so
   that each of the three signs appears in roughly **25–30% of the set**. The
   top row of that table is where κ behaves. Your app's filter already does
   this: label a first pass, then filter by finding and build the agreement
   set from it.
2. **Report agreement three ways**, not just κ: observed agreement,
   prevalence-adjusted bias-adjusted kappa (PABAK), and the 2×2 table itself.
   Reviewers of low-prevalence reliability studies expect this, and it stops
   a rare-sign κ of 0.41 being read as carelessness.
3. **Aim for ≥ 40 positive examples of each sign** in the agreement set.
   Below that the CI is too wide to support any claim.

### Minimum totals, by purpose

| Purpose | Minimum | Comfortable | Note |
|---|---|---|---|
| Inter-rater agreement, per sign | 150 images, ≥ 40 positives | 200–300, ≥ 60 positives | Enriched, not consecutive |
| Pilot / feasibility report | 150–200 total | 300 | Enough for a conference abstract |
| Fine-tuning a classifier per sign | ~100 positives per class | 500–1,000 per class | DFUC2021 had 2,555 infection images and still reached only macro F1 0.55 |
| Held-out test set | 20% of total, **split by patient** | — | Never by image — see below |

### The one methodological error that would invalidate the study

**Split by patient, never by image.** Serial photographs of one ulcer are not
independent observations. If two views of the same wound fall on opposite
sides of the train/test split, the model can score well by recognising the
patient rather than the pathology, and the reported accuracy is inflated by an
amount nobody can estimate afterwards. Reviewers ask about this first.

Wound Vision already derives a case identity from the filename prefix for
exactly this reason. **Tell both graders tomorrow to keep the filename
convention** (`P014_v1.jpg`, `P014_v2.jpg`) — if they rename files, the
grouping is lost and no later analysis can recover it.

### Also agree before they start

- **A written case definition for each of the three signs**, one or two
  sentences each, with a borderline example. Most disagreement is definitional,
  not perceptual, and it is cheap to fix beforehand and expensive afterwards.
- **Label 20 images together first**, discuss, then separate. Calibration
  before independence.
- **They must not confer afterwards.** Two readings that have been reconciled
  are one reading, and κ computed on them is meaningless.
- **Wet gangrene must be a different class from dry gangrene.** The app already
  separates them — one is infection and needs drainage and antibiotics, the
  other is ischaemia and needs revascularisation.

---

## 3. References (APA 7)

Verify all details against the publisher before submission.

Galdran, A., Carneiro, G., & González Ballester, M. A. (2021). *Convolutional
nets versus vision transformers for diabetic foot ulcer classification*.
Diabetic Foot Ulcers Grand Challenge 2021. https://arxiv.org/abs/2112.00065

Goyal, M., Reeves, N. D., Rajbhandari, S., Ahmad, N., Wang, C., & Yap, M. H.
(2020). Recognition of ischaemia and infection in diabetic foot ulcers:
Dataset and techniques. *Computers in Biology and Medicine*, *117*, 103616.
https://doi.org/10.1016/j.compbiomed.2020.103616

Kabir, M. A., et al. (2024). *WoundTissue: Labelled wound tissue images dataset
for segmentation* [Data set]. GitHub. https://github.com/akabircs/WoundTissue

Senneville, É., Albalawi, Z., van Asten, S. A., Abbas, Z. G., Allison, G.,
Aragón-Sánchez, J., … Peters, E. J. G. (2024). IWGDF/IDSA guidelines on the
diagnosis and treatment of diabetes-related foot infections.
*Diabetes/Metabolism Research and Reviews*, *40*(3), e3687.
https://doi.org/10.1002/dmrr.3687

Yap, M. H., Cassidy, B., Pappachan, J. M., O'Shea, C., Gillespie, D., &
Reeves, N. D. (2021). *Analysis towards classification of infection and
ischaemia of diabetic foot ulcers*. 2021 IEEE EMBS International Conference on
Biomedical and Health Informatics (BHI).
https://doi.org/10.1109/BHI50953.2021.9508563

Additional sources consulted — confirm authorship and full citation details
before use:

- Clinical applications of machine learning for infection assessment in
  diabetic foot ulcers [Review]. PubMed Central.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC13033529/
- Are deep tissue cultures a reliable alternative to bone biopsy for
  diagnosing diabetic foot osteomyelitis? A comparative diagnostic study.
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11988501/
- Enhancing chronic wound assessment through agreement analysis and tissue
  segmentation. *Scientific Reports* (2025).
  https://www.nature.com/articles/s41598-025-06703-5
- Automated segmentation of wound bed tissue from clinical photographs: A
  benchmark of five deep learning architectures under a shared protocol.
  *Journal of Imaging Informatics in Medicine* (2026).
  https://doi.org/10.1007/s10278-026-02363-7

### Journal quartiles (verify current year)

| Journal | Indexing |
|---|---|
| *Computers in Biology and Medicine* | Q1, Scopus, high CiteScore |
| *Diabetes/Metabolism Research and Reviews* | Q1, Scopus |
| *Scientific Reports* | Q1, Scopus |
| *Journal of Imaging Informatics in Medicine* | Q1/Q2, Scopus |

---

## 4. One table for the professor

If he wants a single slide, this is it.

| | Published work (DFUC and successors) | Wound Vision |
|---|---|---|
| Infection label | One binary, from the photograph | Three signs: pus, abscess, wet gangrene |
| Reference standard | Expert visual annotation | Visual label **plus** tissue culture & sensitivity |
| Grading | Predicted by the model | Computed from bedside findings by published rule; model contributes only what a camera can see |
| Skin type | Not recorded | Fitzpatrick I–VI, every image |
| Population | UK (Lancashire) | Malaysia, Fitzpatrick IV–VI |
| Pressure injury | Separate literature, little overlap | Same instrument, both wound types |
| Reported ceiling | Macro F1 ≈ 0.55 (four-class) | Not yet measured — no result claimed |

The last row matters. Leaving it blank and saying so is what makes the rest of
the table credible.
