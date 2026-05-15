import { db } from "./auth-db";
import { featureRequests } from "@shared/models/auth";
import { eq } from "drizzle-orm";

const INITIAL_FEATURES = [
  {
    title: "Upload Through User Request",
    description: "Allow users to request document uploads from other team members or external parties directly through the platform.",
    category: "collaboration",
    priority: 1,
  },
  {
    title: "Text-to-Speech for AI Responses",
    description: "Enable voice playback of AI responses for a hands-free, conversational experience on mobile devices. The speaker icon would read answers aloud using natural-sounding AI voices.",
    category: "mobile",
    priority: 2,
  },
  {
    title: "Advanced Contract Analysis",
    description: "AI-powered contract review with clause extraction, risk identification, obligation tracking, and compliance checking.",
    category: "analysis",
    priority: 3,
  },
  {
    title: "Invoice Reconciliation Pack",
    description: "Automated invoice matching and reconciliation tools to compare invoices against purchase orders and receipts.",
    category: "analysis",
    priority: 4,
  },
  {
    title: "Binding Agreement Analysis",
    description: "Deep analysis of binding agreements including term extraction, party identification, and commitment tracking.",
    category: "analysis",
    priority: 5,
  },
  {
    title: "Anki Flashcard Support",
    description: "Import and process Anki (.apkg) flashcard decks to make study content searchable and answerable. Perfect for medical, law, and language students.",
    category: "file-types",
    priority: 6,
  },
  {
    title: "Document Translation",
    description: "Translate documents to any language while preserving formatting and context",
    category: "analysis",
    priority: 10,
  },
];

export async function seedFeatureRequests(): Promise<void> {
  console.log("[Seed] Seeding feature requests...");
  
  // Check if features already exist
  const existingFeatures = await db.select().from(featureRequests).limit(1);
  
  if (existingFeatures.length > 0) {
    console.log("[Seed] Feature requests already seeded, skipping...");
    return;
  }
  
  // Insert initial features
  for (const feature of INITIAL_FEATURES) {
    await db.insert(featureRequests).values({
      title: feature.title,
      description: feature.description,
      category: feature.category,
      status: "upcoming",
      priority: feature.priority,
      voteCount: 0,
    });
  }
  
  console.log(`[Seed] Seeded ${INITIAL_FEATURES.length} feature requests`);
}
