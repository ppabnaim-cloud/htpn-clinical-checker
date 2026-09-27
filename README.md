# Wound Vision

A browser-based wound assessment prototype for **diabetic foot ulcers** and **pressure injuries**.
Everything runs on the device: no image is uploaded, and there is no backend.

> Research prototype. Not a medical device, not validated, not for clinical decision-making.

Dr Naim Bin Abdul Malek · Deep Learning Healthcare Centre of Excellence ·
Hospital Tengku Permaisuri Norashikin, Kajang

## What it does

| | |
|---|---|
| **Segmentation** | MobileNetV2-UNet trained on FUSeg expert masks outlines the wound and measures it |
| **Classification** | MobileNetV2 with two softmax heads (severity, infection appearance), trained on wound crops |
| **Tissue map** | A CIE Lab colour rule splits the wound bed into granulation, slough, necrosis and pale tissue. Not a trained model, and labelled as such |
| **Classification by rule** | Wagner (Meggitt 1976 / Wagner 1981), Texas (Armstrong, Lavery & Harkless 1998) and NPIAP 2016 are computed from clinician findings, not predicted |
| **Occlusion testing** | Masks the wound and reclassifies, then masks everything but the wound, to test whether the lesion actually drives the prediction |
| **Train on your data** | Transfer learning in the browser, split by patient rather than by image |

## Layout

    index.html    the whole application, one file
    model/        whole-photograph classifier (TF.js)
    model-roi/    wound-crop classifier, with calibration
    seg/          segmentation model
    samples/      demonstration images, with PROVENANCE.md
    vendor/       pinned TensorFlow.js
    ml/           training and audit scripts (Python)
    docs/         deployment and training notes, conference script
    qr/           printable QR code for the public link

## Running it

It is a static site. Any web server will do:

    python3 -m http.server 8000     # then open http://127.0.0.1:8000/

Deployment is a static Vercel project with no build step.

## History

Split out of `htpn-clinical-checker`, which also held an unrelated clinical documentation
tool. The commit history of the wound work came across intact.

The original public link, handed out at a conference, is preserved by a permanent redirect
from `htpn-clinical-checker.vercel.app/dfu/`.
