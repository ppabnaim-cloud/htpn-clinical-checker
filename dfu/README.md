# DFU Vision — Diabetic Foot Ulcer deep learning prototype

A browser-based demonstrator for the Deep Learning Healthcare Centre of Excellence. A clinician photographs a
diabetic foot ulcer on a phone, the image is classified **on the device** by a transfer-learned convolutional
network, a Grad-CAM heatmap shows what the model looked at, the result is mapped onto the University of Texas
Diabetic Wound Classification, and the clinician records the ground truth (clinical grade/stage and tissue
culture & sensitivity) so that every case becomes a labelled training example for the next cycle.

Live path once deployed with the rest of this repository on Vercel: `https://<your-app>.vercel.app/dfu/`

> **Disclaimer.** Research prototype. Not a medical device, not validated, not for clinical decision-making.
> Trained on a small public dataset with weak (rule-derived) labels. The app opens with this disclaimer and with the
> standardised image acquisition protocol, and will not proceed until both are acknowledged.

## What the demo shows (30 seconds)

| t (s) | Screen | Talking point |
|---|---|---|
| 0–7 | Disclaimer gate and image acquisition protocol | "Garbage in, garbage out. Standardised capture (distance, angle, lighting, scale, no identifiers) is a prerequisite, not an afterthought." |
| 7–11 | Capture / upload / sample | "Works from the phone camera in clinic. Nothing leaves the device — the model runs in the browser." |
| 11–17 | Infection and depth probabilities, Grad-CAM overlay | "Transfer learning from ImageNet; Grad-CAM shows the network is looking at the slough, not the background." |
| 17–22 | Texas classification grid | "AI proposes grade and infection stage; the clinician supplies ischaemia (ABPI/toe pressure) because a photo cannot." |
| 22–30 | Ground truth form and case log | "Culture & sensitivity and the clinician's class are the reference standard. Every logged case feeds the next training cycle — this is the data flywheel." |

The recorded walk-through is in `demo/dfu-demo.mp4` (26 s, phone viewport).

## Version 0.2 — train on your own data

The **Train on your data** tab turns the demonstrator into a small platform for the DrPH study:

| Source | How | Where the images go |
|---|---|---|
| Upload folder | Choose a folder whose sub-folders are classes (`wagner_0 … wagner_5`, `1A … 3D`, `infected / not_infected`) | Stay in the browser |
| Add per class | Name a class, add images from the phone gallery (works on iPhone, which has no folder upload) | Stay in the browser |
| Google Drive | OAuth client ID + Drive folder ID; sub-folders are classes; images are downloaded with `drive.readonly` scope | Downloaded into the browser only |
| Load Colab model | Select `model.json`, the `.bin` shards and `classes.json` exported by `ml/DFU_finetune_colab.ipynb` | n/a |

**In-browser transfer learning.** Each image is passed once through the frozen ImageNet MobileNetV2 backbone to obtain a
1,280-number embedding (with horizontal/vertical flip augmentation), a stratified 20 % is held out, and a new head
(dense 128 → dropout → softmax, class-weighted) is trained with TensorFlow.js. Sixty images train in about a minute on a
laptop. The result shows held-out accuracy, macro F1, a confusion matrix and per-class precision/recall, and can be
activated in the Assess tab (Grad-CAM works on it), saved on the device (IndexedDB) and downloaded.

**GPU fine-tuning.** `ml/DFU_finetune_colab.ipynb` fine-tunes a whole backbone (EfficientNetB0, DenseNet121,
InceptionV3, ResNet101V2 or MobileNetV2, the families named in the protocol) on Google Colab's free T4 GPU, using a
stratified 70/15/15 split, class weights, early stopping, and reports AUC, sensitivity, specificity, PPV, NPV, F1 and MCC
on the held-out test set. It exports a float16 TensorFlow.js model plus `classes.json` (class names, Grad-CAM layer,
input range, scheme, metrics) that the app loads directly.

**Wagner as well as Texas.** The scheme toggle in the Assess tab shows either the Texas grid or the Meggitt–Wagner
ladder. For the demo model, Wagner is a mapping (superficial → 1, deep/extensive → 2, or 3 when infection is also
predicted). For a model trained on Wagner-named folders, the ladder shows the predicted grade directly. Wagner is
appearance-based, which suits an image-only model and a primary-care triage rule such as "refer at Wagner ≥ 2"; Texas
depth and stage need probe-to-bone, vascular assessment and microbiology, which the app collects in Step 3 rather than
pretending to infer.

**Data governance.** The DrPH protocol commits to an institution-hosted server under the PDPA 2010. Consumer Google Drive
is not that. Use the Drive option only for de-identified images; for study data, prefer the zip-upload path in the Colab
notebook under an institutional account, or run the notebook on an institutional GPU.

### Google Drive setup (one-off)

1. Google Cloud Console → create a project → **APIs & Services → Library** → enable **Google Drive API**.
2. **OAuth consent screen** → External (or Internal for a Workspace) → add your account as a test user.
3. **Credentials → Create credentials → OAuth client ID → Web application** → add the app's origin
   (e.g. `https://htpn-clinical-checker.vercel.app`) under *Authorised JavaScript origins*.
4. Paste the client ID and the Drive folder ID (the part of the folder URL after `/folders/`) into the app.

### Online GPU options

| Option | Cost | Notes |
|---|---|---|
| Google Colab (free) | Free | T4 GPU, session limits of a few hours; enough for a few thousand 224 px images with EfficientNetB0 |
| Google Colab Pro / Pro+ | About USD 10 / 50 per month | Longer sessions, faster GPUs (L4/A100), background execution |
| Kaggle Notebooks | Free | 30 GPU-hours per week (T4 ×2 or P100); dataset must be uploaded to Kaggle |
| Lightning AI Studios | Free tier, then pay-as-you-go | Persistent environment; GPU hours included monthly |
| Paperspace Gradient / RunPod / Vast.ai | Pay-as-you-go from about USD 0.2–0.5 per hour | Rent a GPU VM; you control where data lives |
| Institutional GPU (university HPC, MOH data centre) | Usually free to the study | The only option that clearly satisfies the PDPA/institution-hosted commitment |

## How it works

```
phone camera / gallery / sample  ─►  centre crop 224×224, scale to [-1,1]
        │
        ▼
MobileNetV2 (ImageNet weights, TensorFlow.js in the browser)
        │ out_relu  (7×7×1280 feature map)  ──►  Grad-CAM: gradient of the chosen class score w.r.t. this map
        ▼
global average pool ─► dropout ─► two softmax heads
        ├─ grade      : mild (Texas Grade 1-like) vs severe (Texas Grade 3-like)
        └─ infection  : none (Stage A) vs suspected (Stage B)
        │
        ▼
Texas cell = AI grade × (AI infection + clinician ischaemia) ─► e.g. 3B
        │
        ▼
ground truth form (clinician grade/stage, probe-to-bone, C&S organisms + sensitivities) ─► local case log ─► CSV export
```

* **Transfer learning, not training from scratch.** MobileNetV2 pre-trained on ImageNet; the backbone is frozen while
  the two new heads are trained, then the top 30 layers are fine-tuned at a low learning rate (2e-5). Total CPU training
  time is about five minutes on four cores.
* **On-device inference.** The exported TensorFlow.js model is 4.5 MB (float16). Inference takes roughly 0.5–1.3 s on
  WebGL; Grad-CAM adds a fraction of a second. Nothing is uploaded, which matters for patient images.
* **Explainability.** Grad-CAM (Selvaraju et al., 2017) is computed live in the browser by splitting the network at the
  last convolutional map and back-propagating the selected class score. The clinician can switch the explanation target
  between *severe*, *mild* and *infection*.
* **Texas classification.** Grade 0 and Grade 2 are deliberately greyed out: a photograph cannot see tendon, capsule or
  bone, so the depth head only separates a superficial from a deep/extensive appearance. Ischaemia (Stage C/D) is a
  clinician input.

## Training data and labels — read this before presenting

* **Images:** the public Foot Ulcer Segmentation Challenge 2021 release (AZH Wound and Vascular Center; Wang C. et al.,
  *Fully automatic wound segmentation with deep convolutional neural networks*, Sci Rep 2020;10:21897;
  https://github.com/uwm-bigdata/wound-segmentation). 810 training and 200 validation photographs with expert wound masks.
  The three sample images in the app come from the validation split, which the model never trained on.
* **Labels are weak labels.** The dataset has masks but no Texas grades or culture results, so `ml/make_labels.py`
  derives proxies:
  * *severity*: wound area from the expert mask (> 2 % of the photo, or > 10 % black eschar, = severe; < 0.6 % with no
    slough or eschar = mild; the grey zone is left unlabelled);
  * *infection*: > 10 % of the wound bed yellow/green (slough or pus) or > 15 % black eschar = suspected; negligible
    slough and eschar = none. A peri-wound erythema rule was tried and dropped because healthy granulation is also red.
* **Held-out agreement with the weak labels** (`model/metrics.json`): severity head AUC 0.93 / accuracy 84 % (n = 107);
  infection head AUC 0.80 / accuracy 75 % (n = 157). These describe agreement with the proxy rules, **not** clinical
  accuracy. Sample A/B/C were chosen because the model's output on them matches their appearance; on the wider held-out
  set the model is wrong roughly one time in four for infection and one in six for severity.
* The ground-truth step in the app is precisely the mechanism intended to replace these proxies with clinician-adjudicated
  grades and culture-confirmed infection status.

## Reproducing the model

```bash
python -m venv venv && . venv/bin/activate
pip install -r ml/requirements.txt
git clone --depth 1 https://github.com/uwm-bigdata/wound-segmentation.git /tmp/ws
python ml/make_labels.py --root "/tmp/ws/data/Foot Ulcer Segmentation Challenge" --out /tmp/labels.json
TF_USE_LEGACY_KERAS=1 python ml/train_dfu.py --labels /tmp/labels.json --out dfu/model
```

To re-record the demo video:

```bash
(cd dfu && python -m http.server 8765) &
python ml/record_demo.py          # writes dfu/demo/dfu-demo.mp4
```

## Running locally

The app is static: `cd dfu && python -m http.server 8765`, then open http://127.0.0.1:8765/ (a phone on the same
network can use your machine's IP). Camera capture requires HTTPS or localhost, which Vercel provides.

## Files

| Path | Purpose |
|---|---|
| `index.html` | The whole app: disclaimer gate, capture, inference, Grad-CAM, Texas grid, ground truth, case log, model card |
| `model/` | TensorFlow.js layers model (`model.json` + float16 weight shards) and `metrics.json` |
| `samples/` | Three held-out sample photographs (cropped, de-identified, from FUSeg 2021) |
| `vendor/tf.min.js` | TensorFlow.js 4.22.0 (Apache-2.0), vendored so the app has no runtime CDN dependency |
| `demo/` | Recorded walk-through video |
| `../ml/DFU_finetune_colab.ipynb` | GPU fine-tuning notebook (Drive or zip upload → TF.js export) |
| `../ml/` | Labelling, training/export and video-recording scripts |

## Roadmap for a real system (what the prototype is *not* yet)

1. Prospective, protocol-compliant image collection with clinician-adjudicated Texas grade/stage and culture results.
2. Wound segmentation first (the FUSeg masks make this feasible) so that classification runs on the wound, not the room.
3. Calibration and abstention thresholds; external validation on Malaysian skin tones and camera hardware.
4. Server-side model registry and audit trail; integration with the clinical information system; MDA regulatory pathway.
