/* ─────────────────────────────────────────────
   F11 + F11b + F12 — BMS Database & Recommendation
   Common BMS models with validation vectors + custom BMS CRUD
   ───────────────────────────────────────────── */

export type CellType = 'li-ion' | 'lfp' | 'na-ion' | 'lto' | 'nimh' | 'alk' | 'lipo';

export type BalanceType = 'pasivo' | 'activo-capacitivo' | 'activo-inductivo' | 'sin-balanceo';

export interface BmsEntry {
  name: string;
  brand: string;
  sMin: number;          // Min series count
  sMax: number;          // Max series count
  chem: CellType[];      // Compatible chemistries (empty = any)
  maxA: number;          // Continuous MOSFET current
  balanceType: BalanceType;
  balanceCurrent: number; // Balance current in A (0 for passive/sin)
  protocol: string;      // Bluetooth/UART/CAN/SMBus
  smart: boolean;        // Programmable S count
  w: number;             // Width mm
  d: number;             // Depth mm
  h: number;             // Height mm
  vCutoffCharge?: number;  // Per-cell charge cutoff V (F11b)
  vCutoffDischarge?: number; // Per-cell discharge cutoff V (F11b)
  custom?: boolean;        // Flag: user-created BMS (F11b)
}

export const BMS_DB: BmsEntry[] = [
  // Daly Smart BMS
  { name: 'Daly 7S-30S 60A', brand: 'Daly', sMin: 7, sMax: 30, chem: ['li-ion', 'lfp'], maxA: 60, balanceType: 'activo-capacitivo', balanceCurrent: 0.05, protocol: 'Bluetooth', smart: true, w: 52, d: 30, h: 14 },
  { name: 'Daly 7S-30S 100A', brand: 'Daly', sMin: 7, sMax: 30, chem: ['li-ion', 'lfp'], maxA: 100, balanceType: 'activo-capacitivo', balanceCurrent: 0.05, protocol: 'Bluetooth', smart: true, w: 62, d: 36, h: 16 },
  { name: 'Daly 7S-24S 20A', brand: 'Daly', sMin: 7, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 20, balanceType: 'activo-capacitivo', balanceCurrent: 0.03, protocol: 'Bluetooth', smart: true, w: 42, d: 24, h: 10 },
  { name: 'Daly 4S-8S 30A', brand: 'Daly', sMin: 4, sMax: 8, chem: ['li-ion'], maxA: 30, balanceType: 'activo-capacitivo', balanceCurrent: 0.03, protocol: 'Bluetooth', smart: true, w: 36, d: 22, h: 8 },

  // Jikong (JK) BMS
  { name: 'JK BMS 8S-24S 60A', brand: 'JK', sMin: 8, sMax: 24, chem: ['li-ion', 'lfp', 'lto'], maxA: 60, balanceType: 'activo-inductivo', balanceCurrent: 2.0, protocol: 'Bluetooth', smart: true, w: 56, d: 32, h: 14 },
  { name: 'JK BMS 8S-24S 100A', brand: 'JK', sMin: 8, sMax: 24, chem: ['li-ion', 'lfp', 'lto'], maxA: 100, balanceType: 'activo-inductivo', balanceCurrent: 2.0, protocol: 'Bluetooth', smart: true, w: 68, d: 38, h: 16 },
  { name: 'JK BMS 8S-24S 200A', brand: 'JK', sMin: 8, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 200, balanceType: 'activo-inductivo', balanceCurrent: 2.0, protocol: 'Bluetooth/CAN', smart: true, w: 82, d: 46, h: 18 },

  // ANT BMS
  { name: 'ANT BMS 7S-24S 60A', brand: 'ANT', sMin: 7, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 60, balanceType: 'activo-capacitivo', balanceCurrent: 0.05, protocol: 'Bluetooth', smart: true, w: 50, d: 28, h: 12 },
  { name: 'ANT BMS 7S-24S 100A', brand: 'ANT', sMin: 7, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 100, balanceType: 'activo-capacitivo', balanceCurrent: 0.05, protocol: 'Bluetooth', smart: true, w: 60, d: 34, h: 14 },
  { name: 'ANT BMS 7S-24S 150A', brand: 'ANT', sMin: 7, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 150, balanceType: 'activo-capacitivo', balanceCurrent: 0.05, protocol: 'Bluetooth', smart: true, w: 72, d: 40, h: 16 },

  // Xuanjing BMS
  { name: 'Xuanjing 8S-24S 60A', brand: 'Xuanjing', sMin: 8, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 60, balanceType: 'activo-capacitivo', balanceCurrent: 0.03, protocol: 'Bluetooth', smart: true, w: 48, d: 26, h: 12 },
  { name: 'Xuanjing 8S-24S 100A', brand: 'Xuanjing', sMin: 8, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 100, balanceType: 'activo-capacitivo', balanceCurrent: 0.03, protocol: 'Bluetooth', smart: true, w: 58, d: 32, h: 14 },

  // Fixed-count BMS (non-smart)
  { name: 'BMS 13S Li-ion 40A', brand: 'Generic', sMin: 13, sMax: 13, chem: ['li-ion'], maxA: 40, balanceType: 'pasivo', balanceCurrent: 0, protocol: 'N/A', smart: false, w: 42, d: 20, h: 8 },
  { name: 'BMS 13S Li-ion 60A', brand: 'Generic', sMin: 13, sMax: 13, chem: ['li-ion'], maxA: 60, balanceType: 'pasivo', balanceCurrent: 0, protocol: 'N/A', smart: false, w: 48, d: 24, h: 10 },
  { name: 'BMS 16S Li-ion 60A', brand: 'Generic', sMin: 16, sMax: 16, chem: ['li-ion'], maxA: 60, balanceType: 'pasivo', balanceCurrent: 0, protocol: 'N/A', smart: false, w: 48, d: 24, h: 10 },
  { name: 'BMS 14S LFP 60A', brand: 'Generic', sMin: 14, sMax: 14, chem: ['lfp'], maxA: 60, balanceType: 'pasivo', balanceCurrent: 0, protocol: 'N/A', smart: false, w: 48, d: 24, h: 10 },
  { name: 'BMS 16S LFP 80A', brand: 'Generic', sMin: 16, sMax: 16, chem: ['lfp'], maxA: 80, balanceType: 'pasivo', balanceCurrent: 0, protocol: 'N/A', smart: false, w: 56, d: 28, h: 12 },
  { name: 'BMS 8S Li-ion 30A', brand: 'Generic', sMin: 8, sMax: 8, chem: ['li-ion'], maxA: 30, balanceType: 'pasivo', balanceCurrent: 0, protocol: 'N/A', smart: false, w: 36, d: 18, h: 8 },
  { name: 'BMS 10S Li-ion 30A', brand: 'Generic', sMin: 10, sMax: 10, chem: ['li-ion'], maxA: 30, balanceType: 'pasivo', balanceCurrent: 0, protocol: 'N/A', smart: false, w: 36, d: 18, h: 8 },

  // High-current BMS
  { name: 'JK BMS 8S-24S 300A', brand: 'JK', sMin: 8, sMax: 24, chem: ['li-ion', 'lfp'], maxA: 300, balanceType: 'activo-inductivo', balanceCurrent: 2.0, protocol: 'Bluetooth/CAN', smart: true, w: 100, d: 56, h: 22 },
  { name: 'Daly 7S-30S 200A', brand: 'Daly', sMin: 7, sMax: 30, chem: ['li-ion', 'lfp'], maxA: 200, balanceType: 'activo-capacitivo', balanceCurrent: 0.05, protocol: 'Bluetooth/UART', smart: true, w: 82, d: 46, h: 18 },

  // Na-Ion compatible
  { name: 'JK BMS 8S-24S 60A (Na-Ion)', brand: 'JK', sMin: 8, sMax: 24, chem: ['li-ion', 'lfp', 'lto', 'na-ion'], maxA: 60, balanceType: 'activo-inductivo', balanceCurrent: 2.0, protocol: 'Bluetooth', smart: true, w: 56, d: 32, h: 14 },

  // LTO compatible
  { name: 'JK BMS 8S-20S 60A (LTO)', brand: 'JK', sMin: 8, sMax: 20, chem: ['lto', 'li-ion', 'lfp'], maxA: 60, balanceType: 'activo-inductivo', balanceCurrent: 2.0, protocol: 'Bluetooth', smart: true, w: 56, d: 32, h: 14 },
];

/* ─────────────────────────────────────────────
   F12 — Validation Vectors
   ───────────────────────────────────────────── */

export interface BmsValidation {
  sMatch: { level: 'green' | 'yellow' | 'red'; msg: string };
  chemMatch: { level: 'green' | 'yellow' | 'red'; msg: string };
  currentMatch: { level: 'green' | 'yellow' | 'red'; msg: string };
  overall: 'green' | 'yellow' | 'red';
}

/**
 * F12 Vector 1 — S count match
 * Green: exact or within range
 * Yellow: smart BMS allows reprogramming
 * Red: fixed BMS with wrong S count
 */
function validateSCount(bms: BmsEntry, packS: number): { level: 'green' | 'yellow' | 'red'; msg: string } {
  if (packS >= bms.sMin && packS <= bms.sMax) {
    return { level: 'green', msg: `${packS}S dentro del rango ${bms.sMin}S-${bms.sMax}S` };
  }
  if (bms.smart) {
    const needed = packS < bms.sMin ? bms.sMin : bms.sMax;
    return { level: 'yellow', msg: `Reprogramar BMS a ${packS}S (rango: ${bms.sMin}S-${bms.sMax}S)` };
  }
  if (bms.sMin === bms.sMax) {
    return { level: 'red', msg: `BMS fijo a ${bms.sMin}S — incompatible con pack ${packS}S` };
  }
  return { level: 'red', msg: `${packS}S fuera de rango ${bms.sMin}S-${bms.sMax}S` };
}

/**
 * F12 Vector 2 — Chemistry exclusion
 * Green: compatible
 * Yellow: partially compatible (verify)
 * Red: incompatible
 */
function validateChemistry(bms: BmsEntry, packChem: CellType): { level: 'green' | 'yellow' | 'red'; msg: string } {
  if (bms.chem.length === 0) return { level: 'green', msg: 'Compatible con cualquier química' };
  if (bms.chem.includes(packChem)) {
    return { level: 'green', msg: `Diseñado para ${packChem.toUpperCase()}` };
  }
  // Partial match — some chemistries share voltage ranges
  const chemVoltMap: Record<string, [number, number]> = {
    'li-ion': [2.5, 4.2], 'lipo': [3.0, 4.35], 'lfp': [2.5, 3.65],
    'lto': [1.5, 2.8], 'na-ion': [1.5, 4.0], 'nimh': [1.0, 1.4], 'alk': [0.9, 1.6],
  };
  const packRange = chemVoltMap[packChem];
  const bmsRanges = bms.chem.map(c => chemVoltMap[c]).filter(Boolean);
  if (packRange && bmsRanges.some(r => Math.abs(r[0] - packRange[0]) < 0.3 && Math.abs(r[1] - packRange[1]) < 0.3)) {
    return { level: 'yellow', msg: `BMS para ${bms.chem[0].toUpperCase()} — verificar voltajes de corte` };
  }
  return { level: 'red', msg: `Incompatible: BMS soporta ${bms.chem.map(c => c.toUpperCase()).join(', ')}` };
}

/**
 * F12 Vector 3 — MOSFET current margin + balance recommendation
 * Green: MOSFET > I_max × 1.25 (25% margin)
 * Yellow: MOSFET > I_max but < 25% margin
 * Red: MOSFET < I_max
 * Extra: recommend active balance for packs > 20Ah
 */
function validateCurrent(bms: BmsEntry, packIMax: number, packAh: number): { level: 'green' | 'yellow' | 'red'; msg: string } {
  const margin = packIMax * 1.25;
  if (bms.maxA >= margin) {
    let msg = `${bms.maxA}A MOSFET — ${Math.round((bms.maxA / packIMax - 1) * 100)}% sobre I_max`;
    if (packAh > 20 && bms.balanceType === 'pasivo') {
      msg += ` ⚠ Pack >20Ah: recomendar balance activo`;
      return { level: 'yellow', msg };
    }
    return { level: 'green', msg };
  }
  if (bms.maxA >= packIMax) {
    return { level: 'yellow', msg: `${bms.maxA}A MOSFET — sin margen sobre I_max (${packIMax.toFixed(1)}A)` };
  }
  return { level: 'red', msg: `${bms.maxA}A MOSFET < I_max (${packIMax.toFixed(1)}A) — INSUFICIENTE` };
}

/**
 * F12 — Full validation for a BMS against pack config
 */
export function validateBms(bms: BmsEntry, packS: number, packChem: CellType, packIMax: number, packAh: number): BmsValidation {
  const sMatch = validateSCount(bms, packS);
  const chemMatch = validateChemistry(bms, packChem);
  const currentMatch = validateCurrent(bms, packIMax, packAh);
  const levels = [sMatch.level, chemMatch.level, currentMatch.level];
  const overall = levels.includes('red') ? 'red' : levels.includes('yellow') ? 'yellow' : 'green';
  return { sMatch, chemMatch, currentMatch, overall };
}

/* ─────────────────────────────────────────────
   F11 — Recommendation Algorithm
   ───────────────────────────────────────────── */

export interface BmsRecommendation {
  bms: BmsEntry;
  validation: BmsValidation;
  score: number; // Higher = better match
}

/**
 * Recommend BMS for a given pack configuration.
 * Scores each BMS by: S match (40pts), current margin (30pts), chem (20pts), balance (10pts)
 */
export function recommendBms(
  packS: number,
  packChem: CellType,
  packIMax: number,
  packAh: number,
  customBms?: BmsEntry[]
): BmsRecommendation[] {
  const allBms = [...BMS_DB, ...(customBms ?? [])];

  const scored = allBms.map((bms) => {
    const validation = validateBms(bms, packS, packChem, packIMax, packAh);

    // Skip red-overall BMS
    if (validation.overall === 'red') return null;

    let score = 0;

    // S match (40 pts)
    if (validation.sMatch.level === 'green') score += 40;
    else if (validation.sMatch.level === 'yellow') score += 25;

    // Current margin (30 pts)
    if (validation.currentMatch.level === 'green') score += 30;
    else if (validation.currentMatch.level === 'yellow') score += 15;

    // Chemistry (20 pts)
    if (validation.chemMatch.level === 'green') score += 20;
    else if (validation.chemMatch.level === 'yellow') score += 10;

    // Balance type bonus (10 pts) — prefer active for large packs
    if (packAh > 20 && (bms.balanceType === 'activo-inductivo' || bms.balanceType === 'activo-capacitivo')) {
      score += 10;
    } else if (packAh <= 20) {
      score += 5; // Any balance is fine for small packs
    }

    return { bms, validation, score };
  }).filter(Boolean) as BmsRecommendation[];

  return scored.sort((a, b) => b.score - a.score);
}

/* ─────────────────────────────────────────────
   F11b — Custom BMS CRUD
   localStorage persistence + export/import
   ───────────────────────────────────────────── */

const CUSTOM_BMS_KEY = 'bca:bms:custom';

interface CustomBmsStorage {
  version: 1;
  entries: BmsEntry[];
}

function loadCustomBms(): BmsEntry[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BMS_KEY);
    if (!raw) return [];
    const data: CustomBmsStorage = JSON.parse(raw);
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

function saveCustomBms(entries: BmsEntry[]): void {
  const data: CustomBmsStorage = { version: 1, entries };
  localStorage.setItem(CUSTOM_BMS_KEY, JSON.stringify(data));
}

let customBmsCache: BmsEntry[] | null = null;

export function getCustomBms(): BmsEntry[] {
  if (customBmsCache === null) customBmsCache = loadCustomBms();
  return customBmsCache;
}

export function addCustomBms(entry: BmsEntry): void {
  const list = getCustomBms();
  entry.custom = true;
  list.push(entry);
  saveCustomBms(list);
  customBmsCache = list;
}

export function updateCustomBms(index: number, entry: BmsEntry): void {
  const list = getCustomBms();
  if (index < 0 || index >= list.length) return;
  entry.custom = true;
  list[index] = entry;
  saveCustomBms(list);
  customBmsCache = list;
}

export function removeCustomBms(index: number): void {
  const list = getCustomBms();
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  saveCustomBms(list);
  customBmsCache = list;
}

export function duplicateCustomBms(index: number): void {
  const list = getCustomBms();
  if (index < 0 || index >= list.length) return;
  const copy = { ...list[index], name: `[Copy] ${list[index].name}`, custom: true };
  list.push(copy);
  saveCustomBms(list);
  customBmsCache = list;
}

export function exportCustomBms(): string {
  return JSON.stringify({ version: 1, entries: getCustomBms() }, null, 2);
}

export function importCustomBms(json: string): { ok: boolean; count: number; error?: string } {
  try {
    const data: CustomBmsStorage = JSON.parse(json);
    if (!data.entries || !Array.isArray(data.entries)) {
      return { ok: false, count: 0, error: 'Invalid format: missing entries array' };
    }
    const valid = data.entries.filter((e) => e.name && typeof e.sMin === 'number');
    saveCustomBms(valid);
    customBmsCache = valid;
    return { ok: true, count: valid.length };
  } catch (e) {
    return { ok: false, count: 0, error: `Parse error: ${e}` };
  }
}

/**
 * Get all BMS entries: built-in + custom.
 * Used by recommendation engine and dropdown population.
 */
export function getAllBms(): BmsEntry[] {
  return [...BMS_DB, ...getCustomBms()];
}
