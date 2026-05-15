export interface UseCase {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: "education" | "media" | "business";
  videoPath?: string;
  thumbnailPath?: string;
  steps: {
    step: number;
    title: string;
    description: string;
  }[];
  benefits: string[];
  ctaText: string;
  ctaRoute: string;
  suggestedPrompts?: string[];
  supportedFileTypes?: string[];
  examplePrompt?: string;
  exampleResponse?: string;
  voiceScript?: string;
}

export const useCases: UseCase[] = [
  {
    id: "university-notes-mcq",
    title: "Study Notes to Quiz",
    subtitle: "Transform your study materials into practice tests",
    description: "Upload your university lecture notes, textbook chapters, or study guides and let Evident generate multiple-choice questionnaires to help you prepare for exams. Perfect for students preparing for midterms, finals, or certification exams.",
    icon: "GraduationCap",
    category: "education",
    steps: [
      {
        step: 1,
        title: "Upload Your Notes",
        description: "Drag and drop your PDF lecture notes, Word documents, PowerPoint slides, or even photos of handwritten notes into Evident. For example, upload your 'Biology 101 - Cell Structure' lecture notes."
      },
      {
        step: 2,
        title: "Wait for Processing",
        description: "Evident extracts and analyzes the content, identifying key concepts, definitions, diagrams, and important facts from your study material."
      },
      {
        step: 3,
        title: "Ask for a Quiz",
        description: "Type your request in natural language. For example: 'Create a 10-question multiple choice quiz with 4 options each. Include the correct answer and a brief explanation for each question.'"
      },
      {
        step: 4,
        title: "Review & Study",
        description: "Evident generates a complete quiz with questions, multiple choice options (A, B, C, D), correct answers, and explanations citing your original notes."
      }
    ],
    benefits: [
      "Save hours of manual quiz creation",
      "Questions are based on YOUR actual study material",
      "Every answer includes citations to verify accuracy",
      "Customize difficulty level and question count",
      "Perfect for exam preparation and self-testing"
    ],
    ctaText: "Upload Your Notes",
    ctaRoute: "/",
    supportedFileTypes: ["PDF", "DOCX", "PPTX", "TXT", "Images of handwritten notes"],
    suggestedPrompts: [
      "Create a 10-question multiple choice quiz with 4 options each",
      "Generate flashcards from the key concepts in my notes",
      "List the main topics covered and create 2 questions per topic",
      "Create a practice test with easy, medium, and hard questions",
      "What are the key terms I should memorize for the exam?"
    ],
    examplePrompt: "Based on my uploaded Biology lecture notes, create a 5-question multiple choice quiz about cell structure. Each question should have 4 options (A, B, C, D). Include the correct answer and a brief explanation for each.",
    exampleResponse: `**Question 1:** What is the primary function of the mitochondria in a cell?

A) Protein synthesis
B) Energy production (ATP)
C) Cell division
D) Waste removal

**Correct Answer:** B) Energy production (ATP)
**Explanation:** The mitochondria is known as the "powerhouse of the cell" because it produces ATP through cellular respiration. [Source: Lecture Notes, Page 12]

---

**Question 2:** Which organelle contains the cell's genetic material?

A) Ribosome
B) Golgi apparatus
C) Nucleus
D) Lysosome

**Correct Answer:** C) Nucleus
**Explanation:** The nucleus houses DNA and controls cell activities. It is surrounded by a double membrane called the nuclear envelope. [Source: Lecture Notes, Page 8]

---

**Question 3:** What is the function of the endoplasmic reticulum (ER)?

A) Photosynthesis
B) Protein and lipid synthesis
C) Cell wall formation
D) Oxygen storage

**Correct Answer:** B) Protein and lipid synthesis
**Explanation:** The rough ER synthesizes proteins while the smooth ER produces lipids. [Source: Lecture Notes, Page 15]`,
    voiceScript: "Transform your study notes into practice quizzes instantly. Simply upload your lecture notes, textbook chapters, or study guides. Then ask Evident to create a multiple choice quiz. You'll get questions with answer options, correct answers, and explanations - all based on your actual study material with citations to verify accuracy."
  },
  {
    id: "video-transcript",
    title: "Video to Transcript",
    subtitle: "Extract searchable text from any video or audio",
    description: "Upload lecture recordings, meeting videos, podcasts, or any audio/video file and get accurate transcripts you can search, quote, and reference. Perfect for students, researchers, and professionals.",
    icon: "Video",
    category: "media",
    steps: [
      {
        step: 1,
        title: "Upload Your Video",
        description: "Drag and drop your video or audio file (MP4, MP3, WAV, M4A, etc.) into Evident. Supports lecture recordings, podcasts, interviews, and more."
      },
      {
        step: 2,
        title: "Automatic Transcription",
        description: "Evident's AI transcribes the audio with high accuracy, converting speech to searchable, quotable text."
      },
      {
        step: 3,
        title: "Ask Questions",
        description: "Query your transcript naturally: 'What were the main topics covered?' or 'Summarize the discussion about machine learning.'"
      },
      {
        step: 4,
        title: "Get Cited Answers",
        description: "Receive answers with timestamps and direct quotes, making it easy to find and reference specific moments in your recording."
      }
    ],
    benefits: [
      "Never miss important details from recordings",
      "Search through hours of content in seconds",
      "Get summaries without watching the full video",
      "Perfect for lectures, meetings, and interviews"
    ],
    ctaText: "Upload a Video",
    ctaRoute: "/",
    supportedFileTypes: ["MP4", "MP3", "WAV", "M4A", "WEBM", "MOV"],
    suggestedPrompts: [
      "Summarize the main points discussed in this recording",
      "List all topics covered with timestamps",
      "What were the key takeaways from this lecture?",
      "Create a transcript outline with section headings",
      "What questions were asked during this recording?"
    ],
    examplePrompt: "I uploaded a 45-minute lecture on machine learning. Summarize the key concepts covered and list the main topics discussed with timestamps.",
    exampleResponse: `**Lecture Summary: Introduction to Machine Learning**

The lecture covers fundamental machine learning concepts, divided into three main sections:

**Key Topics Discussed:**

1. **What is Machine Learning? (00:02:15 - 00:12:30)**
   - Definition: "Machine learning is a subset of AI that enables systems to learn from data" [Timestamp: 00:03:45]
   - Types: Supervised, unsupervised, and reinforcement learning
   - Real-world applications discussed

2. **Supervised Learning Deep Dive (00:12:30 - 00:28:00)**
   - Classification vs Regression explained [Timestamp: 00:15:20]
   - "The key is having labeled training data" [Timestamp: 00:18:40]
   - Examples: spam detection, price prediction

3. **Neural Networks Introduction (00:28:00 - 00:42:15)**
   - Basic architecture: input, hidden, output layers
   - "Think of neurons as mathematical functions" [Timestamp: 00:31:55]
   - Backpropagation concept introduced

**Key Takeaway:** "Start with simple models, understand your data, then increase complexity as needed" [Timestamp: 00:41:30]`,
    voiceScript: "Turn any video or audio into searchable, quotable text. Upload your lecture recordings, meeting videos, or podcasts. Evident automatically transcribes the audio and lets you ask questions about the content. Get answers with timestamps and direct quotes, so you can quickly find specific moments without watching the entire recording."
  },
  {
    id: "contract-obligations",
    title: "Contract Analysis",
    subtitle: "AI-powered clause analysis with negotiation insights",
    description: "Upload contracts or legal documents and let Evident's advanced AI analyze clauses, explain legal implications in plain language, suggest negotiation points, and generate comprehensive summary reports.",
    icon: "FileCheck",
    category: "business",
    steps: [
      {
        step: 1,
        title: "Upload Your Contract",
        description: "Drop your PDF contract, agreement, or policy document into Evident. Our advanced PyMuPDF engine preserves document structure and extracts tables accurately."
      },
      {
        step: 2,
        title: "AI Clause Analysis",
        description: "Evident's AI identifies all clauses, parties, dates, obligations, and key terms. Each clause is analyzed for risk level and which party it favors."
      },
      {
        step: 3,
        title: "Get Implications & Negotiation Points",
        description: "Receive plain-language explanations of what each clause means for you, plus AI-suggested negotiation points and red flags to watch out for."
      },
      {
        step: 4,
        title: "Generate Summary Report",
        description: "Get a comprehensive report with executive summary, all obligations by party, important dates, missing clauses, and overall fairness assessment."
      }
    ],
    benefits: [
      "Understand complex legal language in plain terms",
      "Identify favorable vs unfavorable clauses instantly",
      "Get AI-suggested negotiation points with priorities",
      "See risk levels and red flags before signing",
      "Never miss critical obligations or deadlines",
      "Generate professional summary reports"
    ],
    ctaText: "Analyze a Contract",
    ctaRoute: "/",
    supportedFileTypes: ["PDF", "DOCX", "TXT"],
    suggestedPrompts: [
      "Analyze this contract and show me all high-risk clauses",
      "What are the negotiation points I should focus on?",
      "Explain the termination clause implications in simple terms",
      "List all my obligations with deadlines and consequences",
      "Generate a summary report of this agreement",
      "What clauses are missing that should be included?",
      "Which party does this contract favor overall?"
    ],
    examplePrompt: "I uploaded a vendor service agreement. List all payment obligations, due dates, and penalties for late payment.",
    exampleResponse: `**Payment Obligations Analysis - Vendor Service Agreement**

**1. Monthly Service Fee**
- Amount: $5,000 per month
- Due Date: 1st of each month
- "Payment shall be made within 30 days of invoice date" [Clause 4.1, Page 3]

**2. Implementation Fee**
- One-time payment: $15,000
- Due Date: Upon contract signing
- "Implementation fee is due and payable upon execution of this Agreement" [Clause 4.2, Page 3]

**3. Annual License Renewal**
- Amount: $12,000 annually
- Due Date: 30 days before anniversary date
- "License renewal fees must be paid 30 days prior to the renewal date" [Clause 4.3, Page 4]

**Late Payment Penalties:**
- Interest Rate: 1.5% per month on overdue amounts [Clause 4.5, Page 4]
- Grace Period: 15 days
- "After 60 days of non-payment, Provider may suspend services" [Clause 4.6, Page 5]
- Collection Costs: "Client shall be responsible for all collection costs including reasonable attorney fees" [Clause 4.7, Page 5]

**Key Deadline:** First payment due within 30 days of contract execution.`,
    voiceScript: "Quickly understand any contract or legal document. Upload your agreement and ask Evident to identify payment obligations, deadlines, and key terms. Get structured answers with exact clause references you can verify in the original document. Never miss a critical obligation or penalty again."
  },
  {
    id: "invoice-reconciliation",
    title: "Invoice Reconciliation",
    subtitle: "Match invoices to time entries and flag discrepancies",
    description: "Upload invoices and time entry data to automatically reconcile billing. Evident extracts line items from invoices, matches them against your time records, flags discrepancies, and generates a detailed reconciliation report.",
    icon: "Receipt",
    category: "business",
    steps: [
      {
        step: 1,
        title: "Upload Invoices",
        description: "Drop your PDF or image invoices into Evident. The AI extracts vendor info, line items, hours, rates, and amounts automatically."
      },
      {
        step: 2,
        title: "Import Time Entries",
        description: "Upload a CSV export from your time tracking system (Harvest, Toggl, etc.) or connect via API to pull time entry data."
      },
      {
        step: 3,
        title: "Auto-Match & Flag",
        description: "Evident matches invoice line items to time entries by project, date, hours, and rates. Discrepancies are flagged automatically."
      },
      {
        step: 4,
        title: "Review & Export Report",
        description: "Review matched items and discrepancies in an interactive table. Export a reconciliation report to Excel or PDF."
      }
    ],
    benefits: [
      "Save hours of manual invoice verification",
      "Catch billing errors before payment",
      "Identify missing time entries or overbilling",
      "Generate audit-ready reconciliation reports",
      "Support for multiple time tracking systems",
      "Flag rate mismatches and duplicate entries"
    ],
    ctaText: "Reconcile Invoices",
    ctaRoute: "/",
    supportedFileTypes: ["PDF", "Images (JPG, PNG)", "CSV", "XLSX"],
    suggestedPrompts: [
      "Reconcile this invoice against my time entries",
      "Which line items don't match any time entries?",
      "Show me all billing discrepancies over $100",
      "Generate a reconciliation summary report",
      "List invoiced hours vs tracked hours by project",
      "Find duplicate time entries that may be double-billed"
    ],
    examplePrompt: "I uploaded an invoice from Acme Consulting and my Harvest time entries for January. Reconcile them and show me any discrepancies.",
    exampleResponse: `**Invoice Reconciliation Report**
*Invoice: Acme Consulting #INV-2026-0142 | Period: January 1-31, 2026*

**Summary:**
| Metric | Invoice | Time Entries | Difference |
|--------|---------|--------------|------------|
| Total Hours | 156.5 hrs | 152.0 hrs | +4.5 hrs |
| Total Amount | $23,475.00 | $22,800.00 | +$675.00 |
| Line Items | 8 | 7 matched | 1 unmatched |

**Matched Items (7):**
| Project | Invoice Hrs | Tracked Hrs | Rate | Status |
|---------|-------------|-------------|------|--------|
| Website Redesign | 45.0 | 45.0 | $150 | Matched |
| API Integration | 32.0 | 32.0 | $150 | Matched |
| Mobile App Phase 1 | 28.5 | 28.5 | $150 | Matched |
| Database Migration | 20.0 | 20.0 | $150 | Matched |
| Support & Maintenance | 15.0 | 12.0 | $150 | Hour Mismatch |
| Code Review | 8.0 | 8.0 | $150 | Matched |
| Documentation | 6.5 | 6.5 | $150 | Matched |

**Discrepancies Found (2):**

1. **Hour Mismatch - Support & Maintenance**
   - Invoice: 15.0 hours ($2,250.00)
   - Time Entries: 12.0 hours ($1,800.00)
   - Difference: +3.0 hours (+$450.00)
   - [Source: Invoice Line 5 vs Harvest Project ID 4521]

2. **Unmatched Invoice Line - "Strategy Consulting"**
   - Invoice: 1.5 hours ($225.00)
   - No matching time entries found
   - [Source: Invoice Line 8]

**Recommendation:** Request clarification on "Strategy Consulting" line item and verify Support & Maintenance hours before payment.`,
    voiceScript: "Stop spending hours manually checking invoices against time entries. Upload your invoices and time tracking data, and Evident automatically matches line items, identifies discrepancies like missing entries or overbilling, and generates a detailed reconciliation report you can export to Excel or PDF."
  },
  {
    id: "research-paper-summary",
    title: "Research Paper Summary",
    subtitle: "Quickly understand academic papers and studies",
    description: "Upload research papers, journal articles, or academic studies and get clear summaries, key findings, and methodology explanations in plain language.",
    icon: "BookOpen",
    category: "education",
    steps: [
      {
        step: 1,
        title: "Upload Research Papers",
        description: "Drop your PDF research papers, academic articles, or study documents into Evident."
      },
      {
        step: 2,
        title: "Content Analysis",
        description: "Evident processes the paper, understanding its structure, methodology, findings, and conclusions."
      },
      {
        step: 3,
        title: "Ask for Insights",
        description: "Query: 'Summarize the key findings' or 'Explain the methodology in simple terms.'"
      },
      {
        step: 4,
        title: "Learn Efficiently",
        description: "Get clear explanations with citations to specific sections you can verify in the original paper."
      }
    ],
    benefits: [
      "Understand complex research quickly",
      "Get plain-language explanations of technical content",
      "Find specific information across multiple papers",
      "Perfect for literature reviews and studying"
    ],
    ctaText: "Analyze Research",
    ctaRoute: "/",
    supportedFileTypes: ["PDF", "DOCX"],
    suggestedPrompts: [
      "Summarize the key findings in plain language",
      "Explain the methodology used in this study",
      "What are the limitations mentioned by the authors?",
      "List the main conclusions and their supporting evidence",
      "How does this paper compare to other research in the field?"
    ],
    examplePrompt: "Summarize the key findings of this research paper on renewable energy storage. Explain the methodology in simple terms.",
    exampleResponse: `**Research Paper Summary: Advanced Battery Technologies for Grid-Scale Energy Storage**

**Key Findings:**

1. **Main Discovery**
   - Solid-state batteries show 40% improvement in energy density compared to lithium-ion
   - "Our results demonstrate a breakthrough in cycle life, achieving 10,000+ cycles with minimal degradation" [Abstract, Page 1]

2. **Performance Results**
   - Energy density: 450 Wh/kg (vs 250 Wh/kg for traditional Li-ion)
   - Charging speed: 80% capacity in 15 minutes
   - Operating temperature range: -20°C to 60°C [Table 2, Page 8]

3. **Cost Analysis**
   - Projected cost reduction: 35% by 2027
   - "Manufacturing scalability remains the primary challenge" [Discussion, Page 12]

**Methodology Explained Simply:**
The researchers tested new battery materials by:
1. Creating small test batteries with different chemical compositions
2. Charging and discharging them thousands of times to test durability
3. Measuring how much energy they could store and release
4. Comparing results to current battery technology

Think of it like testing different recipes for a cake - they tried many variations to find the best combination of ingredients for maximum performance.

**Practical Implications:**
This technology could enable longer-range electric vehicles and more reliable renewable energy storage for homes and power grids.`,
    voiceScript: "Understand complex research papers quickly. Upload any academic paper or study, and ask Evident to summarize the key findings in plain language. Get clear explanations of technical methodologies and find specific information across your research documents. Perfect for literature reviews and studying."
  },
  {
    id: "meeting-action-items",
    title: "Meeting Notes to Action Items",
    subtitle: "Never miss a follow-up from your meetings",
    description: "Upload meeting recordings or notes and let Evident extract action items, decisions made, and assign responsibilities automatically.",
    icon: "ClipboardList",
    category: "business",
    steps: [
      {
        step: 1,
        title: "Upload Meeting Content",
        description: "Drop your meeting recording (audio/video) or typed meeting notes into Evident."
      },
      {
        step: 2,
        title: "Smart Extraction",
        description: "Evident transcribes audio and identifies discussions, decisions, and commitments made during the meeting."
      },
      {
        step: 3,
        title: "Get Action Items",
        description: "Ask: 'List all action items with owners' or 'What decisions were made in this meeting?'"
      },
      {
        step: 4,
        title: "Follow Up Effectively",
        description: "Receive organized action items with context and direct quotes from the discussion."
      }
    ],
    benefits: [
      "Never miss important follow-ups",
      "Clear accountability with cited commitments",
      "Save time on meeting minutes",
      "Searchable record of all decisions"
    ],
    ctaText: "Process Meeting Notes",
    ctaRoute: "/",
    supportedFileTypes: ["MP4", "MP3", "WAV", "M4A", "PDF", "DOCX", "TXT"],
    suggestedPrompts: [
      "List all action items with owners and deadlines",
      "What decisions were made in this meeting?",
      "Summarize the key discussion points",
      "Who committed to what and by when?",
      "Create meeting minutes with attendees, topics, and next steps"
    ],
    examplePrompt: "From this team meeting recording, extract all action items with owners and deadlines. Also list the key decisions made.",
    exampleResponse: `**Meeting Action Items & Decisions - Q1 Planning Session**
*Date: January 15, 2026 | Duration: 45 minutes*

**ACTION ITEMS:**

| # | Action Item | Owner | Deadline | Source |
|---|-------------|-------|----------|--------|
| 1 | Finalize Q1 marketing budget | Sarah | Jan 22 | "Sarah, can you have the budget ready by next Monday?" [12:34] |
| 2 | Set up vendor demo for new CRM | Mike | Jan 18 | "Mike volunteered to coordinate with Salesforce" [18:45] |
| 3 | Draft customer survey questions | Lisa | Jan 20 | "Lisa will prepare the survey draft" [24:12] |
| 4 | Review security audit findings | David | Jan 25 | "David needs to go through the audit report" [31:20] |
| 5 | Schedule team training session | Sarah | Jan 19 | "We need training booked before month-end" [38:55] |

**KEY DECISIONS MADE:**

1. **Budget Allocation Approved**
   - Marketing: $50,000 (increased from $40,000)
   - "We agreed to increase the marketing budget by 25%" [15:22]

2. **New CRM Selection**
   - Decision: Proceed with Salesforce evaluation
   - "Everyone agreed Salesforce is our top choice" [22:10]

3. **Q1 Priority: Customer Retention**
   - Focus on reducing churn by 10%
   - "Customer retention is our number one priority this quarter" [35:40]

**NEXT MEETING:** January 22, 2026 at 2:00 PM`,
    voiceScript: "Never miss a follow-up from your meetings again. Upload your meeting recording or notes, and Evident automatically extracts action items with owners and deadlines. Get a clear list of decisions made, with timestamps and direct quotes from the discussion for accountability."
  },
  {
    id: "policy-compliance",
    title: "Policy Compliance Check",
    subtitle: "Verify compliance against company policies",
    description: "Upload your company policies and procedures, then ask questions to verify compliance requirements, find specific rules, and understand guidelines.",
    icon: "Shield",
    category: "business",
    steps: [
      {
        step: 1,
        title: "Upload Policies",
        description: "Add your company policies, HR guidelines, compliance documents, or procedure manuals."
      },
      {
        step: 2,
        title: "Build Your Knowledge Base",
        description: "Evident indexes all your policy documents, making them searchable and queryable."
      },
      {
        step: 3,
        title: "Ask Compliance Questions",
        description: "Query: 'What is the policy on remote work?' or 'What are the expense approval requirements?'"
      },
      {
        step: 4,
        title: "Get Verified Answers",
        description: "Receive policy-based answers with direct citations to the official documents."
      }
    ],
    benefits: [
      "Instant access to policy information",
      "Ensure consistent policy interpretation",
      "Reduce time spent searching documents",
      "Always cite the official source"
    ],
    ctaText: "Upload Policies",
    ctaRoute: "/",
    supportedFileTypes: ["PDF", "DOCX", "TXT"],
    suggestedPrompts: [
      "What is the policy on remote work?",
      "What are the expense approval limits and requirements?",
      "How do I request time off and what's the approval process?",
      "What are the data security requirements for employees?",
      "Summarize the key compliance requirements I need to follow"
    ],
    examplePrompt: "What is our company's policy on remote work? Include approval requirements and any restrictions.",
    exampleResponse: `**Remote Work Policy Summary**

Based on the Employee Handbook (Version 3.2, Updated January 2026):

**Eligibility:**
- All full-time employees after 90-day probation period
- "Employees must have demonstrated satisfactory performance in their role" [Section 5.2, Page 18]

**Approval Requirements:**
1. Submit Remote Work Request Form to direct manager
2. Manager approval required within 5 business days
3. HR review for positions requiring on-site presence
4. "Final approval authority rests with department head for requests exceeding 3 days per week" [Section 5.3, Page 19]

**Restrictions & Guidelines:**
- Maximum 4 days remote per week for most positions
- "Customer-facing roles limited to 2 remote days per week" [Section 5.4, Page 20]
- Must be available during core hours: 10 AM - 3 PM local time
- Secure, private workspace required
- Company VPN must be used for all work activities

**Equipment Provided:**
- Laptop and necessary software
- $200 one-time home office stipend
- "Company does not reimburse internet or utility costs" [Section 5.6, Page 21]

**Review Period:**
Remote work arrangements reviewed quarterly. "Arrangements may be modified based on business needs" [Section 5.8, Page 22]

**To Apply:** Contact HR or access the Remote Work Request Form on the company intranet.`,
    voiceScript: "Get instant answers about company policies and procedures. Upload your policy documents, HR guidelines, or compliance materials. Then simply ask questions in plain language. Evident provides verified answers with direct citations to the official documents, ensuring consistent policy interpretation across your organization."
  },
  {
    id: "technical-docs-qa",
    title: "Technical Documentation Q&A",
    subtitle: "Get instant answers from technical manuals",
    description: "Upload product manuals, technical specifications, API documentation, or user guides and ask questions in plain language to find exactly what you need.",
    icon: "Wrench",
    category: "business",
    steps: [
      {
        step: 1,
        title: "Upload Documentation",
        description: "Add your technical manuals, product guides, API docs, or specification sheets."
      },
      {
        step: 2,
        title: "Intelligent Indexing",
        description: "Evident processes technical content, understanding diagrams, specifications, and procedures."
      },
      {
        step: 3,
        title: "Ask Technical Questions",
        description: "Query: 'How do I configure this setting?' or 'What are the system requirements?'"
      },
      {
        step: 4,
        title: "Get Precise Answers",
        description: "Receive step-by-step answers with references to the exact section in your documentation."
      }
    ],
    benefits: [
      "Find answers without reading entire manuals",
      "Quick troubleshooting support",
      "Onboard new team members faster",
      "Accurate, source-verified information"
    ],
    ctaText: "Upload Tech Docs",
    ctaRoute: "/",
    supportedFileTypes: ["PDF", "DOCX", "TXT", "MD", "HTML"],
    suggestedPrompts: [
      "How do I configure [specific setting]?",
      "What are the system requirements for installation?",
      "List the steps to troubleshoot [specific issue]",
      "What are the API endpoints and their parameters?",
      "Create a quick-start guide for new users"
    ],
    examplePrompt: "How do I configure the API rate limiting settings? What are the default values and recommended settings for production?",
    exampleResponse: `**API Rate Limiting Configuration Guide**

Based on the API Documentation (v2.4):

**Configuration Location:**
\`config/api-settings.yaml\` or via Admin Dashboard > Settings > API Limits

**Default Settings:**
| Parameter | Default Value | Description |
|-----------|---------------|-------------|
| requests_per_minute | 60 | Max requests per API key per minute |
| requests_per_hour | 1,000 | Max requests per API key per hour |
| burst_limit | 10 | Max concurrent requests |
| timeout_seconds | 30 | Request timeout |
[Table 4.2, Page 45]

**Recommended Production Settings:**
"For production environments, we recommend the following configuration" [Section 4.3, Page 46]:

\`\`\`yaml
rate_limiting:
  enabled: true
  requests_per_minute: 100
  requests_per_hour: 5000
  burst_limit: 25
  timeout_seconds: 60
  retry_after_header: true
\`\`\`

**How to Apply:**

1. **Via Config File:**
   - Edit \`config/api-settings.yaml\`
   - Restart the API service: \`systemctl restart api-service\`
   [Section 4.4, Page 47]

2. **Via Dashboard:**
   - Navigate to Admin > Settings > API Limits
   - Update values and click "Save"
   - Changes apply immediately, no restart needed

**Important Notes:**
- "Rate limits are applied per API key, not per IP address" [Section 4.5, Page 48]
- Monitor usage via \`/api/v1/usage\` endpoint
- Set up alerts for keys approaching limits`,
    voiceScript: "Get instant answers from technical documentation and user manuals. Upload your API docs, product guides, or specification sheets. Ask questions in plain language and receive precise, step-by-step answers with references to the exact sections in your documentation. Perfect for troubleshooting and onboarding new team members."
  }
];
