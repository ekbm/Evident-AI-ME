import { z } from "zod";

export const PackId = {
  FINANCE: "finance",
  LEGAL: "legal",
  HR: "hr",
  SALES: "sales",
  SERVICE: "service",
  PROCUREMENT: "procurement",
  CONSTRUCTION: "construction",
  COMPLIANCE: "compliance",
} as const;

export type PackIdType = (typeof PackId)[keyof typeof PackId];

export const PackStatus = {
  ENABLED: "enabled",
  AVAILABLE: "available",
  COMING_SOON: "coming_soon",
  DISABLED: "disabled",
  HIDDEN: "hidden", // Hidden packs - only visible to testing users
} as const;

export type PackStatusType = (typeof PackStatus)[keyof typeof PackStatus];

export interface PackRoutes {
  primaryPath: string;
  learnMorePath?: string;
}

export interface PackPricing {
  monthlyPrice: number;
  yearlyPrice: number;
  isLaunchPromo: boolean;
  launchPromoEnds?: string;
}

export interface PackFeature {
  name: string;
  description: string;
  path: string;
  status: "active" | "coming_soon";
}

export interface PackDefinition {
  id: PackIdType;
  title: string;
  shortDescription: string;
  longDescription: string;
  statusDefault: PackStatusType;
  routes: PackRoutes;
  tags: string[];
  icon: string;
  disclaimer?: string;
  pricing: PackPricing;
  features: PackFeature[];
}

export const PACKS: PackDefinition[] = [
  {
    id: PackId.FINANCE,
    title: "Finance & Accounting Intelligence Pack",
    shortDescription: "Validate invoices against POs and receipts with explainable discrepancies.",
    longDescription: "Automate invoice verification against time entries, purchase orders, and contracts. Identify discrepancies in hours, rates, and amounts with AI-powered analysis. Generate audit-ready reconciliation reports with full traceability and evidence-based citations.",
    statusDefault: PackStatus.ENABLED,
    routes: {
      primaryPath: "/reconciliation",
      learnMorePath: "/packs/finance",
    },
    tags: ["Invoice Reconciliation", "Audit", "Time Tracking"],
    icon: "DollarSign",
    disclaimer: "No payment processing. For verification purposes only.",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free with Advanced+ plan (request-based)
    features: [
      {
        name: "Invoice Reconciliation",
        description: "Match invoices against POs and time entries with AI-powered discrepancy detection",
        path: "/reconciliation",
        status: "active",
      },
    ],
  },
  {
    id: PackId.LEGAL,
    title: "Legal Intelligence Pack",
    shortDescription: "Extract clauses, risks, and obligations with source-linked explanations.",
    longDescription: "AI-powered contract analysis with clause identification, risk level assessment, and negotiation point suggestions. Extract obligations, deadlines, and party-specific requirements from legal documents with full source citations.",
    statusDefault: PackStatus.ENABLED,
    routes: {
      primaryPath: "/legal/contracts",
      learnMorePath: "/packs/legal",
    },
    tags: ["Contract Analysis", "Risk Assessment", "Obligations"],
    icon: "Scale",
    disclaimer: "Not legal advice. Consult a qualified attorney.",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free with Advanced+ plan (request-based)
    features: [
      {
        name: "Contract Analysis",
        description: "Extract clauses, risks, obligations, and negotiation points from contracts",
        path: "/legal/contracts",
        status: "active",
      },
    ],
  },
  {
    id: PackId.HR,
    title: "HR Intelligence Pack",
    shortDescription: "Screen hundreds of CVs against your criteria with AI-powered analysis.",
    longDescription: "Bulk CV screening for HR teams. Define must-have requirements, nice-to-have skills, and red flags. Upload CVs and get ranked candidates with evidence-based scoring. Export shortlists to CSV. Decision support tool - does not make automated hiring decisions.",
    statusDefault: PackStatus.ENABLED,
    routes: {
      primaryPath: "/cv-screener",
      learnMorePath: "/packs/hr",
    },
    tags: ["CV Screening", "Recruitment", "Hiring"],
    icon: "Users",
    disclaimer: "Decision support only. Does not make automated hiring decisions.",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free with Advanced+ plan (request-based)
    features: [
      {
        name: "CV Screening",
        description: "Screen CVs against customizable criteria with AI-powered analysis",
        path: "/cv-screener",
        status: "active",
      },
      {
        name: "Candidate Ranking",
        description: "Get ranked shortlists with evidence from CV text",
        path: "/cv-screener",
        status: "active",
      },
    ],
  },
  {
    id: PackId.SALES,
    title: "Sales Intelligence Pack",
    shortDescription: "Analyze proposals, contracts, and leads with AI-powered insights.",
    longDescription: "Streamline your sales workflows with AI-powered document analysis. Extract key terms from proposals and contracts, analyze deal structures, identify negotiation points, and get evidence-based insights for lead qualification and pipeline management.",
    statusDefault: PackStatus.HIDDEN, // Hidden until iOS approval - testing only
    routes: {
      primaryPath: "/sales",
      learnMorePath: "/packs/sales",
    },
    tags: ["Proposals", "Contracts", "Lead Qualification"],
    icon: "TrendingUp",
    disclaimer: "Decision support only. Does not make automated sales decisions.",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free from Scholar onwards
    features: [
      {
        name: "Proposal Analysis",
        description: "Extract key terms, pricing, and commitments from sales proposals",
        path: "/sales/proposals",
        status: "coming_soon",
      },
      {
        name: "Contract Review",
        description: "Analyze sales contracts for terms, obligations, and risks",
        path: "/sales/contracts",
        status: "coming_soon",
      },
    ],
  },
  {
    id: PackId.SERVICE,
    title: "Service Intelligence Pack",
    shortDescription: "Analyze service agreements, SLAs, and customer documentation.",
    longDescription: "AI-powered analysis for service industry documents. Extract SLA terms, service level commitments, and compliance requirements. Analyze customer contracts, service agreements, and support documentation with evidence-based insights.",
    statusDefault: PackStatus.HIDDEN, // Hidden until iOS approval - testing only
    routes: {
      primaryPath: "/service",
      learnMorePath: "/packs/service",
    },
    tags: ["SLAs", "Service Agreements", "Customer Docs"],
    icon: "Headphones",
    disclaimer: "Decision support only. Does not make automated service decisions.",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free from Scholar onwards
    features: [
      {
        name: "SLA Analysis",
        description: "Extract service levels, response times, and compliance terms from SLAs",
        path: "/service/slas",
        status: "coming_soon",
      },
      {
        name: "Agreement Review",
        description: "Analyze service agreements for commitments and obligations",
        path: "/service/agreements",
        status: "coming_soon",
      },
    ],
  },
  {
    id: PackId.PROCUREMENT,
    title: "Procurement Intelligence Pack",
    shortDescription: "Vendor management and purchase order processing automation.",
    longDescription: "Planned domain intelligence built on Evident Core. Supplier evaluation, PO matching, vendor contract analysis, and procurement automation workflows.",
    statusDefault: PackStatus.COMING_SOON,
    routes: {
      primaryPath: "/procurement",
      learnMorePath: "/packs/procurement",
    },
    tags: ["Vendors", "Purchase Orders", "Supply Chain"],
    icon: "ShoppingCart",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free with Advanced+ plan (request-based)
    features: [
      {
        name: "PO Matching",
        description: "Match purchase orders with invoices and receipts",
        path: "/procurement/po-match",
        status: "coming_soon",
      },
    ],
  },
  {
    id: PackId.CONSTRUCTION,
    title: "Construction & Project Docs Pack",
    shortDescription: "Project documentation analysis and change order tracking.",
    longDescription: "Planned domain intelligence built on Evident Core. Construction contract analysis, change order verification, project milestone tracking, and documentation workflows.",
    statusDefault: PackStatus.COMING_SOON,
    routes: {
      primaryPath: "/construction",
      learnMorePath: "/packs/construction",
    },
    tags: ["Construction", "Projects", "Change Orders"],
    icon: "HardHat",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free with Advanced+ plan (request-based)
    features: [
      {
        name: "Change Order Tracking",
        description: "Track and analyze construction change orders",
        path: "/construction/change-orders",
        status: "coming_soon",
      },
    ],
  },
  {
    id: PackId.COMPLIANCE,
    title: "Compliance & Audit Pack",
    shortDescription: "Regulatory compliance checking and audit trail management.",
    longDescription: "Planned domain intelligence built on Evident Core. Policy compliance verification, audit trail analysis, regulatory requirement mapping, and compliance reporting.",
    statusDefault: PackStatus.COMING_SOON,
    routes: {
      primaryPath: "/compliance",
      learnMorePath: "/packs/compliance",
    },
    tags: ["Compliance", "Audit", "Regulations"],
    icon: "Shield",
    pricing: { monthlyPrice: 0, yearlyPrice: 0, isLaunchPromo: true }, // Free with Advanced+ plan (request-based)
    features: [
      {
        name: "Policy Compliance",
        description: "Verify documents against regulatory requirements",
        path: "/compliance/policies",
        status: "coming_soon",
      },
    ],
  },
];

export function getPack(id: PackIdType): PackDefinition | undefined {
  return PACKS.find((p) => p.id === id);
}

export function getPackBySlug(slug: string): PackDefinition | undefined {
  return PACKS.find((p) => p.id === slug);
}

export function enabledByDefault(id: PackIdType): boolean {
  const pack = getPack(id);
  return pack?.statusDefault === PackStatus.ENABLED;
}

export function getEnabledPacks(): PackDefinition[] {
  return PACKS.filter((p) => p.statusDefault === PackStatus.ENABLED);
}

export function getComingSoonPacks(): PackDefinition[] {
  return PACKS.filter((p) => p.statusDefault === PackStatus.COMING_SOON);
}

// Dynamically derive upgrade benefits from pack definitions
// This automatically works for any new packs you add - no manual updates needed
export function getUpgradeBenefitsForDocType(documentType: string, packId?: PackIdType | null): { headline: string; benefits: string[]; isValid: boolean } {
  const defaultBenefits = ["Deep analysis", "Key insights", "Smart extraction"];
  
  // If we have a specific pack, derive benefits from its definition
  if (packId) {
    const pack = getPack(packId);
    if (pack) {
      // Collect benefits from multiple sources
      const benefits: string[] = [];
      
      // 1. Use pack tags first (they're already concise feature names)
      if (pack.tags && pack.tags.length > 0) {
        benefits.push(...pack.tags.slice(0, 3));
      }
      
      // 2. Add feature names if we need more
      if (benefits.length < 3 && pack.features && pack.features.length > 0) {
        const featureNames = pack.features.map(f => f.name);
        for (const name of featureNames) {
          if (benefits.length >= 3) break;
          if (!benefits.includes(name)) benefits.push(name);
        }
      }
      
      // 3. Fall back to defaults if pack has no tags/features
      const finalBenefits = benefits.length > 0 ? benefits : defaultBenefits;
      
      // Clean up the pack title for the headline
      const cleanTitle = pack.title
        .replace(" Intelligence Pack", "")
        .replace(" Pack", "")
        .trim();
      
      return {
        headline: `Unlock ${cleanTitle} Intelligence`,
        benefits: finalBenefits,
        isValid: true,
      };
    }
  }
  
  // Fallback for document types without a matched pack
  // Only create contextual headline if we have a valid document type
  const cleanDocType = (documentType || "").replace(" document", "").trim();
  
  if (cleanDocType && cleanDocType.length > 0) {
    const capitalizedType = cleanDocType.charAt(0).toUpperCase() + cleanDocType.slice(1);
    return {
      headline: `Unlock ${capitalizedType} Intelligence`,
      benefits: defaultBenefits,
      isValid: true,
    };
  }
  
  // No valid pack or document type - return generic but mark as invalid
  return {
    headline: "Upgrade for More Features",
    benefits: defaultBenefits,
    isValid: false,
  };
}

export const packEntitlementsSchema = z.object({
  finance: z.boolean().default(false),
  legal: z.boolean().default(false),
  hr: z.boolean().default(false),
  sales: z.boolean().default(false),
  service: z.boolean().default(false),
  procurement: z.boolean().default(false),
  construction: z.boolean().default(false),
  compliance: z.boolean().default(false),
});

export type PackEntitlements = z.infer<typeof packEntitlementsSchema>;

export const DEFAULT_PACK_ENTITLEMENTS: PackEntitlements = {
  finance: false,
  legal: false,
  hr: false,
  sales: false,
  service: false,
  procurement: false,
  construction: false,
  compliance: false,
};
