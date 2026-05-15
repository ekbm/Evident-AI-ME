/**
 * Global Processing Settings
 * Persistent settings stored in PostgreSQL for document processing configuration
 */

import { db } from "./auth-db";
import { systemSettings } from "@shared/models/auth";
import { eq } from "drizzle-orm";

type ProcessingMode = 'nodejs' | 'python' | 'hybrid';

interface ProcessingSettings {
  forcePythonService: boolean;
  forcePythonServiceEnabledAt: string | null;
  forcePythonServiceEnabledBy: string | null;
  processingMode: ProcessingMode;
  processingModeChangedAt: string | null;
  processingModeChangedBy: string | null;
  autoPrepAfterIngest: boolean;
  autoPrepAfterIngestChangedAt: string | null;
  autoPrepAfterIngestChangedBy: string | null;
}

const SETTINGS_KEY = "processing_settings";

let cachedSettings: ProcessingSettings | null = null;

async function loadSettingsFromDb(): Promise<ProcessingSettings> {
  try {
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, SETTINGS_KEY));
    if (result.length > 0) {
      const parsed = JSON.parse(result[0].value);
      cachedSettings = {
        forcePythonService: parsed.forcePythonService ?? false,
        forcePythonServiceEnabledAt: parsed.forcePythonServiceEnabledAt ?? null,
        forcePythonServiceEnabledBy: parsed.forcePythonServiceEnabledBy ?? null,
        processingMode: parsed.processingMode ?? 'hybrid',
        processingModeChangedAt: parsed.processingModeChangedAt ?? null,
        processingModeChangedBy: parsed.processingModeChangedBy ?? null,
        autoPrepAfterIngest: parsed.autoPrepAfterIngest ?? true,
        autoPrepAfterIngestChangedAt: parsed.autoPrepAfterIngestChangedAt ?? null,
        autoPrepAfterIngestChangedBy: parsed.autoPrepAfterIngestChangedBy ?? null,
      };
      return cachedSettings;
    }
  } catch (e) {
    console.log("[ProcessingSettings] Error loading from database, using defaults:", e);
  }
  
  cachedSettings = {
    forcePythonService: false,
    forcePythonServiceEnabledAt: null,
    forcePythonServiceEnabledBy: null,
    processingMode: 'hybrid',
    processingModeChangedAt: null,
    processingModeChangedBy: null,
    autoPrepAfterIngest: true,
    autoPrepAfterIngestChangedAt: null,
    autoPrepAfterIngestChangedBy: null,
  };
  return cachedSettings;
}

async function saveSettingsToDb(settings: ProcessingSettings, userId?: string): Promise<void> {
  try {
    const value = JSON.stringify(settings);
    await db.insert(systemSettings)
      .values({
        key: SETTINGS_KEY,
        value,
        updatedAt: new Date(),
        updatedBy: userId || null,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value,
          updatedAt: new Date(),
          updatedBy: userId || null,
        },
      });
    cachedSettings = settings;
  } catch (e) {
    console.error("[ProcessingSettings] Error saving to database:", e);
    throw e;
  }
}

export async function isForcePythonServiceEnabled(): Promise<boolean> {
  if (cachedSettings === null) {
    await loadSettingsFromDb();
  }
  return cachedSettings?.forcePythonService ?? false;
}

export function isForcePythonServiceEnabledSync(): boolean {
  return cachedSettings?.forcePythonService ?? false;
}

export function getProcessingSettingsSync(): ProcessingSettings {
  return cachedSettings ?? {
    forcePythonService: false,
    forcePythonServiceEnabledAt: null,
    forcePythonServiceEnabledBy: null,
    processingMode: 'hybrid',
    processingModeChangedAt: null,
    processingModeChangedBy: null,
    autoPrepAfterIngest: true,
    autoPrepAfterIngestChangedAt: null,
    autoPrepAfterIngestChangedBy: null,
  };
}

export function getProcessingModeSync(): ProcessingMode {
  return cachedSettings?.processingMode ?? 'hybrid';
}

export async function setProcessingMode(mode: ProcessingMode, userId?: string): Promise<void> {
  const current = await getProcessingSettings();
  const newSettings: ProcessingSettings = {
    ...current,
    processingMode: mode,
    processingModeChangedAt: new Date().toISOString(),
    processingModeChangedBy: userId || 'admin',
  };
  
  await saveSettingsToDb(newSettings, userId);
  
  console.log(`[ProcessingSettings] Processing Mode changed to: ${mode.toUpperCase()}${userId ? ` by ${userId}` : ''}`);
}

export async function setForcePythonService(enabled: boolean, userId?: string): Promise<void> {
  const current = await getProcessingSettings();
  const newSettings: ProcessingSettings = {
    ...current,
    forcePythonService: enabled,
    forcePythonServiceEnabledAt: enabled ? new Date().toISOString() : null,
    forcePythonServiceEnabledBy: enabled ? (userId || 'admin') : null,
  };
  
  await saveSettingsToDb(newSettings, userId);
  
  console.log(`[ProcessingSettings] Force Python Service: ${enabled ? 'ENABLED' : 'DISABLED'}${userId ? ` by ${userId}` : ''} (persistent)`);
}

export function isAutoPrepAfterIngestEnabled(): boolean {
  return cachedSettings?.autoPrepAfterIngest ?? true;
}

export async function setAutoPrepAfterIngest(enabled: boolean, userId?: string): Promise<void> {
  const current = await getProcessingSettings();
  const newSettings: ProcessingSettings = {
    ...current,
    autoPrepAfterIngest: enabled,
    autoPrepAfterIngestChangedAt: new Date().toISOString(),
    autoPrepAfterIngestChangedBy: userId || 'admin',
  };
  
  await saveSettingsToDb(newSettings, userId);
  
  console.log(`[ProcessingSettings] Auto Prep After Ingest: ${enabled ? 'ENABLED' : 'DISABLED'}${userId ? ` by ${userId}` : ''}`);
}

export async function getProcessingSettings(): Promise<ProcessingSettings> {
  if (cachedSettings === null) {
    await loadSettingsFromDb();
  }
  return { ...cachedSettings! };
}

export async function initProcessingSettings(): Promise<void> {
  await loadSettingsFromDb();
  console.log(`[ProcessingSettings] Loaded from database - Mode: ${cachedSettings?.processingMode?.toUpperCase() || 'HYBRID'}, Force Python: ${cachedSettings?.forcePythonService ? 'ENABLED' : 'disabled'}`);
}

export { ProcessingMode };
