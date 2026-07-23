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
  if (q.includes('chest pain') || q.includes('headache') || q.includes('shortness of breath') || q.includes('blurry vision') || q.includes('emergency') || q.includes('crisis') || q.includes('warning sign') || q.includes('urgent')) {
    const content = isClinician
      ? `### Emergency Clinical Triage & Crisis Management Protocol

**Clinical Status**: Potential Hypertensive Emergency (SBP ≥180 mmHg or DBP ≥120 mmHg with target organ damage).

#### Red-Flag Symptoms Requiring Immediate ED Transfer:
1. **Neurological**: Acute severe headache, confusion, focal neurological deficits, visual changes.
2. **Cardiovascular**: Severe chest pain (aortic dissection / ACS), dyspnea (acute pulmonary edema).
3. **Renal**: Acute oliguria, hematuria, rapidly rising creatinine.

#### Immediate Management Considerations:
- **Intravenous Antihypertensives**: Labetalol, Nicardipine, or Sodium Nitroprusside in ICU/monitored setting.
- **Blood Pressure Target**: Reduce SBP by no more than 25% within the first hour, then to 160/100 mmHg within 2–6 hours.

> [!CAUTION]
> Immediate referral to emergency care or ICU is required. Do not administer rapid oral nifedipine due to severe stroke/MI risk.`
      : `### ⚠️ Warning Signs & Urgent Medical Care Guidance

If your blood pressure is very high and you experience any of the following warning signs, **seek emergency medical care immediately (call 911 or go to the nearest emergency department)**:

#### Critical Symptoms to Watch For:
- 🚨 **Severe, sudden headache** (worst headache of your life)
- 🚨 **Chest pain, pressure, or tightness**
- 🚨 **Shortness of breath or difficulty breathing**
- 🚨 **Numbness, weakness, or trouble speaking**
- 🚨 **Sudden changes in vision** (blurred vision or loss of sight)
- 🚨 **Severe dizziness, confusion, or nausea**

> [!CAUTION]
> A blood pressure reading of **180/120 mmHg or higher** combined with any of these symptoms is a **Hypertensive Emergency**. Do not wait to see if it comes down — get emergency help right away.`

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
          quote: 'Hypertensive Crises (SBP >180 and/or DBP >120 mmHg): Categorized as Urgency vs Emergency (acute target organ damage present). Emergency requires immediate ICU transfer and parenteral antihypertensives.'
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

  // 2. DASH Diet & Sodium/Salt Specific Query
  if (q.includes('dash') || (q.includes('salt') && !q.includes('lifestyle'))) {
    const content = isClinician
      ? `### DASH Eating Plan & Sodium Restriction Protocol (ACC/AHA 2017 & NICE NG136)

#### 1. DASH Diet Composition (Dietary Approaches to Stop Hypertension):
- **Nutrient Profile**: High in potassium (~4,700 mg/d), calcium (~1,250 mg/d), magnesium (~500 mg/d), and dietary fiber.
- **Food Groups**: 6–8 servings whole grains, 4–5 servings vegetables, 4–5 servings fruits, 2–3 servings low-fat dairy, ≤6 oz lean poultry/fish, 4–5 servings nuts/seeds per week.
- **Expected SBP Impact**: **-11 mmHg SBP** reduction in hypertensive patients (**-3 mmHg** in normotensive).

#### 2. Sodium Restriction Mechanics & Vascular Impact:
- **Target Threshold**: Reduce sodium to **<2,000 mg/day** (equivalent to ~5g NaCl or ~1 tsp table salt). Optimal target **<1,500 mg/day**.
- **Physiologic Mechanism**: Decreases intravascular fluid volume, blunts renal salt-sensitivity, improves endothelial nitric oxide bioavailability, and lowers systemic vascular resistance (SVR).
- **Expected SBP Impact**: Additional **-5 to -6 mmHg SBP** reduction.

> [!NOTE]
> Combining DASH diet + strict sodium restriction yields a synergistic SBP reduction up to **-16 mmHg**, matching single-drug monotherapy efficacy.`
      : `### Understanding the DASH Diet & How Salt Affects Blood Pressure

The **DASH Eating Plan** (Dietary Approaches to Stop Hypertension) is a scientifically proven diet specifically designed to lower blood pressure naturally.

#### 🥗 Key Foods in the DASH Diet:
- **Eat More**: Vegetables, fruits, whole grains, nuts, seeds, beans, and low-fat dairy products.
- **Eat Less**: Foods high in saturated fats, full-fat dairy, fatty meats, and sugary drinks/desserts.
- **Key Nutrients**: Rich in potassium, calcium, and magnesium — minerals that help relax blood vessel walls.

#### 🧂 How Sodium (Salt) Affects Your Blood Pressure:
- Excess salt causes your body to hold onto extra water.
- This extra fluid increases blood volume in your arteries, putting higher pressure against artery walls.
- **Target Goal**: Keep daily sodium under **2,000 mg** (about 1 teaspoon of total salt per day).
- **Practical Tip**: Over 70% of sodium comes from processed, canned, and restaurant foods, not the salt shaker at home!

> [!TIP]
> **Expected Results**: Following the DASH diet can lower your top blood pressure number (systolic) by **8 to 11 mmHg** within just a few weeks!`

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
          quote: 'DASH Diet Pattern (-11 mmHg SBP), Sodium Restriction <2,000 mg/day (-5 to -6 mmHg SBP).'
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

  // 3. Home BP Measurement Guide
  if (q.includes('measure') || q.includes('home') || q.includes('correctly')) {
    const content = isClinician
      ? `### Home Blood Pressure Monitoring (HBPM) Protocol & Diagnostic Cutoffs

#### HBPM Protocol Standards (NICE NG136 & ACC/AHA 2017):
1. **Preparation**: Patient seated quietly for 5 minutes prior to measurement. Feet flat on floor, back supported, arm supported at heart level.
2. **Cuff Sizing**: Bladder length must encircle ≥80% of arm circumference; width ≥40%.
3. **Frequency**: 2 consecutive readings spaced 1 minute apart, performed morning and evening for 7 days (minimum 4 days data).
4. **Data Handling**: Discard Day 1 readings; average all remaining readings to calculate true diagnostic HBPM mean.

#### Diagnostic Cutoffs:
- **Clinic BP ≥140/90 mmHg** corresponds to **HBPM / ABPM Mean ≥135/85 mmHg** (Stage 1 HTN threshold).
- **Clinic BP ≥160/100 mmHg** corresponds to **HBPM / ABPM Mean ≥150/95 mmHg** (Stage 2 HTN threshold).

> [!NOTE]
> HBPM eliminates White-Coat effect (~15-25% prevalence) and improves 5-year cardiovascular risk prediction vs clinic spot checks.`
      : `### How to Correctly Measure Blood Pressure at Home

Getting accurate home blood pressure readings is essential for managing your heart health. Follow these guideline steps:

#### 📋 Before You Measure:
- **Rest**: Sit quietly for 5 minutes before taking a reading.
- **Avoid Stimulants**: Don’t drink caffeine, smoke, or exercise 30 minutes before testing.
- **Empty Bladder**: A full bladder can temporarily raise your reading by 10 to 15 mmHg.

#### 🪑 Proper Seating Position:
1. Sit in a chair with your back supported and feet flat on the floor (do not cross legs).
2. Rest your arm on a table so the cuff is level with your **heart**.
3. Place the cuff directly on bare skin, about 1 inch above the bend of your elbow.

#### ⏱️ Measurement Routine:
- Take **2 readings 1 minute apart** in the morning before taking medications, and **2 readings in the evening** before dinner.
- Record both numbers in your log or app to share with your doctor.

> [!TIP]
> A home reading of **135/85 mmHg or higher** is generally considered elevated blood pressure.`

    return {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: now,
      citations: [
        {
          source_id: 'guidelines/nice-ng136-summary.md',
          title: 'NICE NG136 - Home Blood Pressure Monitoring Standards',
          organization: 'NICE UK',
          source_url: 'https://www.nice.org.uk/guidance/ng136',
          quote: 'HBPM protocol: measure twice daily for 7 days. Discard first day data and average remaining readings. Target HBPM <135/85 mmHg.'
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

  // 4. Questions to Ask Doctor
  if (q.includes('doctor') || q.includes('ask') || q.includes('prep') || q.includes('question')) {
    const content = isClinician
      ? `### Shared Decision-Making & Patient Consultation Checklist

#### Essential Consultation Domain Review:
1. **Target Goal Alignment**: Establish patient-specific BP target (e.g. <130/80 mmHg vs <140/90 mmHg based on ASCVD / CKD status).
2. **Adherence & Side-Effect Screening**: Evaluate peripheral edema (CCBs), dry cough/hyperkalemia (ACEi), hyperuricemia (diuretics).
3. **Home Monitoring Data**: Review patient’s 7-day HBPM logs to rule out masked hypertension or white-coat effect.
4. **End-Organ Screening**: Verify baseline eGFR, uACR, lipids, HbA1c, and ECG status.

> [!NOTE]
> Provide structured patient education materials and schedule follow-up within 4 weeks of treatment modification.`
      : `### Questions to Ask Your Doctor About High Blood Pressure

Preparing for your appointment helps you get the most out of your visit. Here are 5 key questions to ask your doctor:

#### ❓ Top 5 Questions for Your Doctor:
1. **"What is my personal target blood pressure goal?"** *(e.g., under 130/80 or under 140/90)*
2. **"Which lifestyle changes will give me the biggest benefit based on my health history?"**
3. **"How often should I measure my blood pressure at home, and what log format do you prefer?"**
4. **"What potential side effects should I watch for with my current medications?"**
5. **"Do I need any blood tests to check my kidney function, electrolytes, or cholesterol?"**

#### 📝 What to Bring to Your Visit:
- Your home blood pressure log or smartphone app history.
- A complete list of all medications, vitamins, and supplements you take.

> [!TIP]
> Don't hesitate to take notes during your appointment or ask your doctor to explain any medical terms you don't recognize!`

    return {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: now,
      citations: [
        {
          source_id: 'guidelines/acc-aha-2017-summary.md',
          title: 'ACC/AHA 2017 Guidelines - Patient-Centered Consultation',
          organization: 'ACC/AHA',
          source_url: 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065',
          quote: 'Encourage structured patient-clinician communication regarding home BP monitoring, target goals, and medication adherence.'
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

  // 5. Systolic & Diastolic Numbers Meaning
  if (q.includes('number') || q.includes('systolic') || q.includes('diastolic') || q.includes('meaning') || q.includes('reading')) {
    const content = isClinician
      ? `### Hemodynamic Definitions & BP Classification Standard (ACC/AHA 2017)

#### 1. Systolic Blood Pressure (SBP):
- Measures peak arterial pressure during ventricular contraction (systole).
- Stronger predictor of cardiovascular events and end-organ damage in adults aged ≥50.

#### 2. Diastolic Blood Pressure (DBP):
- Measures baseline arterial pressure during ventricular relaxation and filling (diastole).
- Stronger risk predictor in younger adults (<50 years).

#### 📊 ACC/AHA 2017 BP Classification Table:
| Category | Systolic (mmHg) | Diastolic (mmHg) |
| :--- | :--- | :--- |
| **Normal** | <120 | AND <80 |
| **Elevated** | 120–129 | AND <80 |
| **Stage 1 HTN** | 130–139 | OR 80–89 |
| **Stage 2 HTN** | ≥140 | OR ≥90 |
| **Hypertensive Crisis** | >180 | AND/OR >120 |

> [!NOTE]
> If SBP and DBP fall into different categories, classify the patient using the higher category.`
      : `### What Your Systolic and Diastolic Blood Pressure Numbers Mean

A blood pressure reading is written as two numbers (for example: **120/80 mmHg**). Here is what each number means:

#### 1. Top Number: Systolic Blood Pressure
- Measures the pressure in your blood vessels when your heart **beats and pumps blood**.
- This is the higher number in your reading.

#### 2. Bottom Number: Diastolic Blood Pressure
- Measures the pressure in your blood vessels when your heart **rests between beats**.
- This is the lower number in your reading.

#### 📊 Understanding Your Numbers:
- **Normal**: Less than 120/80 mmHg
- **Elevated**: 120–129 / less than 80 mmHg *(lifestyle changes recommended)*
- **Stage 1 High BP**: 130–139 / 80–89 mmHg
- **Stage 2 High BP**: 140 or higher / 90 or higher mmHg

> [!TIP]
> If your top and bottom numbers fall into different categories, your overall category is based on whichever number is higher.`

    return {
      id: `fallback-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: now,
      citations: [
        {
          source_id: 'guidelines/acc-aha-2017-summary.md',
          title: 'ACC/AHA 2017 Guideline BP Categories',
          organization: 'ACC/AHA',
          source_url: 'https://www.ahajournals.org/doi/10.1161/HYP.0000000000000065',
          quote: 'Blood pressure categories in adults: Normal <120/<80, Elevated 120-129/<80, Stage 1 HTN 130-139/80-89, Stage 2 HTN >=140/>=90.'
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

  // 6. General Lifestyle Modifications
  if (q.includes('lifestyle') || q.includes('naturally') || q.includes('exercise') || q.includes('weight')) {
    const content = isClinician
      ? `### Evidence-Based Non-Pharmacological Interventions (ACC/AHA 2017 & NICE NG136)

Non-pharmacological therapy is recommended for all individuals with elevated blood pressure or hypertension.

#### 1. Dietary Sodium Restriction
- **Target**: Reduce sodium intake to **<2,000 mg/day** (equivalent to ~5g of table salt).
- **Expected SBP Impact**: **-5 to -6 mmHg** in hypertensive patients (**-2 to -3 mmHg** in normotensive).

#### 2. DASH Dietary Pattern
- **Composition**: Rich in fruits, vegetables, whole grains, low-fat dairy, and reduced saturated fat.
- **Expected SBP Impact**: **-11 mmHg** (hypertensive) / **-3 mmHg** (normotensive).

#### 3. Weight Loss
- **Target**: Maintain ideal body weight (BMI 18.5–24.9 kg/m²).
- **Expected SBP Impact**: **-1 mmHg per kg of body weight lost**.

#### 4. Physical Activity
- **Aerobic Exercise**: 150 minutes/week of moderate-intensity aerobic physical activity.
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
- **Expected SBP reduction**: ~5 to 6 mmHg.

#### 3. Regular Physical Activity
- Aim for at least **150 minutes of moderate aerobic exercise per week** (e.g., 30 minutes of brisk walking 5 days a week).
- **Expected SBP reduction**: ~5 to 8 mmHg.

#### 4. Maintain a Healthy Weight
- Losing excess weight helps lower blood pressure directly.
- **Expected SBP reduction**: ~1 mmHg for every kilogram (2.2 lbs) of weight lost.

#### 5. Manage Stress & Prioritize Sleep
- Aim for 7 to 9 hours of quality sleep each night and practice relaxation techniques.

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

  // 7. First-Line Drug Treatment & Guidelines
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
> Your doctor will select the safest medication for your specific medical profile and monitor your blood pressure and blood tests regularly.`

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

  // 8. Default General Response for any other question
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
