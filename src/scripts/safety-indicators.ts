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
   F9 — Strip Thermal Risk Check (generalized)
   Works for any strip material: Ni, Cu, Steel, Au-plated Cu.
   Calculates actual heat generation via I²R and estimates
   temperature rise via natural convection (h ≈ 25 W/m²·K).
   ───────────────────────────────────────────── */

const T_AMB = 25;
const H_CONVECTION = 25;

const MATERIAL_T_MAX: Record<number, number> = {
  1.7: 150,   // Copper
  2.4: 120,   // Gold-plated Copper
  7.0: 200,   // Nickel
  14.0: 80,   // Steel
};

export interface StripThermalResult {
  level: SafetyLevel;
  currentPerSegment: number;
  heatPerSeg: number;
  tStrip: number;
  tMax: number;
  pct: number;
  matLabel: string;
}

function getMaterialLabel(rhoRaw: number): string {
  if (rhoRaw <= 1.8) return 'Copper';
  if (rhoRaw <= 2.5) return 'Au-plated Cu';
  if (rhoRaw <= 8.0) return 'Nickel';
  return 'Steel';
}

export function checkStripThermal(packCurrentA: number, P: number): StripThermalResult {
  const rhoRaw = parseFloat(inputs['sim-strip-mat']?.value ?? '7');
  const rho = rhoRaw * 1e-8;
  const perSeg = P > 0 ? packCurrentA / P : packCurrentA;

  const dRaw = parseFloat(inputs['c-diam']?.value ?? '18') / 1000;
  const pwRaw = parseFloat(inputs['c-prism-w']?.value ?? '0') / 1000;
  const isPrismatic = inputs['cell-type']?.value === 'prismatic';
  const d = isPrismatic && pwRaw > 0 ? pwRaw : dRaw;
  const sp = parseFloat(inputs['c-spacing']?.value ?? '1') / 1000;
  const wStrip = parseFloat(inputs['sim-strip-w']?.value ?? '7') / 1000;
  const tStrip = parseFloat(inputs['sim-strip-t']?.value ?? '0.15') / 1000;

  const L_seg = d + sp;
  const R_seg = (rho * L_seg) / (wStrip * tStrip);
  const Q_seg = perSeg * perSeg * R_seg;
  const A_surface = 2 * (wStrip + tStrip) * L_seg;
  const dT = A_surface > 0 ? Q_seg / (H_CONVECTION * A_surface) : 0;
  const T_strip = T_AMB + dT;

  const tMax = MATERIAL_T_MAX[rhoRaw] ?? 150;
  const range = tMax - T_AMB;
  const pct = range > 0 ? Math.max(0, Math.min(100, ((T_strip - T_AMB) / range) * 100)) : 0;

  let level: SafetyLevel = 'green';
  if (pct >= 80) level = 'red';
  else if (pct >= 50) level = 'yellow';

  return {
    level,
    currentPerSegment: perSeg,
    heatPerSeg: Q_seg,
    tStrip: T_strip,
    tMax,
    pct,
    matLabel: getMaterialLabel(rhoRaw),
  };
}

export function renderStripThermalIndicator(r: StripThermalResult) {
  let text: string;
  if (r.level === 'red') {
    text = `THERMAL RISK — ${r.tStrip.toFixed(1)}°C ≥ ${r.tMax}°C limit`;
  } else if (r.level === 'yellow') {
    text = `WARM — ${r.tStrip.toFixed(1)}°C (${r.matLabel}, ${r.pct.toFixed(0)}% of limit)`;
  } else {
    const heatStr = r.heatPerSeg >= 0.01 ? `${r.heatPerSeg.toFixed(2)}W` : `${(r.heatPerSeg * 1000).toFixed(1)}mW`;
    text = `OK — ${r.tStrip.toFixed(1)}°C (${heatStr})`;
  }
  setSafetyEl('safety-strip-thermal', EMOJI[r.level], text, COLOR[r.level]);
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

  renderStripRecommendations(r);
}

/* ─────────────────────────────────────────────
   F10c — Automatic Strip Recommendations
   Triggered when ampacity is yellow/red.
   Suggests upgrade options from AMPACITY_TABLE.
   ───────────────────────────────────────────── */

export interface StripRecommendation {
  label: string;
  detail: string;
  t: number;
  w: number;
  layers: number;
}

export function getStripRecommendations(
  currentPerSeg: number,
  currentT: number,
  currentW: number,
): StripRecommendation[] {
  if (currentPerSeg <= 0) return [];

  const recs: StripRecommendation[] = [];
  const currentArea = currentT * currentW;

  // Suggestion 1: best single-layer upgrade (smallest area that handles the current)
  const singleCandidates = AMPACITY_TABLE
    .filter(e => e.maxA >= currentPerSeg && (e.t * e.w) > currentArea)
    .sort((a, b) => (a.t * a.w) - (b.t * b.w));

  if (singleCandidates.length > 0) {
    const best = singleCandidates[0];
    recs.push({
      label: `Upgrade to ${best.t}×${best.w}mm`,
      detail: `${best.maxA}A max (single layer)`,
      t: best.t,
      w: best.w,
      layers: 1,
    });
  }

  // Suggestion 2: double-layer option using existing or thinner strip
  const doubleCandidates = AMPACITY_TABLE
    .filter(e => (e.maxA * 2) >= currentPerSeg && (e.t * e.w * 2) < currentArea * 1.5)
    .sort((a, b) => (a.t * a.w) - (b.t * b.w));

  if (doubleCandidates.length > 0) {
    const best = doubleCandidates[0];
    recs.push({
      label: `Double layer: 2× ${best.t}×${best.w}mm`,
      detail: `${(best.maxA * 2).toFixed(0)}A combined`,
      t: best.t,
      w: best.w,
      layers: 2,
    });
  }

  return recs;
}

function renderStripRecommendations(r: AmpacityResult) {
  const container = document.getElementById('safety-ampacity-recs');
  if (!container) return;

  if (r.level === 'green' || r.level === 'neutral') {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const tStrip = parseFloat(inputs['sim-strip-t']?.value ?? '0.15');
  const wStrip = parseFloat(inputs['sim-strip-w']?.value ?? '7');
  const recs = getStripRecommendations(r.currentPerSegment, tStrip, wStrip);

  if (recs.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  const items = recs.map(rec =>
    `<div class="flex items-start gap-1 text-[0.6rem] leading-tight mt-0.5">
      <span class="text-amber-500 font-bold shrink-0">→</span>
      <span><span class="font-semibold text-slate-700">${rec.label}</span> <span class="text-slate-500">${rec.detail}</span></span>
    </div>`
  ).join('');

  container.innerHTML = items;
  container.style.display = 'block';
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

/* ─────────────────────────────────────────────
   F7 — Packing Efficiency Indicator
   Compare actual fill ratio vs theoretical max
   🟢 ≥85% of theoretical / 🟡 70-85% / 🔴 <70%
   ───────────────────────────────────────────── */

export interface PackingResult {
  level: SafetyLevel;
  fillRatio: number;
  theoMax: number;
  efficiency: number; // fillRatio / theoMax (0..1)
}

export function checkPacking(fillRatio: number, theoMax: number): PackingResult {
  const efficiency = theoMax > 0 ? fillRatio / theoMax : 0;

  let level: SafetyLevel = 'green';
  if (efficiency < 0.70) level = 'red';
  else if (efficiency < 0.85) level = 'yellow';

  return { level, fillRatio, theoMax, efficiency };
}

export function renderPackingIndicator(r: PackingResult) {
  let text: string;
  if (r.level === 'red') {
    text = `LOW — ${(r.efficiency * 100).toFixed(0)}% of theoretical max (${(r.theoMax * 100).toFixed(1)}%)`;
  } else if (r.level === 'yellow') {
    text = `FAIR — ${(r.efficiency * 100).toFixed(0)}% of theoretical max`;
  } else {
    text = `GOOD — ${(r.efficiency * 100).toFixed(0)}% of theoretical max (${(r.theoMax * 100).toFixed(1)}%)`;
  }
  setSafetyEl('safety-packing', EMOJI[r.level], text, COLOR[r.level]);
}
