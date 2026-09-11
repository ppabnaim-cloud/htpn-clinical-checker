"""
DFU demonstrator: transfer learning (MobileNetV2, ImageNet weights) with two
classification heads, exported to TensorFlow.js for in-browser inference + Grad-CAM.

  head "grade"     : mild (Texas Grade 1-like, superficial) vs severe (Texas Grade 3-like, deep/extensive)
  head "infection" : none (Texas Stage A) vs suspected (Texas Stage B)

Labels are WEAK labels derived from the FUSeg 2021 masks (wound area) and wound-bed
colour features (slough / necrosis / peri-wound erythema). See make_labels.py and README.
They are demonstrator labels, NOT clinician-adjudicated ground truth.

Usage:  TF_USE_LEGACY_KERAS=1 python ml/train_dfu.py --labels /tmp/work/labels.json --out dfu/model
"""
import os, json, argparse, random
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
import numpy as np, tensorflow as tf, tf_keras as keras
from tf_keras import layers
from PIL import Image

IMG = 224
GRADE = ["mild", "severe"]
INF = ["none", "suspected"]

def load_crop(path):
    """Crop away the zero-padding used by the FUSeg release, then centre-crop to square."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im)
    valid = a.sum(-1) > 12
    ys, xs = np.where(valid)
    if len(ys):
        im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((IMG, IMG), Image.BILINEAR)
    return np.asarray(im, dtype=np.uint8)

def build_arrays(rows, balance=False):
    X, yg, yi, wg, wi = [], [], [], [], []
    for r in rows:
        if r["grade"] is None and r["infection"] is None: continue
        X.append(load_crop(r["path"]))
        yg.append(GRADE.index(r["grade"]) if r["grade"] else 0); wg.append(1.0 if r["grade"] else 0.0)
        yi.append(INF.index(r["infection"]) if r["infection"] else 0); wi.append(1.0 if r["infection"] else 0.0)
    yg, yi, wg, wi = np.array(yg), np.array(yi), np.array(wg, np.float32), np.array(wi, np.float32)
    if balance:   # up-weight the minority class of each head so the loss is class-balanced
        for y, w in [(yg, wg), (yi, wi)]:
            n0, n1 = w[y == 0].sum(), w[y == 1].sum()
            if n0 > 0 and n1 > 0: w[y == 1] *= n0 / n1
    return (np.stack(X), yg, yi, wg, wi)

def make_ds(X, yg, yi, wg, wi, train):
    ds = tf.data.Dataset.from_tensor_slices((X, {"grade": yg, "infection": yi}, {"grade": wg, "infection": wi}))
    aug = keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.25, fill_mode="reflect"),
        layers.RandomZoom(0.2, fill_mode="reflect"),
        layers.RandomContrast(0.2),
        layers.RandomBrightness(0.15, value_range=(0, 255)),
    ])
    def prep(x, y, w):
        x = tf.cast(x, tf.float32)
        if train: x = aug(x, training=True)
        x = x / 127.5 - 1.0   # MobileNetV2 preprocess_input; the browser does the same in JS
        return x, y, w
    if train: ds = ds.shuffle(2048, seed=0)
    return ds.batch(32).map(prep, num_parallel_calls=tf.data.AUTOTUNE).prefetch(tf.data.AUTOTUNE)

def build_model():
    inp = keras.Input((IMG, IMG, 3), name="image")
    base = keras.applications.MobileNetV2(input_tensor=inp, include_top=False, weights="imagenet", alpha=1.0)
    base.trainable = False
    x = layers.GlobalAveragePooling2D(name="gap")(base.get_layer("out_relu").output)   # out_relu = last 7x7x1280 conv map (Grad-CAM target)
    x = layers.Dropout(0.3, name="drop")(x)
    grade = layers.Dense(2, activation="softmax", name="grade")(x)
    inf = layers.Dense(2, activation="softmax", name="infection")(x)
    return keras.Model(inp, [grade, inf], name="dfu_mobilenetv2"), base

def compile_(model, lr):
    model.compile(optimizer=keras.optimizers.Adam(lr),
                  loss={"grade": "sparse_categorical_crossentropy", "infection": "sparse_categorical_crossentropy"},
                  weighted_metrics={"grade": ["accuracy"], "infection": ["accuracy"]})

def evaluate(model, X, yg, yi, wg, wi):
    from sklearn.metrics import roc_auc_score
    pg, pi = model.predict(X.astype(np.float32) / 127.5 - 1.0, batch_size=32, verbose=0)
    out = {}
    for name, p, y, w in [("grade", pg[:, 1], yg, wg), ("infection", pi[:, 1], yi, wi)]:
        m = w > 0
        out[name] = {"n": int(m.sum()), "auc": float(roc_auc_score(y[m], p[m])), "accuracy": float(((p[m] > 0.5) == y[m]).mean())}
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", default="/tmp/work/labels.json")
    ap.add_argument("--out", default="dfu/model")
    ap.add_argument("--epochs_head", type=int, default=10)
    ap.add_argument("--epochs_ft", type=int, default=4)
    a = ap.parse_args()
    tf.random.set_seed(0); np.random.seed(0); random.seed(0)
    rows = json.load(open(a.labels))
    tr = build_arrays([r for r in rows if r["split"] == "train"], balance=True)
    va = build_arrays([r for r in rows if r["split"] == "validation"])
    print("train", tr[0].shape, "val", va[0].shape)
    model, base = build_model()
    # Phase 1: train the heads only (frozen ImageNet backbone)
    compile_(model, 1e-3)
    model.fit(make_ds(*tr, True), validation_data=make_ds(*va, False), epochs=a.epochs_head, verbose=2)
    # Phase 2: fine-tune the top of the backbone at a low learning rate
    base.trainable = True
    for l in base.layers[:-30]: l.trainable = False
    for l in base.layers:
        if isinstance(l, layers.BatchNormalization): l.trainable = False
    compile_(model, 2e-5)
    model.fit(make_ds(*tr, True), validation_data=make_ds(*va, False), epochs=a.epochs_ft, verbose=2)
    metrics = evaluate(model, *va)
    print("validation metrics (against WEAK labels):", json.dumps(metrics, indent=1))
    os.makedirs(a.out, exist_ok=True)
    model.save(os.path.join("/tmp/work", "dfu_model.h5"))
    import tensorflowjs as tfjs
    tfjs.converters.save_keras_model(model, a.out, quantization_dtype_map={"float16": "*"})
    json.dump({"backbone": "MobileNetV2 (alpha 1.0, 224px, ImageNet weights)", "heads": {"grade": GRADE, "infection": INF},
               "gradcam_layer": "out_relu", "train_images": int(tr[0].shape[0]), "val_images": int(va[0].shape[0]),
               "validation_on_weak_labels": metrics, "label_note": "Weak labels derived from FUSeg masks + colour features (demonstrator only)."},
              open(os.path.join(a.out, "metrics.json"), "w"), indent=1)
    print("exported to", a.out)
