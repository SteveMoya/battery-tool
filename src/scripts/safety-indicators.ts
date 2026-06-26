import { inputs } from './dom';
import { getOpenCircuitVoltage } from './simulation';

/* ─────────────────────────────────────────────
   F10a — Empirical Ampacity Table
   Each entry: [thickness_mm, width_mm] → { optimalA, maxA, poorA }
   Compare against I_per_segment = I_pack / P (current per parallel group)
   ───────────────────────────────────────────── */

interface AmpacityEntry {
  t: number;   // thickness mm
  w: number;   // width mm
  optimalA: number;
  maxA: number;
  poorA: number;
}

const AMPACITY_TABLE: AmpacityEntry[] = [
  { t: 0.10, w: 5.0, optimalA: 3.0,  maxA: 5.0,  poorA: 7.0  },
  { t: 0.10, w: 7.0, optimalA: 5.0,  maxA: 7.0,  poorA: 10.0 },
  { t: 0.15, w: 7.0, optimalA: 7.0,  maxA: 10.0, poorA: 14.0 },
  { t: 0.15, w: 8.0, optimalA: 8.0,  maxA: 12.0, poorA: 16.0 },
  { t: 0.20, w: 7.0, optimalA: 10.0, maxA: 15.0, poorA: 20.0 },
  { t: 0.30, w: 7.0, optimalA: 15.0, maxA: 20.0, poorA: 28.0 },
];

export type SafetyLevel = 'green' | 'yellow' | 'red' | 'neutral';

export interface AmpacityResult {
  level: SafetyLevel;
  currentPerSegment: number;
  optimalA: number;
  maxA: number;
  poorA: number;
  matchLabel: string;
}

function findClosestAmpacity(tMm: number, wMm: number): AmpacityEntry {
  let best = AMPACITY_TABLE[0];
  let bestDist = Infinity;
  for (const e of AMPACITY_TABLE) {
    const dist = Math.abs(e.t - tMm) + Math.abs(e.w - wMm) * 0.5;
    if (dist < bestDist) { bestDist = dist; best = e; }
  }
  return best;
}

export function checkAmpacity(packCurrentA: number, P: number): AmpacityResult {
  const tStrip = parseFloat(inputs['sim-strip-t']?.value ?? '0.15');
  const wStrip = parseFloat(inputs['sim-strip-w']?.value ?? '7');
  const entry = findClosestAmpacity(tStrip, wStrip);
  const perSeg = P > 0 ? packCurrentA / P : packCurrentA;

  let level: SafetyLevel = 'green';
  if (perSeg > entry.poorA) level = 'red';
  else if (perSeg > entry.optimalA) level = 'yellow';

  return {
    level,
    currentPerSegment: perSeg,
    optimalA: entry.optimalA,
    maxA: entry.maxA,
    poorA: entry.poorA,
    matchLabel: `${entry.t}×${entry.w}mm`,
  };
}

/* ─────────────────────────────────────────────
   F10b — Micah Toll Rule
   Fixed heuristic: 0.15mm × 8mm = 5A continuous safe
   If strip is thinner/narrower → derate proportionally
   ───────────────────────────────────────────── */

const MICAH_TOLL_BASELINE_A = 5.0;
const MICAH_TOLL_T = 0.15;
const MICAH_TOLL_W = 8.0;

export interface MicahTollResult {
  level: SafetyLevel;
  currentPerSegment: number;
  safeA: number;
  ratio: number;
}

export function checkMicahToll(packCurrentA: number, P: number): MicahTollResult {
  const tStrip = parseFloat(inputs['sim-strip-t']?.value ?? '0.15');
  const wStrip = parseFloat(inputs['sim-strip-w']?.value ?? '7');

  const areaRatio = (tStrip * wStrip) / (MICAH_TOLL_T * MICAH_TOLL_W);
  const safeA = MICAH_TOLL_BASELINE_A * areaRatio;
  const perSeg = P > 0 ? packCurrentA / P : packCurrentA;
  const ratio = safeA > 0 ? perSeg / safeA : 0;

  let level: SafetyLevel = 'green';
  if (ratio > 1.0) level = 'red';
  else if (ratio > 0.8) level = 'yellow';

  return { level, currentPerSegment: perSeg, safeA, ratio };
}

/* ─────────────────────────────────────────────
   F6 — Voltage Sag Semaphore
   Compare vNet vs cutoffPack = cutoff × S
   🟢 OK / 🟡 LVC Cercano (within 10%) / 🔴 HIT LVC
   + Time-to-cutoff estimate
   ───────────────────────────────────────────── */

export interface VoltageSagResult {
  level: SafetyLevel;
  vNet: number;
  cutoffPack: number;
  headroomPct: number;
  timeToCutoff: string;
}

export function checkVoltageSag(
  vNet: number,
  I: number,
  soc: number,
  R_total: number,
  S: number,
  P: number,
  cellMin: number,
  cellMax: number,
  cellNom: number,
  cellAh: number,
  cutoff: number,
  mode: string,
): VoltageSagResult {
  const cutoffPack = cutoff * S;

  if (mode !== 'discharge' || I < 0.01) {
    return { level: 'neutral', vNet, cutoffPack, headroomPct: 100, timeToCutoff: '--' };
  }

  const headroomPct = cutoffPack > 0 ? ((vNet - cutoffPack) / cutoffPack) * 100 : 100;

  let level: SafetyLevel = 'green';
  if (vNet < cutoffPack) level = 'red';
  else if (headroomPct < 10) level = 'yellow';

  // Estimate time-to-cutoff: find SoC where OCV = cutoff + sag, then compute runtime
  const vCellSag = (I * R_total) / S;
  const vCellNeeded = cutoff + vCellSag;
  let low = 0, high = 1;
  for (let k = 0; k < 8; k++) {
    const mid = (low + high) / 2;
    if (getOpenCircuitVoltage(mid, cellMin, cellMax, cellNom) < vCellNeeded) low = mid; else high = mid;
  }
  const cutoffSoC = (low + high) / 2;

  let timeToCutoff = '--';
  if (soc > cutoffSoC) {
    const packAh = P * cellAh;
    const hrs = (packAh * (soc - cutoffSoC)) / I;
    const h = Math.floor(hrs);
    const m = Math.round((hrs - h) * 60);
    timeToCutoff = h > 99 ? '>99h' : `${h}h ${m}m`;
  } else {
    timeToCutoff = '0h 0m';
  }

  return { level, vNet, cutoffPack, headroomPct, timeToCutoff };
}

/* ─────────────────────────────────────────────
   DOM Rendering — update all safety indicator elements
   ───────────────────────────────────────────── */

const EMOJI: Record<SafetyLevel, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  neutral: '⚪',
};

function setSafetyEl(id: string, emoji: string, text: string, color: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const emojiSpan = el.querySelector('.safety-emoji');
  const textSpan = el.querySelector('.safety-text');
  if (emojiSpan) emojiSpan.textContent = emoji;
  if (textSpan) textSpan.textContent = text;
  (el as HTMLElement).style.color = color;
  (el as HTMLElement).style.borderColor = color;
}

const COLOR: Record<SafetyLevel, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  neutral: '#94a3b8',
};

export function renderVoltageSagIndicator(r: VoltageSagResult) {
  let text: string;
  if (r.level === 'neutral') {
    text = 'N/A (charge/idle)';
  } else if (r.level === 'red') {
    text = `HIT LVC — ${r.vNet.toFixed(1)}V < ${r.cutoffPack.toFixed(1)}V`;
  } else if (r.level === 'yellow') {
    text = `LVC Cercano — ${r.headroomPct.toFixed(1)}% headroom`;
  } else {
    text = `OK — ${r.headroomPct.toFixed(1)}% above LVC`;
  }
  setSafetyEl('safety-voltage-sag', EMOJI[r.level], text, COLOR[r.level]);

  const ttEl = document.getElementById('safety-time-to-cutoff');
  if (ttEl) ttEl.textContent = r.timeToCutoff;
}

export function renderAmpacityIndicator(r: AmpacityResult) {
  let text: string;
  if (r.level === 'red') {
    text = `EXCEED — ${r.currentPerSegment.toFixed(1)}A > ${r.poorA}A limit`;
  } else if (r.level === 'yellow') {
    text = `MARGINAL — ${r.currentPerSegment.toFixed(1)}A > ${r.optimalA}A optimal`;
  } else {
    text = `OK — ${r.currentPerSegment.toFixed(1)}A ≤ ${r.optimalA}A`;
  }
  setSafetyEl('safety-ampacity', EMOJI[r.level], text, COLOR[r.level]);
}

export function renderMicahTollIndicator(r: MicahTollResult) {
  let text: string;
  if (r.level === 'red') {
    text = `EXCEED — ${r.currentPerSegment.toFixed(1)}A > ${r.safeA.toFixed(1)}A safe`;
  } else if (r.level === 'yellow') {
    text = `MARGINAL — ${Math.round(r.ratio * 100)}% of safe limit`;
  } else {
    text = `OK — ${r.currentPerSegment.toFixed(1)}A ≤ ${r.safeA.toFixed(1)}A`;
  }
  setSafetyEl('safety-micah', EMOJI[r.level], text, COLOR[r.level]);
}
