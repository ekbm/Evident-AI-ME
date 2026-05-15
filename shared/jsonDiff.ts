/**
 * JSON Diff Utility for Invoice Normalization Audit
 * Generates patches and human-readable summaries of changes
 */

export interface DiffOperation {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
  oldValue?: unknown;
}

export interface DiffResult {
  patch: DiffOperation[];
  summary: string[];
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "number") return val.toLocaleString();
  if (typeof val === "string") return val.length > 50 ? val.substring(0, 47) + "..." : val;
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === "object") return "{...}";
  return String(val);
}

function getLineItemKey(item: Record<string, unknown>): string {
  if (item.sku) return `sku:${item.sku}`;
  if (item.description && item.unitPrice) {
    return `desc:${String(item.description).substring(0, 30)}|price:${item.unitPrice}`;
  }
  if (item.description) return `desc:${String(item.description).substring(0, 50)}`;
  return `idx:${item.id || "unknown"}`;
}

function diffObjects(
  original: Record<string, unknown>,
  normalized: Record<string, unknown>,
  basePath: string = ""
): DiffOperation[] {
  const ops: DiffOperation[] = [];
  const allKeys = Array.from(new Set([...Object.keys(original), ...Object.keys(normalized)]));

  for (const key of allKeys) {
    const path = basePath ? `${basePath}.${key}` : key;
    const origVal = original[key];
    const normVal = normalized[key];

    if (!(key in original)) {
      ops.push({ op: "add", path, value: normVal });
    } else if (!(key in normalized)) {
      ops.push({ op: "remove", path, oldValue: origVal });
    } else if (Array.isArray(origVal) && Array.isArray(normVal)) {
      if (key === "lineItems") {
        const lineItemOps = diffLineItems(origVal, normVal, path);
        ops.push(...lineItemOps);
      } else {
        if (JSON.stringify(origVal) !== JSON.stringify(normVal)) {
          ops.push({ op: "replace", path, value: normVal, oldValue: origVal });
        }
      }
    } else if (
      typeof origVal === "object" &&
      origVal !== null &&
      typeof normVal === "object" &&
      normVal !== null
    ) {
      const nestedOps = diffObjects(
        origVal as Record<string, unknown>,
        normVal as Record<string, unknown>,
        path
      );
      ops.push(...nestedOps);
    } else if (origVal !== normVal) {
      ops.push({ op: "replace", path, value: normVal, oldValue: origVal });
    }
  }

  return ops;
}

function diffLineItems(
  original: Record<string, unknown>[],
  normalized: Record<string, unknown>[],
  basePath: string
): DiffOperation[] {
  const ops: DiffOperation[] = [];
  
  const origMap = new Map<string, { item: Record<string, unknown>; index: number }>();
  original.forEach((item, idx) => {
    origMap.set(getLineItemKey(item), { item, index: idx });
  });

  const normMap = new Map<string, { item: Record<string, unknown>; index: number }>();
  normalized.forEach((item, idx) => {
    normMap.set(getLineItemKey(item), { item, index: idx });
  });

  Array.from(normMap.entries()).forEach(([key, { item: normItem, index: normIdx }]) => {
    const origEntry = origMap.get(key);
    if (!origEntry) {
      ops.push({ op: "add", path: `${basePath}[${normIdx}]`, value: normItem });
    } else {
      const itemOps = diffObjects(origEntry.item, normItem, `${basePath}[${normIdx}]`);
      ops.push(...itemOps);
    }
  });

  Array.from(origMap.entries()).forEach(([key, { item: origItem, index: origIdx }]) => {
    if (!normMap.has(key)) {
      ops.push({ op: "remove", path: `${basePath}[${origIdx}]`, oldValue: origItem });
    }
  });

  return ops;
}

function generateSummary(ops: DiffOperation[]): string[] {
  const summaries: string[] = [];

  for (const op of ops) {
    const pathParts = op.path.split(".");
    const fieldName = pathParts[pathParts.length - 1];
    const isLineItem = op.path.includes("lineItems");

    if (op.op === "add") {
      if (isLineItem && op.path.match(/lineItems\[\d+\]$/)) {
        summaries.push(`Added line item: ${formatValue((op.value as Record<string, unknown>)?.description)}`);
      } else {
        summaries.push(`Added ${fieldName}: ${formatValue(op.value)}`);
      }
    } else if (op.op === "remove") {
      if (isLineItem && op.path.match(/lineItems\[\d+\]$/)) {
        summaries.push(`Removed line item: ${formatValue((op.oldValue as Record<string, unknown>)?.description)}`);
      } else {
        summaries.push(`Removed ${fieldName}`);
      }
    } else if (op.op === "replace") {
      if (fieldName === "totalAmount" || fieldName === "amount" || fieldName === "rate") {
        const oldNum = typeof op.oldValue === "number" ? op.oldValue : 0;
        const newNum = typeof op.value === "number" ? op.value : 0;
        const diff = newNum - oldNum;
        const pct = oldNum !== 0 ? ((diff / oldNum) * 100).toFixed(1) : "N/A";
        summaries.push(`${fieldName}: ${formatValue(op.oldValue)} → ${formatValue(op.value)} (${diff >= 0 ? "+" : ""}${pct}%)`);
      } else if (fieldName === "quantity" || fieldName === "hours") {
        summaries.push(`${fieldName}: ${formatValue(op.oldValue)} → ${formatValue(op.value)}`);
      } else {
        summaries.push(`${fieldName}: ${formatValue(op.oldValue)} → ${formatValue(op.value)}`);
      }
    }
  }

  return summaries;
}

export function diff(
  original: Record<string, unknown>,
  normalized: Record<string, unknown>
): DiffResult {
  const patch = diffObjects(original, normalized);
  const summary = generateSummary(patch);
  return { patch, summary };
}

export function applyPatch(
  original: Record<string, unknown>,
  patch: DiffOperation[]
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(original));

  for (const op of patch) {
    const pathParts = op.path.split(/\.|\[|\]/).filter(Boolean);
    let current: Record<string, unknown> = result;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!(part in current)) {
        current[part] = isNaN(Number(pathParts[i + 1])) ? {} : [];
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = pathParts[pathParts.length - 1];

    if (op.op === "add" || op.op === "replace") {
      current[lastPart] = op.value;
    } else if (op.op === "remove") {
      if (Array.isArray(current)) {
        current.splice(Number(lastPart), 1);
      } else {
        delete current[lastPart];
      }
    }
  }

  return result;
}

export function hasCriticalChanges(ops: DiffOperation[]): boolean {
  const criticalFields = ["totalAmount", "amount", "rate", "quantity"];
  return ops.some(
    (op) =>
      op.op === "replace" &&
      criticalFields.some((field) => op.path.includes(field))
  );
}
