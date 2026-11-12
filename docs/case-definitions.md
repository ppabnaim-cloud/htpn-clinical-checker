# Case definitions for the grading session

Agreed before labelling begins, so that disagreement is perceptual rather than definitional.
Most disagreement between graders is about what the word means, and that is cheap to fix now
and expensive to fix afterwards.

**Graders are the reference standard. The app is the thing being measured.** Where your label
and the app's reading differ, the app is wrong by definition, and the disagreement is a result
rather than a mistake. Do not look at the app's answer before recording your own.

---

## 1. Peri-wound erythema beyond 0.5 cm

### The question
**Does erythema extend more than 0.5 cm outwards from the ulcer margin, anywhere around it?**

This is the IWGDF/IDSA criterion, one of five local signs of infection. It is a question about
**distance**, not about intensity: faint redness reaching 2 cm counts, vivid redness confined to
3 mm does not.

### How to judge it

- **Measure from the ulcer edge**, not its centre, and in the direction where the redness
  reaches furthest. One margin is enough; it need not surround the wound.
- **The redness must be continuous with the ulcer margin.** A separate red patch that does not
  touch the wound is not this sign, whatever else it may be.
- **Compare with the patient's own skin further out in the same photograph**, never against an
  idea of what red looks like. This is the single most important instruction in this document.
- **Record present / absent / cannot tell.** "Cannot tell" is a real answer and is analysed
  separately; forcing an uncertain image into "absent" corrupts both the agreement statistic
  and the training label.

### Skin tone

In Fitzpatrick IV–VI, inflamed skin frequently does not read as red. It may appear **darker,
duskier, violaceous, greyish or simply shinier** than the surrounding skin. All of these count
if they are a change from the patient's own adjacent skin.

This matters more here than in most published work. The public datasets this project compares
itself against come from a predominantly Fitzpatrick I–III population, and erythema is the
criterion most altered by pigmentation. If you find yourself recording "absent" on every darkly
pigmented foot, stop and re-read this section.

### Common false positives in a foot clinic

| Looks like erythema | Why it is not |
|---|---|
| **Dependent rubor** | Redness of the dependent foot that fades on elevation. It is ischaemia, not infection. If the history or the photograph suggests it, record "cannot tell". |
| **Antiseptic staining** | Povidone-iodine stains orange-brown, chlorhexidine pink, gentian violet purple. Staining has a sharp edge and often a run or drip mark. |
| **Pressure marks** | Sock elastic, dressing edges and strapping leave bands with straight borders. Erythema from infection does not have straight borders. |
| **Haemosiderin staining** | Chronic venous disease leaves a fixed brown-purple discolouration, usually of the gaiter area and usually bilateral. |
| **Flash and shadow** | A flash close to the skin reddens what it hits. Compare the peri-wound skin with skin further out **in the same photograph**, under the same light. |

Dependent rubor and iodine staining are the two that will cost you most often.

### What a photograph cannot settle

Blanching cannot be tested in a photograph, and neither can warmth or tenderness. Judge only
what the image shows. If you believe the redness is present but cannot separate it from
staining or lighting, that is what "cannot tell" is for.

### Calibration before you separate

Label 20 images together and discuss them, then work independently and **do not confer
afterwards** — two readings that have been reconciled are one reading, and a kappa computed on
them means nothing. The calibration set must include at least three Fitzpatrick V–VI feet and
two with antiseptic staining, because those are the images the definition exists for.

### What the app does with the same question

For the record, and so that disagreement can be interpreted rather than argued about. The app
measures CIE a\* in a band around the wound against the patient's own skin beyond that band,
keeps only the above-threshold region continuous with the margin, and reports how far it
reaches in centimetres. It needs a ruler scale to do so, and says "Set a scale" when it has
none, because the criterion is a distance.

Two known weaknesses, both of which should show up as disagreement with you:

- On deeply pigmented or shadowed skin much of the band fails the app's skin filter, and the
  reading then rests on a lighter and therefore redder remnant. The app reports how many cells
  it used, and this is the case where your judgement should be trusted over it.
- The colour rule has no way to tell erythema from antiseptic staining.

---

## 2. Still to be written before the session

The same treatment is needed for each of the signs below, and the session should not start
without them. Each needs: the question in one sentence, how to judge it, the common false
positives, and what a photograph cannot settle.

| Sign | The hard part to pin down |
|---|---|
| Purulent discharge | Distinguishing pus from exudate, slough liquefying, and dressing residue |
| Abscess | It is subsurface, so graders are judging secondary signs, not a sighting |
| Wet gangrene | Separating it from dry eschar; this one decides drainage against revascularisation |
| Slough | Boundary with granulation and with fibrin film, and that it is not an infection sign |
| Necrosis or eschar | Dry against wet, and dark pigmented skin being read as necrosis |

Note that the last two are **tissue viability, not infection**, and the labelling sheet should
group them that way, as the app now does.
