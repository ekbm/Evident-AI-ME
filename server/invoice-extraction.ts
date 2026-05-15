import OpenAI from "openai";
import { 
  createInvoiceDocument, 
  updateInvoiceDocument, 
  createInvoiceLineItemsBulk,
  getInvoiceLineItemsByInvoice
} from "./db";
import type { InvoiceDocument, InvoiceLineItem } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || process.env.EVIDENT_OPENAI_API });

interface ExtractedInvoiceData {
  vendorName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  totalAmount: number | null;
  currency: string;
  lineItems: Array<{
    description: string;
    projectName: string | null;
    quantity: number;
    unitType: string;
    rate: number | null;
    amount: number;
    dateFrom: string | null;
    dateTo: string | null;
  }>;
}

const INVOICE_EXTRACTION_PROMPT = `You are an expert invoice parser. Analyze the provided invoice text and extract structured data.

Extract the following information:
1. Vendor/Company name (who issued the invoice)
2. Invoice number
3. Invoice date (in ISO format YYYY-MM-DD)
4. Due date (in ISO format YYYY-MM-DD if present)
5. Total amount (as a number, no currency symbols)
6. Currency (USD, EUR, GBP, etc.)
7. Line items - for each item extract:
   - Description (what service or product)
   - Project name (if mentioned, look for project, client, or matter references)
   - Quantity (number of hours, units, etc.)
   - Unit type (hours, days, units, items)
   - Rate (per unit price if shown)
   - Amount (total for this line)
   - Date from/to (service period if mentioned, in ISO format)

Return a JSON object with this structure:
{
  "vendorName": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "currency": "USD",
  "lineItems": [
    {
      "description": "string",
      "projectName": "string or null",
      "quantity": number,
      "unitType": "hours|days|units|items",
      "rate": number or null,
      "amount": number,
      "dateFrom": "YYYY-MM-DD or null",
      "dateTo": "YYYY-MM-DD or null"
    }
  ]
}

Important:
- If a value is not found, use null
- Convert all amounts to numbers (remove $ , symbols)
- Infer project names from context if not explicitly stated
- Look for time periods in line item descriptions`;

export async function extractInvoiceFromText(
  userId: string,
  filename: string,
  assetId: string | null,
  documentText: string
): Promise<{ invoice: InvoiceDocument; lineItems: InvoiceLineItem[] }> {
  const invoiceDoc = createInvoiceDocument({
    userId,
    assetId,
    filename,
    vendorName: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    totalAmount: null,
    currency: "USD",
    status: "EXTRACTING",
    errorMessage: null,
    rawExtractedData: null,
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: INVOICE_EXTRACTION_PROMPT },
        { role: "user", content: `Please extract invoice data from the following document:\n\n${documentText}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const extracted: ExtractedInvoiceData = JSON.parse(content);

    updateInvoiceDocument(invoiceDoc.id, {
      vendorName: extracted.vendorName,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      dueDate: extracted.dueDate,
      totalAmount: extracted.totalAmount,
      currency: extracted.currency || "USD",
      status: "EXTRACTED",
      rawExtractedData: content,
    });

    const lineItems = createInvoiceLineItemsBulk(
      extracted.lineItems.map((item) => ({
        invoiceId: invoiceDoc.id,
        description: item.description,
        projectName: item.projectName,
        quantity: item.quantity,
        unitType: item.unitType || "hours",
        rate: item.rate,
        amount: item.amount,
        dateFrom: item.dateFrom,
        dateTo: item.dateTo,
      }))
    );

    const updatedInvoice = {
      ...invoiceDoc,
      vendorName: extracted.vendorName,
      invoiceNumber: extracted.invoiceNumber,
      invoiceDate: extracted.invoiceDate,
      dueDate: extracted.dueDate,
      totalAmount: extracted.totalAmount,
      currency: extracted.currency || "USD",
      status: "EXTRACTED" as const,
      rawExtractedData: content,
    };

    return { invoice: updatedInvoice, lineItems };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown extraction error";
    updateInvoiceDocument(invoiceDoc.id, {
      status: "ERROR",
      errorMessage,
    });
    throw error;
  }
}

export async function getInvoiceWithLineItems(invoiceId: string): Promise<{ invoice: InvoiceDocument; lineItems: InvoiceLineItem[] } | null> {
  const { getInvoiceDocumentById } = await import("./db");
  const invoice = getInvoiceDocumentById(invoiceId);
  if (!invoice) return null;
  
  const lineItems = getInvoiceLineItemsByInvoice(invoiceId);
  return { invoice, lineItems };
}

interface PyMuPDFExtractedData {
  docType: string;
  fields: {
    vendorName?: string;
    invoiceNumber?: string;
    poReference?: string;
    invoiceDate?: string;
    dueDate?: string;
    totalAmount?: number;
    taxAmount?: number;
    currency?: string;
  };
  lineItems: Array<{
    description?: string;
    quantity?: number;
    unitPrice?: number;
    amount?: number;
  }>;
  rawText: string;
  anchors: Record<string, { page: number; bbox: number[] }>;
  meta: {
    isScannedLikely: boolean;
    pages: number;
    tableCount: number;
    blockCount: number;
    code?: string;
    message?: string;
  };
}

export async function extractInvoiceFromPyMuPDF(
  userId: string,
  filename: string,
  extractedData: PyMuPDFExtractedData
): Promise<{ invoice: InvoiceDocument; lineItems: InvoiceLineItem[] }> {
  const invoiceDoc = createInvoiceDocument({
    userId,
    assetId: null,
    filename,
    vendorName: extractedData.fields.vendorName || null,
    invoiceNumber: extractedData.fields.invoiceNumber || null,
    invoiceDate: extractedData.fields.invoiceDate || null,
    dueDate: extractedData.fields.dueDate || null,
    totalAmount: extractedData.fields.totalAmount || null,
    currency: extractedData.fields.currency || "USD",
    status: "EXTRACTED",
    errorMessage: null,
    rawExtractedData: JSON.stringify({
      fields: extractedData.fields,
      anchors: extractedData.anchors,
      meta: extractedData.meta,
    }),
  });

  const lineItems: InvoiceLineItem[] = [];

  if (extractedData.lineItems && extractedData.lineItems.length > 0) {
    const lineItemsToCreate = extractedData.lineItems.map((item, idx) => ({
      invoiceId: invoiceDoc.id,
      description: item.description || `Line item ${idx + 1}`,
      projectName: null,
      quantity: item.quantity || 1,
      unitType: "hours" as const,
      rate: item.unitPrice || null,
      amount: item.amount || 0,
      dateFrom: null,
      dateTo: null,
    }));

    const createdItems = createInvoiceLineItemsBulk(lineItemsToCreate);
    lineItems.push(...createdItems);
  }

  return { invoice: invoiceDoc, lineItems };
}
