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

## 2. Purulent discharge (pus)

### The question
**Is there thick, opaque discharge in or on the wound?**

The second of the five IWGDF/IDSA local criteria that a photograph can carry. Purulent means
**opaque and thick**: cream, yellow, green or blood-stained, holding its own shape rather than
running like water.

### How to judge it
- Look for **free-standing fluid**, not wet tissue. Pus pools, usually in the dependent part of
  the wound, and has a glossy highlight where the light catches it.
- Opacity is the test. Serous exudate is thin and translucent, straw-coloured, and the wound bed
  can be seen through it. Pus cannot be seen through.
- Thick strands bridging the wound, or a collection with a visible edge, both count.
- Record **present / absent / cannot tell**.

### Common false positives

| Looks like pus | Why it is not |
|---|---|
| **Hydrocolloid or hydrofibre gel** | These dressings liquefy into a yellow-brown gel that looks and smells exactly like pus. This is the most common error in a foot clinic. If a dressing of that type was just removed, record "cannot tell" unless the wound was cleaned first. |
| **Liquefying slough** | Yellow, but adherent to the bed and part of it, not a collection sitting on it. If it would stay put when the foot tilts, it is slough. |
| **Serous or serosanguinous exudate** | Thin, translucent, straw or pink. The bed is visible through it. |
| **Fibrin film** | A thin yellow-white sheet bonded to the surface, not a fluid. |

### What a photograph cannot settle
Smell, consistency on probing, and whether the discharge is expressible from a deeper space.
Nor can it see a wound that was cleaned immediately before the photograph: **absence in the
image is absence at that moment**, not absence on the ward round.

---

## 3. Abscess

### The question
**Does the appearance suggest a collection of pus beneath the surface?**

An abscess is subsurface, so this is the one label that is **not a sighting**. Graders judge
secondary signs, and the answer is recorded as a likelihood.

### How to judge it
- **Focal** swelling, rather than the whole foot being swollen: a dome or bulge with a centre.
- Skin over it **tense, stretched and shiny**, sometimes with the normal skin creases flattened.
- Discolouration over the swelling, or a **pointing head** where it is coming to the surface.
- Record **likely / unlikely / cannot tell**, matching the app, which also reports abscess as a
  likelihood and never as a finding.

### Common false positives

| Looks like an abscess | Why it is not |
|---|---|
| **Generalised oedema** | Diffuse, often bilateral, no focus, pits on pressure. An abscess has a centre. |
| **Charcot midfoot deformity** | A bony prominence, typically the rocker-bottom midfoot. Hard, not tense; the skin over it is often callused rather than shiny. |
| **Haematoma** | Bruise colours through the overlying skin, and a history of injury. |
| **Gouty tophus, bursa, ganglion** | Chronic, often over a joint or pressure point, and the patient has usually had it for a long time. |

### What a photograph cannot settle
Fluctuance, which needs palpation and is the sign that actually makes the diagnosis. Also depth,
and whether a collection communicates with the ulcer. A confirmed abscess in the clinical record
is a different variable from this label, and should be recorded separately where it exists.

---

## 4. Wet gangrene

### The question
**Is there moist, infected necrosis, as opposed to dry mummified tissue?**

This is the label with the largest consequence attached. Wet gangrene is a surgical emergency
needing drainage and antibiotics; dry gangrene is ischaemia and needs perfusion, and operating
into it can cost the limb. **The two are separate labels and must never be merged.**

### How to judge it

| | Wet gangrene | Dry gangrene or eschar |
|---|---|---|
| Surface | Moist, boggy, may weep | Desiccated, leathery, hard |
| Colour | Dusky purple, green-black, mottled | Uniform black or dark brown |
| Shape | Swollen, tissue expanded | Shrunken, mummified |
| Edge | Poorly demarcated, blending into inflamed skin | Sharply demarcated, often a clean line |
| Surroundings | Erythema and oedema around it | Normal or ischaemic-looking skin, no swelling |
| Bullae | Common | Absent |

Record **present / absent / cannot tell** for wet gangrene, and record dry gangrene or eschar
separately under section 6.

### Common false positives

| Looks like wet gangrene | Why it is not |
|---|---|
| **Eschar under an occlusive dressing** | Occlusion and maceration soften dry eschar and make it look wet. The giveaway is that the edge stays sharp and the surrounding skin is not inflamed. This is the main trap. |
| **Gentian violet or silver dressing** | Both stain tissue black or blue-black. Staining is superficial and often extends onto intact skin in a drip or smear pattern. |
| **Haematoma or dried blood** | Dark red-brown rather than green-black, and no surrounding inflammation. |

### What a photograph cannot settle
Crepitus and smell, both of which are decisive at the bedside and invisible here. If you are
weighing wet against dry and the photograph does not separate them, that is exactly the case
for "cannot tell": guessing here is how a limb is lost in either direction.

---

## 5. Slough

**Slough is not a sign of infection.** It is present in most chronic ulcers and is not among
the IWGDF/IDSA criteria. It is recorded because tissue composition matters for healing, and
because the app estimates it.

### The question
**Is there yellow, tan or white devitalised tissue in the wound bed?**

### How to judge it
- Soft, moist, **adherent to the bed**, sometimes stringy or in sheets.
- Yellow, cream, tan or grey-white. Colour alone does not settle it; position and texture do.
- Count adherent devitalised tissue regardless of thickness. Do not count a thin transparent
  serous film that would wipe away with a swab.
- Record **present / absent / cannot tell**, and the approximate share of the bed if your sheet
  asks for it.

### Common false positives

| Looks like slough | Why it is not | Why it matters |
|---|---|---|
| **Exposed tendon** | White, glistening, fibrous, linear, running in the long axis of the foot | Tendon exposure changes the Wagner and Texas grade. Labelling it slough loses that. |
| **Subcutaneous fat** | Yellow but **lobulated and glistening**, globular rather than stringy | It is viable tissue |
| **Bone** | Hard, white, smooth | Probe-to-bone changes management entirely |
| **Hydrocolloid gel residue** | Sits on the surface, often beyond the wound edge | Dressing, not tissue |

### What a photograph cannot settle
Adherence, which is tested by wiping, and depth. Where you cannot tell slough from fat or
tendon, record "cannot tell" rather than defaulting to slough.

### What the app does
The tissue model reports a slough percentage of the wound bed, cross-validated at Dice 0.495,
which is its weak class. Expect disagreement, and treat yours as the reference.

---

## 6. Necrosis or eschar

**Also tissue viability, not infection.** Dry necrosis is usually ischaemic. Where the
appearance is moist and infected, it belongs under wet gangrene in section 4 as well.

### The question
**Is there black, brown or tan devitalised tissue in or at the edge of the wound?**

The label is deliberately **"necrosis or eschar" and not "dry necrosis"**, because dry and wet
cannot be reliably separated in a photograph. Record what you see here, and use section 4 to say
whether it is wet.

### How to judge it
- Black, dark brown or tan, and clearly **devitalised** rather than dark-coloured skin.
- Hard and leathery, or softer and boggy. Both count for this label.
- Record **present / absent / cannot tell**.

### Common false positives

| Looks like necrosis | Why it is not |
|---|---|
| **Deeply pigmented skin at the wound edge** | Intact skin, with normal texture and skin creases, continuous with the rest of the foot. On Fitzpatrick V–VI this is the commonest error, and it is the same failure the app's colour rule makes. |
| **Shadow in a deep cavity** | A deep or undermined wound photographs dark at its base. Look for detail inside the shadow and for a lighting direction that explains it. |
| **Silver, charcoal or gentian violet dressings** | All stain tissue black or grey-black, usually with a smear or drip edge extending onto intact skin. |
| **Dried blood or haematoma** | Red-brown, crusted, often with a clot's irregular surface. |
| **Tattoo** | Follows a design, has straight or deliberate edges, and the skin surface is normal. |

### What a photograph cannot settle
What lies under an eschar, whether it is adherent, and whether there is fluctuance beneath it.

### What the app does
Necrosis comes from a colour rule, `L < 30` in CIE Lab, which means **any sufficiently dark
pixel**. Dry eschar, wet gangrene, shadow in a cavity, dark pigmented skin and an underexposed
photograph all land in it. The app's necrosis percentage on a dark or shadowed image should be
expected to be wrong, and the model was never trained on a necrosis label at all.

---

## 7. Recording, in all cases

- **"Cannot tell" is a real answer** and is analysed separately. Forcing an uncertain image into
  "absent" corrupts the agreement statistic and the training label at once.
- **An untouched image is excluded from training**, so silence is never read as a negative. If a
  sign is absent, record it absent; do not leave the row blank.
- **The photograph is a point in time.** A wound cleaned or redressed immediately before it was
  taken may show none of what was there ten minutes earlier. Record the image, not the patient.
- **Label 20 images together first, then separate.** The calibration set must include at least
  three Fitzpatrick V–VI feet, two with antiseptic staining, and two photographed through or
  just after an occlusive dressing, because those are the images these definitions exist for.
- **Do not confer afterwards.** Two readings that have been reconciled are one reading.
- **Do not look at the app's answer before recording your own.** You are the reference standard.
