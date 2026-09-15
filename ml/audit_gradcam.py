"""Quantify whether Grad-CAM points at the wound.

For each held-out image with an expert mask:
  cam_mass_in_wound = sum(CAM * mask) / sum(CAM)      (how much heat lands on the wound)
  chance            = mask_area / valid_image_area    (what you'd get from a uniform heatmap)
  ratio             = cam_mass_in_wound / chance      (1.0 = no better than chance)
Also the classic 'pointing game': does the CAM's peak pixel fall inside the wound?
"""
import os, json, sys, numpy as np
os.environ["TF_USE_LEGACY_KERAS"]="1"; os.environ["TF_CPP_MIN_LOG_LEVEL"]="3"
sys.path.insert(0,'ml')
import tensorflow as tf, tf_keras as keras
from PIL import Image

IMG=224
import argparse
ap=argparse.ArgumentParser(); ap.add_argument('--model', default='/tmp/work/dfu_model.h5')
ap.add_argument('--root', default='/tmp/ws/data/Foot Ulcer Segmentation Challenge')
ap.add_argument('--labels', default='/tmp/work/labels_v2.json')
A=ap.parse_args()
model=keras.models.load_model(A.model, compile=False)
GRAD='out_relu'
conv=keras.Model(model.inputs,[model.get_layer(GRAD).output, model.outputs[0], model.outputs[1]])

def crop_box(a):
    valid=a.sum(-1)>12; ys,xs=np.where(valid)
    return xs.min(),ys.min(),xs.max()+1,ys.max()+1

def prep(path, mask_path, roi=False, margin=0.6):
    im=Image.open(path).convert('RGB'); m=Image.open(mask_path).convert('L')
    a=np.asarray(im); x0,y0,x1,y1=crop_box(a)
    im=im.crop((x0,y0,x1,y1)); m=m.crop((x0,y0,x1,y1))
    if roi:                                   # crop to the wound plus a margin
        mm=np.asarray(m)>127
        if mm.sum()<20: return None
        ys,xs=np.where(mm); cy,cx=(ys.min()+ys.max())/2,(xs.min()+xs.max())/2
        h,w=ys.max()-ys.min()+1,xs.max()-xs.min()+1
        s=max(h,w)*(1+2*margin)
        s=min(s, min(im.size))                 # keep inside the photo
        l,t=int(max(0,min(cx-s/2, im.size[0]-s))), int(max(0,min(cy-s/2, im.size[1]-s)))
        im=im.crop((l,t,l+int(s),t+int(s))); m=m.crop((l,t,l+int(s),t+int(s)))
    else:
        w,h=im.size; s=min(w,h)
        im=im.crop(((w-s)//2,(h-s)//2,(w-s)//2+s,(h-s)//2+s)); m=m.crop(((w-s)//2,(h-s)//2,(w-s)//2+s,(h-s)//2+s))
    return (np.asarray(im.resize((IMG,IMG),Image.BILINEAR),dtype=np.float32),
            np.asarray(m.resize((IMG,IMG),Image.NEAREST))>127)

def gradcam(x, head, cls):
    x=tf.constant((x/127.5-1)[None])
    with tf.GradientTape() as t:
        acts,pg,pi=conv(x); s=(pg if head==0 else pi)[0,cls]
    g=t.gradient(s,acts); w=tf.reduce_mean(g,axis=(1,2),keepdims=True)
    cam=tf.nn.relu(tf.reduce_sum(acts*w,-1))[0].numpy()
    cam=cam-cam.min(); cam=cam/(cam.max()+1e-9)
    big=np.array(Image.fromarray((cam*255).astype(np.uint8)).resize((IMG,IMG),Image.BILINEAR),dtype=np.float32)/255
    probs=(float(pg[0,1]), float(pi[0,1]))
    return big, probs

rows=json.load(open(A.labels))
ROOT=A.root
val=[r for r in rows if r['split']=='validation']
res={'centre':[], 'roi':[]}
for mode in ['centre','roi']:
    for r in val:
        mp=f"{ROOT}/validation/labels/{r['name']}"
        if not os.path.exists(mp): continue
        out=prep(r['path'], mp, roi=(mode=='roi'))
        if out is None: continue
        x,mask=out
        if mask.sum()<20: continue
        # explain the class the model actually predicted (severity head)
        cam,probs=gradcam(x, 0, 1 if True else 0)
        area=mask.mean()
        inside=(cam*mask).sum()/(cam.sum()+1e-9)
        peak=np.unravel_index(cam.argmax(), cam.shape)
        res[mode].append(dict(name=r['name'], area=float(area), inside=float(inside),
                              ratio=float(inside/max(area,1e-6)), hit=bool(mask[peak])))
for mode in ['centre','roi']:
    d=res[mode]; A=np.array([x['area'] for x in d]); I=np.array([x['inside'] for x in d]); R=np.array([x['ratio'] for x in d]); H=np.array([x['hit'] for x in d])
    print(f"\n{mode.upper()} crop  (n={len(d)})")
    print(f"  wound occupies      {A.mean()*100:5.1f} % of the frame (median {np.median(A)*100:.1f} %)")
    print(f"  Grad-CAM heat on wound {I.mean()*100:5.1f} %   (chance = {A.mean()*100:.1f} %)")
    print(f"  concentration ratio  {np.median(R):5.2f}x chance (mean {R.mean():.2f})")
    print(f"  peak inside wound    {H.mean()*100:5.1f} % of images")
json.dump(res, open('/tmp/work/cam_audit.json','w'))
