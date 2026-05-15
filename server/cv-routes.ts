import { type Express, type Request, type Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { chatWithJsonOutput } from "./openai";
import { getChunksByAssetIdsAsync, getAssetByIdAsync } from "./db";
import { db } from "./auth-db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

const getUserId = (req: Request): string | null => {
  const session = (req as any).session;
  if (session?.userId && session?.authProvider === "email") {
    return session.userId;
  }
  if ((req as any).tokenUserId) {
    return (req as any).tokenUserId;
  }
  const user = req.user as any;
  return user?.claims?.sub || user?.id || null;
};

interface CVSection {
  heading: string;
  content: string;
}

interface GeneratedCV {
  fullName: string;
  contactLine: string;
  professionalSummary: string;
  sections: CVSection[];
  keywords: string[];
  coverLetter: string;
  linkedInSummary: string;
  atsScore: number;
}

interface TailoredCV extends GeneratedCV {
  matchScore: number;
  alignmentNotes: string[];
  addedKeywords: string[];
}

export function registerCVRoutes(app: Express) {

  app.post("/api/cv/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { documentIds, roleType, cvTone, additionalNotes } = req.body;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "At least one document must be selected" });
      }
      if (!roleType) return res.status(400).json({ error: "Role type is required" });
      if (!cvTone) return res.status(400).json({ error: "CV tone is required" });

      const chunks = await getChunksByAssetIdsAsync(documentIds);
      if (chunks.length === 0) {
        return res.status(400).json({ error: "Selected documents have no processed content. Please wait for processing to complete." });
      }

      const docNames: string[] = [];
      for (const docId of documentIds) {
        const asset = await getAssetByIdAsync(docId);
        if (asset) docNames.push(asset.filename);
      }

      const contentPieces = chunks
        .slice(0, 40)
        .map(c => c.text);
      let documentContent = contentPieces.join("\n\n");
      if (documentContent.length > 15000) {
        documentContent = documentContent.substring(0, 15000) + "...";
      }

      const toneDescriptions: Record<string, string> = {
        corporate: "Formal, polished, results-driven language suitable for large corporations and established firms",
        startup: "Dynamic, impact-focused, concise language that highlights adaptability and initiative",
        academic: "Scholarly, research-oriented language emphasising publications, methodologies, and academic achievements",
        government: "Structured, competency-based language aligned with public sector frameworks and selection criteria",
      };

      const toneGuide = toneDescriptions[cvTone] || toneDescriptions.corporate;

      const systemPrompt = `You are an expert CV/resume writer and career coach specialising in graduate applications. Analyse the provided documents (transcripts, certificates, internship records, portfolios, etc.) and produce a complete career application package.

ROLE TYPE: ${roleType}
CV TONE: ${cvTone} — ${toneGuide}
${additionalNotes ? `ADDITIONAL NOTES: ${additionalNotes}` : ""}

Extract all relevant information from the documents and create:

1. **Professional Summary** — A compelling 2-3 sentence summary tailored to the ${roleType} industry. Use power verbs and quantified achievements where possible.

2. **Skills** — Categorised into Technical Skills, Soft Skills, and Industry-Specific Skills. List each category separately with bullet points.

3. **Projects** — Describe each project with: what was built/achieved, technologies/methods used, and measurable impact or outcome. Use the STAR format (Situation, Task, Action, Result) where applicable.

4. **Internship / Work Experience** — For each role, include: company, role title, dates, and 3-4 bullet points highlighting achievements (not just duties). Quantify results wherever possible (e.g. "increased efficiency by 30%").

5. **Education** — Include institution, degree, dates, GPA/grades, relevant coursework, and honours.

6. **Certifications & Awards** — List all professional certifications, academic awards, and recognitions.

7. **Publications & Research** — If academic, include papers, conferences, and research projects.

8. **Extracurricular & Leadership** — Clubs, volunteering, leadership roles, and community involvement.

ALL WORDING MUST BE ATS-OPTIMISED:
- Use standard section headings (no creative names)
- Include role-aligned keywords naturally throughout
- Avoid tables, graphics, or columns (plain text/bullet format)
- Use industry-standard terminology for the ${roleType} sector
- Mirror common job description language for this field

Additionally generate:

9. **Cover Letter** — A professional cover letter (3-4 paragraphs) grounded in the CV content, written in ${cvTone} tone, addressed generically ("Dear Hiring Manager"). It should reference specific achievements from the CV and demonstrate fit for ${roleType} roles.

10. **LinkedIn Summary** — A compelling 150-200 word LinkedIn "About" section that captures the candidate's value proposition, key achievements, and career direction. Written in first person, conversational but professional.

Respond with valid JSON:
{
  "fullName": "extracted or placeholder name",
  "contactLine": "extracted contact details or '[Your Email] | [Your Phone] | [Your LinkedIn]'",
  "professionalSummary": "compelling summary as described above",
  "sections": [
    { "heading": "Skills", "content": "**Technical Skills**\\n- Skill 1\\n...\\n\\n**Soft Skills**\\n- Skill 1\\n..." },
    { "heading": "Projects", "content": "markdown formatted with impact metrics" },
    { "heading": "Experience", "content": "STAR-format achievements" },
    { "heading": "Education", "content": "..." },
    { "heading": "Certifications & Awards", "content": "..." },
    ...additional sections as appropriate
  ],
  "keywords": ["ATS-optimised", "role-aligned", "industry", "keywords"],
  "coverLetter": "Full cover letter text with paragraphs separated by \\n\\n",
  "linkedInSummary": "First-person LinkedIn About section",
  "atsScore": 85
}

The atsScore should be your estimate (0-100) of how well this CV would pass through common ATS systems for ${roleType} positions.`;

      const userPrompt = `Source documents: ${docNames.join(", ")}

DOCUMENT CONTENT:
${documentContent}

Generate a professional ${roleType} CV in ${cvTone} tone based on this material.`;

      const result = await chatWithJsonOutput<GeneratedCV>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          type: "object",
          properties: {
            fullName: { type: "string" },
            contactLine: { type: "string" },
            professionalSummary: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
            keywords: { type: "array", items: { type: "string" } },
            coverLetter: { type: "string" },
            linkedInSummary: { type: "string" },
            atsScore: { type: "number" },
          },
        }
      );

      res.json({
        success: true,
        cv: result,
        documentCount: documentIds.length,
        roleType,
        cvTone,
      });
    } catch (error: any) {
      console.error("[CV] Generation error:", error);
      res.status(500).json({ error: "Failed to generate CV. Please try again." });
    }
  });

  app.post("/api/cv/tailor", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { cv, jobDescription, jobDocumentIds } = req.body;

      if (!cv) return res.status(400).json({ error: "Base CV is required" });

      let jobContent = jobDescription || "";

      if (jobDocumentIds && Array.isArray(jobDocumentIds) && jobDocumentIds.length > 0) {
        const chunks = await getChunksByAssetIdsAsync(jobDocumentIds);
        const jobDocContent = chunks.map(c => c.text).join("\n\n");
        if (jobDocContent.length > 5000) {
          jobContent += "\n\n" + jobDocContent.substring(0, 5000);
        } else {
          jobContent += "\n\n" + jobDocContent;
        }
      }

      if (!jobContent.trim()) {
        return res.status(400).json({ error: "Job description text or document is required" });
      }

      const systemPrompt = `You are an expert CV tailoring assistant. Given a base CV and a job description, optimise the CV to better match the specific job requirements.

Tasks:
1. Rewrite the professional summary to directly address the target role
2. Reorder and emphasise relevant experience and skills that match the job
3. Incorporate missing keywords from the job description naturally into all sections
4. Adjust bullet points to highlight transferable achievements using the job's language
5. Rewrite the cover letter to specifically address this job posting
6. Update the LinkedIn summary to reflect the target role
7. Recalculate the ATS score based on keyword alignment with the job description
8. Provide a match score (0-100) and detailed alignment notes

Keep all factual content accurate — only restructure, reword, and emphasise.

Respond with valid JSON:
{
  "fullName": "same as original",
  "contactLine": "same as original",
  "professionalSummary": "rewritten to align with job",
  "sections": [{ "heading": "...", "content": "..." }, ...],
  "keywords": ["updated", "keyword", "list"],
  "coverLetter": "tailored cover letter for this specific job",
  "linkedInSummary": "updated LinkedIn summary",
  "atsScore": 90,
  "matchScore": 85,
  "alignmentNotes": ["Added emphasis on X", "Reordered Y section", ...],
  "addedKeywords": ["keywords", "added", "from", "job", "description"]
}`;

      const userPrompt = `BASE CV:
Name: ${cv.fullName}
Summary: ${cv.professionalSummary}
${cv.sections.map((s: CVSection) => `## ${s.heading}\n${s.content}`).join("\n\n")}

COVER LETTER:
${cv.coverLetter || "Not yet generated"}

LINKEDIN SUMMARY:
${cv.linkedInSummary || "Not yet generated"}

JOB DESCRIPTION:
${jobContent}

Tailor the entire application package (CV, cover letter, and LinkedIn summary) for this specific job.`;

      const result = await chatWithJsonOutput<TailoredCV>(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          type: "object",
          properties: {
            fullName: { type: "string" },
            contactLine: { type: "string" },
            professionalSummary: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string" },
                  content: { type: "string" },
                },
              },
            },
            keywords: { type: "array", items: { type: "string" } },
            coverLetter: { type: "string" },
            linkedInSummary: { type: "string" },
            atsScore: { type: "number" },
            matchScore: { type: "number" },
            alignmentNotes: { type: "array", items: { type: "string" } },
            addedKeywords: { type: "array", items: { type: "string" } },
          },
        }
      );

      res.json({
        success: true,
        cv: result,
      });
    } catch (error: any) {
      console.error("[CV] Tailor error:", error);
      res.status(500).json({ error: "Failed to tailor CV. Please try again." });
    }
  });

  app.post("/api/cv/email", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Not authenticated" });

      const { cv, recipientEmail } = req.body;
      if (!cv) return res.status(400).json({ error: "CV data is required" });

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const email = recipientEmail || user?.email;
      if (!email) return res.status(400).json({ error: "No email address available" });

      let cvText = `${cv.fullName}\n${cv.contactLine}\n\n`;
      cvText += `PROFESSIONAL SUMMARY\n${cv.professionalSummary}\n\n`;
      for (const section of cv.sections || []) {
        cvText += `${section.heading.toUpperCase()}\n${section.content}\n\n`;
      }
      if (cv.coverLetter) {
        cvText += `---\n\nCOVER LETTER\n\n${cv.coverLetter}\n\n`;
      }
      if (cv.linkedInSummary) {
        cvText += `---\n\nLINKEDIN SUMMARY\n\n${cv.linkedInSummary}\n\n`;
      }

      let cvHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin: 0; font-size: 14px;">Evident</h1>
    <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0;">Graduate CV Builder</p>
  </div>
  <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="text-align: center; margin-top: 0; font-size: 22px;">${escapeHtml(cv.fullName)}</h1>
    <p style="text-align: center; color: #64748b; font-size: 13px;">${escapeHtml(cv.contactLine)}</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
    <h2 style="color: #0d9488; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Professional Summary</h2>
    <p style="font-size: 14px;">${escapeHtml(cv.professionalSummary)}</p>
    ${(cv.sections || []).map((s: CVSection) => `
      <h2 style="color: #0d9488; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-top: 24px;">${escapeHtml(s.heading)}</h2>
      <div style="font-size: 14px; white-space: pre-line;">${escapeHtml(s.content)}</div>
    `).join("")}
  </div>
  ${cv.coverLetter ? `
  <div style="background: #f0fdf4; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #0d9488; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">Cover Letter</h2>
    <div style="font-size: 14px; white-space: pre-line;">${escapeHtml(cv.coverLetter)}</div>
  </div>` : ""}
  ${cv.linkedInSummary ? `
  <div style="background: #eff6ff; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h2 style="color: #2563eb; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">LinkedIn Summary</h2>
    <div style="font-size: 14px; white-space: pre-line;">${escapeHtml(cv.linkedInSummary)}</div>
  </div>` : ""}
  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px;">
    <p>Generated by Evident CV Builder</p>
  </div>
</body>
</html>`;

      const { getResendClientForAlerts } = await import("./email-service");
      const { client, fromEmail } = await getResendClientForAlerts();

      const { data, error } = await client.emails.send({
        from: fromEmail || "Evident <onboarding@resend.dev>",
        replyTo: "mosesekbote@yahoo.com",
        to: email,
        subject: `Your CV — ${cv.fullName} | Evident CV Builder`,
        html: cvHtml,
        text: cvText,
      });

      if (error) {
        console.error("[CV] Email send error:", error);
        return res.status(500).json({ error: "Failed to send email" });
      }

      console.log(`[CV] CV emailed to ${email}, id: ${data?.id}`);
      res.json({ success: true, sentTo: email });
    } catch (error: any) {
      console.error("[CV] Email error:", error);
      res.status(500).json({ error: "Failed to send CV email. Please try again." });
    }
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
