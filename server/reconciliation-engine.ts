import {
  createReconciliationRun,
  updateReconciliationRun,
  createReconciliationMatch,
  createReconciliationDiscrepancy,
  getReconciliationRunById,
  getReconciliationMatchesByRun,
  getReconciliationDiscrepanciesByRun,
  getInvoiceLineItemsByInvoice,
  getTimeEntriesByUser,
  getInvoiceDocumentById,
  getInvoiceLineItemById,
  getTimeEntryById,
} from "./db";
import type {
  ReconciliationRun,
  ReconciliationMatch,
  ReconciliationDiscrepancy,
  InvoiceLineItem,
  TimeEntry,
  ReconciliationResult,
} from "@shared/schema";

interface ReconciliationOptions {
  hoursTolerance: number;
  rateTolerance: number;
  dateFrom?: string;
  dateTo?: string;
}

interface MatchCandidate {
  invoiceLine: InvoiceLineItem;
  timeEntry: TimeEntry;
  confidence: number;
  hoursMatch: boolean;
  rateMatch: boolean;
  projectMatch: boolean;
}

export async function runReconciliation(
  userId: string,
  invoiceId: string,
  options: ReconciliationOptions = { hoursTolerance: 0.25, rateTolerance: 0 }
): Promise<ReconciliationResult> {
  const invoice = getInvoiceDocumentById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const run = createReconciliationRun({
    userId,
    invoiceId,
    status: "RUNNING",
    matchedCount: 0,
    discrepancyCount: 0,
    totalInvoiceAmount: invoice.totalAmount,
    totalMatchedAmount: null,
    totalDiscrepancyAmount: null,
    errorMessage: null,
    completedAt: null,
  });

  try {
    const invoiceLines = getInvoiceLineItemsByInvoice(invoiceId);
    const timeEntries = getTimeEntriesByUser(userId, options.dateFrom, options.dateTo);

    const matches: ReconciliationMatch[] = [];
    const discrepancies: ReconciliationDiscrepancy[] = [];
    const matchedTimeEntryIds = new Set<string>();
    const matchedInvoiceLineIds = new Set<string>();

    for (const invoiceLine of invoiceLines) {
      const candidates = findMatchCandidates(invoiceLine, timeEntries, options);
      
      if (candidates.length === 0) {
        const disc = createReconciliationDiscrepancy({
          runId: run.id,
          invoiceLineItemId: invoiceLine.id,
          timeEntryId: null,
          discrepancyType: "MISSING_TIME_ENTRY",
          invoiceValue: `${invoiceLine.quantity} hours @ ${invoiceLine.rate || "N/A"}/hr`,
          timeEntryValue: null,
          difference: invoiceLine.amount,
          description: `No matching time entry found for "${invoiceLine.description}" (${invoiceLine.projectName || "No project"})`,
          severity: invoiceLine.amount > 500 ? "HIGH" : invoiceLine.amount > 100 ? "MEDIUM" : "LOW",
          resolved: false,
          resolvedAt: null,
        });
        discrepancies.push(disc);
        continue;
      }

      const bestMatch = candidates
        .filter((c) => !matchedTimeEntryIds.has(c.timeEntry.id))
        .sort((a, b) => b.confidence - a.confidence)[0];

      if (!bestMatch) {
        const disc = createReconciliationDiscrepancy({
          runId: run.id,
          invoiceLineItemId: invoiceLine.id,
          timeEntryId: null,
          discrepancyType: "MISSING_TIME_ENTRY",
          invoiceValue: `${invoiceLine.quantity} hours`,
          timeEntryValue: null,
          difference: invoiceLine.amount,
          description: `All matching time entries already matched to other invoice lines`,
          severity: "MEDIUM",
          resolved: false,
          resolvedAt: null,
        });
        discrepancies.push(disc);
        continue;
      }

      matchedTimeEntryIds.add(bestMatch.timeEntry.id);
      matchedInvoiceLineIds.add(invoiceLine.id);

      const match = createReconciliationMatch({
        runId: run.id,
        invoiceLineItemId: invoiceLine.id,
        timeEntryId: bestMatch.timeEntry.id,
        matchConfidence: bestMatch.confidence,
        invoiceHours: invoiceLine.quantity,
        timeEntryHours: bestMatch.timeEntry.hours,
        invoiceAmount: invoiceLine.amount,
        timeEntryAmount: bestMatch.timeEntry.amount,
      });
      matches.push(match);

      if (!bestMatch.hoursMatch) {
        const hoursDiff = invoiceLine.quantity - bestMatch.timeEntry.hours;
        const disc = createReconciliationDiscrepancy({
          runId: run.id,
          invoiceLineItemId: invoiceLine.id,
          timeEntryId: bestMatch.timeEntry.id,
          discrepancyType: "HOURS_MISMATCH",
          invoiceValue: `${invoiceLine.quantity} hours`,
          timeEntryValue: `${bestMatch.timeEntry.hours} hours`,
          difference: hoursDiff * (invoiceLine.rate || 0),
          description: `Hours mismatch: Invoice shows ${invoiceLine.quantity}h, time entry shows ${bestMatch.timeEntry.hours}h (diff: ${hoursDiff > 0 ? "+" : ""}${hoursDiff.toFixed(2)}h)`,
          severity: Math.abs(hoursDiff) > 2 ? "HIGH" : "MEDIUM",
          resolved: false,
          resolvedAt: null,
        });
        discrepancies.push(disc);
      }

      if (!bestMatch.rateMatch && invoiceLine.rate && bestMatch.timeEntry.rate) {
        const rateDiff = invoiceLine.rate - bestMatch.timeEntry.rate;
        const disc = createReconciliationDiscrepancy({
          runId: run.id,
          invoiceLineItemId: invoiceLine.id,
          timeEntryId: bestMatch.timeEntry.id,
          discrepancyType: "RATE_MISMATCH",
          invoiceValue: `$${invoiceLine.rate}/hr`,
          timeEntryValue: `$${bestMatch.timeEntry.rate}/hr`,
          difference: rateDiff * invoiceLine.quantity,
          description: `Rate mismatch: Invoice rate $${invoiceLine.rate}/hr vs tracked rate $${bestMatch.timeEntry.rate}/hr`,
          severity: Math.abs(rateDiff) > 20 ? "HIGH" : "MEDIUM",
          resolved: false,
          resolvedAt: null,
        });
        discrepancies.push(disc);
      }
    }

    for (const timeEntry of timeEntries) {
      if (!matchedTimeEntryIds.has(timeEntry.id)) {
        const disc = createReconciliationDiscrepancy({
          runId: run.id,
          invoiceLineItemId: null,
          timeEntryId: timeEntry.id,
          discrepancyType: "MISSING_INVOICE_LINE",
          invoiceValue: null,
          timeEntryValue: `${timeEntry.hours} hours on ${timeEntry.projectName}`,
          difference: timeEntry.amount ? -timeEntry.amount : null,
          description: `Time entry not found in invoice: ${timeEntry.hours}h on "${timeEntry.projectName}" (${timeEntry.entryDate})`,
          severity: timeEntry.hours > 4 ? "HIGH" : "MEDIUM",
          resolved: false,
          resolvedAt: null,
        });
        discrepancies.push(disc);
      }
    }

    const totalMatchedAmount = matches.reduce((sum, m) => sum + m.invoiceAmount, 0);
    const totalDiscrepancyAmount = discrepancies
      .filter((d) => d.difference !== null)
      .reduce((sum, d) => sum + Math.abs(d.difference || 0), 0);

    updateReconciliationRun(run.id, {
      status: "COMPLETED",
      matchedCount: matches.length,
      discrepancyCount: discrepancies.length,
      totalMatchedAmount,
      totalDiscrepancyAmount,
      completedAt: new Date().toISOString(),
    });

    return buildReconciliationResult(run.id);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    updateReconciliationRun(run.id, {
      status: "ERROR",
      errorMessage,
    });
    throw error;
  }
}

function findMatchCandidates(
  invoiceLine: InvoiceLineItem,
  timeEntries: TimeEntry[],
  options: ReconciliationOptions
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  for (const entry of timeEntries) {
    const projectMatch = matchProjects(invoiceLine.projectName, entry.projectName);
    if (!projectMatch) continue;

    const hoursDiff = Math.abs(invoiceLine.quantity - entry.hours);
    const hoursMatch = hoursDiff <= options.hoursTolerance;

    let rateMatch = true;
    if (invoiceLine.rate && entry.rate && options.rateTolerance >= 0) {
      const rateDiff = Math.abs(invoiceLine.rate - entry.rate);
      rateMatch = rateDiff <= options.rateTolerance;
    }

    let confidence = 0.5;
    if (projectMatch) confidence += 0.3;
    if (hoursMatch) confidence += 0.15;
    if (rateMatch) confidence += 0.05;

    candidates.push({
      invoiceLine,
      timeEntry: entry,
      confidence: Math.min(confidence, 1),
      hoursMatch,
      rateMatch,
      projectMatch: true,
    });
  }

  return candidates;
}

function matchProjects(invoiceProject: string | null, timeProject: string): boolean {
  if (!invoiceProject) return true;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const invNorm = normalize(invoiceProject);
  const timeNorm = normalize(timeProject);

  if (invNorm === timeNorm) return true;
  if (invNorm.includes(timeNorm) || timeNorm.includes(invNorm)) return true;

  const invWords = invNorm.split(/\s+/);
  const timeWords = timeNorm.split(/\s+/);
  const commonWords = invWords.filter((w) => timeWords.includes(w));
  if (commonWords.length >= Math.min(invWords.length, timeWords.length) * 0.5) {
    return true;
  }

  return false;
}

export function buildReconciliationResult(runId: string): ReconciliationResult {
  const run = getReconciliationRunById(runId);
  if (!run) {
    throw new Error("Reconciliation run not found");
  }

  const matches = getReconciliationMatchesByRun(runId);
  const discrepancies = getReconciliationDiscrepanciesByRun(runId);

  const matchDetails = matches.map((m) => {
    const invoiceLine = getInvoiceLineItemById(m.invoiceLineItemId);
    const timeEntry = getTimeEntryById(m.timeEntryId);
    return {
      invoiceLine: invoiceLine!,
      timeEntry: timeEntry!,
      matchConfidence: m.matchConfidence,
    };
  });

  const invoice = getInvoiceDocumentById(run.invoiceId);
  const invoiceLines = getInvoiceLineItemsByInvoice(run.invoiceId);
  const timeEntries = invoice ? getTimeEntriesByUser(run.userId) : [];

  return {
    runId: run.id,
    status: run.status,
    summary: {
      totalInvoiceLines: invoiceLines.length,
      totalTimeEntries: timeEntries.length,
      matchedCount: run.matchedCount,
      discrepancyCount: run.discrepancyCount,
      totalInvoiceAmount: run.totalInvoiceAmount || 0,
      totalMatchedAmount: run.totalMatchedAmount || 0,
      totalDiscrepancyAmount: run.totalDiscrepancyAmount || 0,
    },
    matches: matchDetails,
    discrepancies,
  };
}

export function getReconciliationResult(runId: string): ReconciliationResult | null {
  const run = getReconciliationRunById(runId);
  if (!run) return null;
  return buildReconciliationResult(runId);
}
