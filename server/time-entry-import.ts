import { createTimeEntriesBulk, deleteTimeEntriesByUser, getTimeEntriesByUser } from "./db";
import type { TimeEntry, InsertTimeEntry } from "@shared/schema";

interface CSVTimeEntry {
  projectName: string;
  taskName?: string;
  description?: string;
  hours: number;
  rate?: number;
  entryDate: string;
}

export function parseCSVTimeEntries(csvContent: string): CSVTimeEntry[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV file must have a header row and at least one data row");
  }

  const headerLine = lines[0].toLowerCase();
  const headers = parseCSVLine(headerLine);
  
  const projectIdx = findColumnIndex(headers, ["project", "project_name", "projectname", "client", "matter"]);
  const taskIdx = findColumnIndex(headers, ["task", "task_name", "taskname", "activity"]);
  const descIdx = findColumnIndex(headers, ["description", "desc", "notes", "note", "memo"]);
  const hoursIdx = findColumnIndex(headers, ["hours", "time", "duration", "qty", "quantity"]);
  const rateIdx = findColumnIndex(headers, ["rate", "hourly_rate", "hourlyrate", "price"]);
  const dateIdx = findColumnIndex(headers, ["date", "entry_date", "entrydate", "work_date", "workdate"]);

  if (projectIdx === -1) {
    throw new Error("CSV must have a 'Project' column");
  }
  if (hoursIdx === -1) {
    throw new Error("CSV must have an 'Hours' column");
  }
  if (dateIdx === -1) {
    throw new Error("CSV must have a 'Date' column");
  }

  const entries: CSVTimeEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    const projectName = values[projectIdx]?.trim();
    if (!projectName) continue;

    const hoursStr = values[hoursIdx]?.trim();
    const hours = parseFloat(hoursStr || "0");
    if (isNaN(hours) || hours <= 0) continue;

    const dateStr = values[dateIdx]?.trim();
    const entryDate = parseDate(dateStr);
    if (!entryDate) continue;

    const entry: CSVTimeEntry = {
      projectName,
      hours,
      entryDate,
    };

    if (taskIdx !== -1 && values[taskIdx]) {
      entry.taskName = values[taskIdx].trim();
    }
    if (descIdx !== -1 && values[descIdx]) {
      entry.description = values[descIdx].trim();
    }
    if (rateIdx !== -1 && values[rateIdx]) {
      const rate = parseFloat(values[rateIdx].replace(/[$,]/g, ""));
      if (!isNaN(rate)) {
        entry.rate = rate;
      }
    }

    entries.push(entry);
  }

  return entries;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const idx = headers.findIndex((h) => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usMatch) {
    const month = usMatch[1].padStart(2, "0");
    const day = usMatch[2].padStart(2, "0");
    let year = usMatch[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  const euMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (euMatch) {
    const day = euMatch[1].padStart(2, "0");
    const month = euMatch[2].padStart(2, "0");
    let year = euMatch[3];
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function importTimeEntries(
  userId: string,
  entries: CSVTimeEntry[],
  sourceType: string = "csv",
  clearExisting: boolean = false
): TimeEntry[] {
  if (clearExisting) {
    deleteTimeEntriesByUser(userId);
  }

  const inserts: InsertTimeEntry[] = entries.map((entry) => ({
    userId,
    sourceType,
    sourceId: null,
    projectName: entry.projectName,
    taskName: entry.taskName || null,
    description: entry.description || null,
    hours: entry.hours,
    rate: entry.rate || null,
    amount: entry.rate ? entry.hours * entry.rate : null,
    entryDate: entry.entryDate,
  }));

  return createTimeEntriesBulk(inserts);
}

export function getUserTimeEntries(
  userId: string,
  dateFrom?: string,
  dateTo?: string
): TimeEntry[] {
  return getTimeEntriesByUser(userId, dateFrom, dateTo);
}
