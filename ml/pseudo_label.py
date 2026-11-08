"""Pseudo-label unlabelled wound images with a teacher that never saw the fold being scored.

DFUTissue ships 110 labelled images and 600 unlabelled ones, and the dataset's own authors
train semi-supervised for exactly that reason. 104 labelled images is the binding constraint
on slough, not the recipe: threshold tuning gained nothing and the two loss/augmentation
changes lost ground, so the next honest lever is more data.

Leakage is the thing to get right. A teacher trained on everything would have seen the images
the student is later scored on, and its pseudo-labels would carry that knowledge into the
student through the back door, so the student's held-out score would be fiction. Each fold's
teacher is therefore the cross-validation model trained WITHOUT that fold, and its pseudo
labels are used only for the student of the same fold.

Pixels the teacher is unsure about are written as 250 and mapped to "ignore" by the palette,
so they contribute no gradient. Writing them as a class instead would teach the student the
teacher's guesses wholesale, which is how pseudo-labelling usually goes wrong.

    python ml/pseudo_label.py --teacher run/f0/tissue_model.h5 \
        --src /path/to/unlabelled --out /path/to/pseudo-f0 --conf 0.9

    TF_USE_LEGACY_KERAS=1 python ml/train_tissue.py --root <labelled> \
        --palette ml/palettes/dfutissue.json --folds 3 --fold 0 \
        --extra-root /path/to/pseudo-f0 --extra-palette /path/to/pseudo-f0/palette.json \
        --out run/student-f0

The images under --src must already be in the same geometry as the labelled set. DFUTissue's
unlabelled images are zero-padded to 256 while its Labeled/Original images are not, so they
have to be unpadded first or the teacher is reading a border the labelled set never has.
"""
import os, sys, glob, json, argparse
import numpy as np
from PIL import Image

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import train_tissue as T

PSEUDO_IGNORE = 250


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--teacher", required=True, help="a .h5 trained WITHOUT the fold to be scored")
    ap.add_argument("--src", required=True, help="directory of unlabelled images")
    ap.add_argument("--out", required=True)
    ap.add_argument("--conf", type=float, default=0.90)
    ap.add_argument("--min-tissue", type=int, default=200,
                    help="skip an image whose confident pixels are nearly all background")
    a = ap.parse_args()

    import tf_keras as keras
    os.makedirs(os.path.join(a.out, "images"), exist_ok=True)
    os.makedirs(os.path.join(a.out, "labels"), exist_ok=True)

    model = keras.models.load_model(a.teacher, compile=False)
    print(f"teacher {a.teacher}", flush=True)

    files = sorted(sum([glob.glob(os.path.join(a.src, e)) for e in
                        ("*.png", "*.jpg", "*.jpeg", "*.bmp")], []))
    if not files:
        raise SystemExit(f"no images under {a.src}")

    kept, tally, ig = 0, np.zeros(len(T.CLASSES), dtype=np.int64), 0
    B = 16
    for i in range(0, len(files), B):
        batch = files[i:i+B]
        ims = [Image.open(f).convert("RGB").resize((T.IMG, T.IMG), Image.BILINEAR) for f in batch]
        X = np.stack([np.asarray(im, dtype=np.uint8) for im in ims])
        P = model.predict(X.astype(np.float32) / 127.5 - 1.0, verbose=0)
        conf, cls = P.max(-1), P.argmax(-1)
        for j, f in enumerate(batch):
            y = cls[j].astype(np.uint8)
            y[conf[j] < a.conf] = PSEUDO_IGNORE
            if ((y > 0) & (y < len(T.CLASSES))).sum() < a.min_tissue:
                continue
            stem = os.path.splitext(os.path.basename(f))[0]
            ims[j].save(os.path.join(a.out, "images", stem + ".png"))
            Image.fromarray(y, mode="L").save(os.path.join(a.out, "labels", stem + ".png"))
            kept += 1
            for c in range(len(T.CLASSES)):
                tally[c] += int((y == c).sum())
            ig += int((y == PSEUDO_IGNORE).sum())

    json.dump({"_note": f"pseudo-labels from {a.teacher} at confidence {a.conf}; "
                        f"{PSEUDO_IGNORE} marks pixels the teacher was unsure of, which the "
                        f"trainer maps to ignore so they contribute no gradient",
               **{str(i): c for i, c in enumerate(T.CLASSES)},
               str(PSEUDO_IGNORE): T.IGNORE_NAME},
              open(os.path.join(a.out, "palette.json"), "w"), indent=1)

    tot = max(int(tally.sum()) + ig, 1)
    print(f"kept {kept}/{len(files)} images at confidence {a.conf}")
    print("pseudo-label pixel share:",
          json.dumps({c: round(float(tally[i]) / tot, 4) for i, c in enumerate(T.CLASSES)}),
          f"ignore {ig/tot:.4f}")
    if kept == 0:
        raise SystemExit("no image passed the filter \u2014 lower --conf or --min-tissue")


if __name__ == "__main__":
    main()
