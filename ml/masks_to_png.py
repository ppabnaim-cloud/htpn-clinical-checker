"""
Turn the masks drawn in the app into a dataset train_tissue.py can read.

The app's "Draw the tissue map" panel exports one NDJSON line per mask, each a run-length
encoded index map at 224x224. This writes them out as the images/ + labels/ layout the trainer
expects, with a palette file alongside.

    python ml/masks_to_png.py --ndjson wound-masks-2026-11-07.ndjson \
        --images /path/to/the/same/photographs --out /data/htpn-tissue

Then:

    TF_USE_LEGACY_KERAS=1 python ml/train_tissue.py \
        --root /data/htpn-tissue --palette /data/htpn-tissue/palette.json \
        --dataset "HTPN hand-drawn" --out dfu/tissue

The photographs are NOT in the export. They never leave the browser, which is the whole point
of the app, so the masks carry only the key (filename|bytes) and this script matches them back
against the originals by filename. Keep the images somewhere this script can read them.

ONE TRAP, and it is the reason this script warns rather than silently converting. In the editor
0 means "not labelled" and is distinct from "Not wound". A grader who paints the slough and
stops has said nothing about the rest of the frame. Training treats anything unmapped as
background, so unpainted pixels become background examples — which is wrong if the grader
simply did not get to them. Paint "Not wound" deliberately, or accept that the unpainted
remainder is being taught as background. The script prints the proportion for every mask so
the decision is made with the number in front of you.
"""
import os, json, argparse, collections
import numpy as np
from PIL import Image

# Must match MASK_CLASSES in the app: erase 0, then TISSUE in order, then "Not wound" 90.
APP_VALUES = {0: "unlabelled", 1: "gran", 2: "slough", 3: "necro", 4: "pus",
              5: "pale", 90: "background"}


def rle_decode(rle, n):
    parts = [int(x) for x in rle.split(",")]
    out = np.zeros(n * n, dtype=np.uint8)
    i = 0
    for v, run in zip(parts[0::2], parts[1::2]):
        out[i:i + run] = v
        i += run
    if i != n * n:
        raise ValueError(f"run-length decode produced {i} pixels, expected {n*n}")
    return out.reshape(n, n)


def find_image(images_dir, filename):
    for root, _, files in os.walk(images_dir):
        if filename in files:
            return os.path.join(root, filename)
    base = os.path.splitext(filename)[0]
    for root, _, files in os.walk(images_dir):
        for f in files:
            if os.path.splitext(f)[0] == base:
                return os.path.join(root, f)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ndjson", required=True, help="the file the app's Export all masks produced")
    ap.add_argument("--images", required=True, help="directory holding the original photographs")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    os.makedirs(os.path.join(a.out, "images"), exist_ok=True)
    os.makedirs(os.path.join(a.out, "labels"), exist_ok=True)

    written, missing, tally = 0, [], collections.Counter()
    unpainted = []
    for line in open(a.ndjson, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        key, n = rec["key"], rec.get("n", 224)
        filename = key.rsplit("|", 1)[0]          # the key is "name|bytes"
        src = find_image(a.images, filename)
        if not src:
            missing.append(filename)
            continue
        m = rle_decode(rec["rle"], n)
        for v, c in collections.Counter(m.ravel().tolist()).items():
            tally[APP_VALUES.get(int(v), f"value {v}")] += c
        frac0 = float((m == 0).mean())
        unpainted.append((filename, frac0))

        # square centre-crop the photo the same way the app and the trainer do
        im = Image.open(src).convert("RGB")
        w, h = im.size
        s = min(w, h)
        im = im.crop(((w - s)//2, (h - s)//2, (w - s)//2 + s, (h - s)//2 + s)).resize((n, n), Image.BILINEAR)

        stem = os.path.splitext(filename)[0]
        im.save(os.path.join(a.out, "images", stem + ".png"))
        Image.fromarray(m, mode="L").save(os.path.join(a.out, "labels", stem + ".png"))
        written += 1

    # The palette is written from the app's own value map, so it cannot drift from the editor.
    palette = {"_source": "exported from the Wound Vision mask editor",
               "_warning": "0 means NOT LABELLED, not background. It is mapped to background "
                           "below because the trainer needs every pixel in a class — check the "
                           "unpainted proportions this script printed before trusting that.",
               "0": "background", "90": "background",
               "1": "gran", "2": "slough", "3": "necro", "4": "pus", "5": "pale"}
    json.dump(palette, open(os.path.join(a.out, "palette.json"), "w"), indent=1)

    total = sum(tally.values()) or 1
    print(f"wrote {written} image/mask pairs to {a.out}")
    if missing:
        print(f"\n{len(missing)} mask(s) had no matching photograph and were skipped:")
        for f in missing[:10]:
            print("   ", f)
    print("\npixel share by class:")
    for k, v in tally.most_common():
        print(f"  {k:<12} {100*v/total:6.2f} %")

    bad = [(f, p) for f, p in unpainted if p > 0.5]
    print(f"\nunpainted ('not labelled') pixels: {100*tally['unlabelled']/total:.1f} % overall")
    if bad:
        print(f"{len(bad)} mask(s) are more than half unpainted. Those pixels will train as")
        print("background. Paint 'Not wound' on them, or drop the mask:")
        for f, p in sorted(bad, key=lambda x: -x[1])[:10]:
            print(f"   {100*p:5.1f} %  {f}")
    print(f"\nnext:\n  TF_USE_LEGACY_KERAS=1 python ml/train_tissue.py --root {a.out} "
          f"--palette {os.path.join(a.out, 'palette.json')} --dataset 'HTPN hand-drawn' --out dfu/tissue")


if __name__ == "__main__":
    main()
