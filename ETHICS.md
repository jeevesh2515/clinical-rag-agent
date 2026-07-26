# Ethics & Responsible Use

**Last updated:** July 26, 2026

**Clinical Workflows** (`https://clinical-workflows.vercel.app`) is an educational and engineering demonstration of a production-grade clinical RAG (Retrieval-Augmented Generation) architecture. This document outlines the ethical framework, safety principles, and responsible-use guidelines governing this project.

---

## 1. Clinical Disclaimer

**This application is NOT a medical device.**

Clinical Workflows has not been reviewed, cleared, or approved by any regulatory authority, including the U.S. Food and Drug Administration (FDA), the Medicines and Healthcare products Regulatory Agency (MHRA), or any equivalent body. It does not comply with:

- **FDA** 21 CFR Part 820 / IEC 62304 (medical device software)
- **EU** Medical Device Regulation (MDR) 2017/745
- **UK** Medical Devices Regulations 2002 (SI 2002 No. 618)

**Do not use this application for real clinical decision support, diagnosis, treatment planning, medication management, or any patient-facing purpose.** The system may produce incomplete, inaccurate, or harmful outputs. Always consult a qualified healthcare provider for medical advice.

---

## 2. Intended Use

This project is designed exclusively for:

- **Educational demonstration** of RAG architectures applied to clinical knowledge domains.
- **Engineering portfolio showcase** of LangGraph agent orchestration, hybrid retrieval, safety routing, deterministic calculators, and evaluation harnesses.
- **Research and experimentation** with safety guardrails, citation provenance, and LLM-as-judge evaluation in clinical contexts.

The hypertension guideline content (OKF concept files) is drawn from published sources (NICE NG136, WHO, CDC, ACC/AHA, ESC/ESH) and is provided for reference only. It does not constitute practice guidelines or institutional endorsements.

---

## 3. System Limitations

### 3.1 Domain Scope

- **Hypertension-focused only.** Knowledge is limited to chronic hypertension guidelines. The system is not trained or validated for other conditions (cardiology, oncology, infectious disease, etc.).
- **Synthetic scenarios only.** All demonstration data, sample queries, and test accounts are synthetic. The system has not been validated on real clinical populations.

### 3.2 No HIPAA Compliance

- This application is **not HIPAA-compliant**.
- It does not execute Business Associate Agreements (BAAs).
- It does not provide audit logs satisfying 45 CFR 164.312(b).
- It does not guarantee encryption-at-rest or access controls meeting healthcare regulatory standards.

### 3.3 LLM Limitations

- Large Language Models (LLMs) can **hallucinate** — generate plausible-sounding but factually incorrect information. Our safety routing and citation validation reduce this risk but cannot eliminate it.
- LLMs have **knowledge cutoffs**. They may not reflect the latest guidelines, drug approvals, or recall notices.
- LLMs do not have **reasoning guarantees**. Numerical calculations, drug dosage math, and temporal logic may be unreliable. The system routes known calculations (eGFR, MAP, BMI) to deterministic code, but unanticipated calculations revert to LLM inference.

### 3.4 Retrieval Limitations

- Document chunking may split related concepts across boundaries.
- Hybrid retrieval may miss relevant content in low-resource medical subdomains.
- Cross-encoder reranking improves precision but does not guarantee clinical correctness.

---

## 4. Data Privacy Commitment

### 4.1 No PHI Collection

We do **not** intentionally collect, store, or process Protected Health Information (PHI) as defined by HIPAA (45 CFR 160.103). If you enter real patient data despite this prohibition, you do so at your own risk and in violation of these terms.

### 4.2 Data Minimization

- We store only the data you voluntarily provide: account credentials, synthetic profile information, uploaded test documents, and conversation history.
- No data is sold, rented, or shared with third parties for marketing or analytics.
- LLM providers (OpenRouter, Cohere, OpenAI, Anthropic, Google) process queries only when you supply your own API keys. Review their respective privacy policies for their data-handling practices.

### 4.3 User Control

- You may delete your account and associated data at any time.
- You may export your conversation history.
- Data that is not explicitly retained (e.g., ephemeral query logs) is discarded after request completion.

### 4.4 Retention

- Demo database contents may be reset without notice.
- Long-term backups are not guaranteed.

---

## 5. Responsible AI Principles

### 5.1 Safety-First Routing

The LangGraph agent enforces safety at the structural graph level:

```
[Query] ➔ validate_request ➔ classify_intent ➔ {Refusal Branch OR Retrieval Branch}
```

Unsafe queries — those requesting prescribing advice, self-diagnosis, emergency triage, or treatment recommendations — are **refused before any retrieval or generation occurs**. This is not a soft warning but a hard architectural gate.

### 5.2 Deterministic Calculators Over LLM Math

Clinical calculations (eGFR via CKD-EPI 2009, MAP, Pulse Pressure, BMI) are executed by audited deterministic code, never by LLM text generation. This eliminates LLM math drift and unit-conversion errors.

### 5.3 Citation Provenance

Every generated claim is accompanied by a citation traceable to a source document, version, publication date, and license. The citation validator confirms that each claim has at least one supporting retrieval chunk before the response is delivered.

### 5.4 Refusal of Unsafe Queries

The system is designed to refuse:

- Prescribing or medication adjustment requests
- Diagnostic interpretations of symptoms
- Emergency triage or urgency assessments
- Requests to impersonate a licensed clinician
- Prompt injection and jailbreak attempts
- Any query that could be construed as direct clinical decision support

### 5.5 Transparency About Capabilities

The system explicitly discloses its limitations in every response through its mode-switching behavior (Patient vs. Clinician persona) and by surfacing the evidence panel with full retrieval transparency.

---

## 6. No PHI Policy

**You must not enter real Protected Health Information (PHI) into this application.**

PHI includes, but is not limited to:

- Patient names, addresses, dates of birth
- Medical record numbers, health plan IDs
- Lab results, diagnoses, or treatment plans for real individuals
- Photographs or scans of real patient documents
- Any information that could identify an individual in a health context

The application is designed for synthetic, de-identified, and fictional scenarios only. Example acceptable usage includes:

- "Calculate eGFR for a 62-year-old female with creatinine 1.4 mg/dL"
- "What does NICE say about BP targets in diabetic patients?"
- "Is amlodipine contraindicated with a GFR of 35?"

If you suspect that PHI has been entered accidentally, open a GitHub issue immediately (see Section 7).

---

## 7. Contact for Concerns

For ethical concerns, safety issues, data-deletion requests, or questions about this policy:

- **GitHub Issues:** https://github.com/jeevesh2515/clinical-rag-agent/issues
- **Repository:** https://github.com/jeevesh2515/clinical-rag-agent

We take reports of safety concerns, potential misuse, or compliance issues seriously and will respond as promptly as possible given the project's educational scope and resourcing.

---

## 8. Transparency

### 8.1 How the AI Works

1. **Query Intake** — A user submits a question via the workstation interface.
2. **Safety Classification** — The LangGraph agent classifies the intent. If it falls into a blocked category (prescribing, diagnosis, emergency), the query is refused immediately.
3. **Routing** — Safe queries are routed to the appropriate backend:
   - **OKF Knowledge Spine** — Canonical facts from curated concept files for deterministic answers.
   - **Hybrid RAG Store** — Vector + BM25 search across indexed guideline documents.
   - **Deterministic Calculator** — Code-based clinical math.
   - **Personal RAG Engine** — User-uploaded document context.
4. **Reranking** — Retrieved candidates are rescored by a cross-encoder reranker.
5. **Generation** — A grounded LLM generates a response, constrained to the retrieved evidence.
6. **Validation** — Claim and citation validators check that every claim is supported by a retrieved source.
7. **Delivery** — The response is returned with citations, provenance, and safety metadata visible in the evidence panel.

### 8.2 What It Can Do

- Answer hypertension guideline questions from indexed sources with citations.
- Calculate eGFR, MAP, Pulse Pressure, and BMI deterministically.
- Detect care gaps from synthetic clinical profiles.
- Demonstrate safety routing by correctly refusing unsafe queries.

### 8.3 What It Cannot Do

- Provide medical advice, diagnosis, or treatment.
- Handle real patient data or PHI.
- Guarantee completeness or accuracy of retrieved information.
- Replace clinical judgment or a licensed healthcare provider.
- Operate as a medical device or clinical decision support system.

### 8.4 Accountability

This project is maintained by individual contributors acting in a personal capacity. It is not affiliated with any healthcare institution, regulatory body, or commercial entity. No clinician-in-the-loop review is performed on generated outputs. Users bear full responsibility for how they interpret and use the system's outputs.

---

## 9. Acknowledgment

By using this application, you acknowledge that you have read, understood, and agree to the terms outlined in this document and the accompanying [Terms of Service](TERMS.md) and [Privacy Policy](PRIVACY.md).

---

*This document may be updated as the project evolves. Changes will be reflected by an updated date at the top of this file.*
