# Training a findings head

**Wound Vision · guide for the study team**
Deep Learning Healthcare Project, Hospital Tengku Permaisuri Norashikin

---

## What a findings head is, and why it exists

The Assess tab lists six signs of infection. Three of them it works out for itself; three it
has to ask for.

| Sign | Where the answer comes from |
|---|---|
| Slough | Colour rule — unvalidated |
| Necrosis | Colour rule — unvalidated |
| Peri-wound erythema | Colour rule — unvalidated |
| **Pus** | **Asked** |
| **Abscess** | **Asked** |
| **Wet gangrene** | **Asked** |

The three it asks for have no detector **yet**. That is a statement about labels, not about
what is learnable, and the two are easy to conflate.

No *colour rule* can give them one:

- **Pus** is yellow — the same hue window (55–105°) the rule already assigns to slough. A rule
  that called yellow "pus" would call every fibrinous wound bed pus.
- **Wet gangrene** is dark — the same `L < 30` bucket as dry eschar.

But a trained head is not a colour rule. The ImageNet embedding carries texture, gloss, margin,
shape and context, and on those the pairs genuinely differ: purulent discharge is opaque and
glossy where slough is fibrinous and matt, and often pools or tracks from a sinus; moist
gangrene is swollen, dusky and frequently bullous with surrounding erythema, where dry eschar is
desiccated and sharply demarcated. **Both are learnable.** Transfer learning is why that may
take tens of labelled positives rather than thousands — but it never takes zero, and supplying
them is what step B is for.

**Abscess is different in kind.** The collection is under the surface, so no model sees it; a
head predicts it from what travels with it — swelling, erythema, induration, a pointing head.
That is a legitimate thing to model and a useful prompt to palpate, but it is a likelihood
rather than a sighting, and the app labels it accordingly.

A *findings head* is a small classifier trained on your own graded images to answer one of those
three. Train one, keep it, and that row stops asking and starts answering — with its probability
and the number of cases it learned from shown beside it. **The examiner can always overrule it.**

This is the only training target whose output changes a screen a clinician reads, so the bar for
believing one is higher than for a Wagner head. That is what most of this guide is about.

---

## The five steps

### 1. Grade enough images in step B

Tick **Pus**, **Abscess** or **Wet gangrene** under *Signs of infection*.

> **Grade the negatives too.** An image counts as *absent* only if you ticked or graded
> something on it. An untouched image is left out of training entirely — silence is not a
> negative. If you only ever tick the positives, the head has nothing to contrast them with and
> the target will report one class.

Remember the files themselves are not kept between sessions: a browser cannot hold on to files
you picked. Your ticks *are* kept. Re-select the same images in step A each sitting and every
tick reattaches to the right one.

### 2. Choose the target

In **Train the model to predict**, choose *Pus, present or absent*. The option text already
tells you what you have:

```
Pus, present or absent — 2 classes, smallest 31
```

Two numbers govern this screen and they are easy to confuse:

| | Value | What it is |
|---|---|---|
| `MIN_TO_RUN` | 4 per class | What the code needs to produce a held-out split at all. The button is gated on this. |
| `MIN_PER_CLASS` | 100 per class | What the result needs before anyone should publish the number. The readiness card advises on this. |

Four per class will start a run. It will not give you a head worth deploying.

### 3. Train

The defaults are the right starting point:

| Setting | Default | Note |
|---|---|---|
| Epochs | 40 | Raise only if loss is still falling at the end |
| Hidden units | 128 | Lower to 64 if the smaller class is thin, to reduce overfitting |
| Flip augmentation | On (×3) | Each image is embedded three times. Turn off to cut the work to a third on a slow machine |

The backbone is frozen; only the head is trained, on 1,280-number embeddings. The 20 % held-out
split is taken **by case**, not by image, so serial photographs of one ulcer cannot appear on
both sides of it. Class weights are applied automatically for imbalance.

### 4. Read the result before you keep it

See *When to believe it* below. This is the step that matters.

### 5. Press "Use this model in Assess"

**Without this the model is lost on reload.** A completed run that is never kept leaves nothing
behind. Once kept, open the Assess tab and load an image: the matching row now reads

```
Pus    [Findings head · pus · p 0.64 · 37 cases]    — model: present
```

The dropdown defaults to the model's call. Choosing *Present* or *Absent* yourself overrides it,
and your answer is what the verdict uses.

---

## When to believe it

### Read macro F1, not accuracy

Pus is uncommon. If one image in ten has it, a head that answers *absent* every single time
scores **90 % accuracy** and is worthless. Macro F1 exposes that; accuracy hides it.

### Check recall on the *present* class

It is in the per-class table under the confusion matrix. Here the costly error is missing pus,
not flagging it when it is absent — so precision on *present* matters less than recall. A head
with 95 % precision and 40 % recall misses three positives in five.

### Count cases, not images

Ten photographs of one ulcer are one case. The run reports both `n_train_images` and `n_cases`.
The case count is the one that bounds what the head can have learned, and it is the number shown
beside the model's call in Assess.

### Thresholds

| Positive cases | What to do |
|---|---|
| Under 30 | Train it to see where you stand, read the numbers, **discard**. Do not keep it. |
| 30–100 | Keep it if macro F1 and *present* recall are both sound, and treat it as provisional. Re-train as the set grows. |
| Over 100 | A number worth reporting. |

---

## Two cautions

### Abscess is a likelihood, not a sighting

An abscess is a subsurface collection, established at the bedside by fluctuance, by probing or
by imaging. A head trained on it is not seeing the abscess; it is learning what accompanies one
in your images — swelling, erythema, induration, the shape of the forefoot.

That is worth having. A prompt to palpate is clinically useful, and it is the honest framing.
The Assess row for abscess therefore reads **likely / unlikely** where pus and wet gangrene read
**present / absent**, so the word on screen matches what the model can support.

Two things to do differently for it:

- Hold it to **more cases** than you would a pus head. Secondary-sign inference is more fragile
  than direct appearance.
- Before believing it generalises, ask what else those positives have in common — the same
  ward, the same dressing, the same camera, the same photographer. A head can reach good
  held-out accuracy by learning the ward. Grading images from more than one source is the
  defence.

### Wet gangrene needs more cases than pus

It is genuinely visible, and a head can learn it. But what separates it from dry eschar is
moisture, swelling and odour, and only the first two reach a camera — moisture weakly, through
specular highlights that change with the flash and the dressing. Treat a wet gangrene head as
weaker than its figures suggest and hold it to more cases, not fewer.

---

## How the confirmation loop works

Once a head is kept, the row does not answer silently. It flags and waits:

```
Pus   [Findings head · pus · p 0.78 · 54 cases · confirm]   — model: present
```

The row is highlighted while the model has flagged something and you have not yet answered. The
dropdown's default shows the model's call; choosing **Present** or **Absent** records yours, and
yours is what the verdict and the case log use. The model never overwrites a clinician's answer
and never silently decides.

This is the intended division of labour: the model's job is to make sure the finding is *looked
for*, and yours is to settle it.

## What this does not change

A findings head fills in one row. It does not touch:

- **The infection verdict**, which is the severity model's. The three findings escalate it when
  present but do not produce it — slough appears in nearly every chronic ulcer, so a verdict
  driven by the findings list would return *infected* for almost every photograph, with an
  antibiotic under it.
- **Wagner, Texas or NPIAP**, which come from the examination questions, not from any model.
- **The antibiotic**, which follows the IWGDF severity grade.

---

## Checklist

- [ ] Negatives graded, not just positives
- [ ] Target reports 2 classes
- [ ] Smallest class ≥ 30 cases before keeping
- [ ] Macro F1 read, not accuracy
- [ ] Recall on *present* checked in the per-class table
- [ ] Case count noted — it appears in Assess beside the model's call
- [ ] "Use this model in Assess" pressed
- [ ] Assess tab checked on a real image
- [ ] Abscess head, if deployed, held to more cases and checked for ward/camera confounding

---

*This guide is also in the app: Study team tab, step C, "Training a findings head".*
