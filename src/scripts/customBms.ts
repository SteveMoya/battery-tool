/* ─────────────────────────────────────────────
   F11b — Custom BMS Persistence
   localStorage CRUD for user-defined BMS models
   ───────────────────────────────────────────── */

import type { BmsEntry } from './bms-database';

const STORAGE_KEY = 'bca:bms:custom';

export interface CustomBmsEntry extends BmsEntry {
  id: string;
  createdAt: number;
}

function generateId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readAll(): CustomBmsEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeAll(entries: CustomBmsEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function getAllCustomBms(): CustomBmsEntry[] {
  return readAll();
}

export function getCustomBmsById(id: string): CustomBmsEntry | undefined {
  return readAll().find((e) => e.id === id);
}

export function addCustomBms(data: Omit<CustomBmsEntry, 'id' | 'createdAt'>): CustomBmsEntry {
  const entries = readAll();
  const entry: CustomBmsEntry = {
    ...data,
    id: generateId(),
    createdAt: Date.now(),
  };
  entries.push(entry);
  writeAll(entries);
  return entry;
}

export function updateCustomBms(id: string, data: Partial<Omit<CustomBmsEntry, 'id' | 'createdAt'>>): CustomBmsEntry | null {
  const entries = readAll();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...data };
  writeAll(entries);
  return entries[idx];
}

export function deleteCustomBms(id: string): boolean {
  const entries = readAll();
  const filtered = entries.filter((e) => e.id !== id);
  if (filtered.length === entries.length) return false;
  writeAll(filtered);
  return true;
}

export function duplicateCustomBms(id: string): CustomBmsEntry | null {
  const original = getCustomBmsById(id);
  if (!original) return null;
  const { id: _id, createdAt: _c, ...rest } = original;
  return addCustomBms({ ...rest, name: `${rest.name} (copy)` });
}

export function exportCustomBms(): string {
  return JSON.stringify(readAll(), null, 2);
}

export function importCustomBms(json: string): { ok: boolean; count: number; error?: string } {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return { ok: false, count: 0, error: 'Expected JSON array' };
    const entries = readAll();
    const existingIds = new Set(entries.map((e) => e.id));
    let imported = 0;
    for (const item of data) {
      if (!item.name || !item.brand) continue;
      const id = item.id && !existingIds.has(item.id) ? item.id : generateId();
      entries.push({ ...item, id, createdAt: item.createdAt || Date.now() });
      imported++;
    }
    writeAll(entries);
    return { ok: true, count: imported };
  } catch (e) {
    return { ok: false, count: 0, error: (e as Error).message };
  }
}
