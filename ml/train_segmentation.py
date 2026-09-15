"""
Wound segmentation for DFU Vision: MobileNetV2-UNet trained on the FUSeg 2021 expert masks.

Why this exists: Grad-CAM cannot localise a diabetic foot ulcer. On the FUSeg validation split the
ulcer occupies a median 1.3 % of the photograph, while the Grad-CAM grid (7x7 over a 224 px input)
resolves nothing finer than ~2 % per cell. Measured on 190 held-out images, the heatmap's hottest
point fell inside the true ulcer in only 13 % of cases. Segmentation answers "where" directly;
classification then runs on the cropped wound, and Grad-CAM is demoted to a sanity check.

Encoder: MobileNetV2 (ImageNet weights), frozen first, then the top unfrozen at a low rate.
Decoder: four upsample-concat-conv blocks using the standard MobileNetV2 skip tensors.
Loss:    Dice + binary cross-entropy (the wound is a small minority of pixels).

Usage:
  TF_USE_LEGACY_KERAS=1 python ml/train_segmentation.py \
      --root "/path/to/wound-segmentation/data/Foot Ulcer Segmentation Challenge" \
      --out dfu/seg

Data: Wang C. et al., Sci Rep 2020;10:21897 — github.com/uwm-bigdata/wound-segmentation
"""
import os, glob, json, argparse, time
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
import numpy as np, tensorflow as tf, tf_keras as keras
from tf_keras import layers
from PIL import Image

IMG = 224
SKIPS = ["block_13_expand_relu", "block_6_expand_relu", "block_3_expand_relu", "block_1_expand_relu"]  # 14, 28, 56, 112


def load_pair(img_path, mask_path):
    """Crop away the zero-padding in the FUSeg release, centre-crop square, resize."""
    im = Image.open(img_path).convert("RGB")
    m = Image.open(mask_path).convert("L")
    a = np.asarray(im)
    valid = a.sum(-1) > 12
    ys, xs = np.where(valid)
    if len(ys):
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        im, m = im.crop(box), m.crop(box)
    w, h = im.size
    s = min(w, h)
    box = ((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)
    im, m = im.crop(box), m.crop(box)
    return (np.asarray(im.resize((IMG, IMG), Image.BILINEAR), dtype=np.uint8),
            (np.asarray(m.resize((IMG, IMG), Image.NEAREST)) > 127).astype(np.uint8))


def build_arrays(root, split):
    X, Y = [], []
    for p in sorted(glob.glob(f"{root}/{split}/images/*.png")):
        mp = f"{root}/{split}/labels/{os.path.basename(p)}"
        if not os.path.exists(mp):
            continue
        x, y = load_pair(p, mp)
        if y.sum() < 20:            # no usable wound annotation
            continue
        X.append(x); Y.append(y)
    return np.stack(X), np.stack(Y)[..., None]


def augment(x, y):
    """Geometric transforms must apply identically to image and mask, so do them together."""
    k = tf.random.uniform([], 0, 4, dtype=tf.int32)
    x, y = tf.image.rot90(x, k), tf.image.rot90(y, k)
    if tf.random.uniform([]) < 0.5:
        x, y = tf.image.flip_left_right(x), tf.image.flip_left_right(y)
    if tf.random.uniform([]) < 0.5:
        x, y = tf.image.flip_up_down(x), tf.image.flip_up_down(y)
    x = tf.image.random_brightness(x, 30.0)          # photometric: image only
    x = tf.image.random_contrast(x, 0.8, 1.2)
    x = tf.image.random_saturation(x, 0.8, 1.2)
    return tf.clip_by_value(x, 0.0, 255.0), y


def make_ds(X, Y, train, batch=16):
    ds = tf.data.Dataset.from_tensor_slices((X, Y))
    ds = ds.map(lambda x, y: (tf.cast(x, tf.float32), tf.cast(y, tf.float32)), num_parallel_calls=tf.data.AUTOTUNE)
    if train:
        ds = ds.shuffle(1024, seed=0).map(augment, num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.map(lambda x, y: (x / 127.5 - 1.0, y), num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(batch).prefetch(tf.data.AUTOTUNE)


def build_model():
    inp = keras.Input((IMG, IMG, 3), name="image")
    enc = keras.applications.MobileNetV2(input_tensor=inp, include_top=False, weights="imagenet")
    enc.trainable = False
    x = enc.get_layer("out_relu").output                      # 7x7x1280
    # One 3x3 conv per stage, and the mask is predicted at 112 px then upsampled. Two convs per stage
    # and a 224 px conv head tripled the cost for no measurable Dice gain on a wound this size.
    for name, ch in zip(SKIPS, [192, 96, 48, 24]):
        x = layers.UpSampling2D(2, interpolation="bilinear")(x)
        x = layers.Concatenate()([x, enc.get_layer(name).output])
        x = layers.Conv2D(ch, 3, padding="same", use_bias=False)(x)
        x = layers.BatchNormalization()(x)
        x = layers.Activation("relu")(x)
    logit = layers.Conv2D(1, 1, name="logit")(x)               # 112x112x1
    up = layers.UpSampling2D(2, interpolation="bilinear")(logit)
    # No Lambda layer anywhere in this model: TensorFlow.js cannot deserialise one, so a Lambda used
    # merely to rename the output silently breaks the browser build.
    out = layers.Activation("sigmoid", name="mask")(up)
    return keras.Model(inp, out, name="dfu_unet_mobilenetv2"), enc


def dice_bce(y_true, y_pred):
    yt = tf.reshape(y_true, [tf.shape(y_true)[0], -1])
    yp = tf.reshape(y_pred, [tf.shape(y_pred)[0], -1])
    num = 2.0 * tf.reduce_sum(yt * yp, 1) + 1.0
    den = tf.reduce_sum(yt, 1) + tf.reduce_sum(yp, 1) + 1.0
    dice = 1.0 - tf.reduce_mean(num / den)
    return dice + tf.reduce_mean(keras.losses.binary_crossentropy(y_true, y_pred))


def dice_coef(y_true, y_pred):
    yt = tf.reshape(y_true, [tf.shape(y_true)[0], -1])
    yp = tf.reshape(tf.cast(y_pred > 0.5, tf.float32), [tf.shape(y_pred)[0], -1])
    num = 2.0 * tf.reduce_sum(yt * yp, 1) + 1e-6
    den = tf.reduce_sum(yt, 1) + tf.reduce_sum(yp, 1) + 1e-6
    return tf.reduce_mean(num / den)


def evaluate(model, X, Y, thresh=0.5):
    """Per-image Dice and IoU, plus how often the predicted centroid lands inside the true wound."""
    dices, ious, hits, areas = [], [], [], []
    for i in range(0, len(X), 16):
        p = model.predict(X[i:i+16].astype(np.float32) / 127.5 - 1.0, verbose=0)[:, :, :, 0]
        for j in range(len(p)):
            pred, true = p[j] > thresh, Y[i+j, :, :, 0] > 0.5
            inter, union = (pred & true).sum(), (pred | true).sum()
            dices.append(2 * inter / (pred.sum() + true.sum() + 1e-6))
            ious.append(inter / (union + 1e-6))
            areas.append(pred.mean())
            if pred.sum() > 0:
                ys, xs = np.where(pred)
                hits.append(bool(true[int(ys.mean()), int(xs.mean())]))
            else:
                hits.append(False)
    return {"dice": float(np.mean(dices)), "dice_median": float(np.median(dices)),
            "iou": float(np.mean(ious)), "centroid_in_wound": float(np.mean(hits)),
            "mean_predicted_area_frac": float(np.mean(areas)), "n": len(dices)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="/tmp/ws/data/Foot Ulcer Segmentation Challenge")
    ap.add_argument("--out", default="dfu/seg")
    ap.add_argument("--epochs_dec", type=int, default=12)
    ap.add_argument("--epochs_ft", type=int, default=6)
    ap.add_argument("--limit", type=int, default=0, help="debug: use only N training images")
    a = ap.parse_args()
    tf.random.set_seed(0); np.random.seed(0)

    t0 = time.time()
    Xtr, Ytr = build_arrays(a.root, "train")
    Xva, Yva = build_arrays(a.root, "validation")
    if a.limit:
        Xtr, Ytr = Xtr[:a.limit], Ytr[:a.limit]
        Xva, Yva = Xva[:max(8, a.limit // 4)], Yva[:max(8, a.limit // 4)]
    print(f"train {Xtr.shape} val {Xva.shape}  (wound covers {Ytr.mean()*100:.2f} % of training pixels)", flush=True)

    model, enc = build_model()
    print(f"{model.count_params():,} parameters", flush=True)

    model.compile(optimizer=keras.optimizers.Adam(1e-3), loss=dice_bce, metrics=[dice_coef])
    model.fit(make_ds(Xtr, Ytr, True), validation_data=make_ds(Xva, Yva, False), epochs=a.epochs_dec, verbose=2,
              callbacks=[keras.callbacks.EarlyStopping(monitor="val_dice_coef", mode="max", patience=4, restore_best_weights=True)])

    enc.trainable = True                                  # fine-tune the top of the encoder
    for l in enc.layers[:-30]:
        l.trainable = False
    for l in enc.layers:
        if isinstance(l, layers.BatchNormalization):
            l.trainable = False
    model.compile(optimizer=keras.optimizers.Adam(5e-5), loss=dice_bce, metrics=[dice_coef])
    model.fit(make_ds(Xtr, Ytr, True), validation_data=make_ds(Xva, Yva, False), epochs=a.epochs_ft, verbose=2,
              callbacks=[keras.callbacks.EarlyStopping(monitor="val_dice_coef", mode="max", patience=3, restore_best_weights=True)])

    m = evaluate(model, Xva, Yva)
    print("held-out segmentation:", json.dumps(m, indent=1), flush=True)

    os.makedirs(a.out, exist_ok=True)
    model.save("/tmp/work/dfu_seg_model.h5")
    import tensorflowjs as tfjs
    tfjs.converters.save_keras_model(model, a.out, quantization_dtype_map={"float16": "*"})
    json.dump({"task": "wound segmentation", "architecture": "MobileNetV2-UNet (ImageNet encoder, 4 skip connections)",
               "input": [IMG, IMG, 3], "input_range": "[-1,1]", "output": "single-channel sigmoid mask",
               "train_images": int(len(Xtr)), "val_images": int(len(Xva)), "held_out": m,
               "data": "FUSeg 2021 (AZH Wound and Vascular Center); Wang et al., Sci Rep 2020;10:21897",
               "minutes": round((time.time() - t0) / 60, 1)}, open(os.path.join(a.out, "metrics.json"), "w"), indent=1)
    print("exported to", a.out, f"in {(time.time()-t0)/60:.1f} min")
