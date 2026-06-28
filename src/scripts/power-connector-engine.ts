/* ─────────────────────────────────────────────
   F17 — Power Connector & Cable Guide Engine
   Connector DB, AWG table, recommendation algorithms,
   BMS wiring diagram data, and fuse sizing.
   ───────────────────────────────────────────── */

import type { BmsEntry } from './bms-database';

/* ── Connector Database ── */

export interface Connector {
  name: string;
  continuousA: number;
  burstA: number;
  contactResistance: number; // mΩ
  voltageMax: number;
  wireRange: [number, number]; // AWG [min, max] — lower AWG = thicker
  weightG: number;
  antiSpark: boolean;
  type: 'bullet' | 'anderson' | 'ec' | 'ring';
  category: 'low' | 'mid' | 'high' | 'industrial';
}

export const CONNECTOR_DB: Connector[] = [
  // Bullet connectors (XT series — RC origin, compact)
  { name: 'XT30', continuousA: 30, burstA: 45, contactResistance: 0.8, voltageMax: 150, wireRange: [14, 18], weightG: 2.5, antiSpark: false, type: 'bullet', category: 'low' },
  { name: 'XT60', continuousA: 60, burstA: 100, contactResistance: 0.4, voltageMax: 150, wireRange: [10, 14], weightG: 5.5, antiSpark: false, type: 'bullet', category: 'mid' },
  { name: 'XT90', continuousA: 90, burstA: 150, contactResistance: 0.2, voltageMax: 150, wireRange: [8, 12], weightG: 12, antiSpark: false, type: 'bullet', category: 'mid' },
  { name: 'XT90-S', continuousA: 90, burstA: 150, contactResistance: 0.2, voltageMax: 150, wireRange: [8, 12], weightG: 14, antiSpark: true, type: 'bullet', category: 'mid' },
  { name: 'EC5', continuousA: 120, burstA: 180, contactResistance: 0.15, voltageMax: 150, wireRange: [8, 10], weightG: 16, antiSpark: false, type: 'ec', category: 'high' },
  { name: 'EC8', continuousA: 150, burstA: 240, contactResistance: 0.1, voltageMax: 150, wireRange: [6, 8], weightG: 20, antiSpark: false, type: 'ec', category: 'high' },

  // AS series (large bullets — separate +/- plugs)
  { name: 'AS150', continuousA: 150, burstA: 250, contactResistance: 0.08, voltageMax: 300, wireRange: [6, 8], weightG: 25, antiSpark: false, type: 'bullet', category: 'high' },
  { name: 'AS200', continuousA: 200, burstA: 350, contactResistance: 0.06, voltageMax: 300, wireRange: [4, 6], weightG: 35, antiSpark: false, type: 'bullet', category: 'industrial' },

  // Anderson PowerPole (modular, field serviceable)
  { name: 'PP15', continuousA: 15, burstA: 30, contactResistance: 1.0, voltageMax: 600, wireRange: [14, 18], weightG: 3, antiSpark: false, type: 'anderson', category: 'low' },
  { name: 'PP30', continuousA: 30, burstA: 45, contactResistance: 0.5, voltageMax: 600, wireRange: [12, 14], weightG: 5, antiSpark: false, type: 'anderson', category: 'low' },
  { name: 'PP45', continuousA: 45, burstA: 75, contactResistance: 0.35, voltageMax: 600, wireRange: [10, 12], weightG: 7, antiSpark: false, type: 'anderson', category: 'mid' },

  // Anderson SB series (industrial, genderless)
  { name: 'SB50', continuousA: 50, burstA: 120, contactResistance: 0.25, voltageMax: 600, wireRange: [6, 12], weightG: 20, antiSpark: false, type: 'anderson', category: 'mid' },
  { name: 'SB120', continuousA: 120, burstA: 240, contactResistance: 0.15, voltageMax: 600, wireRange: [2, 6], weightG: 35, antiSpark: false, type: 'anderson', category: 'high' },
  { name: 'SB175', continuousA: 175, burstA: 350, contactResistance: 0.1, voltageMax: 600, wireRange: [2, 0], weightG: 50, antiSpark: false, type: 'anderson', category: 'industrial' },
  { name: 'SB350', continuousA: 350, burstA: 550, contactResistance: 0.05, voltageMax: 600, wireRange: [4, 0], weightG: 80, antiSpark: false, type: 'anderson', category: 'industrial' },
];

/* ── AWG / Cable Gauge Table ── */

export interface AwgEntry {
  awg: number;          // 14, 12, 10, 8, 6, 4, 2, 1, 0, 20, 30, 40 (encoded as 0, 20, 30, 40)
  label: string;        // "14 AWG", "1/0 AWG", etc.
  areaMm2: number;
  resistanceOhmPerKft: number;
  ampacity60C: number;  // A
  ampacity75C: number;
}

// Internal sort key: 4/0=400, 3/0=300, 2/0=200, 1/0=0, 1=1, 2=2, ...
function awgSortKey(awg: number): number {
  if (awg === 0) return 0;    // 1/0
  if (awg === 20) return -1;  // 2/0
  if (awg === 30) return -2;  // 3/0
  if (awg === 40) return -3;  // 4/0
  return awg;                  // positive AWG
}

export const AWG_TABLE: AwgEntry[] = [
  { awg: 14,  label: '14 AWG',  areaMm2: 2.08,  resistanceOhmPerKft: 2.525, ampacity60C: 15, ampacity75C: 15 },
  { awg: 12,  label: '12 AWG',  areaMm2: 3.31,  resistanceOhmPerKft: 1.588, ampacity60C: 20, ampacity75C: 20 },
  { awg: 10,  label: '10 AWG',  areaMm2: 5.26,  resistanceOhmPerKft: 0.999, ampacity60C: 30, ampacity75C: 30 },
  { awg: 8,   label: '8 AWG',   areaMm2: 8.37,  resistanceOhmPerKft: 0.628, ampacity60C: 40, ampacity75C: 45 },
  { awg: 6,   label: '6 AWG',   areaMm2: 13.30, resistanceOhmPerKft: 0.395, ampacity60C: 55, ampacity75C: 60 },
  { awg: 4,   label: '4 AWG',   areaMm2: 21.15, resistanceOhmPerKft: 0.249, ampacity60C: 70, ampacity75C: 80 },
  { awg: 2,   label: '2 AWG',   areaMm2: 33.62, resistanceOhmPerKft: 0.156, ampacity60C: 95, ampacity75C: 115 },
  { awg: 1,   label: '1 AWG',   areaMm2: 42.41, resistanceOhmPerKft: 0.124, ampacity60C: 110, ampacity75C: 130 },
  { awg: 0,   label: '1/0 AWG', areaMm2: 53.49, resistanceOhmPerKft: 0.098, ampacity60C: 125, ampacity75C: 150 },
  { awg: 20,  label: '2/0 AWG', areaMm2: 67.43, resistanceOhmPerKft: 0.078, ampacity60C: 145, ampacity75C: 175 },
  { awg: 30,  label: '3/0 AWG', areaMm2: 85.01, resistanceOhmPerKft: 0.062, ampacity60C: 165, ampacity75C: 200 },
  { awg: 40,  label: '4/0 AWG', areaMm2: 107.20, resistanceOhmPerKft: 0.049, ampacity60C: 195, ampacity75C: 230 },
];

/* ── Fuse Standard Ratings (A) ── */

const FUSE_RATINGS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 150, 175, 200, 250, 300, 350, 400];

/* ── Application profiles ── */

export type Application = 'ebike' | 'powerwall' | 'ev' | 'drone' | 'general';

interface AppProfile {
  label: string;
  preferType: 'bullet' | 'anderson' | 'ec' | 'ring' | 'any';
  preferLightweight: boolean;
  preferFieldServiceable: boolean;
  maxVoltageDropPct: number;
}

const APP_PROFILES: Record<Application, AppProfile> = {
  ebike:       { label: 'E-Bike',           preferType: 'any',     preferLightweight: false, preferFieldServiceable: true,  maxVoltageDropPct: 3 },
  powerwall:   { label: 'Powerwall',        preferType: 'anderson',preferLightweight: false, preferFieldServiceable: true,  maxVoltageDropPct: 2 },
  ev:          { label: 'Electric Vehicle', preferType: 'any',     preferLightweight: false, preferFieldServiceable: false, maxVoltageDropPct: 2 },
  drone:       { label: 'Drone/UAV',        preferType: 'bullet',  preferLightweight: true,  preferFieldServiceable: false, maxVoltageDropPct: 5 },
  general:     { label: 'General',          preferType: 'any',     preferLightweight: false, preferFieldServiceable: false, maxVoltageDropPct: 3 },
};

/* ── Result Types ── */

export interface ConnectorRecommendation {
  connector: Connector;
  reason: string;
  wireGauge: AwgEntry;
  voltageDrop: number;   // V
  voltageDropPct: number; // %
  needsAntiSpark: boolean;
  fuseRating: number;    // A
  fuseType: string;
  safetyNotes: string[];
}

export interface CableRecommendation {
  gauge: AwgEntry;
  voltageDrop: number;
  voltageDropPct: number;
  ampacityMargin: number; // % over current
}

export interface BalanceWireInfo {
  awg: number;
  label: string;
  wireCount: number;     // S + 1
  gaugeLabel: string;
}

export interface BmsWiringData {
  seriesCount: number;
  balanceWires: BalanceWireInfo;
  mainNegWire: string;   // AWG label for B- to BMS
  mainPosWire: string;   // AWG label for pack+ output
  diagram: BmsDiagramNode[];
}

export interface BmsDiagramNode {
  id: string;
  type: 'cell' | 'bms' | 'fuse' | 'connector' | 'terminal';
  label: string;
  x: number;
  y: number;
  color?: string;
}

/* ── Main Recommendation Function ── */

export function recommendConnector(
  packS: number,
  packP: number,
  cellNom: number,
  cellAh: number,
  iMax: number,
  bms: BmsEntry | null,
  cableLengthCm: number,
  application: Application,
): ConnectorRecommendation {
  const packVoltage = packS * cellNom;
  const profile = APP_PROFILES[application];

  // 1. Find connectors that handle the current (with 25% margin)
  const requiredA = iMax * 1.25;
  const needsAntiSpark = packVoltage > 36; // >7S li-ion or >12S LFP

  let candidates = CONNECTOR_DB.filter(c => c.continuousA >= requiredA);

  // Prefer anti-spark if voltage is high
  if (needsAntiSpark) {
    const antiSpark = candidates.filter(c => c.antiSpark);
    if (antiSpark.length > 0) candidates = antiSpark;
  }

  // Prefer application type
  if (profile.preferType !== 'any') {
    const typed = candidates.filter(c => c.type === profile.preferType);
    if (typed.length > 0) candidates = typed;
  }

  // Prefer field serviceable for powerwall/ebike
  if (profile.preferFieldServiceable) {
    const anderson = candidates.filter(c => c.type === 'anderson');
    if (anderson.length > 0) candidates = anderson;
  }

  // Sort: lightest first if drone, otherwise smallest continuousA that fits
  if (profile.preferLightweight) {
    candidates.sort((a, b) => a.weightG - b.weightG);
  } else {
    candidates.sort((a, b) => a.continuousA - b.continuousA);
  }

  const connector = candidates[0] ?? CONNECTOR_DB[CONNECTOR_DB.length - 1]; // fallback to SB350

  // 2. Find best cable gauge for this current
  const cableRec = recommendCableGauge(iMax, cableLengthCm, packVoltage, profile.maxVoltageDropPct);

  // 3. Fuse rating
  const fuse = recommendFuse(iMax, packVoltage);

  // 4. Safety notes
  const safetyNotes: string[] = [];
  if (needsAntiSpark && !connector.antiSpark) {
    safetyNotes.push(`⚠ Pack ${packVoltage.toFixed(0)}V — consider anti-spark connector (XT90-S or pre-charge resistor)`);
  }
  if (connector.continuousA < iMax * 1.5) {
    safetyNotes.push(`⚡ Connector rated ${connector.continuousA}A — only ${Math.round((connector.continuousA / iMax - 1) * 100)}% margin over I_max`);
  }
  if (cableRec.voltageDropPct > profile.maxVoltageDropPct) {
    safetyNotes.push(`📉 Voltage drop ${cableRec.voltageDropPct.toFixed(1)}% exceeds ${profile.maxVoltageDropPct}% target — consider shorter cable or thicker gauge`);
  }
  if (packVoltage > 60) {
    safetyNotes.push(`🔒 High voltage (${packVoltage.toFixed(0)}V) — use insulated connectors and follow local electrical codes`);
  }
  if (bms && iMax > bms.maxA * 0.8) {
    safetyNotes.push(`⚡ BMS MOSFET (${bms.maxA}A) close to I_max (${iMax.toFixed(1)}A) — verify thermal headroom`);
  }

  // Reason text
  let reason = `${connector.continuousA}A continuous`;
  if (connector.antiSpark) reason += ' + anti-spark';
  if (application === 'drone') reason += ' (lightweight)';
  if (application === 'powerwall') reason += ' (field serviceable)';

  return {
    connector,
    reason,
    wireGauge: cableRec.gauge,
    voltageDrop: cableRec.voltageDrop,
    voltageDropPct: cableRec.voltageDropPct,
    needsAntiSpark,
    fuseRating: fuse.rating,
    fuseType: fuse.type,
    safetyNotes,
  };
}

/* ── Cable Gauge Recommendation ── */

export function recommendCableGauge(
  currentA: number,
  lengthCm: number,
  voltageV: number,
  maxDropPct: number,
): CableRecommendation {
  const lengthM = lengthCm / 100;
  // Round-trip length for voltage drop calc (positive + negative)
  const roundTripM = lengthM * 2;

  // Find minimum AWG by ampacity (use 75°C column for safety)
  let minByAmpacity: AwgEntry | null = null;
  for (const entry of AWG_TABLE) {
    if (entry.ampacity75C >= currentA) {
      minByAmpacity = entry;
      break;
    }
  }
  if (!minByAmpacity) minByAmpacity = AWG_TABLE[AWG_TABLE.length - 1]; // biggest available

  // Find minimum AWG by voltage drop
  const maxOhm = (voltageV * (maxDropPct / 100)) / currentA;
  // R_total = R_per_ft × roundTripFt / 1000
  const roundTripFt = roundTripM * 3.28084;
  let minByDrop: AwgEntry | null = null;
  for (const entry of AWG_TABLE) {
    const rTotal = (entry.resistanceOhmPerKft * roundTripFt) / 1000;
    if (rTotal <= maxOhm) {
      minByDrop = entry;
      break;
    }
  }
  if (!minByDrop) minByDrop = AWG_TABLE[AWG_TABLE.length - 1];

  // Pick the thicker (lower AWG number) of the two
  const keyA = awgSortKey(minByAmpacity.awg);
  const keyD = awgSortKey(minByDrop.awg);
  const gauge = keyA <= keyD ? minByAmpacity : minByDrop; // lower AWG = thicker

  // Calculate actual voltage drop
  const rPerFt = gauge.resistanceOhmPerKft / 1000;
  const rTotal = rPerFt * roundTripFt;
  const vDrop = rTotal * currentA;
  const vDropPct = voltageV > 0 ? (vDrop / voltageV) * 100 : 0;

  const ampacityMargin = currentA > 0 ? ((gauge.ampacity75C / currentA) - 1) * 100 : 0;

  return { gauge, voltageDrop: vDrop, voltageDropPct: vDropPct, ampacityMargin };
}

/* ── Fuse Sizing ── */

export function recommendFuse(iMax: number, voltageV: number): { rating: number; type: string } {
  // Fuse should be 125% of continuous current, rounded up to standard value
  const target = iMax * 1.25;
  let rating = FUSE_RATINGS[0];
  for (const r of FUSE_RATINGS) {
    if (r >= target) { rating = r; break; }
    rating = r; // fallback to largest if none fits
  }

  // Fuse type selection
  let type = 'ANL';
  if (rating <= 15) type = 'Blade (ATO/ATC)';
  else if (rating <= 30) type = 'MAXI';
  else if (rating <= 60) type = 'MIDI';
  else if (rating <= 150) type = 'ANL';
  else type = 'Class-T';

  return { rating, type };
}

/* ── BMS Wiring Diagram Data ── */

export function generateBmsWiring(
  packS: number,
  bms: BmsEntry | null,
  packP: number,
  cellAh: number,
  iMax: number,
  cellNom: number,
): BmsWiringData {
  // Balance wire gauge based on series count
  let balAwg = 22;
  let balLabel = '22 AWG';
  if (packS > 16) { balAwg = 20; balLabel = '20 AWG'; }
  if (packS > 24) { balAwg = 18; balLabel = '18 AWG'; }

  const balanceWires: BalanceWireInfo = {
    awg: balAwg,
    label: balLabel,
    wireCount: packS + 1,
    gaugeLabel: balLabel,
  };

  // Main B- wire gauge (BMS handles this current)
  const mainCurrent = iMax;
  const mainCable = recommendCableGauge(mainCurrent, 30, packS * cellNom, 3);

  // Generate diagram nodes (vertical layout)
  const diagram: BmsDiagramNode[] = [];
  const cellWidth = 40;
  const cellGap = 8;
  const startX = 20;
  const startY = 20;
  const bmsX = startX + packS * (cellWidth + cellGap) + 40;

  // Cells (series)
  for (let i = 0; i < packS; i++) {
    diagram.push({
      id: `cell-${i}`,
      type: 'cell',
      label: `S${i + 1}`,
      x: startX + i * (cellWidth + cellGap),
      y: startY,
      color: i % 2 === 0 ? '#3b82f6' : '#60a5fa',
    });
  }

  // BMS box
  diagram.push({
    id: 'bms',
    type: 'bms',
    label: bms ? bms.name : 'BMS',
    x: bmsX,
    y: startY + 20,
    color: '#22c55e',
  });

  // Fuse (on positive output)
  diagram.push({
    id: 'fuse',
    type: 'fuse',
    label: `Fuse ${recommendFuse(iMax, packS * 3.6).rating}A`,
    x: bmsX + 60,
    y: startY,
    color: '#ef4444',
  });

  // Output connector
  diagram.push({
    id: 'connector',
    type: 'connector',
    label: 'Output',
    x: bmsX + 120,
    y: startY + 20,
    color: '#f59e0b',
  });

  return {
    seriesCount: packS,
    balanceWires,
    mainNegWire: mainCable.gauge.label,
    mainPosWire: mainCable.gauge.label,
    diagram,
  };
}

/* ── Render helpers (return HTML strings for sidebar) ── */

export function renderConnectorCard(rec: ConnectorRecommendation): string {
  const notes = rec.safetyNotes.map(n =>
    `<div class="flex items-start gap-1 text-[0.6rem] leading-tight mt-0.5">
      <span class="text-amber-500 font-bold shrink-0">→</span>
      <span class="text-slate-600">${n}</span>
    </div>`
  ).join('');

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1 border-b border-slate-200 pb-1">Recommended Connector</div>
      <div class="flex justify-between items-center mb-1">
        <span class="text-[0.78rem] font-extrabold text-slate-700">${rec.connector.name}</span>
        <span class="text-[0.55rem] font-bold px-1.5 py-0.5 rounded ${rec.connector.antiSpark ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}">${rec.connector.continuousA}A</span>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Type</span>
        <span class="font-mono font-semibold text-slate-700">${rec.connector.type}</span>
        <span class="text-slate-500">Continuous</span>
        <span class="font-mono font-semibold text-slate-700">${rec.connector.continuousA}A / ${rec.connector.burstA}A burst</span>
        <span class="text-slate-500">Resistance</span>
        <span class="font-mono font-semibold text-slate-700">${rec.connector.contactResistance} mΩ</span>
        <span class="text-slate-500">Max Voltage</span>
        <span class="font-mono font-semibold text-slate-700">${rec.connector.voltageMax}V</span>
        <span class="text-slate-500">Wire Range</span>
        <span class="font-mono font-semibold text-slate-700">${rec.connector.wireRange[1]}–${rec.connector.wireRange[0]} AWG</span>
        <span class="text-slate-500">Weight</span>
        <span class="font-mono font-semibold text-slate-700">${rec.connector.weightG}g</span>
      </div>
      ${rec.connector.antiSpark ? '<div class="mt-1 text-[0.6rem] font-bold text-amber-600">⚡ Anti-Spark built-in</div>' : ''}
    </div>

    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1 border-b border-slate-200 pb-1">Cable & Fuse</div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Cable Gauge</span>
        <span class="font-mono font-semibold text-slate-700">${rec.wireGauge.label} (${rec.wireGauge.areaMm2}mm²)</span>
        <span class="text-slate-500">Ampacity</span>
        <span class="font-mono font-semibold text-slate-700">${rec.wireGauge.ampacity75C}A (75°C)</span>
        <span class="text-slate-500">Voltage Drop</span>
        <span class="font-mono font-semibold ${rec.voltageDropPct > 3 ? 'text-red-600' : 'text-slate-700'}">${rec.voltageDrop.toFixed(2)}V (${rec.voltageDropPct.toFixed(1)}%)</span>
        <span class="text-slate-500">Fuse</span>
        <span class="font-mono font-semibold text-slate-700">${rec.fuseRating}A ${rec.fuseType}</span>
      </div>
    </div>

    ${notes ? `
    <div class="bg-amber-50 border border-amber-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-amber-600 uppercase mb-1">Safety Notes</div>
      ${notes}
    </div>` : ''}
  `;
}

export function renderBmsWiringInfo(wiring: BmsWiringData): string {
  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1 border-b border-slate-200 pb-1">BMS Wiring</div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Balance Wires</span>
        <span class="font-mono font-semibold text-slate-700">${wiring.balanceWires.wireCount}× ${wiring.balanceWires.label}</span>
        <span class="text-slate-500">Main B- Cable</span>
        <span class="font-mono font-semibold text-slate-700">${wiring.mainNegWire}</span>
        <span class="text-slate-500">Main P+ Cable</span>
        <span class="font-mono font-semibold text-slate-700">${wiring.mainPosWire}</span>
      </div>
      <div class="mt-1.5 text-[0.58rem] text-slate-400 leading-tight">
        ${wiring.seriesCount} series taps → BMS balance inputs (B-, B1, B2, ... B${wiring.seriesCount})
      </div>
    </div>
  `;
}
