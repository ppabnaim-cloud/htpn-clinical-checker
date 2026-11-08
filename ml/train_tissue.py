"""
Wound-bed tissue segmentation for Wound Vision: MobileNetV2-UNet, multi-class.

Why this exists: the app currently classifies wound-bed pixels with tissueOf() — six hand-written
thresholds on CIELAB lightness, chroma and hue. It fails in the way hand-written thresholds do.
On a real heel ulcer it put 78 % of the bed in "other" and reported "Slough — Not seen" over a
plainly sloughy, purulent bed, because calling a pixel slough needs chroma above 15 and that bed
was a pale, desaturated cream-yellow. Below L 30 it has no hue information at all, so any dark
bed becomes necrosis wholesale.

A learned segmenter replaces the rule. The app keeps the rule as a fallback and labels whichever
it used, so the provenance on screen is always true.

This is the sibling of train_segmentation.py and shares its architecture deliberately: the same
encoder, the same four skips, the same export path. That model answers "where is the wound" with
one sigmoid channel; this one answers "what is each pixel of it" with a softmax over tissue
classes.

CLASSES (fixed, and matching the TISSUE array in dfu/index.html so the app can map by index):

    0 background    anything that is not wound bed, including intact skin
    1 gran          granulation — red, beefy
    2 slough        slough / fibrin — yellow, stringy
    3 necro         necrosis / eschar — black, leathery
    4 pus           purulent discharge — opaque, glossy, pooling
    5 pale          epithelial / re-epithelialising — pale pink

No public dataset labels pus. It is here for masks drawn in the app's own editor, exported with
ml/masks_to_png.py. A model trained without it simply records that in classes_missing and the
app keeps the colour rule for whatever is absent.

Datasets. None of the public sets uses these five names, so each needs a mapping, and none of
them labels pus, abscess, gangrene, peri-wound erythema or bleeding — those remain findings the
clinician supplies, and are the gap an HTPN-labelled set would fill.

    woundtissue   github.com/akabircs/WoundTissue — 147 images, colour-coded masks:
                  granulation, necrosis, slough, maceration, tendon, bone
    dfutissue     arXiv 2406.16012 — 110 expert-labelled DFU images (+600 unlabelled).
                  Reported class lists differ between papers; inspect before trusting.
    toledo        Toledo et al., VISAPP 2022 — 222 specialist-labelled images:
                  background, epithelialisation, healthy skin, granulation, slough,
                  necrotic, exposed tendon

Masks are colour-coded and the palettes are NOT guessed here. Run --inspect first:

    python ml/train_tissue.py --root /data/WoundTissue --inspect

which prints every distinct mask colour with its pixel share, then write the mapping into a JSON
file and pass it with --palette. A wrong palette trains a confident, wrong model in silence,
which is exactly the failure this script is meant to remove.

Usage:
  TF_USE_LEGACY_KERAS=1 python ml/train_tissue.py \
      --root /data/WoundTissue --palette ml/palettes/woundtissue.json --out dfu/tissue

Licensing: WoundTissue, DFUTissue and the Toledo set each carry their own terms. Check them
before use and record which you trained on — the exported metrics.json has a "data" field for it.
"""
import os, glob, json, argparse, time, collections, random
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
import numpy as np
from PIL import Image

IMG = 224
# "pus" is here although no public dataset labels it: masks drawn in the app's own editor can,
# and the app builds its model->display mapping from the class list in metrics.json, so a model
# with pus drops in beside one without it.
CLASSES = ["background", "gran", "slough", "necro", "pus", "pale"]
NC = len(CLASSES)

# A label value meaning "no opinion". tf.one_hot of an index outside [0, NC) is all zeros, so
# the cross-entropy at such a pixel is exactly zero and it teaches nothing. That is what makes
# confidence-filtered pseudo-labels usable: the parts of a teacher's guess that are not
# trustworthy can be dropped per pixel instead of per image. The soft-Dice term still counts
# the model's prediction at an ignored pixel in its denominator, which costs a little and is
# not worth masking given the term is a tie-break on top of the weighted CE.
IGNORE = 255
IGNORE_NAME = "ignore"
SKIPS = ["block_13_expand_relu", "block_6_expand_relu", "block_3_expand_relu", "block_1_expand_relu"]

IMG_EXT = ("*.png", "*.jpg", "*.jpeg", "*.bmp")


def find_pairs(root):
    """Image/mask pairs, across the layouts these datasets actually ship in.

    The image and mask directories are matched by NAME ANYWHERE in the path, not as the
    immediate parent, because DFUTissue nests a split under each: Images/TrainVal/x.png beside
    Annotations/TrainVal/x.png. WoundTissue is the flat case, image/x.png beside label/x.png.
    """
    DIRS = [("images", "masks"), ("images", "labels"), ("image", "label"),
            ("img", "mask"), ("Images", "Annotations"), ("Images", "Masks")]
    pairs, seen = [], set()
    for sub, msub in DIRS:
        for pat in IMG_EXT:
            for p in sorted(glob.glob(os.path.join(root, "**", sub, "**", pat), recursive=True)):
                parts = p.split(os.sep)
                if sub not in parts:
                    continue
                i = len(parts) - 1 - parts[::-1].index(sub)      # the last such component
                stem = os.sep.join(parts[:i] + [msub] + parts[i+1:])
                for ext in (".png", ".bmp", ".jpg", ".jpeg"):
                    cand = os.path.splitext(stem)[0] + ext
                    if os.path.exists(cand) and p not in seen:
                        seen.add(p); pairs.append((p, cand)); break
    if not pairs:                                                # flat, with a _mask suffix
        for pat in IMG_EXT:
            for p in sorted(glob.glob(os.path.join(root, "**", pat), recursive=True)):
                if "_mask" in p or "_label" in p:
                    continue
                for suf in ("_mask", "_label"):
                    cand = os.path.splitext(p)[0] + suf + ".png"
                    if os.path.exists(cand) and p not in seen:
                        seen.add(p); pairs.append((p, cand)); break
    return pairs


def inspect(root, limit=40):
    """Print every distinct mask colour and its share, so the palette is read off the data
    rather than assumed. Guessing a palette is how you train a confident wrong model."""
    pairs = find_pairs(root)
    print(f"{len(pairs)} image/mask pairs under {root}")
    if not pairs:
        print("No pairs found. Check --root, or the directory layout (images/ + masks/).")
        return
    probe = np.asarray(Image.open(pairs[0][1]))
    if probe.ndim == 2 and probe.max() <= 32:
        vals = collections.Counter()
        for _, mp in pairs[:limit]:
            for v, n in collections.Counter(np.asarray(Image.open(mp)).ravel().tolist()).items():
                vals[int(v)] += n
        tot = sum(vals.values())
        print("\nthese are INDEX masks, not colour masks. Values found:")
        for v, n in sorted(vals.items()):
            print(f"  {v:<3d} {100*n/tot:6.2f} %  (key \"{v}\")")
        print("\nAn index tells you nothing about which tissue it is. Read the dataset's own")
        print("code or documentation, or overlay a mask on its photograph, before mapping it.")
        print("Values must map to:", CLASSES)
        return

    tally = collections.Counter()
    for _, mp in pairs[:limit]:
        a = np.asarray(Image.open(mp).convert("RGB")).reshape(-1, 3)
        for col, n in collections.Counter(map(tuple, a)).items():
            tally[tuple(int(c) for c in col)] += n   # plain ints: numpy scalars print as np.uint8(…)
    total = sum(tally.values())
    print(f"\ndistinct mask colours in the first {min(limit, len(pairs))} masks:")
    for col, n in tally.most_common(30):
        print("  %-22s %6.2f %%  (key \"%d,%d,%d\")" % ("rgb%s" % (col,), 100*n/total, col[0], col[1], col[2]))
    print("\nWrite these into a palette JSON, e.g.")
    print(json.dumps({"0,0,0": "background", "255,0,0": "gran",
                      "255,255,0": "slough", "0,255,0": "necro",
                      "255,0,255": "pale"}, indent=1))
    print("keys are \"r,g,b\"; values must be one of", CLASSES)
    print("Any colour not listed is treated as background.")


def load_palette(path):
    """Two mask encodings in the wild, so two key forms. "r,g,b" means a colour mask
    (WoundTissue); a bare integer means an index mask (DFUTissue). Keys starting with _ are
    notes — provenance, licence and the traps — and are deliberately carried in the same file
    as the mapping so they cannot drift apart from it."""
    raw = json.load(open(path))
    pal, indexed = {}, None
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        if v != IGNORE_NAME and v not in CLASSES:
            raise SystemExit(f"palette maps {k} to {v!r}, which is not one of "
                             f"{CLASSES + [IGNORE_NAME]}")
        key = k.replace(" ", "")
        isidx = "," not in key
        if indexed is None:
            indexed = isidx
        elif indexed != isidx:
            raise SystemExit("palette mixes index keys and r,g,b keys; use one or the other")
        ci = IGNORE if v == IGNORE_NAME else CLASSES.index(v)
        pal[int(key) if isidx else tuple(int(x) for x in key.split(","))] = ci
    if not pal:
        raise SystemExit(f"{path} has no mapping entries (keys starting with _ are notes)")
    return pal, bool(indexed)


def load_pair(img_path, mask_path, pal, indexed=False):
    im = Image.open(img_path).convert("RGB")
    mk = Image.open(mask_path)
    mk = mk.convert("L") if indexed else mk.convert("RGB")
    if mk.size != im.size:
        mk = mk.resize(im.size, Image.NEAREST)
    w, h = im.size
    s = min(w, h)
    box = ((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)
    im, mk = im.crop(box), mk.crop(box)
    im = im.resize((IMG, IMG), Image.BILINEAR)
    mk = mk.resize((IMG, IMG), Image.NEAREST)
    a = np.asarray(mk)
    y = np.zeros((IMG, IMG), dtype=np.uint8)              # anything unmapped falls to background
    if indexed:
        for idx, ci in pal.items():
            y[a == idx] = ci
    else:
        for col, ci in pal.items():
            y[(a[:, :, 0] == col[0]) & (a[:, :, 1] == col[1]) & (a[:, :, 2] == col[2])] = ci
    return np.asarray(im, dtype=np.uint8), y


def build_arrays(root, pal, limit=0, indexed=False):
    """Return the names alongside the arrays.

    This used to return X and Y alone, and the caller recovered the names with
    find_pairs(root)[:len(X)]. That is wrong whenever a pair is dropped below: every name
    after the first drop belongs to a different image than the row it is paired with, so the
    split-by-case grouping was being computed from misaligned names. It happens to be
    harmless on DFUTissue, where each file is its own case, and would quietly leak a wound
    across the split on any dataset where it is not."""
    pairs = find_pairs(root)
    if limit:
        pairs = pairs[:limit]
    X, Y, kept = [], [], []
    for p, mp in pairs:
        x, y = load_pair(p, mp, pal, indexed)
        if ((y > 0) & (y < NC)).sum() < 50:               # nothing but background or ignore
            continue
        X.append(x); Y.append(y); kept.append(p)
    if not X:
        raise SystemExit("no usable pairs — check --root and --palette")
    return np.stack(X), np.stack(Y), kept


def case_of(name):
    return os.path.basename(name).split("_")[0]


def split_by_fold(X, Y, names, fold, folds, seed=0):
    """Hold out one of `folds` case-level folds.

    Why this exists: DFUTissue's own Test split contains just 5 images with any slough, so a
    slough Dice measured on it rests on 5 images and moves with the noise. Rotating every case
    through the held-out fold scores each image exactly once, on a model that never saw it,
    and puts all 72 slough-bearing images behind the number instead of 5."""
    rng = random.Random(seed)
    cases = sorted({case_of(n) for n in names})
    rng.shuffle(cases)
    held = {c for i, c in enumerate(cases) if i % folds == fold}
    m = np.array([case_of(n) in held for n in names])
    return X[~m], Y[~m], X[m], Y[m], len(cases), int(m.sum()), [n for n, k in zip(names, m) if k]


def split_by_case(X, Y, names, val_frac=0.2, seed=0):
    """Split on the case the image came from, not on the image. Several photographs of one
    ulcer are not independent, and splitting by image leaks the wound across the split and
    inflates every number this script prints."""
    rng = np.random.RandomState(seed)
    cases = sorted({os.path.basename(n).split("_")[0] for n in names})
    rng.shuffle(cases)
    val = set(cases[:max(1, int(round(len(cases) * val_frac)))])
    m = np.array([os.path.basename(n).split("_")[0] in val for n in names])
    return X[~m], Y[~m], X[m], Y[m], len(cases), len(val)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--palette", help="JSON mapping \"r,g,b\" -> class name; see --inspect")
    ap.add_argument("--out", default="dfu/tissue")
    ap.add_argument("--dataset", default="woundtissue", help="recorded in metrics.json")
    ap.add_argument("--epochs_dec", type=int, default=25)
    ap.add_argument("--epochs_ft", type=int, default=10)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--inspect", action="store_true")
    ap.add_argument("--folds", type=int, default=0,
                    help="cross-validate: hold out case-level fold --fold of --folds")
    ap.add_argument("--fold", type=int, default=0)
    ap.add_argument("--zoom", action="store_true",
                    help="scale augmentation. The model is sharply scale-sensitive and the app "
                         "cannot guarantee the framing it was trained on, so train across scales.")
    ap.add_argument("--dice-fg", action="store_true",
                    help="exclude background from the soft-Dice term, so it is about tissue")
    ap.add_argument("--extra-root", action="append", default=[],
                    help="another dataset to ADD to training only; repeatable. Its pairs never "
                         "enter the held-out fold, so the headline stays on the main set.")
    ap.add_argument("--extra-palette", action="append", default=[])
    ap.add_argument("--pred-out", help="write per-image held-out predictions here as .npz")
    a = ap.parse_args()

    if a.inspect:
        # Reading a mask palette is a data task, so it must not need a training stack. TF is
        # imported below this branch so --inspect runs anywhere PIL and numpy do.
        inspect(a.root); return
    if not a.palette:
        raise SystemExit("--palette is required (run --inspect first to read the mask colours)")

    import tensorflow as tf, tf_keras as keras
    from tf_keras import layers

    tf.random.set_seed(0); np.random.seed(0)
    t0 = time.time()

    pal, indexed = load_palette(a.palette)
    X, Y, names = build_arrays(a.root, pal, a.limit, indexed)
    heldNames = None
    if a.folds:
        Xtr, Ytr, Xva, Yva, ncase, nval, heldNames = split_by_fold(X, Y, names, a.fold, a.folds)
        print(f"fold {a.fold} of {a.folds}", flush=True)
    else:
        Xtr, Ytr, Xva, Yva, ncase, nval = split_by_case(X, Y, names)

    # Extra datasets go into TRAINING ONLY. Mixing them into the held-out fold would change
    # what the headline number is measured on, so improvements would not be comparable.
    for i, er in enumerate(a.extra_root):
        ep = a.extra_palette[i] if i < len(a.extra_palette) else a.palette
        epal, eidx = load_palette(ep)
        Xe, Ye, ne = build_arrays(er, epal, 0, eidx)
        print(f"adding {len(Xe)} training images from {er}", flush=True)
        Xtr = np.concatenate([Xtr, Xe]); Ytr = np.concatenate([Ytr, Ye])
    share = {c: float((Ytr == i).mean()) for i, c in enumerate(CLASSES)}
    # Which classes the training data actually contained. A class absent here is one the model
    # can never predict, and the app must keep using the colour rule for it rather than
    # silently reporting it as never present. DFUTissue has no necrosis label at all.
    present = [c for i, c in enumerate(CLASSES) if (Ytr == i).sum() > 0]
    missing = [c for c in CLASSES if c not in present]
    if missing:
        print(f"WARNING: no training pixels for {missing}. The model cannot predict "
              f"{'it' if len(missing) == 1 else 'them'}; the app will fall back to the colour "
              f"rule for {'that class' if len(missing) == 1 else 'those classes'}.", flush=True)
    print(f"train {Xtr.shape} val {Xva.shape} from {ncase} cases ({nval} held out)", flush=True)
    print("pixel share:", json.dumps({k: round(v, 4) for k, v in share.items()}), flush=True)

    def augment(x, y):
        k = tf.random.uniform([], 0, 4, dtype=tf.int32)
        x, y = tf.image.rot90(x, k), tf.image.rot90(y, k)
        if tf.random.uniform([]) < 0.5:
            x, y = tf.image.flip_left_right(x), tf.image.flip_left_right(y)
        if tf.random.uniform([]) < 0.5:
            x, y = tf.image.flip_up_down(x), tf.image.flip_up_down(y)
        # Photometric augmentation on the image only — and deliberately strong on saturation
        # and hue, because the whole point is a model that does not fail the way a chroma
        # threshold fails on a washed-out bed.
        x = tf.image.random_brightness(x, 30.0)
        x = tf.image.random_contrast(x, 0.75, 1.25)
        x = tf.image.random_saturation(x, 0.7, 1.3)
        x = tf.image.random_hue(x, 0.02)
        x = tf.clip_by_value(x, 0.0, 255.0)          # y untouched by the photometric ops
        return x, y

    ZMIN, ZMAX = 0.55, 1.40

    def zoom(x, y):
        """Scale augmentation.

        The model turned out to be sharply scale-sensitive: trained on crops where the tissue
        fills about 14 % of the frame, its granulation Dice falls from 0.78 to 0.13 when the
        same wound is shown at 1.7 %. The app cannot promise a framing, so teach the model the
        range instead of relying on the crop to hit one number.

        Shrinking pads by MIRRORING rather than with black. A black border is not something a
        camera produces, and a model given one learns it as a cue; mirroring extends the skin
        outward, and because the label is mirrored with it every pixel keeps a true class.
        """
        sc = tf.random.uniform([], ZMIN, ZMAX)
        d = tf.maximum(tf.cast(tf.round(float(IMG) * sc), tf.int32), 32)
        xi = tf.image.resize(x, [d, d], method="bilinear")
        yi = tf.image.resize(y, [d, d], method="nearest")

        def crop_in():
            lim = tf.maximum(d - IMG, 0) + 1
            oy = tf.random.uniform([], 0, lim, dtype=tf.int32)
            ox = tf.random.uniform([], 0, lim, dtype=tf.int32)
            return (tf.image.crop_to_bounding_box(xi, oy, ox, IMG, IMG),
                    tf.image.crop_to_bounding_box(yi, oy, ox, IMG, IMG))

        def pad_out():
            lo = (IMG - d) // 2
            hi = IMG - d - lo
            pads = [[lo, hi], [lo, hi], [0, 0]]
            return (tf.pad(xi, pads, mode="SYMMETRIC"),
                    tf.pad(yi, pads, mode="SYMMETRIC"))

        xo, yo = tf.cond(d >= IMG, crop_in, pad_out)
        xo = tf.ensure_shape(xo, [IMG, IMG, 3])
        yo = tf.ensure_shape(yo, [IMG, IMG, 1])
        return xo, tf.cast(tf.round(yo), tf.int32)

    def make_ds(Xa, Ya, train, batch=8):
        ds = tf.data.Dataset.from_tensor_slices((Xa, Ya))
        # The label is an index map, so it carries a channel axis through augmentation:
        # tf.image.rot90 and the flips require at least three dimensions, and a 2-D mask
        # fails there rather than at the loss, which is a long way from the cause.
        ds = ds.map(lambda x, y: (tf.cast(x, tf.float32), tf.cast(y, tf.int32)[..., None]),
                    num_parallel_calls=tf.data.AUTOTUNE)
        if train:
            ds = ds.shuffle(512, seed=0).map(augment, num_parallel_calls=tf.data.AUTOTUNE)
            if a.zoom:
                # after the flips, before the one-hot: zoom needs the index map, not the one-hot
                ds = ds.map(lambda x, y: zoom(x, tf.cast(y, tf.float32)),
                            num_parallel_calls=tf.data.AUTOTUNE)
        ds = ds.map(lambda x, y: (x / 127.5 - 1.0,
                                  tf.one_hot(tf.squeeze(tf.cast(y, tf.int32), -1), NC)),
                    num_parallel_calls=tf.data.AUTOTUNE)
        return ds.batch(batch).prefetch(tf.data.AUTOTUNE)

    def build_model():
        inp = keras.Input((IMG, IMG, 3), name="image")
        enc = keras.applications.MobileNetV2(input_tensor=inp, include_top=False, weights="imagenet")
        enc.trainable = False
        x = enc.get_layer("out_relu").output
        for name, ch in zip(SKIPS, [192, 96, 48, 24]):
            x = layers.UpSampling2D(2, interpolation="bilinear")(x)
            x = layers.Concatenate()([x, enc.get_layer(name).output])
            x = layers.Conv2D(ch, 3, padding="same", use_bias=False)(x)
            x = layers.BatchNormalization()(x)
            x = layers.Activation("relu")(x)
        logit = layers.Conv2D(NC, 1, name="logit")(x)                 # 112x112xNC
        up = layers.UpSampling2D(2, interpolation="bilinear")(logit)
        # No Lambda layer anywhere: TensorFlow.js cannot deserialise one, and a Lambda used
        # merely to rename an output silently breaks the browser build.
        out = layers.Activation("softmax", name="tissue")(up)
        return keras.Model(inp, out, name="tissue_unet_mobilenetv2"), enc

    # Tissue classes are heavily imbalanced — necrosis and epithelium are a few percent of
    # pixels — so an unweighted loss learns "granulation everywhere" and scores well on
    # accuracy. Weight by inverse pixel frequency, and report macro Dice, never accuracy.
    # A class with NO pixels must get weight ZERO, not the largest weight in the set. Clamping
    # its share to a small epsilon and inverting is the obvious way to write this and it is
    # catastrophic: on DFUTissue, which has no necrosis or epithelium label, the two absent
    # classes took all the weight (2.49 each) and the three real ones fell to ~0.00, so the
    # loss was almost entirely about classes the data could not teach. Weight the present
    # classes by inverse frequency and normalise over those alone.
    w = np.array([0.0 if share[c] <= 0 else 1.0 / share[c] for c in CLASSES], dtype=np.float32)
    if w.sum() <= 0:
        raise SystemExit("no class has any training pixels")
    w = (w / w.sum() * len(present)).astype(np.float32)
    print("class weights:", dict(zip(CLASSES, [round(float(v), 2) for v in w])), flush=True)
    wt = tf.constant(w)

    # Which channels the soft-Dice term is averaged over. Background is 90 % of pixels and
    # is the easy class, so including it means the Dice term is mostly a report on background
    # and contributes almost no gradient to the thin classes the term was added for. With
    # --dice-fg it is averaged over the tissue classes present in the data instead.
    dice_ch = tf.constant([1.0 if (c in present and (not a.dice_fg or i > 0)) else 0.0
                           for i, c in enumerate(CLASSES)], dtype=tf.float32)
    print("dice channels:", dict(zip(CLASSES, [float(v) for v in dice_ch.numpy()])), flush=True)

    def loss_fn(y_true, y_pred):
        ce = -tf.reduce_sum(y_true * tf.math.log(y_pred + 1e-7) * wt, axis=-1)
        yt = tf.reshape(y_true, [tf.shape(y_true)[0], -1, NC])
        yp = tf.reshape(y_pred, [tf.shape(y_pred)[0], -1, NC])
        num = 2.0 * tf.reduce_sum(yt * yp, 1) + 1.0
        den = tf.reduce_sum(yt, 1) + tf.reduce_sum(yp, 1) + 1.0
        per_ch = num / den                                     # [batch, NC]
        dice = tf.reduce_sum(per_ch * dice_ch, -1) / tf.reduce_sum(dice_ch)
        return tf.reduce_mean(ce) + (1.0 - tf.reduce_mean(dice))

    def macro_dice(y_true, y_pred):
        yp = tf.one_hot(tf.argmax(y_pred, -1), NC)
        yt = tf.reshape(y_true, [-1, NC]); yp = tf.reshape(yp, [-1, NC])
        num = 2.0 * tf.reduce_sum(yt * yp, 0) + 1e-6
        den = tf.reduce_sum(yt, 0) + tf.reduce_sum(yp, 0) + 1e-6
        return tf.reduce_mean(num / den)

    model, enc = build_model()
    print(f"{model.count_params():,} parameters", flush=True)
    cb = lambda p: [keras.callbacks.EarlyStopping(monitor="val_macro_dice", mode="max",
                                                  patience=p, restore_best_weights=True)]

    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss=loss_fn, metrics=[macro_dice])
    model.fit(make_ds(Xtr, Ytr, True), validation_data=make_ds(Xva, Yva, False),
              epochs=a.epochs_dec, verbose=2, callbacks=cb(6))

    enc.trainable = True
    for l in enc.layers[:-30]:
        l.trainable = False
    for l in enc.layers:
        if isinstance(l, layers.BatchNormalization):
            l.trainable = False
    model.compile(optimizer=keras.optimizers.Adam(5e-5), loss=loss_fn, metrics=[macro_dice])
    model.fit(make_ds(Xtr, Ytr, True), validation_data=make_ds(Xva, Yva, False),
              epochs=a.epochs_ft, verbose=2, callbacks=cb(4))

    # Per-class Dice on the held-out cases. Accuracy is not reported on purpose: with
    # background at 70 % of pixels it is a number that cannot go wrong.
    P = []
    for i in range(0, len(Xva), 8):
        P.append(model.predict(Xva[i:i+8].astype(np.float32) / 127.5 - 1.0, verbose=0).argmax(-1))
    P = np.concatenate(P)
    per = {}
    for i, c in enumerate(CLASSES):
        pr, tr = P == i, Yva == i
        per[c] = {"dice": float(2 * (pr & tr).sum() / (pr.sum() + tr.sum() + 1e-6)),
                  "iou": float((pr & tr).sum() / ((pr | tr).sum() + 1e-6)),
                  "true_pixel_share": float(tr.mean())}
    # Over the tissue classes that exist in the data. Averaging in a class with no pixels
    # scores it 0 and halves the headline number for a reason that has nothing to do with the
    # model, which would then read as a worse model rather than a smaller label set.
    scored = [c for c in CLASSES[1:] if c in present]
    macro = float(np.mean([per[c]["dice"] for c in scored])) if scored else 0.0
    print("held-out per class:", json.dumps(per, indent=1))
    print(f"macro Dice over tissue classes (background excluded): {macro:.3f}")

    os.makedirs(a.out, exist_ok=True)
    # Always write the Keras model first. tensorflowjs and tensorflow pin conflicting versions
    # of numpy and protobuf, so the two live in separate virtualenvs here and the conversion is
    # a second step. Losing a finished training run to an import error is not acceptable.
    h5 = os.path.join(a.out, "tissue_model.h5")
    model.save(h5)
    print("saved", h5, flush=True)
    try:
        import tensorflowjs as tfjs
        tfjs.converters.save_keras_model(model, a.out, quantization_dtype_map={"float16": "*"})
        print("converted to TensorFlow.js in", a.out, flush=True)
    except Exception as e:
        print(f"\nTensorFlow.js conversion skipped ({type(e).__name__}: {e}).")
        print("The trained model IS saved. Convert it in an environment that has tensorflowjs:")
        print(f"  tensorflowjs_converter --input_format=keras --quantize_float16='*' \\\n"
              f"      {h5} {a.out}")
    json.dump({"task": "wound-bed tissue segmentation",
               "architecture": "MobileNetV2-UNet (ImageNet encoder, 4 skip connections)",
               "input": [IMG, IMG, 3], "input_range": "[-1,1]",
               "output": f"{IMG}x{IMG}x{NC} softmax", "classes": CLASSES,
               "train_images": int(len(Xtr)), "val_images": int(len(Xva)),
               "cases": int(ncase), "val_cases": int(nval), "split": "by case",
               "per_class": per, "macro_dice_tissue": macro,
               "classes_present": present, "classes_missing": missing,
               "macro_scored_over": scored,
               "data": a.dataset, "palette": a.palette,
               "recipe": {"zoom_aug": bool(a.zoom), "dice_foreground_only": bool(a.dice_fg),
                          "extra_roots": a.extra_root,
                          "folds": a.folds or None, "fold": a.fold if a.folds else None},
               "held_out_names": [os.path.basename(n) for n in (heldNames or [])],
               "minutes": round((time.time() - t0) / 60, 1)},
              open(os.path.join(a.out, "metrics.json"), "w"), indent=1)
    print("exported to", a.out, f"in {(time.time()-t0)/60:.1f} min")


if __name__ == "__main__":
    main()
