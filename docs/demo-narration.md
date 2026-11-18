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

**This labelling is where I believe the contribution is.** *(See the novelty notes below —
use the checked wording.)*

**There is also a Fitzpatrick skin type field. I have left it as not recorded, and I want to
be honest about why: I do not have the manpower to do it properly in this round. I am keeping
the field because it matters — darker skin is under-represented in the published diabetic foot
datasets, and a Malaysian cohort is well placed to help fill that gap later.**

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
If I may have until the end of December, I will finish collecting, balance the classes across
Wagner 1 to 5 and across the tissue findings, complete the training and validate it. Then I can
show you the complete version."**

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
By end of December I expect to show those three mapped and measured the same way."**

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

**What is not finished is the data. I am short on pus, abscess and wet gangrene. With time until
end of December to finish collection, balance the classes and validate, I can present the
complete model.**

**Thank you."**

---

## Novelty — what the literature actually says

I searched before writing this. Two of the four claims need rewording. A supervisor who
searches will find these papers in a few minutes, and an overstated claim costs more than a
narrower true one.

| Your claim | Verdict | Why |
|---|---|---|
| No DFU model trained for pus, abscess, wet gangrene | **Partly wrong — reword** | A ResNet50 model (Clf4DFU) already uses *Infection2 = deep abscess or osteomyelitis*, and splits gangrene into *localised* vs *whole-foot*. Another study segments seven classes including gangrene and infection. **Abscess and gangrene already exist as classes.** |
| No DFU model trained on a Malaysian population | **Not contradicted, but unproven** | Public sets are Iraqi (Kaggle/Nasiriyah) and UK-led (DFUC, Manchester Met). I found no Malaysian DFU dataset — but absence in one search is not proof. |
| No dataset matches each image to a ground truth such as tissue C&S | **Strongest claim — mostly holds** | DFUC2021 infection labels were assigned by **visual inspection** by a podiatrist and a consultant, checked against records — not microbiology. One Warsaw wound study did use positive culture + antibiotics, so it is not unprecedented. |
| Fitzpatrick datasets lack darker-skin DFU | **True but already published** | A 2025 paper on skin-tone fairness in DFU CNNs reports exactly this under-representation. Noticing the gap is not novel; **supplying the images is.** |

### Safe wording — say this instead

**On pus, abscess and wet gangrene:**

> **"Published DFU models do classify infection, and one separates deep abscess from
> osteomyelitis. What I could not find is a model that treats purulent discharge as its own
> labelled class, or that separates wet from dry gangrene — the published work divides gangrene
> by how far it has spread, not by whether it is wet. Those are the three signs that change
> management fastest, so that is where I am putting the labelling effort."**

**On the Malaysian population:**

> **"The public datasets I could find are from Iraq and the United Kingdom. I could not find a
> diabetic foot ulcer dataset drawn from a Malaysian population. I want to say 'could not find'
> rather than 'does not exist', because I have not done a systematic search."**

**On the reference standard — your strongest point:**

> **"In the main public DFU dataset, infection is labelled by a clinician looking at the
> photograph. So a model trained on it learns to agree with an expert's visual impression, not
> with what is actually in the wound. In my design each image is tied to the patient's own deep
> tissue culture result, so the label has an anchor outside the photograph."**

> ⚠️ **Pre-empt this, because a good supervisor will raise it.** IWGDF and IDSA define diabetic
> foot infection **clinically** — at least two local signs — not by culture. So culture is not a
> *better* truth than clinical diagnosis; it is a **second, independent axis**, and the
> disagreement between them is itself the interesting finding. Say this before they do. Also
> note swab culture is imperfect against tissue biopsy (pooled sensitivity ~85%, specificity
> ~68%), which is exactly why you specify a **deep tissue specimen**.

**On Fitzpatrick skin type:**

> **"Under-representation of darker skin in wound datasets is already documented — there is a
> 2025 paper on skin-tone fairness in diabetic foot ulcer models showing it. So noticing it is
> not my contribution. Contributing actual darker-skin diabetic foot images from a Malaysian
> cohort would be. I have kept the field in the app but I have not been able to staff it this
> round, so I am presenting it as future work, not as a result."**

### Sources

- [Construction and validation of a deep learning-based diagnostic model for segmentation and classification of diabetic foot (Clf4DFU)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12014428/)
- [Diabetic Foot Ulcer Grand Challenge 2021: Evaluation and Summary](https://arxiv.org/pdf/2111.10376)
- [Analysis Towards Classification of Infection and Ischaemia of Diabetic Foot Ulcers (DFUC labelling)](https://ar5iv.labs.arxiv.org/html/2104.03068)
- [Evaluating Skin Tone Fairness in CNNs for the Classification of Diabetic Foot Ulcers](https://www.researchgate.net/publication/394024268_Evaluating_Skin_Tone_Fairness_in_Convolutional_Neural_Networks_for_the_Classification_of_Diabetic_Foot_Ulcers)
- [Skin Tone Benchmark Dataset for Diabetic Foot Ulcers](https://mondallab.cs.fiu.edu/wp-content/uploads/sites/50/2024/04/Skin-Tone-Benchmark-Dataset-for-Diabetic-Foot-Ulcers-and-Machine-Learning-to-Discover-the-Salient-Features.pdf)
- [Swab cultures vs tissue biopsy for diagnosing diabetic foot infections: systematic review and meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC13494358/)
- [Advances in Image-Based Diagnosis of Diabetic Foot Ulcers Using Deep Learning: A Systematic Review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12730623/)
- [Artificial intelligence models for wound infection recognition compared with human results (Warsaw, culture-based labels)](https://www.sciencedirect.com/science/article/abs/pii/S0208521625000610)

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
