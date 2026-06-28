/* ─────────────────────────────────────────────
   F7 — Degradation & Cycle Life Engine
   Capacity fade curves, calendar life, cost per cycle.
   ───────────────────────────────────────────── */

import type { Chemistry } from './thermal-engine';

/* ── Chemistry degradation parameters ── */

interface DegradationParams {
  label: string;
  k1Base: number;         // Base degradation coefficient (% per √cycle)
  ea: number;             // Activation energy (kJ/mol) for Arrhenius
  nRef: number;           // Reference cycles to 80% SoH at 25°C, 1C, 80% DoD
  tRef: number;           // Reference temperature (°C)
  crateRef: number;       // Reference C-rate
  dodRef: number;         // Reference DoD (0-1)
  alpha: number;          // C-rate exponent
  beta: number;           // DoD exponent
  calendarLifeRef: number; // Reference calendar life (years) at 25°C
}

const DEGRADATION_PARAMS: Record<Chemistry, DegradationParams> = {
  nmc: {
    label: 'NMC',
    k1Base: 0.02,
    ea: 24.6,
    nRef: 500,
    tRef: 25,
    crateRef: 1,
    dodRef: 0.8,
    alpha: 0.4,
    beta: 0.6,
    calendarLifeRef: 10,
  },
  lfp: {
    label: 'LFP',
    k1Base: 0.005,
    ea: 20.0,
    nRef: 2000,
    tRef: 25,
    crateRef: 1,
    dodRef: 0.8,
    alpha: 0.3,
    beta: 0.5,
    calendarLifeRef: 15,
  },
  lto: {
    label: 'LTO',
    k1Base: 0.002,
    ea: 15.0,
    nRef: 8000,
    tRef: 25,
    crateRef: 1,
    dodRef: 0.8,
    alpha: 0.25,
    beta: 0.4,
    calendarLifeRef: 20,
  },
  'na-ion': {
    label: 'Na-Ion',
    k1Base: 0.01,
    ea: 22.0,
    nRef: 1000,
    tRef: 25,
    crateRef: 1,
    dodRef: 0.8,
    alpha: 0.35,
    beta: 0.55,
    calendarLifeRef: 8,
  },
  nca: {
    label: 'NCA',
    k1Base: 0.025,
    ea: 26.0,
    nRef: 400,
    tRef: 25,
    crateRef: 1,
    dodRef: 0.8,
    alpha: 0.45,
    beta: 0.65,
    calendarLifeRef: 8,
  },
};

/* ── Interfaces ── */

export interface DegradationConfig {
  chemistry: Chemistry;
  tempOperating: number;   // Average operating temperature (°C)
  crateAvg: number;        // Average C-rate
  dodAvg: number;          // Average depth of discharge (0-1)
  cyclesPerYear: number;   // How many cycles per year
  packCostEur: number;     // Total pack cost (EUR)
  packCapacityKwh: number; // Pack capacity (kWh)
}

export interface DegradationResult {
  // Capacity fade
  capacityFadePerCycle: number;  // % per √cycle
  cyclesTo80pct: number;         // Cycles to 80% SoH
  cyclesTo70pct: number;         // Cycles to 70% SoH
  // Calendar life
  calendarLifeYears: number;     // Calendar life to 80% SoH
  // Cost analysis
  costPerCycle: number;          // EUR per cycle
  costPerKwhCycle: number;       // EUR per kWh per cycle
  // Degradation curve (for chart)
  degradationCurve: { cycle: number; capacityPct: number }[];
  // Summary
  level: 'excellent' | 'good' | 'fair' | 'poor';
  levelColor: string;
  statusText: string;
  warnings: string[];
}

/* ── Main degradation analysis function ── */

export function analyzeDegradation(config: DegradationConfig): DegradationResult {
  const params = DEGRADATION_PARAMS[config.chemistry] || DEGRADATION_PARAMS.nmc;
  const warnings: string[] = [];

  const R = 8.314; // J/(mol·K)
  const Tref = params.tRef + 273.15;
  const Toperating = config.tempOperating + 273.15;

  // ── 1. Temperature effect (Arrhenius) ──
  const arrheniusFactor = (params.ea * 1000 / R) * (1 / Tref - 1 / Toperating);
  const tempMultiplier = Math.exp(arrheniusFactor);

  // ── 2. C-rate effect ──
  const crateMultiplier = Math.pow(config.crateAvg / params.crateRef, params.alpha);

  // ── 3. DoD effect ──
  const dodMultiplier = Math.pow(config.dodAvg / params.dodRef, params.beta);

  // ── 4. Combined degradation coefficient ──
  const k1 = params.k1Base * tempMultiplier * crateMultiplier * dodMultiplier;

  // ── 5. Cycles to 80% SoH ──
  // Capacity fade model: ΔQ = k1 × √n
  // At 80% SoH: 20% fade = k1 × √n → n = (20/k1)²
  const cyclesTo80pct = Math.round(Math.pow(20 / k1, 2));
  const cyclesTo70pct = Math.round(Math.pow(30 / k1, 2));

  // ── 6. Calendar life (Arrhenius) ──
  const calendarLifeYears = Math.round(params.calendarLifeRef * Math.exp(arrheniusFactor));

  // ── 7. Cost per cycle ──
  const costPerCycle = config.packCostEur / Math.max(1, cyclesTo80pct);
  const costPerKwhCycle = config.packCapacityKwh > 0
    ? costPerCycle / config.packCapacityKwh
    : 0;

  // ── 8. Degradation curve ──
  const degradationCurve: { cycle: number; capacityPct: number }[] = [];
  const maxCycles = Math.min(cyclesTo80pct * 1.2, 10000);
  const step = Math.max(1, Math.floor(maxCycles / 50));
  for (let n = 0; n <= maxCycles; n += step) {
    const fade = k1 * Math.sqrt(n);
    degradationCurve.push({ cycle: n, capacityPct: Math.max(0, 100 - fade) });
  }

  // ── 9. Warnings ──
  if (cyclesTo80pct < 500) {
    warnings.push(`Low cycle life (${cyclesTo80pct} cycles) — consider LFP for longer life`);
  }

  if (config.tempOperating > 45) {
    warnings.push(`High operating temperature (${config.tempOperating}°C) significantly reduces cycle life`);
  }

  if (config.crateAvg > 2) {
    warnings.push(`High C-rate (${config.crateAvg}C) accelerates degradation — consider lower discharge rate`);
  }

  if (config.dodAvg > 0.9) {
    warnings.push(`Deep discharge (${(config.dodAvg * 100).toFixed(0)}% DoD) reduces cycle life — consider limiting to 80% DoD`);
  }

  // ── 10. Level ──
  let level: 'excellent' | 'good' | 'fair' | 'poor';
  let levelColor: string;
  if (cyclesTo80pct >= 3000) {
    level = 'excellent';
    levelColor = '#22c55e';
  } else if (cyclesTo80pct >= 1000) {
    level = 'good';
    levelColor = '#3b82f6';
  } else if (cyclesTo80pct >= 500) {
    level = 'fair';
    levelColor = '#eab308';
  } else {
    level = 'poor';
    levelColor = '#ef4444';
  }

  // ── 11. Status text ──
  const statusText = `${cyclesTo80pct.toLocaleString()} cycles to 80% SoH  |  ${calendarLifeYears}yr calendar life  |  €${costPerCycle.toFixed(2)}/cycle`;

  return {
    capacityFadePerCycle: k1,
    cyclesTo80pct,
    cyclesTo70pct,
    calendarLifeYears,
    costPerCycle,
    costPerKwhCycle,
    degradationCurve,
    level,
    levelColor,
    statusText,
    warnings,
  };
}

/* ── Render helpers ── */

export function renderDegradationCard(result: DegradationResult, config: DegradationConfig): string {
  const warningsHtml = result.warnings.length > 0 ? `
    <div class="bg-amber-50 border border-amber-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-amber-600 uppercase mb-1">Warnings</div>
      ${result.warnings.map(w => `
        <div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
          <span class="text-amber-500 font-bold shrink-0">→</span>
          <span class="text-amber-700">${w}</span>
        </div>`).join('')}
    </div>` : '';

  // Simple ASCII chart of degradation curve
  const chartPoints = result.degradationCurve.filter((_, i) => i % Math.max(1, Math.floor(result.degradationCurve.length / 20)) === 0);
  const maxCycle = chartPoints[chartPoints.length - 1]?.cycle ?? 1;

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="flex justify-between items-center mb-1">
        <span class="text-[0.68rem] font-extrabold text-slate-400 uppercase">Cycle Life Analysis</span>
        <span class="text-[0.55rem] font-bold px-1.5 py-0.5 rounded" style="background: ${result.levelColor}20; color: ${result.levelColor};">
          ${result.level.toUpperCase()}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Cycles to 80% SoH</span>
        <span class="font-mono font-semibold text-slate-700">${result.cyclesTo80pct.toLocaleString()}</span>
        <span class="text-slate-500">Cycles to 70% SoH</span>
        <span class="font-mono font-semibold text-slate-700">${result.cyclesTo70pct.toLocaleString()}</span>
        <span class="text-slate-500">Calendar Life</span>
        <span class="font-mono font-semibold text-slate-700">${result.calendarLifeYears} years</span>
        <span class="text-slate-500">Capacity Fade</span>
        <span class="font-mono font-semibold text-slate-700">${result.capacityFadePerCycle.toFixed(4)}% per √cycle</span>
      </div>
    </div>

    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1">Cost Analysis</div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Pack Cost</span>
        <span class="font-mono font-semibold text-slate-700">€${config.packCostEur.toFixed(0)}</span>
        <span class="text-slate-500">Cost per Cycle</span>
        <span class="font-mono font-semibold text-slate-700">€${result.costPerCycle.toFixed(2)}</span>
        <span class="text-slate-500">Cost per kWh per Cycle</span>
        <span class="font-mono font-semibold text-slate-700">€${result.costPerKwhCycle.toFixed(4)}</span>
        <span class="text-slate-500">Total Energy (80% life)</span>
        <span class="font-mono font-semibold text-slate-700">${(result.cyclesTo80pct * config.packCapacityKwh).toFixed(0)} kWh</span>
      </div>
    </div>

    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 mb-1">Degradation Curve</div>
      <div class="flex items-end gap-px" style="height: 40px;">
        ${chartPoints.map(p => {
          const h = Math.max(2, (p.capacityPct / 100) * 38);
          const color = p.capacityPct >= 80 ? '#22c55e' : p.capacityPct >= 70 ? '#eab308' : '#ef4444';
          return `<div style="flex:1; height:${h}px; background:${color}; min-width:2px;" title="${p.cycle} cycles: ${p.capacityPct.toFixed(1)}%"></div>`;
        }).join('')}
      </div>
      <div class="flex justify-between text-[0.5rem] text-slate-400 mt-0.5">
        <span>0</span>
        <span>${maxCycle.toLocaleString()} cycles</span>
      </div>
    </div>

    ${warningsHtml}
  `;
}
