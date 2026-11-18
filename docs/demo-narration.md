# Wound Vision — demo narration script

For a screen recording to a supervisor. Plain spoken English. Roughly 8–9 minutes.
Read the **bold** lines aloud; the indented notes are for you, not the camera.

---

## 1 · Opening and disclaimer  (~45 seconds)

*(Screen: the disclaimer card, before entering)*

**"This is Wound Vision. It is a prototype I built for the Deep Learning Healthcare
Project at Hospital Tengku Permaisuri Norashikin.**

**It runs in an ordinary web browser, so it works on a phone as well as a laptop.
A doctor in the clinic can open it on their phone at the bedside.**

**What it does is simple. It reads a photograph of a wound and reports what it can see.
It does not replace examination, and it does not replace the doctor. The clinician still
decides.**

**The aim of the study is on this screen. Recognise a bad ulcer sooner, act sooner,
keep the limb, and get the patient back to work.**

**Two safety points before anyone can enter. First, the user must confirm they understand
this is still under training and validation. Second, they must confirm they will not upload
a photograph showing a name, an I.C. number or a face, and will not put patient details in
the file name. No image and no patient identifier is stored anywhere. Everything stays on
the device."**

> Click both boxes, then Continue.

---

## 2 · Study team tab  (~3 minutes)

*(Screen: Study team tab)*

**"This tab is the research side. A normal clinician never sees it. It shows the whole
journey of training the model, in four steps, in one sitting."**

### What survives closing the app

**"Before the steps, this table is important. Your ticks and labels are kept. Trained models
are kept. The case log is kept. But the image files themselves are not kept — a browser is
not allowed to hold on to files you picked. So each session you choose the same folder again,
and the labels reattach to the right images automatically."**

### Step A — add your images

**"Step A is adding the photographs.**

**My original plan was different. I wanted to organise the images in Google Drive in folders
by label — a folder for pus, one for abscess, wet gangrene, slough, peri-wound erythema,
necrosis — and link Drive directly to the app. But that needs Google Colab with a paid
subscription, which is not sustainable for a hospital project. So the images are added
manually from the device instead. Ordinary photo files, JPEG or PNG, portrait or landscape."**

### Step B — label the images

*(Screen: step B)*

**"Step B is where the grading happens. For each image I record who is grading it. I have two
independent graders, Dr Farah and Dr Azfar. Both have postgraduate training in wound care.
They grade separately, without conferring, so I can measure how much they agree.**

**Then the Meggitt–Wagner grade, and the findings present in the image — pus, abscess,
wet gangrene, slough, granulation, necrosis, peri-wound erythema.**

**This labelling is where I believe the contribution is — pus, abscess and wet gangrene, which
have no open model to start from.** *(Use the checked wording in the novelty notes below.)*

**There is also a Fitzpatrick skin type field, left as not recorded. I do not have the manpower
to do it properly in this round, so I am keeping the field for future work rather than claiming
anything from it.**

**You can also draw the tissue map by hand, if you want to mark the regions yourself.**

**And these twelve questions are what only your examination can supply — warmth, pain,
tenderness. A photograph cannot show those, so the app asks the human.**

**One field I want to point out. 'Your own call on this wound, before any app output.'
The grader answers from the photograph alone, before anything else. It changes nothing in the
app. It exists so the study can later ask whether showing the app made clinicians more right
or less right — which is the question that decides whether this tool should be used at all.
Once you have seen the app's answer for an image, that number can never be recovered."**

### Step C — train

*(Screen: step C)*

**"Step C is the training, and it happens on this device, in the browser.**

**Every image goes once through an ImageNet-pre-trained MobileNetV2 backbone, which turns the
picture into 1,280 numbers. The backbone is frozen. I only train a small new head on top of
those numbers. Twenty percent of the images are held out to estimate performance.
Flip augmentation is on, which triples the effective number of training examples.**

**You can see the Train button is switched off, and the app says why: training needs at least
two classes with four images each, and right now Wagner 3 has one. The button stays off rather
than give me a number that means nothing. That is deliberate throughout this app — it refuses
to produce a figure it cannot stand behind."**

### Step D — keep or export

**"Step D keeps the trained model in the browser so it can be used on the Findings tab."**

### Where I am now

**"To be straight about progress: I am still short of images for pus, abscess and wet gangrene.
And the arithmetic is unforgiving — the target is forty positive examples each. At clinic rates
that is about two hundred photographs to reach forty with pus, four hundred for abscess, and
something like six hundred for wet gangrene. I will not reach the last two by December.**

**So my plan is to train one pooled head — any severe infection sign present, meaning pus or
abscess or wet gangrene together — rather than three separate ones. That needs about a hundred
and thirty images for forty positives, which is reachable. It also matches how the app already
behaves: any one of those three raises the alarm on its own, so a single pooled detector matches
the decision it actually drives. The three signs stay recorded separately in the log, so they can
be separated later when the numbers exist.**

**By end of December I can therefore show you the pooled severe-sign detector, trained and
validated, and the agreement figures between my two graders for the common classes. What I will
not be able to show is a model that tells pus from abscess from wet gangrene — I would rather say
that now than promise it."**

---

## 3 · Findings tab  (~2 minutes)

*(Screen: Findings tab)*

**"Now the clinical side — this is what the doctor actually uses.**

**You can upload your own photograph or use a demo image. Patient identifiers must be removed
first. Portrait or landscape both work, so a phone photo is fine.**

**I will use a demo image.**

**There are three views. Photo, Wound outline, and Tissue.**

**On the photo you can set the scale using a ruler in the picture. This matters a great deal,
because peri-wound erythema is measured in centimetres. Without a scale the app will not report
a distance — it says so rather than guess.**

**Now Tissue. Using the same transfer learning approach, the app produces a heat map of the
wound bed and gives a percentage for granulation, slough and necrosis, and for peri-wound
erythema.**

**What is not there yet is pus, abscess and wet gangrene. That is the part I am collecting for.
By end of December I expect to show a pooled detector for those three — whether a severe sign is
present — rather than three separate maps, for reasons of sample size I will come to."**

---

## 4 · Grading tab  (~1 minute)

*(Screen: Grading tab)*

**"The grading tab is separated into Wagner, Texas and antibiotics, as three tabs.**

**I separated them because most clinicians in my hospital use Wagner only. Before, they had to
answer the Texas questions too, which wasted their time. Now each tab asks only its own
questions.**

**I have added the antibiotic guidance here, following the National Antimicrobial Guideline.
It is decision support — it is not a prescription.**

**And this is the human-in-the-loop part. The app cannot feel warmth. It cannot feel pain or
tenderness. It cannot probe to bone. So before the Wagner grade is settled and before any
antibiotic is suggested, the app asks the clinician for those findings. The model is never
allowed to conclude infection by itself — it can prompt, but a human sets the answer."**

---

## 5 · Dashboard  (~1.5 minutes)

*(Screen: Dashboard tab)*

**"The last tab is the dashboard. This is how I track whether the study is actually ready,
rather than assuming it is.**

**At the top, Data readiness. How many devices have contributed, how many images are labelled,
how many case-log rows exist, how many rows can be used to calculate agreement between graders,
how many cases are still waiting for a culture result, how many are missing skin type.
Each number says what it is counting — rows or images or cases — because those are different
numbers and it is easy to compare the wrong two.**

**Then three agreement figures: how often the model agrees with culture, how many cultures came
back positive, and the inter-rater kappa between my two graders.**

**Below that is the part I use most — readiness by class.**

**One row for every class: Wagner 1 to 5, pus, abscess, wet gangrene, granulation, slough,
necrosis, peri-wound erythema. For each one it shows how many images I have, how many went into
the last training run, how many are confirmed, how many each grader labelled, and the target.**

**The targets are not round numbers I chose. They come from the sample size needed to show that
two graders agree better than chance — about twenty positive examples per class. Forty is used
for pus, abscess, wet gangrene and peri-wound erythema, because those four can raise the alarm
on their own, so they need tighter agreement.**

**An important detail: the targets are not lowered to what is easy to reach. Wagner 5 will stay
red for a long time, because extensive gangrene is rare and those patients go to theatre, not to
a camera. That red bar is the finding — it tells me to pool Wagner 5 with Wagner 4 in the
analysis rather than quote a result on four cases.**

**There is also a line for images with no Wagner grade yet, so nothing disappears quietly.**

**And below, the case mix — ulcer site, outcome, cases per grader — and the training history."**

---

## 6 · Closing  (~30 seconds)

**"So, to summarise. The app works end to end today: labelling, training in the browser,
tissue mapping with percentages, Wagner and Texas grading, antibiotic support, and a dashboard
that tells me honestly how far from ready I am.**

**What is not finished is the data. I am short on pus, abscess and wet gangrene, and the
prevalence arithmetic means I will not reach forty of each by December. With time until the end
of December I can deliver the pooled severe-sign detector and the inter-rater agreement figures.
Separating the three signs individually is a later piece of work, and I would rather scope it
honestly than over-promise.**

**Thank you."**

---

## Novelty — what the literature actually says

Checked by search before writing. **Fitzpatrick is removed from the novelty list** — the gap is
already published and you have not staffed it, so it is future work, not a contribution.

| Claim | Verdict | Why |
|---|---|---|
| **No open-source model or weights exist to transfer-learn pus, abscess or wet gangrene** | **Holds — lead with this** | The released wound weights are all geometry or tissue type: FUSegNet (wound boundary), uwm-bigdata wound-segmentation (MobileNetV2, wound area), DFUTissueSegNet (granulation/slough — the one you already use), a SegFormer from the DFU challenge. None classifies these three signs. |
| No DFU model trained for pus, abscess, wet gangrene *(original wording)* | **Too broad** | Clf4DFU (ResNet50) does use *deep abscess or osteomyelitis* as a class and splits gangrene by extent. State it as above instead. |
| No DFU dataset from a Malaysian population | **Not contradicted, unproven** | Public sets are Iraqi (Kaggle/Nasiriyah) and UK-led (DFUC). Say "could not find", not "does not exist". |
| No dataset ties each image to a ground truth such as tissue C&S | **Mostly holds — your strongest point** | DFUC2021 infection labels were assigned by **visual inspection** by a podiatrist and a consultant. One Warsaw wound study did use culture, so not unprecedented. |

### Why the open-source framing is the right one

Clf4DFU names abscess as a class in a paper, but **publishes no code and no weights**, and part of
its training set (823 images from Xiangya Hospital) was never released. So the class exists in the
literature as a *result*, not as something anyone can build on. That distinction is the whole point:
a published number you cannot download is not a starting point for the next study.

One dataset to know about, in case you are asked. **SurgWound** (686 images, surgeons at Ohio
State) annotates exudate in six categories including **purulent**. It was investigated as a
pre-training source and **rejected**: the published table gives **purulent = 19 images, 2.8 %** —
fewer positives than this study will collect itself. They are also surgical wounds, not diabetic
foot ulcers, and there is no abscess or gangrene class. Cite it as **precedent for the labelling
schema and the adjudication protocol**, not as data.

### Say this — pus, abscess, wet gangrene

> **"There are open-source wound models I can build on, and I do — the tissue segmentation in this
> app starts from released weights. But everything that is published as a downloadable model does
> wound outline or tissue type: granulation, slough, necrosis. For pus, abscess and wet gangrene
> there is no open model and no released weights to transfer-learn from. One paper does name deep
> abscess as a class, but it publishes no code and part of its data was never released, so there is
> nothing to start from. Those three signs are what change management fastest, and that is where I
> am putting the labelling effort."**

### Say this — Malaysian population

> **"The public datasets I could find are from Iraq and the United Kingdom. I could not find a
> diabetic foot ulcer dataset drawn from a Malaysian population. I say 'could not find' rather than
> 'does not exist', because I have not done a systematic search."**

### Say this — the reference standard (your strongest point)

> **"In the main public DFU dataset, infection is labelled by a clinician looking at the photograph.
> So a model trained on it learns to agree with an expert's visual impression, not with what is
> actually in the wound. In my design each image is tied to the patient's own deep tissue culture
> result, so the label has an anchor outside the photograph."**

> ⚠️ **Pre-empt this, because a good supervisor will raise it.** IWGDF and IDSA define diabetic foot
> infection **clinically** — at least two local signs — not by culture. Culture is therefore not a
> *better* truth; it is a **second, independent axis**, and the disagreement between the two is
> itself the finding. Say it before they do. Note also that swab culture is imperfect against tissue
> biopsy (pooled sensitivity ~85%, specificity ~68%), which is exactly why you specify a **deep
> tissue specimen**.

### If asked about skin tone

> **"Under-representation of darker skin in wound datasets is already documented, so noticing it is
> not my contribution. Contributing darker-skin diabetic foot images from a Malaysian cohort would
> be. I have kept the field in the app, but I could not staff it this round, so it is future work."**

### Sources

- [Smart diabetic foot ulcer scoring system (Clf4DFU) — no code or weights released](https://www.nature.com/articles/s41598-024-62076-1)
- [FUSegNet — released foot-ulcer segmentation code and weights](https://github.com/mrinal054/FUSegNet)
- [uwm-bigdata wound-segmentation — released MobileNetV2 wound-area model](https://github.com/uwm-bigdata/wound-segmentation)
- [uwm-bigdata DFUTissueSegNet — released tissue segmentation](https://github.com/uwm-bigdata/DFUTissueSegNet)
- [Diabetic Foot Ulcer Grand Challenge 2021: Evaluation and Summary](https://arxiv.org/pdf/2111.10376)
- [Analysis Towards Classification of Infection and Ischaemia of DFUs — how labels were assigned](https://ar5iv.labs.arxiv.org/html/2104.03068)
- [SurgWound — surgical wound dataset with a purulent exudate class](https://huggingface.co/datasets/xuxuxuxuxu/SurgWound)
- [Swab cultures vs tissue biopsy for diagnosing diabetic foot infections](https://pmc.ncbi.nlm.nih.gov/articles/PMC13494358/)
- [Evaluating Skin Tone Fairness in CNNs for DFU Classification](https://www.researchgate.net/publication/394024268_Evaluating_Skin_Tone_Fairness_in_Convolutional_Neural_Networks_for_the_Classification_of_Diabetic_Foot_Ulcers)

### Two questions to be ready for

**"Why MobileNetV2 and not something stronger?"**
> **"It runs in a phone browser with no server and no GPU, so no image ever leaves the device.
> That was a privacy requirement, not a performance choice. A stronger backbone is available
> through Colab for the offline training."**

**"Your current numbers come from weak labels, don't they?"**
> **"Yes, and the app says so on screen. The two classifiers were trained on labels derived from
> colour rules, not from clinical diagnosis. They are demonstrators. That is exactly why the
> grading session with Dr Farah and Dr Azfar matters — it replaces the weak labels with real
> ones."**
