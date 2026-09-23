# Demo image provenance

Every image shipped in this folder, where it came from, and on what basis it is published.
A demo image in a public repository is a publication; nothing goes here without an answer
in both columns.

## Diabetic foot ulcer samples — FUSeg 2021, validation split

| File | FUSeg id | Outline agreement with the expert mask (Dice) |
|---|---|---|
| `small_leg_ulcer.jpg` | 0068 | 0.77 |
| `sloughy_heel_ulcer.jpg` | 0046 | 0.70 |
| `large_ankle_ulcer.jpg` | 0729 | 0.94 |
| `necrotic_forefoot_ulcer.jpg` | 0136 | 0.90 |
| `plantar_eschar_ulcer.jpg` | 0971 | 0.96 |

All five are from the **validation** split, so neither the segmentation model nor the
classifier was trained on them. Dice is measured with the component-merge rule the app
ships (largest region plus any region ≥ 10 % of it within 2.5 equivalent diameters).
0.70 is kept on purpose: a demo that shows only its best cases is an advertisement.

Source: FUSeg 2021 / AZH Wound and Vascular Center. Wang C. et al., *Sci Rep*
2020;10:21897. github.com/uwm-bigdata/wound-segmentation.

**Open question for the project owner:** confirm the FUSeg terms permit redistributing
these five images inside a public repository. If they do not, they come out and the demo
runs on locally loaded images instead.

`landscape_offcentre.jpg` and `portrait_phone.jpg` are 0729 and 0046 re-framed into 4:3
and 9:16 shapes with the wound off-centre. They exist to demonstrate that letterboxing
discards nothing at the edge of the frame. Derived images, same provenance.

## Pressure injury samples — HTPN wound unit

| File | Appearance |
|---|---|
| `pi_sloughy.jpg` | depth obscured by slough and eschar |
| `pi_granulating.jpg` | full-thickness wound with a granulating bed |
| `pi_cavity.jpg` | deep cavity with necrotic edging |

Source: wound unit, Hospital Tengku Permaisuri Norashikin, Kajang.

**Basis for publication:** clinical photography consent covering teaching use, attested by
Dr Naim Bin Abdul Malek on 23 September 2026. The consent forms themselves are held by the
hospital and are not in this repository.

**De-identification performed before they were added:** no ruler, name or identity card
number in frame; no face, wristband or bed label; EXIF metadata absent (verified — no GPS,
no camera serial, no timestamp); a burned-in date and time was cropped from
`pi_granulating.jpg` and packaging labels were cropped from the other two.

These carry no expert mask, so no outline score is shown for them.

## What is NOT permitted with these images

They are demonstration images. Using patient images as training or validation data for the
DrPH study needs NMRR registration and MREC approval, which are not in place. Nothing in
this folder may be loaded into the Train tab as study data until they are.

## Images previously shipped here and removed

Three files — `mild_plantar_ulcer.jpg`, `severe_infected_ulcer.jpg`, `deep_heel_ulcer.jpg` —
were captioned in the app as FUSeg images. They were not. Searching all 1,210 FUSeg images
at full resolution, the closest match to each differed by 60 to 70 mean pixel levels, where
an identical image differs by under 6. Their true source is unknown, and so are their
licence and their consent status. They were removed rather than re-captioned, and they
should not be restored.
