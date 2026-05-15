export type HelpArea = "core" | "finance" | "legal" | "account" | "packs";

export interface HelpTopic {
  id: string;
  area: HelpArea;
  title: string;
  description: string;
  steps: string[];
  routes: { label: string; path: string }[];
  tags: string[];
  packRequired?: "finance" | "legal";
  priority?: number;
}

export interface HelpAskResult {
  query: string;
  matches: { topicId: string; score: number }[];
  answer: {
    title: string;
    body: string;
    routes: { label: string; path: string }[];
    steps: string[];
  };
}

export interface HelpTopicsResponse {
  areas: {
    core: HelpTopic[];
    finance: HelpTopic[];
    legal: HelpTopic[];
    packs: HelpTopic[];
    account: HelpTopic[];
  };
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "upload-files",
    area: "core",
    title: "Upload files to Evident",
    description: "Learn how to upload documents, images, audio, or video files to your workspace for AI analysis.",
    steps: [
      "Go to your Workspace",
      "Click the upload area or drag and drop your files",
      "Wait for processing to complete",
      "Your files are now ready for questions"
    ],
    routes: [
      { label: "Go to Workspace", path: "/" }
    ],
    tags: ["upload", "add file", "document", "pdf", "import", "drag drop", "files"],
    priority: 10
  },
  {
    id: "video-audio-limits",
    area: "core",
    title: "File upload limits",
    description: "Upload limits vary by plan. All paid plans can upload large files up to 500MB using the 'Large Files' button. You can also share files via cloud storage links (Google Drive, Dropbox, OneDrive) up to 100MB.",
    steps: [
      "Free plan: 15MB per file",
      "Evident Lite: 10MB per file",
      "Evident Scholar: 20MB per file",
      "Evident Advanced: 25MB per file",
      "Evident Max: 50MB per file",
      "Enterprise: 100MB per file",
      "Large Files option: Up to 500MB for all paid plans - use the 'Large Files' button",
      "Cloud storage links: Up to 100MB via Google Drive, Dropbox, or OneDrive"
    ],
    routes: [
      { label: "Go to Workspace", path: "/" }
    ],
    tags: ["video", "audio", "limit", "size", "500mb", "transcription", "whisper", "media", "large file", "too big", "upload", "file size"],
    priority: 8
  },
  {
    id: "ask-questions",
    area: "core",
    title: "Ask questions with sources",
    description: "Ask questions about your uploaded documents and get answers backed by direct evidence from your source material.",
    steps: [
      "Upload at least one document to your workspace",
      "Type your question in the chat input",
      "Press Enter or click Send",
      "View the answer with cited sources",
      "Click on citations to see the original text"
    ],
    routes: [
      { label: "Go to Workspace", path: "/" }
    ],
    tags: ["ask", "question", "query", "chat", "answer", "sources", "citations", "evidence"],
    priority: 9
  },
  {
    id: "intelligence-packs-overview",
    area: "core",
    title: "Intelligence Packs overview",
    description: "Intelligence Packs are specialized AI assistants for specific domains like Finance and Legal. Each pack provides tailored workflows and analysis capabilities.",
    steps: [
      "Go to the Intelligence Packs page",
      "View available packs and their features",
      "Enabled packs appear in your sidebar",
      "Access pack features from their dedicated pages"
    ],
    routes: [
      { label: "View Intelligence Packs", path: "/packs" },
      { label: "Manage Packs", path: "/settings/packs" }
    ],
    tags: ["packs", "intelligence", "finance", "legal", "specialized", "domain"],
    priority: 8
  },
  {
    id: "finance-upload-invoice",
    area: "finance",
    title: "Upload an invoice, PO, or GRN",
    description: "Upload financial documents like invoices, purchase orders (POs), or goods received notes (GRNs) for reconciliation and analysis.",
    steps: [
      "Go to Invoice Reconciliation",
      "Select the Invoices or Time Entries tab",
      "Click Upload or drag your files",
      "Wait for extraction to complete",
      "Review the extracted data"
    ],
    routes: [
      { label: "Invoice Reconciliation", path: "/reconciliation" }
    ],
    tags: ["invoice", "po", "purchase order", "grn", "goods received", "upload", "financial"],
    packRequired: "finance",
    priority: 7
  },
  {
    id: "finance-run-reconciliation",
    area: "finance",
    title: "Run invoice reconciliation",
    description: "Automatically compare invoices against time entries or purchase orders to identify discrepancies in hours, rates, and amounts.",
    steps: [
      "Upload your invoices in the Invoices tab",
      "Upload matching time entries or POs",
      "Go to the Reconcile tab",
      "Click Run Reconciliation",
      "Review the results in the Results tab"
    ],
    routes: [
      { label: "Invoice Reconciliation", path: "/reconciliation" }
    ],
    tags: ["reconcile", "reconciliation", "match", "compare", "3-way match", "invoice matching", "discrepancy"],
    packRequired: "finance",
    priority: 6
  },
  {
    id: "finance-review-discrepancies",
    area: "finance",
    title: "Review reconciliation discrepancies",
    description: "Examine and resolve discrepancies found during the reconciliation process, including missing entries, rate mismatches, and hour differences.",
    steps: [
      "Go to the Results tab after reconciliation",
      "View the summary of discrepancies",
      "Click on a discrepancy to see details",
      "Review the flagged items",
      "Mark items as resolved or investigate further"
    ],
    routes: [
      { label: "Invoice Reconciliation", path: "/reconciliation" }
    ],
    tags: ["discrepancy", "mismatch", "error", "review", "resolve", "missing", "difference"],
    packRequired: "finance",
    priority: 5
  },
  {
    id: "finance-export",
    area: "finance",
    title: "Export reconciliation results",
    description: "Download your reconciliation results as a report for record-keeping or sharing with your team.",
    steps: [
      "Complete a reconciliation run",
      "Go to the Results tab",
      "Click the Export button",
      "Choose your preferred format",
      "Save the file to your device"
    ],
    routes: [
      { label: "Invoice Reconciliation", path: "/reconciliation" }
    ],
    tags: ["export", "download", "report", "save", "pdf", "csv"],
    packRequired: "finance",
    priority: 4
  },
  {
    id: "legal-upload-contract",
    area: "legal",
    title: "Upload a contract",
    description: "Upload contract documents for AI-powered analysis, clause extraction, and risk assessment.",
    steps: [
      "Go to Contract Analysis",
      "Click the upload area or drag your contract",
      "Supported format: PDF",
      "Wait for analysis to complete"
    ],
    routes: [
      { label: "Contract Analysis", path: "/legal/contracts" }
    ],
    tags: ["contract", "upload", "legal", "agreement", "document"],
    packRequired: "legal",
    priority: 7
  },
  {
    id: "legal-analyse-contract",
    area: "legal",
    title: "Analyse a contract",
    description: "Get AI-powered analysis of your contracts including clause identification, risk assessment, and negotiation suggestions. Not legal advice - consult a qualified attorney.",
    steps: [
      "Upload a contract PDF",
      "Wait for the analysis to complete",
      "Review the extracted clauses",
      "Check the risk assessment",
      "View negotiation suggestions"
    ],
    routes: [
      { label: "Contract Analysis", path: "/legal/contracts" }
    ],
    tags: ["analyse", "analyze", "contract", "review", "ai", "assessment"],
    packRequired: "legal",
    priority: 6
  },
  {
    id: "legal-review-clauses",
    area: "legal",
    title: "Review clauses and risks",
    description: "Examine individual clauses identified in your contract, their risk levels, and implications. AI suggestions are for informational purposes only.",
    steps: [
      "View your analysed contract",
      "Expand each clause section",
      "Check the risk level badge",
      "Read the plain-language implications",
      "Review suggested negotiation points"
    ],
    routes: [
      { label: "Contract Analysis", path: "/legal/contracts" }
    ],
    tags: ["clause", "risk", "implication", "term", "condition", "liability"],
    packRequired: "legal",
    priority: 5
  },
  {
    id: "legal-export",
    area: "legal",
    title: "Export contract analysis",
    description: "Download your contract analysis results as a report for record-keeping or review with legal counsel.",
    steps: [
      "Complete a contract analysis",
      "Click the Export button",
      "Choose your preferred format",
      "Save the file to your device"
    ],
    routes: [
      { label: "Contract Analysis", path: "/legal/contracts" }
    ],
    tags: ["export", "download", "report", "save", "analysis"],
    packRequired: "legal",
    priority: 4
  },
  {
    id: "packs-enable",
    area: "packs",
    title: "Enable Intelligence Packs",
    description: "Manage which Intelligence Packs are enabled for your workspace. Some packs may require specific plan levels.",
    steps: [
      "Go to Intelligence Packs settings",
      "View available packs",
      "Enabled packs are shown with a green badge",
      "Coming soon packs will be available in future updates"
    ],
    routes: [
      { label: "Intelligence Packs", path: "/packs" },
      { label: "Pack Settings", path: "/settings/packs" }
    ],
    tags: ["enable", "activate", "packs", "add", "turn on"],
    priority: 3
  },
  {
    id: "account-settings",
    area: "account",
    title: "Manage account settings",
    description: "Access your account settings to manage preferences, API keys, and workspace configuration.",
    steps: [
      "Click Settings in the sidebar",
      "View your current usage mode",
      "Manage API keys if needed",
      "Adjust your preferences"
    ],
    routes: [
      { label: "Settings", path: "/settings" }
    ],
    tags: ["account", "settings", "preferences", "profile", "api key"],
    priority: 2
  },
  {
    id: "account-billing",
    area: "account",
    title: "View billing and plans",
    description: "View your current plan, upgrade options, and manage your subscription.",
    steps: [
      "Go to the Billing page",
      "View your current plan",
      "Compare available plans",
      "Upgrade if needed"
    ],
    routes: [
      { label: "Billing", path: "/billing" }
    ],
    tags: ["billing", "plan", "subscription", "upgrade", "payment", "pricing"],
    priority: 2
  },
  {
    id: "account-usage",
    area: "account",
    title: "Check usage limits",
    description: "View your current usage and remaining limits for documents, questions, and storage.",
    steps: [
      "Go to Plan & Limits",
      "View document and question usage",
      "Check your remaining quota",
      "Upgrade if you need more"
    ],
    routes: [
      { label: "Plan & Limits", path: "/plan-limits" }
    ],
    tags: ["usage", "limits", "quota", "remaining", "documents", "questions"],
    priority: 2
  }
];
