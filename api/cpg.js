// CPG RAG endpoint — serves structured MOH Malaysia CPG content
// Source: https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list

const CPG_DATA = {
  hypertension: {
    title: 'CPG Management of Hypertension (6th Ed, 2023)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `DIAGNOSIS\n- Hypertension: SBP >=140 mmHg or DBP >=90 mmHg on >=2 separate visits\n- Grade 1 HT: SBP 140-159/DBP 90-99; Grade 2: SBP 160-179/DBP 100-109; Grade 3: SBP >=180/DBP >=110\n- Hypertensive urgency: BP >180/120 without end-organ damage\n- Hypertensive emergency: BP >180/120 WITH end-organ damage\n\nBP TARGETS\n- General adults: <140/90 mmHg; Elderly (>=65y): <150/90 mmHg\n- Diabetes: <130/80 mmHg; CKD with proteinuria: <130/80 mmHg\n- Post-stroke/TIA: <130/80 mmHg; CAD/HF: <130/80 mmHg\n\nPHARMACOTHERAPY\n- ACEi/ARB: preferred in DM, CKD with proteinuria, post-MI, HFrEF\n- CCB (amlodipine): preferred in elderly, isolated systolic HT\n- Combination: ACEi/ARB + CCB (preferred 1st combination)\n- DO NOT combine ACEi + ARB\n- Pregnancy: methyldopa, labetalol, nifedipine; AVOID ACEi/ARB\n- Resistant HT: add spironolactone 25-50mg\n\nMONITORING\n- BP check 1-3 months until target, then 3-6 monthly\n- U&E + glucose + lipid panel annually`
  },
  diabetes: {
    title: 'CPG Management of Type 2 Diabetes Mellitus (6th Ed, 2020)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `DIAGNOSIS\n- FPG >=7.0 mmol/L on 2 occasions; 2h PG >=11.1 mmol/L (OGTT)\n- HbA1c >=6.5% on 2 occasions\n\nGLYCAEMIC TARGETS\n- HbA1c: <6.5-7.0%; FPG: 4.4-7.0 mmol/L; 2h PPG: <10.0 mmol/L\n\nPHARMACOTHERAPY\n- Step 1: Metformin (unless eGFR <30)\n- Step 2: SGLT2i (CVD/HF/CKD), GLP-1 RA (CVD/obesity), DPP4i, SU\n- Step 3: Basal insulin if HbA1c >9% + symptomatic\n\nMONITORING\n- HbA1c 3-monthly until target, 6-monthly maintenance\n- UACR, fundoscopy, foot exam annually; BP target <130/80`
  },
  dyslipidaemia: {
    title: 'CPG Management of Dyslipidaemia (Updated 2023)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `LDL-C TARGETS\n- Very high risk (CVD, DM+EOD): <1.8 mmol/L AND >=50% reduction\n- High risk (DM, CKD, 10-yr risk 10-20%): <2.6 mmol/L\n- Moderate risk: <3.4 mmol/L\n\nPHARMACOTHERAPY\n- High-intensity statin: atorvastatin 40-80mg, rosuvastatin 20-40mg\n- Add ezetimibe 10mg if insufficient; PCSK9i for very high risk/FH\n- Fenofibrate for TG >5.6 mmol/L`
  },
  asthma: {
    title: 'CPG Management of Asthma in Adults (5th Ed, 2017)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `STEP TREATMENT\n- Step 1: SABA PRN; Step 2: Low-dose ICS + SABA; Step 3: ICS + LABA\n- Step 4: Medium/high ICS + LABA; Step 5: High ICS + LABA + biologics\n\nACUTE EXACERBATION\n- SABA 2.5mg nebulised every 20min x3; prednisolone 40-50mg x5 days; O2: SpO2 94-98%`
  },
  copd: {
    title: 'CPG Management of COPD (3rd Ed, 2022)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `GOLD STAGING: GOLD 1 FEV1>=80%; GOLD 2 50-80%; GOLD 3 30-50%; GOLD 4 <30%\nGroup A: SABA; Group B: LAMA; Group C: LAMA; Group D: LAMA+LABA (add ICS if eos>=300)\nAECOPD: SABA+/-SAMA, prednisolone 40mg x5d, antibiotics if purulent, O2 SpO2 88-92%`
  },
  heartfailure: {
    title: 'CPG Heart Failure (3rd Ed, 2019)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `HFrEF FOUR PILLARS: ACEi/ARB/ARNI + Beta-blocker + MRA (spironolactone) + SGLT2i\nDiuretics: furosemide for congestion only\nMonitor: renal profile + K+ within 1-2 weeks of ACEi/MRA start`
  },
  ckd: {
    title: 'CPG Management of Chronic Kidney Disease (2nd Ed, 2018)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `STAGING: G1 eGFR>=90; G2 60-89; G3a 45-59; G3b 30-44; G4 15-29; G5<15\nBP target <130/80; ACEi/ARB mandatory if proteinuria A2/A3\nMetformin: reduce if eGFR 30-45; STOP if <30; SGLT2i to eGFR>=25\nRefer nephrologist if eGFR <30`
  },
  stroke: {
    title: 'CPG Ischaemic Stroke/TIA (3rd Ed, 2020)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `ACUTE AIS: IV alteplase within 4.5h (0.9mg/kg); thrombectomy if LVO within 24h\nSECONDARY PREVENTION: aspirin/clopidogrel (non-cardioembolic); DOAC if AF\nBP target <130/80; LDL <1.8 mmol/L (high-intensity statin)`
  },
  depression: {
    title: 'CPG Major Depressive Disorder (2nd Ed, 2019)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `DIAGNOSIS: >=5 DSM-5 symptoms >=2 weeks; PHQ-9 >=10 = moderate\nTREATMENT: Mild=CBT/watchful waiting; Moderate-severe=SSRI+CBT\nSSRI: sertraline 50-200mg, escitalopram 10-20mg; Duration: >=6-9 months post-remission\nHigh suicide risk: hospitalise, urgent psychiatry referral`
  },
  gout: {
    title: 'CPG Management of Gout (2nd Ed, 2020)',
    source: 'https://mymahtas.moh.gov.my/index.php/docman-list/publications/cpg-list',
    content: `ACUTE ATTACK: NSAIDs/colchicine/prednisolone; DO NOT start ULT during attack\nULT: Target SUA <360 umol/L (<300 if tophi)\nAllopurinol: start 50-100mg, titrate; HLA-B*5801 screen mandatory in Malay/Chinese/Thai\nProphylaxis: colchicine 0.5mg BD x3-6 months after starting ULT`
  }
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { id } = req.query;
  if (!id) {
    return res.status(200).json({ cpgs: Object.entries(CPG_DATA).map(([key, val]) => ({ id: key, title: val.title, source: val.source })) });
  }
  const cpg = CPG_DATA[id];
  if (!cpg) return res.status(404).json({ error: 'CPG not found' });
  return res.status(200).json(cpg);
}
