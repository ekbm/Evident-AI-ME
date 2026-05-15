import { createAssetAsync, createChunkAsync, updateChunkEmbeddingAsync, updateAssetStatusAsync, getAssetsByOwnerIdAsync } from "./db";
import { createEmbedding } from "./openai";
import { db as pgDb } from "./db";
import { pgAssets } from "@shared/models/auth";
import { and, eq, sql as drizzleSql } from "drizzle-orm";

export type OnboardingSample = {
  key: string;
  filename: string;
  mime: string;
  chunks: string[];
  suggestedQuestions: string[];
};

export const ONBOARDING_SAMPLES: OnboardingSample[] = [
  {
    key: "sample-lecture-photosynthesis",
    filename: "Sample Lecture — Photosynthesis.txt",
    mime: "text/plain",
    chunks: [
      "Lecture: Introduction to Photosynthesis. Photosynthesis is the biochemical process by which green plants, algae, and certain bacteria convert light energy from the sun into chemical energy stored in glucose. The overall reaction can be summarised as: 6 CO2 + 6 H2O + light energy → C6H12O6 + 6 O2. The process takes place primarily in the chloroplasts of plant cells, where the green pigment chlorophyll absorbs light most strongly in the blue (around 430 nm) and red (around 660 nm) regions of the visible spectrum, reflecting green light, which is why leaves appear green.",
      "Photosynthesis occurs in two linked stages. The first is the light-dependent reactions, which take place in the thylakoid membranes of the chloroplast. Here, light energy splits water molecules (photolysis), releasing oxygen as a by-product and producing the energy carriers ATP and NADPH. The second stage is the Calvin cycle (light-independent reactions) in the stroma. ATP and NADPH from stage one drive the fixation of carbon dioxide into a three-carbon sugar (G3P), which is then used to build glucose and other carbohydrates.",
      "Several factors limit the rate of photosynthesis: light intensity, carbon dioxide concentration, temperature, and water availability. At low light, the rate increases linearly with light intensity until a saturation point is reached. Temperature affects the enzymes of the Calvin cycle — most plants peak between 25 °C and 35 °C and slow sharply above 40 °C as enzymes denature. Photosynthesis is the foundation of nearly all food chains on Earth and is responsible for the oxygen in our atmosphere.",
    ],
    suggestedQuestions: [
      "Summarise this lecture in 5 bullet points",
      "What factors limit the rate of photosynthesis?",
      "Make me 3 exam-style questions on the Calvin cycle",
    ],
  },
  {
    key: "sample-policy-remote-work",
    filename: "Sample Policy — Remote Work.txt",
    mime: "text/plain",
    chunks: [
      "Acme Corp Remote Work Policy (effective 1 January 2025). Section 1 — Eligibility. All full-time employees who have completed at least 90 days of continuous service are eligible to request remote work. Roles that require physical presence (warehouse, lab, reception) are excluded. Section 2 — Working hours. Remote employees are expected to be available during core business hours of 10:00 to 15:00 in their local time zone. Total weekly working hours must equal 40, and timesheets are submitted every Friday by 17:00.",
      "Section 3 — Equipment and security. The Company provides one laptop, one external monitor and a headset to each remote employee. All Company devices must run the approved endpoint security agent and full-disk encryption. Personal devices may not be used to access customer data. Employees must not store confidential documents on local drives; all work must be saved to approved cloud storage. Lost or stolen equipment must be reported to IT within 24 hours.",
      "Section 4 — Expenses and obligations. The Company will reimburse up to USD 75 per month for home internet and a one-off USD 300 stipend for ergonomic furniture. Employees are obligated to maintain a confidential, ergonomic workspace and to attend any in-person meeting requested with at least 7 days notice. Failure to comply with this policy may result in revocation of remote work privileges and, in serious cases, disciplinary action up to and including termination of employment.",
    ],
    suggestedQuestions: [
      "List every obligation in this policy as a checklist",
      "What are the eligibility requirements for remote work?",
      "How much can I claim for home internet and equipment?",
    ],
  },
  {
    key: "sample-cv-jane-doe",
    filename: "Sample CV — Jane Doe.txt",
    mime: "text/plain",
    chunks: [
      "Jane Doe — Software Engineer. Email: jane.doe@example.com. Location: London, UK. Summary: Software engineer with 5 years of experience building scalable web applications in TypeScript, Node.js and React. Strong background in cloud infrastructure (AWS, GCP), CI/CD and database design (PostgreSQL, Redis). Comfortable owning features end-to-end and mentoring junior engineers.",
      "Experience. Senior Software Engineer, Bright Labs, London (Jan 2023 – present). Led the migration of a monolithic Node.js API to a modular service-oriented architecture, reducing p95 latency by 38%. Designed the company's first vector search pipeline using PostgreSQL pgvector. Mentored 3 junior engineers. Software Engineer, FinTechCo, Remote (Mar 2020 – Dec 2022). Built customer-facing dashboards in React and TypeScript serving 80k monthly active users. Owned the payments integration with Stripe (~£12M annual volume).",
      "Education. BSc Computer Science, University of Manchester (2016 – 2019), First Class Honours. Skills: TypeScript, JavaScript, Node.js, React, Next.js, PostgreSQL, Redis, AWS, GCP, Docker, Kubernetes, Terraform, GitHub Actions. Certifications: AWS Solutions Architect Associate (2023). Languages: English (native), Spanish (conversational).",
    ],
    suggestedQuestions: [
      "Tailor this CV for a senior backend role at a fintech startup",
      "What are this candidate's strongest skills?",
      "Suggest 3 improvements to make this CV stand out",
    ],
  },
];

export type LoadedSample = {
  assetId: string;
  filename: string;
  suggestedQuestions: string[];
};

export async function loadOnboardingSamplesForUser(userId: string): Promise<LoadedSample[]> {
  const loaded: LoadedSample[] = [];

  const existing = await getAssetsByOwnerIdAsync(userId);
  const existingKeys = new Set(existing.map((a) => a.filename));

  for (const sample of ONBOARDING_SAMPLES) {
    if (existingKeys.has(sample.filename)) {
      const found = existing.find((a) => a.filename === sample.filename);
      if (found) {
        loaded.push({
          assetId: found.id,
          filename: found.filename,
          suggestedQuestions: sample.suggestedQuestions,
        });
      }
      continue;
    }

    const totalBytes = sample.chunks.reduce((n, c) => n + Buffer.byteLength(c, "utf8"), 0);

    const asset = await createAssetAsync({
      filename: sample.filename,
      mime: sample.mime,
      sizeBytes: totalBytes,
      status: "READY",
    });

    await pgDb
      .update(pgAssets)
      .set({ ownerId: userId, source: "upload" as any })
      .where(eq(pgAssets.id, asset.id));

    let allEmbedded = true;
    for (let i = 0; i < sample.chunks.length; i++) {
      const text = sample.chunks[i];
      const chunk = await createChunkAsync({
        assetId: asset.id,
        artifactId: null as any,
        sourceRef: `${sample.filename}:p${i + 1}`,
        text,
      });
      try {
        const emb = await createEmbedding(text);
        await updateChunkEmbeddingAsync(chunk.id, JSON.stringify(emb));
      } catch (e) {
        console.error("[OnboardingSamples] embedding failed:", e);
        allEmbedded = false;
      }
    }

    if (!allEmbedded) {
      // Don't expose a partially-indexed sample — RAG would silently miss content.
      await updateAssetStatusAsync(asset.id, "ERROR", "Sample embedding failed");
      continue;
    }

    try {
      await pgDb
        .update(pgAssets)
        .set({ extractionState: "complete" as any, progressPercent: 100, extractedTextBytes: totalBytes })
        .where(eq(pgAssets.id, asset.id));
    } catch {}

    await updateAssetStatusAsync(asset.id, "READY");

    loaded.push({
      assetId: asset.id,
      filename: sample.filename,
      suggestedQuestions: sample.suggestedQuestions,
    });
  }

  return loaded;
}
