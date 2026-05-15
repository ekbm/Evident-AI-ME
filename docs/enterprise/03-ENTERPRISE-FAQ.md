# Evident — Enterprise FAQ

**Common questions from enterprise buyers, IT, legal, and procurement teams**

---

## General

### What is Evident?
Evident is an AI-powered document assistant. Your team uploads documents (or connects existing sources like SharePoint), then asks questions in natural language and gets instant answers with citations back to the source material.

### What types of files does Evident support?
PDF, Microsoft Word, Excel, PowerPoint, plain text, images (with OCR), audio files (with transcription), and video files (with transcription). Essentially any file that contains information your team needs.

### How is this different from ChatGPT or Copilot?
Generic AI tools answer from general internet knowledge. Evident answers **only from your documents** and provides exact citations so you can verify every answer. It also includes enterprise features like obligation extraction, document health scoring, and compliance audit trails that general AI tools don't offer.

### How is this different from enterprise search (like SharePoint search)?
Traditional search returns a list of documents that might contain your answer. Evident reads your documents and gives you the **specific answer** with the exact page and paragraph reference. No more reading through 20 documents to find one sentence.

---

## Security & Privacy

### Where is our data stored?
By default, on Google Cloud Platform with AES-256 encryption at rest. You can choose Custom Storage (your own AWS S3, Azure, or GCS bucket), Private Cloud (dedicated instance in your cloud account), or Full On-Premise (your own servers). See our Data Security Overview for full details.

### Does OpenAI see our data?
OpenAI processes queries through their API but **does not store or train on API data**. This is covered by OpenAI's API data usage policy and their Data Processing Agreement (DPA). For organisations that cannot send any data externally, our On-Premise tier supports local AI models with zero external data transfer.

### Can we get a Data Processing Agreement (DPA)?
Yes. We provide a DPA covering Evident's data handling. We can also provide OpenAI's DPA for the AI processing layer. Contact enterprise@evident.ai to request these.

### Is Evident GDPR compliant?
Yes. We support data minimisation, the right to deletion, data portability, and provide a DPA. Users can delete their data at any time, and full data deletion (including backups) is performed upon account termination.

### Do you have SOC 2 certification?
SOC 2 Type II is on our compliance roadmap for 2026–2027. We can provide our current security documentation and architecture review in the meantime.

### Can we do a security assessment / penetration test?
Yes. We welcome security assessments from enterprise clients. Contact us to arrange access and scope.

---

## Deployment & IT

### How long does implementation take?
For Evident Cloud: under 48 hours. Sign up, connect your sources or upload documents, and your team can start asking questions. Private Cloud and On-Premise deployments typically take 1–4 weeks depending on your infrastructure.

### Do we need to install anything?
No. Evident Cloud and Custom Storage run in the browser — nothing to install. Private Cloud requires provisioning in your cloud account (we handle this). On-Premise requires Docker/Kubernetes on your servers.

### Can we connect to SharePoint / Google Drive / Confluence?
Yes. External integrations are included in all pricing tiers. IT admins connect through a self-service wizard in the admin console — OAuth-based, no developer needed.

### What if we can't do direct integrations (security restrictions)?
We offer multiple offline ingestion methods: SFTP drop folders with scheduled pickup, email forwarding, bulk ZIP upload, CSV/Excel import, and a REST API for custom scripts. Your data gets into Evident without any live integration connections.

### Does Evident support Single Sign-On (SSO)?
SSO/SAML integration (Active Directory, Okta, Azure AD) is on our development roadmap. Currently, authentication is via passwordless email verification codes.

### What are the system requirements?
For Cloud tiers: a modern web browser (Chrome, Safari, Firefox, Edge). For On-Premise: Docker or Kubernetes environment, 4+ CPU cores, 16GB+ RAM, and storage for your documents.

---

## Pricing & Licensing

### How much does Evident cost?
Starting at **$2.99/user/month** for Evident Cloud, with 100 free AI queries per user per month included. After that, simple per-query pricing ($0.015/query). See our pricing document for all tiers.

### Is there a minimum contract?
No minimum contract for Evident Cloud. We offer month-to-month, quarterly, and annual options. Private Cloud requires a minimum of 100 users. On-Premise requires a minimum of 250 users.

### Is there a free trial?
Yes. We offer a free pilot period so your team can evaluate Evident with real documents before committing. Contact enterprise@evident.ai to arrange this.

### What's included in the base price?
Everything — full platform access, all AI features, external integrations, document health scoring, obligation extraction, admin console, email support, and 100 free AI queries per user per month.

### How does usage-based pricing work?
Each user gets 100 free AI queries per month. After that, queries are charged at $0.015 each. Document processing and advanced features have their own transparent rates. You only pay for what you use — no surprises.

### Are there volume discounts?
Yes. For organisations with 500+ users, contact us for volume pricing. Annual commitments receive additional discounts.

---

## Features & Functionality

### Can we control which AI features are available to our team?
Yes. Enterprise admins can configure which modes and features are enabled for their organisation. For example, you can enable only Legal and Compliance modes for a law firm.

### Can different users have access to different documents?
Yes. Role-based access control ensures users only see documents they're authorised for. Admin, user, and viewer roles are supported, with integration to your existing directory services on the roadmap.

### How does obligation extraction work?
Upload a contract or policy document, and Evident automatically identifies and extracts structured obligations, deadlines, and requirements into a checklist format. This saves hours of manual contract review.

### How accurate is the AI?
Evident's answers are grounded in your actual documents with citations. Every answer links back to the specific source. The system includes content validation, source verification, and quality checks to ensure accuracy. Where the AI is unsure, it says so rather than guessing.

### Can Evident handle multiple languages?
Yes. Evident supports documents and queries in multiple languages, leveraging OpenAI's multilingual capabilities. Document processing (OCR, transcription) also works across languages.

### Is there an API for integration with our own systems?
Yes. Evident provides REST API endpoints for document upload, querying, and data export. API documentation and code samples are provided. Custom integrations can be scoped as part of an enterprise agreement.

---

## Support

### What support is included?
Email support is included in all tiers. Priority support with SLA is available as an add-on ($1/user/month) or included with Private Cloud and On-Premise tiers.

### Do you provide onboarding / training?
Yes. We provide guided onboarding, documentation, and in-app tours. For enterprise deployments, dedicated onboarding sessions can be arranged.

### How do we report issues?
Through the admin console (built-in feedback system), email support, or your dedicated account contact (for Private Cloud and On-Premise tiers).

---

## Contact

- **Enterprise Sales:** enterprise@evident.ai
- **Security Questions:** security@evident.ai
- **General Support:** support@evident.ai

---

*Last updated: March 2026*
