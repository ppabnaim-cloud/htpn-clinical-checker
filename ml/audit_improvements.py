"""Three measurements that decide what is worth changing:
   1. calibration  - is the printed probability believable?
   2. test-time augmentation - does averaging over flips buy accuracy for free?
   3. abstention  - at what confidence should the app decline, and what does that cost?
"""
import os, sys, json, numpy as np
os.environ["TF_USE_LEGACY_KERAS"]="1"; os.environ["TF_CPP_MIN_LOG_LEVEL"]="3"
sys.path.insert(0,'ml')
import tensorflow as tf, tf_keras as keras
from PIL import Image
from sklearn.metrics import roc_auc_score, brier_score_loss
from sklearn.linear_model import LogisticRegression
from train_segmentation import load_pair   # same crop logic as training

IMG=224; ROOT=A.root
import argparse
ap=argparse.ArgumentParser()
ap.add_argument('--model', default='/tmp/work/dfu_roi_model.h5')
ap.add_argument('--root', default='/tmp/ws/data/Foot Ulcer Segmentation Challenge')
ap.add_argument('--labels', default='/tmp/work/labels_v2.json')
A=ap.parse_args()
model=keras.models.load_model(A.model, compile=False)
rows=json.load(open(A.labels))

def roi_crop(path, mask_path, margin=0.6):
    im=Image.open(path).convert('RGB'); m=Image.open(mask_path).convert('L')
    a=np.asarray(im); valid=a.sum(-1)>12; ys,xs=np.where(valid)
    im=im.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1)); m=m.crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
    mm=np.asarray(m)>127
    if mm.sum()<20: return None
    ys,xs=np.where(mm); cy,cx=(ys.min()+ys.max())/2,(xs.min()+xs.max())/2
    s=min(max(ys.max()-ys.min()+1, xs.max()-xs.min()+1)*(1+2*margin), min(im.size))
    l=int(max(0,min(cx-s/2, im.size[0]-s))); t=int(max(0,min(cy-s/2, im.size[1]-s)))
    return np.asarray(im.crop((l,t,l+int(s),t+int(s))).resize((IMG,IMG),Image.BILINEAR), dtype=np.float32)

X,yg,yi,wg,wi=[],[],[],[],[]
for r in rows:
    if r['split']!='validation': continue
    mp=f"{ROOT}/validation/labels/{r['name']}"
    if not os.path.exists(mp): continue
    c=roi_crop(r['path'], mp)
    if c is None: continue
    X.append(c)
    yg.append(1 if r['grade']=='severe' else 0); wg.append(1.0 if r['grade'] else 0.0)
    yi.append(1 if r['infection']=='suspected' else 0); wi.append(1.0 if r['infection'] else 0.0)
X=np.stack(X); yg,yi=np.array(yg),np.array(yi); wg,wi=np.array(wg,bool),np.array(wi,bool)
print(f'validation crops: {len(X)}  (severity labelled {wg.sum()}, infection labelled {wi.sum()})\n')

def predict(arr):
    pg,pi=model.predict(arr/127.5-1, batch_size=32, verbose=0)
    return pg[:,1], pi[:,1]

# --- 1 & 2: plain vs test-time augmentation (identity + 3 flips)
plain=predict(X)
views=[X, X[:,:,::-1], X[:,::-1], X[:,::-1,::-1]]
acc=[predict(v) for v in views]
tta=(np.mean([a[0] for a in acc],0), np.mean([a[1] for a in acc],0))

def report(name, p, y, m):
    p,y=p[m],y[m]
    auc=roc_auc_score(y,p); a=((p>0.5)==y).mean(); br=brier_score_loss(y,p)
    lg=np.log(np.clip(p,1e-6,1-1e-6)/(1-np.clip(p,1e-6,1-1e-6))).reshape(-1,1)
    lr=LogisticRegression(fit_intercept=True).fit(lg,y)
    return dict(auc=auc, acc=a, brier=br, slope=float(lr.coef_[0][0]), intercept=float(lr.intercept_[0]))

print('=== 1 & 2 · plain vs 4-view test-time augmentation')
print(f"{'head':<11}{'variant':<7}{'AUC':>7}{'acc':>7}{'Brier':>8}{'slope':>8}{'intercept':>11}")
res={}
for head,(pp,pt,y,m) in {'severity':(plain[0],tta[0],yg,wg), 'infection':(plain[1],tta[1],yi,wi)}.items():
    for lbl,p in (('plain',pp),('TTA',pt)):
        r=report(head,p,y,m); res[(head,lbl)]=r
        print(f"{head:<11}{lbl:<7}{r['auc']:>7.3f}{r['acc']:>7.3f}{r['brier']:>8.3f}{r['slope']:>8.2f}{r['intercept']:>11.2f}")

print('\n   calibration slope 1.0 and intercept 0.0 would be perfect; slope < 1 means overconfident.')

# --- 3: abstention. Decline when max(p, 1-p) is below a threshold.
print('\n=== 3 · abstention on the infection head (TTA probabilities)')
p,y=tta[1][wi], yi[wi]
conf=np.maximum(p,1-p)
print(f"{'threshold':>10}{'kept':>8}{'abstained':>11}{'acc on kept':>13}")
for th in [0.50,0.60,0.70,0.80,0.90]:
    keep=conf>=th
    if keep.sum()==0: continue
    print(f"{th:>10.2f}{keep.sum():>8}{100*(1-keep.mean()):>10.0f} %{100*((p[keep]>0.5)==y[keep]).mean():>12.0f} %")
json.dump({f'{k[0]}_{k[1]}':v for k,v in res.items()}, open('/tmp/work/improve_audit.json','w'), indent=1)
