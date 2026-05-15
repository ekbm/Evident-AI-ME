import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from "docx";
import pptxgen from "pptxgenjs";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";
import type { ProposalSettings, PptSettings } from "@shared/action-engine";

const EXPORTS_DIR = "uploads/exports";

if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

interface ExportRecord {
  id: string;
  path: string;
  mime: string;
  fileName: string;
  createdAt: Date;
}

const exportsRegistry: Map<string, ExportRecord> = new Map();

export function cleanupOldExports() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;

  const entries = Array.from(exportsRegistry.entries());
  for (let i = 0; i < entries.length; i++) {
    const [id, record] = entries[i];
    if (now - record.createdAt.getTime() > maxAge) {
      try {
        if (fs.existsSync(record.path)) {
          fs.unlinkSync(record.path);
        }
        exportsRegistry.delete(id);
      } catch (err) {
        console.error(`Failed to cleanup export ${id}:`, err);
      }
    }
  }
}

setInterval(cleanupOldExports, 60 * 60 * 1000);

interface Citation {
  title: string;
  sourceRef: string;
  snippet?: string;
}

export async function generateProposal(
  questionText: string,
  answerText: string,
  settings: ProposalSettings,
  citations?: Citation[]
): Promise<{ downloadUrl: string; fileName: string; id: string }> {
  const id = uuidv4();
  const fileName = `proposal_${id.slice(0, 8)}.docx`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  const templateTitles: Record<string, string> = {
    sales_proposal: "Sales Proposal",
    sow: "Statement of Work",
    one_page: "Executive Brief",
  };

  const title = templateTitles[settings.template] || "Proposal";
  const projectName = settings.projectName || "Project Proposal";
  const clientName = settings.clientName || "Client";

  const children: any[] = [];

  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  children.push(
    new Paragraph({
      text: projectName,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  if (settings.clientName) {
    children.push(
      new Paragraph({
        text: `Prepared for: ${clientName}`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  children.push(
    new Paragraph({
      text: `Date: ${new Date().toLocaleDateString()}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  children.push(
    new Paragraph({
      text: "Executive Summary",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  const paragraphs = answerText.split(/\n\n+/);
  for (const para of paragraphs.slice(0, settings.length === "short" ? 2 : settings.length === "detailed" ? undefined : 4)) {
    if (para.trim()) {
      children.push(
        new Paragraph({
          text: para.trim(),
          spacing: { after: 200 },
        })
      );
    }
  }

  children.push(
    new Paragraph({
      text: "Context & Background",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      text: `This proposal addresses the following query: "${questionText}"`,
      spacing: { after: 200 },
    })
  );

  if (settings.includePricing) {
    children.push(
      new Paragraph({
        text: "Pricing",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    children.push(
      new Paragraph({
        text: "[Pricing details to be added]",
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: "[Pricing details to be added]",
            italics: true,
            color: "666666",
          }),
        ],
      })
    );
  }

  if (settings.includeTimeline) {
    children.push(
      new Paragraph({
        text: "Timeline",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "[Timeline to be added]",
            italics: true,
            color: "666666",
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  if (settings.includeRisks) {
    children.push(
      new Paragraph({
        text: "Risks & Assumptions",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "[Risks and assumptions to be documented]",
            italics: true,
            color: "666666",
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  if (settings.includeReferences && citations && citations.length > 0) {
    children.push(
      new Paragraph({
        text: "References",
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const citation of citations) {
      children.push(
        new Paragraph({
          text: `• ${citation.title} (${citation.sourceRef})`,
          spacing: { after: 100 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);

  exportsRegistry.set(id, {
    id,
    path: filePath,
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileName,
    createdAt: new Date(),
  });

  return {
    downloadUrl: `/api/exports/download/${id}`,
    fileName,
    id,
  };
}

export async function generatePpt(
  questionText: string,
  answerText: string,
  settings: PptSettings,
  citations?: Citation[]
): Promise<{ downloadUrl: string; fileName: string; id: string }> {
  const id = uuidv4();
  const fileName = `presentation_${id.slice(0, 8)}.pptx`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  const pptx = new pptxgen();
  
  pptx.author = "Evident AI";
  pptx.title = questionText.slice(0, 50);
  pptx.subject = "AI-Generated Presentation";

  const templateSlides: Record<string, number> = {
    executive_brief: 5,
    sales_pitch: 10,
    problem_solution_value: 8,
  };

  const maxSlides = templateSlides[settings.template] || 5;

  const primaryColor = "003366";
  const accentColor = "0066CC";

  const titleSlide = pptx.addSlide();
  titleSlide.addText(questionText.slice(0, 100), {
    x: 0.5,
    y: 2,
    w: 9,
    h: 1.5,
    fontSize: 32,
    bold: true,
    color: primaryColor,
    align: "center",
    valign: "middle",
  });
  titleSlide.addText(`Generated by Evident AI\n${new Date().toLocaleDateString()}`, {
    x: 0.5,
    y: 4,
    w: 9,
    h: 0.5,
    fontSize: 14,
    color: "666666",
    align: "center",
  });

  if (settings.includeAgenda) {
    const agendaSlide = pptx.addSlide();
    agendaSlide.addText("Agenda", {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 0.8,
      fontSize: 28,
      bold: true,
      color: primaryColor,
    });
    
    const agendaItems = [
      "Overview",
      "Key Findings",
      "Analysis",
      settings.includeSources ? "Evidence & Sources" : null,
      settings.includeNextSteps ? "Next Steps" : null,
    ].filter(Boolean);

    agendaSlide.addText(
      agendaItems.map((item, i) => ({ text: `${i + 1}. ${item}\n`, options: { bullet: false } })),
      {
        x: 1,
        y: 1.5,
        w: 8,
        h: 3,
        fontSize: 18,
        color: "333333",
        paraSpaceAfter: 12,
      }
    );
  }

  const paragraphs = answerText.split(/\n\n+/).filter(p => p.trim());
  const contentPerSlide = Math.ceil(paragraphs.length / (maxSlides - 2));

  const sectionTitles = ["Overview", "Key Insights", "Analysis", "Details", "Summary"];
  
  for (let i = 0; i < Math.min(paragraphs.length, maxSlides - 2); i++) {
    const contentSlide = pptx.addSlide();
    const sectionTitle = sectionTitles[i % sectionTitles.length];
    
    contentSlide.addText(sectionTitle, {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: primaryColor,
    });

    const content = paragraphs.slice(i * contentPerSlide, (i + 1) * contentPerSlide).join("\n\n");
    contentSlide.addText(content.slice(0, 800), {
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 4,
      fontSize: 14,
      color: "333333",
      valign: "top",
    });
  }

  if (settings.includeSources && citations && citations.length > 0) {
    const sourcesSlide = pptx.addSlide();
    sourcesSlide.addText("Sources & Evidence", {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: primaryColor,
    });

    const sourceText = citations.slice(0, 6).map(c => `• ${c.title}`).join("\n");
    sourcesSlide.addText(sourceText, {
      x: 0.5,
      y: 1.2,
      w: 9,
      h: 3.5,
      fontSize: 14,
      color: "333333",
    });
  }

  if (settings.includeNextSteps) {
    const nextStepsSlide = pptx.addSlide();
    nextStepsSlide.addText("Next Steps", {
      x: 0.5,
      y: 0.3,
      w: 9,
      h: 0.6,
      fontSize: 24,
      bold: true,
      color: primaryColor,
    });
    nextStepsSlide.addText(
      "1. Review findings with stakeholders\n2. Identify priority actions\n3. Develop implementation plan\n4. Schedule follow-up review",
      {
        x: 0.5,
        y: 1.2,
        w: 9,
        h: 3,
        fontSize: 16,
        color: "333333",
        paraSpaceAfter: 12,
      }
    );
  }

  const thankYouSlide = pptx.addSlide();
  thankYouSlide.addText("Thank You", {
    x: 0.5,
    y: 2.2,
    w: 9,
    h: 1,
    fontSize: 36,
    bold: true,
    color: primaryColor,
    align: "center",
  });
  thankYouSlide.addText("Generated with Evident AI", {
    x: 0.5,
    y: 3.5,
    w: 9,
    h: 0.5,
    fontSize: 14,
    color: "999999",
    align: "center",
  });

  await pptx.writeFile({ fileName: filePath });

  exportsRegistry.set(id, {
    id,
    path: filePath,
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    fileName,
    createdAt: new Date(),
  });

  return {
    downloadUrl: `/api/exports/download/${id}`,
    fileName,
    id,
  };
}

export function getExportById(id: string): ExportRecord | undefined {
  return exportsRegistry.get(id);
}
