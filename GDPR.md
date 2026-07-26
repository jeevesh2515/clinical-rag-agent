# GDPR Compliance Notice — Clinical Workflows

**Last updated: July 26, 2026**

This document describes how the Clinical Workflows application ("the App"), an educational hypertension guideline assistant, processes personal data of users in the European Economic Area (EEA) in accordance with the General Data Protection Regulation (Regulation (EU) 2016/679).

---

## 1. Data Controller

| Field | Detail |
|-------|--------|
| **Controller** | The project maintainer (individual developer) |
| **Contact** | GitHub Issues: https://github.com/jeevesh2515/clinical-rag-agent/issues |
| **App URL** | https://clinical-workflows.vercel.app |

The controller determines the purposes and means of processing personal data. For all privacy-related inquiries, including the exercise of your rights under Articles 15–22 GDPR, please open an issue at the repository link above. A response will be provided within 30 days.

---

## 2. Legal Basis for Processing

Processing of personal data is based on **Article 6(1)(f) GDPR — legitimate interest**.

The legitimate interests pursued are:

- **Educational purpose:** The App is a non-commercial, open-source demonstration of retrieval-augmented generation (RAG) applied to clinical guidelines. It exists solely to showcase technical architecture and facilitate learning.
- **Service functionality:** Account creation and conversation storage are necessary to provide a persistent, usable demo experience.
- **Improvement:** Aggregated usage metrics help identify bugs and improve the application.

**Consent (Article 6(1)(a))** is relied upon where the App explicitly asks for permission — for example, when storing optional preferences.

Processing is **not** based on:
- Performance of a contract (Article 6(1)(b)) — no paid services or binding terms exist.
- Legal obligation (Article 6(1)(c)).
- Vital interests (Article 6(1)(d)).

### Your right to object
You may object at any time to processing based on legitimate interest by contacting us via GitHub Issues. Upon receiving an objection, we will cease processing unless we demonstrate compelling legitimate grounds that override your interests, rights, and freedoms.

---

## 3. Data Retention Policy

| Data Category | Retention Period | Rationale |
|---------------|------------------|-----------|
| Account data (username, email, password hash) | Until account deletion or 12 months of inactivity | Service continuity; inactivity timeout preserves storage hygiene |
| Conversation history | 90 days after last activity, then anonymized | Demo utility balanced against data minimization |
| Uploaded documents | Deleted immediately upon user deletion or 90 days after last upload | Documents are transient demo inputs |
| Usage metrics (aggregated) | 26 months | Standard analytics cycle |
| Session / auth tokens | Duration of session (JWT expiry) | Technical necessity |

### Deletion and reset
- Users may delete their account and all associated data at any time through the App interface, or by requesting deletion via GitHub Issues.
- Upon deletion, all personal data, conversations, and uploaded documents are permanently removed from the database within 72 hours.
- A "demo reset" function is available for users who wish to clear their conversation history without deleting their account.

---

## 4. Your Rights Under the GDPR

You have the following rights under Articles 15–22 GDPR:

### 4.1 Right of access (Article 15)
You may request confirmation of whether your personal data is being processed, and if so, access to that data and information about the processing. We will provide a copy of the data in a structured, commonly used format within 30 days.

### 4.2 Right to rectification (Article 16)
You may request correction of inaccurate personal data. This can be done through your account settings or by contacting us.

### 4.3 Right to erasure ("Right to be forgotten") (Article 17)
You may request deletion of your personal data without undue delay where:
- The data is no longer necessary for the purpose it was collected.
- You withdraw consent and no other legal basis applies.
- You object to processing based on legitimate interest and no overriding grounds exist.
- The data has been unlawfully processed.
- Erasure is required by EU or Member State law.

We will comply within 72 hours.

### 4.4 Right to restriction of processing (Article 18)
You may request restriction of processing where:
- You contest the accuracy of the data (until verified).
- Processing is unlawful and you oppose erasure.
- We no longer need the data but you require it for legal claims.
- You have objected to processing pending verification.

While processing is restricted, data will only be stored — not further processed — except with your consent or for legal claims.

### 4.5 Right to data portability (Article 20)
You may request a copy of your personal data in a machine-readable format (JSON), and have it transmitted directly to another controller where technically feasible. This right applies to data processed by consent or automated means.

### 4.6 Right to object (Article 21)
You may object to processing based on legitimate interest at any time. See Section 2 for details.

### 4.7 Rights related to automated decision-making (Article 22)
The App does **not** engage in automated decision-making, including profiling, that produces legal effects or similarly significant effects.

### Exercising your rights
To exercise any of the above rights, open an issue at: https://github.com/jeevesh2515/clinical-rag-agent/issues

We may request proof of identity before fulfilling the request. Responses will be provided within 30 days (Article 12(3)), extendable by a further 60 days for complex or high-volume requests.

---

## 5. Data Collected

The following personal data is collected:

| Category | Data | Purpose | Source |
|----------|------|---------|--------|
| **Account information** | Username | Unique identification within the App | User input during registration |
| **Account information** | Email address | Account recovery, service notifications | User input during registration |
| **Account information** | Password hash (bcrypt) | Authentication — raw password is never stored | User input, hashed server-side |
| **Conversations** | User messages and LLM responses | Core demo functionality; retrieving and displaying RAG-augmented answers | User input and system generation |
| **Uploaded documents** | Files uploaded for RAG context (e.g., PDFs, text files) | Enabling the RAG retrieval demo | User upload |
| **Usage metrics** | Page views, feature usage timestamps, error reports | Application improvement and bug detection | Automatic (server logs) |
| **Theme preference** | Light/dark mode choice | User experience personalization | Browser/storage (client-side only) |

### What is **not** collected
- Real patient data, medical records, or protected health information (PHI).
- Precise geolocation.
- Biometric or genetic data.
- Political opinions, religious beliefs, or trade union membership.
- Financial information or payment data.
- Advertising identifiers.

### Anonymization
Conversation data may be anonymized for aggregate analysis after the retention period ends. Anonymized data is no longer considered personal data under the GDPR.

---

## 6. Data Sharing and Third-Party Processors

Personal data is shared with the following third parties strictly for service operation:

### 6.1 Large Language Model (LLM) Providers

- **OpenRouter** (openrouter.ai): Routes LLM requests when the user selects a model available via their API. Data shared: conversation messages.
- **Cohere** (cohere.com): Used for embeddings / reranking when configured. Data shared: text excerpts for vector operations.
- **OpenAI** (openai.com): Used **only** when the user provides their own OpenAI API key via application settings. Data shared: conversation messages sent to the configured model.

**⚠️ Important:** These providers may process data on servers outside the EEA. Each provider's data handling is governed by its own terms:
- OpenRouter Privacy Policy
- Cohere Privacy Policy
- OpenAI Business Agreement (data not used for training when API is used)

No LLM provider receives data if the user uses a local or self-hosted model.

### 6.2 Hosting and Infrastructure

- **Vercel Inc.** (vercel.com — US-based): Hosts the Next.js frontend and serverless API functions. Vercel acts as a data processor. Data processed: request/response data transmitted through the App. See Vercel's DPA.
- **Neon Inc.** (neon.tech — US-based): Provides the PostgreSQL database. Neon acts as a data processor. Data stored: all account information, conversations, and uploaded document references. See Neon's DPA.

### 6.3 No data sales
We do **not** sell, rent, or trade personal data to third parties. There is no sharing for advertising, marketing, or any commercial purpose beyond operating this educational demo.

### 6.4 Data Processing Agreement (DPA)
As a data controller, we rely on the DPA offered by each processor (Vercel, Neon) and, where applicable, their Standard Contractual Clauses (SCCs) for international transfers.

---

## 7. International Data Transfers

### 7.1 Storage location
- **Vercel** (serverless functions and edge network): Primarily US-based, with global edge caching.
- **Neon** (PostgreSQL database): US region (primary); standby replicas may exist in additional regions.

### 7.2 Transfer mechanism
Personal data is transferred from the EEA to the United States under:

- **Standard Contractual Clauses (SCCs)** adopted by the European Commission (Decision 2021/914). Both Vercel and Neon offer SCCs in their Data Processing Agreements.
- **Adequacy decisions** are not applicable for the US at the time of this writing. Therefore, transfers rely on SCCs as the safeguard under Article 46(2)(c) GDPR.

### 7.3 Your rights regarding transfers
You may request a copy of the relevant safeguards (SCCs) by opening a GitHub issue. Commercial confidentiality provisions may apply.

---

## 8. Cookies and Tracking

The App uses only **essential (strictly necessary) cookies** as defined under Article 5(3) of the ePrivacy Directive (implemented via GDPR consent rules).

| Cookie | Purpose | Duration | Type |
|--------|---------|----------|------|
| `auth_token` | JWT-based session authentication | Session + configured JWT expiry | Essential |
| `theme` | Light/dark mode preference | 1 year (localStorage, not a cookie) | Essential / preference |

### What is **not** used
- Advertising or marketing cookies.
- Third-party tracking scripts (Google Analytics, Facebook Pixel, HotJar, etc.).
- Cross-site tracking or fingerprinting techniques.
- Social media buttons that send data to third parties.

### Cookie consent
Because no non-essential cookies are set, a cookie consent banner is **not required** under the ePrivacy Directive / GDPR cookie rules. If the App later introduces any non-essential cookie or tracker, explicit consent will be obtained before placement.

---

## 9. Security Measures

The following technical and organizational measures are in place to protect personal data (Article 32 GDPR):

| Measure | Detail |
|---------|--------|
| **HTTPS / TLS** | All traffic is encrypted in transit using TLS 1.2+ (enforced by Vercel edge network) |
| **Password hashing** | Passwords are hashed using **bcrypt** with a cost factor of 12. Raw passwords are never stored or logged |
| **JWT authentication** | Stateless JSON Web Tokens with expiry (configurable, default 24h) signed with a server-side secret |
| **Rate limiting** | API endpoints are rate-limited per IP to mitigate abuse and brute-force attacks |
| **Input sanitization** | User-supplied content is sanitized before rendering or storage to prevent injection |
| **Database access** | Neon database connections are TLS-encrypted and restricted to the Vercel serverless IP range where possible |
| **Minimal data collection** | Only the data necessary for the demo is collected (data minimization by design) |
| **API key isolation** | User-provided LLM API keys (OpenAI, Cohere) are stored encrypted and used only for that user's requests |
| **Access control** | Repository access and deployment credentials are restricted to the project maintainer |

### Incident response
In the event of a personal data breach (Article 33–34 GDPR):
1. The breach will be assessed within 24 hours.
2. If the breach poses a risk to natural persons, the relevant supervisory authority will be notified within 72 hours.
3. Affected users will be notified without undue delay if the breach is likely to result in high risk.

---

## 10. Supervisory Authority

Under Article 77 GDPR, you have the right to lodge a complaint with your local data protection supervisory authority if you believe our processing of your personal data infringes the GDPR.

For users in the EEA, the relevant authority is typically the data protection authority of your habitual residence, place of work, or place of the alleged infringement.

To find your competent authority, visit:
https://edpb.europa.eu/about-edpb/about-edpb/members_en

If you are uncertain which authority applies, contact us first via GitHub Issues and we will assist in directing your query.

---

## 11. Contact Information

All privacy and data protection inquiries should be directed to:

**GitHub Issues** (public): https://github.com/jeevesh2515/clinical-rag-agent/issues

We aim to respond to initial inquiries within **7 business days** and to exercise-of-rights requests within **30 days** as required by Article 12(3) GDPR.

When submitting a request, please:
- Include "GDPR:" in the issue title.
- Clearly indicate which right you wish to exercise.
- Provide your registered username or email so we can identify you.

---

## 12. Policy Updates

This GDPR Compliance Notice may be updated to reflect changes in:
- Data processing practices or features of the App.
- Legal or regulatory requirements.
- Third-party processor arrangements.

### Notification of changes
- The "Last updated" date at the top of this document will reflect the most recent revision.
- Material changes will be communicated via:
  1. A notice displayed within the App upon next login.
  2. An issue posted to the public GitHub repository.
- Non-material changes (typographical fixes, clarifications) will be applied without individual notice.

We encourage you to review this policy periodically. Continued use of the App after changes constitutes acceptance of the updated policy.

---

## Appendix A: GDPR Article Map

| Article | Subject | Location in this Document |
|---------|---------|--------------------------|
| 5 | Principles relating to processing | Sections 2, 3, 5 |
| 6 | Lawfulness of processing | Section 2 |
| 7 | Conditions for consent | Section 2 |
| 12–14 | Information and access | Sections 1, 4, 11 |
| 15 | Right of access | Section 4.1 |
| 16 | Right to rectification | Section 4.2 |
| 17 | Right to erasure | Section 4.3 |
| 18 | Right to restriction | Section 4.4 |
| 20 | Right to portability | Section 4.5 |
| 21 | Right to object | Section 4.6 |
| 22 | Automated decision-making | Section 4.7 |
| 25 | Data protection by design | Section 9 |
| 32 | Security of processing | Section 9 |
| 33–34 | Data breach notification | Section 9 |
| 44–49 | International transfers | Section 7 |
| 77 | Right to lodge complaint | Section 10 |

---

*This document is provided for informational purposes and does not constitute legal advice. For authoritative guidance on GDPR compliance, please consult a qualified data protection lawyer or your supervisory authority.*
