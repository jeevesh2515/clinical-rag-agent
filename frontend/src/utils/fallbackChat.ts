export interface FallbackChatMessage {
  id: string
  role: 'assistant'
  content: string
  timestamp: string
  citations?: Array<{
    source_id: string
    title: string
    page?: number
    chunk_id?: string
    organization?: string
    source_url?: string
    quote?: string
  }>
  safety_flags?: {
    medical_disclaimer: boolean
    consult_licensed_clinician: boolean
    requires_clinician_review: boolean
    unsupported_claims_detected: boolean
    unsafe_request: boolean
    refusal_triggered: boolean
    prompt_injection_detected: boolean
  }
  tool_trace?: Array<{ name: string; input_summary: string; output_summary: string }>
  confidence?: 'high' | 'medium' | 'low'
  mode?: string
  question?: string
}

export function generateFallbackResponse(question: string, mode: string = 'patient'): FallbackChatMessage {
  const q = question.toLowerCase()
  const isClinician = mode === 'clinician'
  const now = new Date().toISOString()

  // 1. Emergency Crisis / Red Flags
  if (q.includes('chest pain') || q.includes('headache') || q.includes('shortness of breath') || q.includes('blurry vision') || q.includes('emergency') || q.includes('crisis')) {
    const content = isClinician
      ? `### Emergency Clinical Triage & Crisis Management Protocol

**Clinical Status**: Potential Hypertensive Emergency (SBP ≥180 mmHg or DBP ≥120 mmHg with target organ damage).

#### Red-Flag Symptoms Requiring Immediate ED Transfer:
1. **Neurological**: Acute severe headache, confusion, focal neurological deficits, visual changes.
2. **Cardiovascular**: Severe chest pain (aortic dissection / ACS), dyspnea (acute pulmonary edema).
3. **Renal**: Acute oliguria, hematuria, rapidly rising creatinine.

#### Immediate Management Considerations:
- **Intravenous Antihypertensives**: Labetalol, Nicardipine, or Sodium Nitroprusside in ICU/monitored setting.
- **Blood Pressure Target**: Reduce SBP by no more than 25% within the first hour, then to 160/100 mmHg within 2–6 hours (except in acute ischemic stroke, aortic dissection, or eclampsia).

> [!CAUTION]
> Immediate referral to emergency care or ICU is required. Do not administer rapid oral nifedipine due to severe stroke/MI risk.`
      : `### ⚠️ Important Medical Safety Warning

If you or someone else is experiencing severe blood pressure symptoms, **seek emergency medical care immediately (call 911 or go to the nearest emergency department)**.

#### Warning Signs of Hypertensive Crisis:
- **Severe, sudden headache**
- **Chest pain or tightness**
- **Shortness of breath**
- **Numbness, weakness, or difficulty speaking**
- **Changes in vision (blurred or loss of vision)**

> [!CAUTION]
> Extremely high blood pressure with any of these symptoms requires immediate emergency medical evaluation. Do not delay seeking medical help.`

    return {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: now,
      citations: [
        {
          source_id: 'guidelines/acc-aha-2017-summary.md',
          title: 'ACC/AHA 2017 Guidelines - Hypertensive Crises Protocol',
          organization: 'ACC/AHA',
          source_url: 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065',
          quote: 'Hypertensive Crises (SBP >180 and/or DBP >120 mmHg): Categorized as Urgency (no acute organ damage) vs Emergency (acute target organ damage present). Emergency requires immediate ICU transfer and parenteral antihypertensives.'
        },
        {
          source_id: 'guidelines/nice-ng136-summary.md',
          title: 'NICE NG136 Guideline - Emergency Specialist Triage',
          organization: 'NICE UK',
          source_url: 'https://www.nice.org.uk/guidance/ng136',
          quote: 'Refer immediately for same-day specialist assessment if clinic BP >= 180/120 mmHg with target organ damage, acute papilloedema, or severe headache/chest pain.'
        }
      ],
      safety_flags: {
        medical_disclaimer: true,
        consult_licensed_clinician: true,
        requires_clinician_review: true,
        unsupported_claims_detected: false,
        unsafe_request: true,
        refusal_triggered: true,
        prompt_injection_detected: false,
      },
      confidence: 'high',
      mode,
      question,
    }
  }

  // 2. Lifestyle Modifications & Natural Lowering
  if (q.includes('lifestyle') || q.includes('naturally') || q.includes('diet') || q.includes('exercise') || q.includes('salt') || q.includes('dash')) {
    const content = isClinician
      ? `### Evidence-Based Non-Pharmacological Interventions (ACC/AHA 2017 & NICE NG136)

Non-pharmacological therapy is recommended for all individuals with elevated blood pressure or hypertension.

#### 1. Dietary Sodium Restriction
- **Target**: Reduce sodium intake to **<2,000 mg/day** (equivalent to ~5g of table salt).
- **Expected SBP Impact**: **-5 to -6 mmHg** in hypertensive patients (**-2 to -3 mmHg** in normotensive).

#### 2. DASH Dietary Pattern (Dietary Approaches to Stop Hypertension)
- **Composition**: Rich in fruits, vegetables, whole grains, low-fat dairy, and reduced saturated fat/cholesterol.
- **Expected SBP Impact**: **-11 mmHg** (hypertensive) / **-3 mmHg** (normotensive).

#### 3. Weight Loss
- **Target**: Maintain ideal body weight (BMI 18.5–24.9 kg/m²).
- **Expected SBP Impact**: **-1 mmHg per kg of body weight lost**.

#### 4. Physical Activity
- **Aerobic Exercise**: 150 minutes/week of moderate-intensity aerobic physical activity (e.g., brisk walking, cycling, swimming).
- **Expected SBP Impact**: **-5 to -8 mmHg**.

#### 5. Alcohol Moderation
- **Target**: Limit daily alcohol consumption to ≤2 standard drinks for men, ≤1 standard drink for women.
- **Expected SBP Impact**: **-4 mmHg**.

> [!NOTE]
> Combining multiple non-pharmacological interventions produces additive SBP reductions equivalent to single-drug monotherapy.`
      : `### Evidence-Based Ways to Lower Blood Pressure Naturally

According to major clinical guidelines (ACC/AHA 2017 and NICE NG136), structured lifestyle changes can significantly lower blood pressure—sometimes as effectively as a single blood pressure medication.

#### 1. Follow the DASH Eating Plan
- Focus on fruits, vegetables, whole grains, nuts, and low-fat dairy.
- Limit foods high in saturated fat and added sugars.
- **Expected SBP reduction**: ~8 to 11 mmHg.

#### 2. Reduce Sodium (Salt) Intake
- Aim for less than **2,000 mg of sodium per day** (about 1 teaspoon of table salt).
- Avoid processed, packaged, and fast foods where hidden sodium is highest.
- **Expected SBP reduction**: ~5 to 6 mmHg.

#### 3. Regular Physical Activity
- Aim for at least **150 minutes of moderate aerobic exercise per week** (e.g., 30 minutes of brisk walking 5 days a week).
- **Expected SBP reduction**: ~5 to 8 mmHg.

#### 4. Maintain a Healthy Weight
- Losing excess weight helps lower blood pressure directly.
- **Expected SBP reduction**: ~1 mmHg for every kilogram (2.2 lbs) of weight lost.

#### 5. Manage Stress & Prioritize Sleep
- Aim for 7 to 9 hours of quality sleep each night.
- Practice deep breathing exercises, mindfulness, or regular relaxation routines.

> [!IMPORTANT]
> Always consult your healthcare provider before stopping or modifying any prescribed blood pressure medications.`

    return {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: now,
      citations: [
        {
          source_id: 'guidelines/acc-aha-2017-summary.md',
          title: 'ACC/AHA 2017 Guidelines - Nonpharmacological Interventions',
          organization: 'ACC/AHA',
          source_url: 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065',
          quote: 'DASH Diet Pattern (-11 mmHg SBP), Sodium Restriction <2,000 mg/day (-5 to -6 mmHg SBP), Aerobic Physical Activity 150 min/wk (-5 to -8 mmHg SBP), Weight loss (-1 mmHg per kg lost).'
        },
        {
          source_id: 'guidelines/nice-ng136-summary.md',
          title: 'NICE NG136 - Section 1.2: Lifestyle Interventions',
          organization: 'NICE UK',
          source_url: 'https://www.nice.org.uk/guidance/ng136',
          quote: 'Offer lifestyle advice to all adults with hypertension. Dietary advice includes reducing sodium intake, adopting a balanced diet rich in fruits/vegetables, limiting alcohol, and maintaining regular aerobic physical activity.'
        }
      ],
      safety_flags: {
        medical_disclaimer: true,
        consult_licensed_clinician: true,
        requires_clinician_review: false,
        unsupported_claims_detected: false,
        unsafe_request: false,
        refusal_triggered: false,
        prompt_injection_detected: false,
      },
      confidence: 'high',
      mode,
      question,
    }
  }

  // 3. First-Line Drug Treatment & Guidelines
  if (q.includes('drug') || q.includes('medication') || q.includes('treatment') || q.includes('first-line') || q.includes('stage 1') || q.includes('nice')) {
    const content = isClinician
      ? `### Step-Care Antihypertensive Protocol (NICE NG136 & ACC/AHA 2017)

#### Step 1 Monotherapy Selection:
1. **Age < 55 OR Type 2 Diabetes (any ethnicity)**:
   - First Choice: **ACE Inhibitor** (e.g., Ramipril 2.5–10 mg daily) or **ARB** (e.g., Losartan 50–100 mg daily).
2. **Age ≥ 55 OR Black African/African-Caribbean origin (without T2D)**:
   - First Choice: **Calcium Channel Blocker (CCB)** (e.g., Amlodipine 5–10 mg daily).
   - If CCB not tolerated / heart failure risk: **Thiazide-like Diuretic** (Indapamide 1.5 mg SR or Chlorthalidone 12.5–25 mg daily).

#### Step 2 Combination Therapy (If Clinic BP ≥140/90 or ABPM/HBPM ≥135/85):
- Combine **ACEi/ARB + CCB** OR **ACEi/ARB + Thiazide-like Diuretic**.
- For Black African/African-Caribbean patients: **ARB + CCB** is preferred over ACEi.

#### Step 3 Triple Therapy:
- **ACEi/ARB + CCB + Thiazide-like Diuretic**.

> [!IMPORTANT]
> Monitor baseline BMP (eGFR, serum K+) within 2–4 weeks of initiating or titrating an ACEi or ARB.`
      : `### Understanding First-Line Medication Guidelines for Hypertension

Medical guidelines (NICE NG136 and ACC/AHA 2017) recommend starting blood pressure medication based on age, ethnic background, and health history:

#### Common First-Line Medication Classes:
1. **ACE Inhibitors (ACEi)** & **ARBs**:
   - *Examples*: Ramipril, Lisinopril, Losartan, Valsartan.
   - *Commonly chosen for*: People under 55, or individuals with diabetes or kidney disease.
2. **Calcium Channel Blockers (CCBs)**:
   - *Examples*: Amlodipine, Felodipine.
   - *Commonly chosen for*: People aged 55 or older, or individuals of Black African/Caribbean heritage.
3. **Thiazide-like Diuretics**:
   - *Examples*: Indapamide, Chlorthalidone.
   - *Commonly chosen*: As an alternative if CCBs are not suitable, or as part of combination therapy.

> [!TIP]
> Your doctor will select the safest medication for your specific medical profile and monitor your blood pressure and blood tests regular.`

    return {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: now,
      citations: [
        {
          source_id: 'guidelines/nice-ng136-summary.md',
          title: 'NICE NG136 - Step-Care Antihypertensive Ladder',
          organization: 'NICE UK',
          source_url: 'https://www.nice.org.uk/guidance/ng136',
          quote: 'Step 1: Offer an ACEi/ARB to adults <55 or with T2D. Offer a CCB to adults >=55 or Black African/African-Caribbean origin. Step 2: Combine ACEi/ARB + CCB or Thiazide-like diuretic.'
        },
        {
          source_id: 'guidelines/jnc8-summary.md',
          title: 'JNC8 Panel Report - First-Line Drug Classes',
          organization: 'JNC8 Panel',
          source_url: 'https://jamanetwork.com/journals/jama/article-abstract/1791497',
          quote: 'In the general nonblack population, initial antihypertensive treatment should include a thiazide-type diuretic, CCB, ACEi, or ARB. In the general black population, initial treatment should include a thiazide-type diuretic or CCB.'
        }
      ],
      safety_flags: {
        medical_disclaimer: true,
        consult_licensed_clinician: true,
        requires_clinician_review: false,
        unsupported_claims_detected: false,
        unsafe_request: false,
        refusal_triggered: false,
        prompt_injection_detected: false,
      },
      confidence: 'high',
      mode,
      question,
    }
  }

  // 4. Default General Response for any other question
  const defaultContent = isClinician
    ? `### Clinical Summary: Hypertension Management Protocol

Grounded in **NICE NG136**, **ACC/AHA 2017**, and **ESC/ESH 2023** guidelines.

#### Key Diagnostic & Treatment Thresholds:
- **Normal BP**: <120/<80 mmHg
- **Elevated BP**: 120–129/<80 mmHg
- **Stage 1 HTN**: Clinic 130–139/80–89 mmHg (ABPM/HBPM 135–144/85–89 mmHg)
- **Stage 2 HTN**: Clinic ≥140/≥90 mmHg (ABPM/HBPM ≥150/≥95 mmHg)

#### Guideline Treatment Target:
- **Standard Adult Target**: <130/80 mmHg (ACC/AHA) or <140/90 mmHg (NICE for age <80).
- **CKD / Diabetes Target**: <130/80 mmHg with proteinuria/uACR monitoring.

> [!NOTE]
> Review retrieved guideline evidence and patient-specific risk factors (ASCVD score, eGFR) prior to clinical decision-making.`
    : `### Hypertension Care & Management Overview

Here is an evidence-based summary based on clinical guidelines (NICE NG136 and ACC/AHA 2017):

#### Key Blood Pressure Categories:
- **Normal**: Less than 120/80 mmHg
- **Elevated**: 120–129 / less than 80 mmHg
- **Stage 1 High Blood Pressure**: 130–139 / 80–89 mmHg
- **Stage 2 High Blood Pressure**: 140 or higher / 90 or higher mmHg

#### Core Recommendations:
1. **Monitor Home Blood Pressure**: Take readings at the same time daily after resting for 5 minutes.
2. **Adopt Healthy Lifestyle Habits**: Reduce sodium intake, eat a DASH-style diet, stay physically active, and manage stress.
3. **Partner with Your Healthcare Provider**: Work together to determine if lifestyle changes alone or medication are best for your target numbers.

> [!IMPORTANT]
> This information is for educational purposes. Please consult your physician for personalized clinical diagnosis and treatment plans.`

  return {
    id: `fallback-${Date.now()}`,
    role: 'assistant',
    content: defaultContent,
    timestamp: now,
    citations: [
      {
        source_id: 'guidelines/acc-aha-2017-summary.md',
        title: 'ACC/AHA 2017 Practice Guidelines',
        organization: 'ACC/AHA',
        source_url: 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065',
        quote: 'Comprehensive evaluation and management of high blood pressure in adults. Establishes SBP/DBP threshold categories and target BP <130/80 mmHg for high-risk patients.'
      },
      {
        source_id: 'guidelines/nice-ng136-summary.md',
        title: 'NICE NG136 Hypertension Overview',
        organization: 'NICE UK',
        source_url: 'https://www.nice.org.uk/guidance/ng136',
        quote: 'Guideline for diagnosis, risk assessment, ABPM confirmation, step-care treatment, and annual monitoring of adults with essential hypertension.'
      }
    ],
    safety_flags: {
      medical_disclaimer: true,
      consult_licensed_clinician: true,
      requires_clinician_review: false,
      unsupported_claims_detected: false,
      unsafe_request: false,
      refusal_triggered: false,
      prompt_injection_detected: false,
    },
    confidence: 'high',
    mode,
    question,
  }
}
