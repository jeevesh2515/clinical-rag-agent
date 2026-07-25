# Privacy Policy

**Last updated:** July 25, 2026

**Clinical Workflows** (`clinical-workflows.vercel.app`) is an educational and engineering demonstration of a production-grade clinical RAG (Retrieval-Augmented Generation) architecture. This Privacy Policy describes how the project handles data.

## 1. Educational / Demonstration Purpose

This application is **not intended for real clinical decision support**. It is a portfolio and research project. Do not enter real Protected Health Information (PHI), personally identifiable information (PII), or real patient data.

## 2. Information We Collect

### Account Information
- Username, email, password hash, and role (patient / clinician / admin) when you register.
- Profile data and clinical notes that **you voluntarily enter**.

### Uploaded Documents
- Prescriptions, lab reports, and doctor notes that **you voluntarily upload**.

### Usage Data
- HTTP request logs (path, method, status code, duration) for debugging.
- Anonymous metrics such as chunk counts and cache hit counters.

## 3. How We Use Information

- To provide the demo query, chat, and calculation features.
- To persist your conversations and notes across sessions.
- To improve retrieval quality and evaluate the RAG pipeline.

## 4. Data Storage

- Data is stored in the database configured by `DATABASE_URL` (SQLite locally, Neon PostgreSQL in production).
- Vector embeddings are stored in the same database (`chunk_vectors` and related tables).
- Uploaded documents are stored via the configured storage backend (local filesystem or S3-compatible object storage).

## 5. Data Sharing

We do **not** sell, rent, or share your data with third parties, except:
- With the LLM / embedding providers you configure (OpenRouter, Cohere, OpenAI, Anthropic, Google) when you provide your own API keys.
- As required by law.

## 6. Security

- Passwords are hashed with bcrypt.
- Authentication uses JWT tokens with a configurable secret.
- All API traffic is served over HTTPS in production.

## 7. GDPR Compliance

For users in the European Economic Area (EEA):
- **Lawful basis:** Legitimate interest in operating this educational demo.
- **Data minimization:** We only store what you voluntarily provide.
- **Right to access / rectification / erasure:** You can request access to, correction of, or deletion of your data by opening an issue on GitHub.
- **Data retention:** Demo data may be retained for the life of the demo database and may be reset without notice.
- **International transfers:** Data may be stored on servers located outside the EEA (e.g., Vercel, Neon).

## 8. Cookies and Tracking

We do not use advertising cookies. We may use essential cookies for authentication and theme preference.

## 9. Children's Privacy

This application is not directed at children under 13. We do not knowingly collect data from children.

## 10. Changes to This Policy

We may update this Privacy Policy. Changes will be reflected by updating the date above.

## 11. Contact

For questions or data-deletion requests, open an issue at:
https://github.com/jeevesh2515/clinical-rag-agent/issues

## Disclaimer

This project is for **educational and engineering demonstration only**. It does not provide medical advice, diagnosis, or treatment recommendations. Always consult a qualified healthcare provider.
