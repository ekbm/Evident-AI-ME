export const TRUSTED_SOURCES_CONFIG = {
  allowedDomains: [
    "gov",
    "edu",
    "org",
    "wikipedia.org",
    "britannica.com",
    "scholar.google.com",
    "arxiv.org",
    "pubmed.ncbi.nlm.nih.gov",
    "nih.gov",
    "cdc.gov",
    "who.int",
    "un.org",
    "europa.eu",
    "iso.org",
    "ieee.org",
    "acm.org",
    "nature.com",
    "sciencedirect.com",
    "springer.com",
    "wiley.com",
    "jstor.org",
    "researchgate.net",
    "investopedia.com",
    "law.cornell.edu",
    "findlaw.com",
    "justia.com",
    "nist.gov",
    "osha.gov",
    "epa.gov",
    "sec.gov",
    "ftc.gov",
    "fda.gov",
    "bls.gov",
    "census.gov",
    "treasury.gov",
    "federalreserve.gov",
    "canada.ca",
    "gov.uk",
    "legislation.gov.uk",
    "austlii.edu.au",
    "merriam-webster.com",
    "dictionary.com",
    "microsoft.com/docs",
    "developer.mozilla.org",
    "docs.google.com",
    "support.apple.com",
    "aws.amazon.com/documentation",
  ],
  blockedDomains: [
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "tiktok.com",
    "reddit.com",
    "pinterest.com",
    "linkedin.com",
    "quora.com",
    "yahoo.answers",
    "answers.com",
  ],
  maxSources: 5,
  recencyDays: 365,
  cacheMinutes: 2, // Reduced from 10 to ensure fresh external sources
};

export type ExternalSearchPolicy = "ASK" | "ALLOW" | "BLOCK";

export interface Citation {
  id: number;
  title: string;
  url: string;
  publisher: string;
  snippet: string;
  domain: string;
}

export interface EnrichmentResult {
  externalSummary: string;
  citations: Citation[];
  eli5Summary?: string;
  safetyNotes?: string[];
  images?: PexelsImage[];
}

export interface PexelsImage {
  id: number;
  url: string;
  photographer: string;
  photographerUrl: string;
  src: {
    medium: string;
    small: string;
    landscape: string;
  };
  alt: string;
}
