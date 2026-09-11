"""
Build WEAK demonstrator labels for the FUSeg 2021 foot-ulcer images.

  grade     : 'mild'  if wound occupies < 0.6 % of the photo and shows little slough / necrosis
              'severe' if wound occupies > 2 % of the photo OR > 10 % of the wound bed is black eschar
  infection : 'suspected' if > 10 % of the wound bed is yellow/green (slough or pus) OR > 15 % is black eschar;
              'none' if slough and eschar are both negligible (peri-wound erythema is computed but not used: v2)
  Images in the grey zone get None for that head and do not contribute to its loss.

These are proxies chosen so the prototype has SOMETHING to learn from. They are not clinical
ground truth. The app's ground-truth form (clinician grade/stage + tissue culture & sensitivity)
is how real labels are meant to be accumulated.

Usage: python ml/make_labels.py --root "/path/to/wound-segmentation/data/Foot Ulcer Segmentation Challenge" --out labels.json
Data: https://github.com/uwm-bigdata/wound-segmentation (Wang et al., Sci Rep 2020; FUSeg 2021 challenge)
"""
import glob, os, json, argparse, collections
import numpy as np
from PIL import Image, ImageFilter

def features(img_path, mask_path):
    im = Image.open(img_path).convert("RGB"); m = Image.open(mask_path).convert("L")
    mask = np.array(m) > 127
    if mask.sum() < 50: return None
    hsv = np.array(im.convert("HSV")).astype(float)
    H, S, V = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    rgb = np.array(im).astype(float) / 255
    valid = rgb.sum(-1) > 0.05                       # FUSeg images are zero-padded to square
    area = mask.sum() / max(valid.sum(), 1)
    slough = ((H >= 35) & (H <= 90) & (S > 0.25) & (V > 0.35) & mask).sum() / mask.sum()
    necro = ((V < 0.22) & mask).sum() / mask.sum()
    ring = np.array(m.resize((128, 128)).filter(ImageFilter.MaxFilter(9)).resize(m.size)) > 127
    ring = ring & ~mask & valid                      # peri-wound ring
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    red = ((r - np.maximum(g, b)) > 0.18) & (S > 0.35) & ring
    ery = red.sum() / max(ring.sum(), 1)
    return dict(area=float(area), slough=float(slough), necro=float(necro), ery=float(ery))

def label(f):
    a, s, n, e = f["area"], f["slough"], f["necro"], f["ery"]
    grade = "severe" if (a > 0.02 or n > 0.10) else ("mild" if (a < 0.006 and n < 0.02 and s < 0.05) else None)
    # v2: wound-bed slough / pus / eschar only. Peri-wound redness (e) was dropped from the rule because
    # healthy granulation tissue is also red, which made the v1 infection labels noisy (held-out AUC 0.72).
    inf = "suspected" if (s > 0.10 or n > 0.15) else ("none" if (s < 0.01 and n < 0.02) else None)
    return grade, inf

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--root", required=True); ap.add_argument("--out", default="labels.json")
    a = ap.parse_args(); rows = []
    for split in ["train", "validation"]:
        for p in sorted(glob.glob(f"{a.root}/{split}/images/*.png")):
            mp = f"{a.root}/{split}/labels/{os.path.basename(p)}"
            if not os.path.exists(mp): continue
            f = features(p, mp)
            if f is None: continue
            g, i = label(f)
            rows.append(dict(split=split, name=os.path.basename(p), path=p, grade=g, infection=i, **f))
    json.dump(rows, open(a.out, "w"), indent=0)
    for k in ["grade", "infection"]:
        print(k, collections.Counter((r["split"], r[k]) for r in rows))
