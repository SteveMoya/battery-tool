/* ─────────────────────────────────────────────
   F2 — Cell Thermal Engine
   Advanced thermal model with derating curves,
   cycle life estimation, and cooling effects.
   ───────────────────────────────────────────── */

import type { SafetyLevel } from './safety-indicators';
import { t } from '../i18n';

/* ── Chemistry-specific thermal parameters ── */

export type Chemistry = 'nmc' | 'lfp' | 'lto' | 'na-ion' | 'nca';
export type CoolingType = 'none' | 'air' | 'liquid';

interface ChemistryThermal {
  label: string;
  ea: number;              // Activation energy (kJ/mol) for Arrhenius
  nRef: number;            // Reference cycles at 25°C, 1C, 80% DoD
  tRef: number;            // Reference temperature (°C)
  crateRef: number;        // Reference C-rate
  dodRef: number;          // Reference DoD (0-1)
  deratingCurve: { temp: number; capacityPct: number }[];
  tMax: number;            // Absolute max temperature
  tRecommended: number;    // Recommended max for long life
}

const CHEMISTRY_PARAMS: Record<Chemistry, ChemistryThermal> = {
  nmc: {
    label: t('thermal.nmcFull'),
    ea: 24.6, nRef: 500, tRef: 25, crateRef: 1, dodRef: 0.8,
    deratingCurve: [
      { temp: 25, capacityPct: 100 },
      { temp: 35, capacityPct: 95 },
      { temp: 45, capacityPct: 85 },
      { temp: 55, capacityPct: 70 },
    ],
    tMax: 60, tRecommended: 45,
  },
  lfp: {
    label: t('thermal.lfpFull'),
    ea: 20.0, nRef: 2000, tRef: 25, crateRef: 1, dodRef: 0.8,
    deratingCurve: [
      { temp: 25, capacityPct: 100 },
      { temp: 35, capacityPct: 98 },
      { temp: 45, capacityPct: 92 },
      { temp: 55, capacityPct: 80 },
    ],
    tMax: 65, tRecommended: 50,
  },
  lto: {
    label: t('thermal.ltoFull'),
    ea: 15.0, nRef: 8000, tRef: 25, crateRef: 1, dodRef: 0.8,
    deratingCurve: [
      { temp: 25, capacityPct: 100 },
      { temp: 35, capacityPct: 99 },
      { temp: 45, capacityPct: 95 },
      { temp: 55, capacityPct: 88 },
    ],
    tMax: 70, tRecommended: 55,
  },
  'na-ion': {
    label: t('thermal.naIonFull'),
    ea: 22.0, nRef: 1000, tRef: 25, crateRef: 1, dodRef: 0.8,
    deratingCurve: [
      { temp: 25, capacityPct: 100 },
      { temp: 35, capacityPct: 96 },
      { temp: 45, capacityPct: 88 },
      { temp: 55, capacityPct: 75 },
    ],
    tMax: 55, tRecommended: 40,
  },
  nca: {
    label: t('thermal.ncaFull'),
    ea: 26.0, nRef: 400, tRef: 25, crateRef: 1, dodRef: 0.8,
    deratingCurve: [
      { temp: 25, capacityPct: 100 },
      { temp: 35, capacityPct: 94 },
      { temp: 45, capacityPct: 82 },
      { temp: 55, capacityPct: 65 },
    ],
    tMax: 60, tRecommended: 40,
  },
};

/* ── Cooling effectiveness ── */

interface CoolingParams {
  hConvection: number;     // W/m²K effective heat transfer coefficient
  deltaT: number;          // Temperature reduction from ambient (°C) at rated load
  powerPenalty: number;    // Power consumption as fraction of heat dissipated
}

const COOLING_PARAMS: Record<CoolingType, CoolingParams> = {
  none: { hConvection: 8, deltaT: 0, powerPenalty: 0 },
  air: { hConvection: 50, deltaT: 8, powerPenalty: 0.02 },
  liquid: { hConvection: 500, deltaT: 3, powerPenalty: 0.05 },
};

/* ── Interfaces ── */

export interface ThermalConfig {
  tAmb: number;            // Ambient temperature (°C)
  tMax: number;            // Maximum allowed cell temperature (°C)
  coolingType: CoolingType;
  airflowCFM: number;      // Air cooling: cubic feet per minute
  coolantFlowLPM: number;  // Liquid cooling: liters per minute
  chemistry: Chemistry;
  sCount: number;
  pCount: number;
  cellAh: number;
  iMax: number;            // Pack max continuous current (A)
  cellIR: number;          // Cell internal resistance (Ω)
  crateAvg: number;        // Average C-rate during operation
  dodAvg: number;          // Average depth of discharge (0-1)
}

export interface ThermalResult {
  tCell: number;           // Estimated cell temperature (°C)
  tCellMax: number;        // Hottest cell (central, with grouping penalty)
  tCellMin: number;        // Coolest cell (peripheral)
  thermalGradient: number;  // ΔT between hottest and coolest (°C)
  deratingFactor: number;  // 0-1, capacity derating due to temperature
  estimatedCycles: number; // Cycle life estimate to 80% capacity
  annualDegradation: number; // % capacity loss per year at 1 cycle/day
  coolingPowerW: number;   // Power consumed by cooling system (W)
  heatGenerationW: number; // Total heat generated (W)
  level: SafetyLevel;
  statusText: string;
}

/* ── Main thermal analysis function ── */

export function analyzeThermal(config: ThermalConfig): ThermalResult {
  const chem = CHEMISTRY_PARAMS[config.chemistry] || CHEMISTRY_PARAMS.nmc;
  const cooling = COOLING_PARAMS[config.coolingType];

  // ── 1. Heat generation (Joule heating) ──
  const nCells = config.sCount * config.pCount;
  const currentPerCell = config.pCount > 0 ? config.iMax / config.pCount : config.iMax;
  const heatPerCell = currentPerCell * currentPerCell * config.cellIR;
  const heatTotal = nCells * heatPerCell;

  // ── 2. Base temperature rise (convection model) ──
  // Simplified: ΔT = Q / (h × A_surface)
  // A_surface per cell ≈ π × d × l (cylindrical) or w × h (prismatic)
  // Use a simplified total surface area estimate
  const surfaceAreaTotal = nCells * 0.003; // ~30cm² per cell typical (rough estimate)
  const deltaTbase = cooling.hConvection > 0
    ? heatTotal / (cooling.hConvection * surfaceAreaTotal)
    : heatTotal * 10; // very rough if no h value

  // Apply cooling effectiveness
  const deltaTcooled = Math.max(0, deltaTbase - cooling.deltaT);

  // ── 3. Cell grouping penalty (central cells hotter) ──
  // More cells in parallel → more central cells → higher gradient
  const groupingPenalty = Math.min(15, config.pCount * 1.5); // max +15°C

  const tCellBase = config.tAmb + deltaTcooled;
  const tCellMin = tCellBase; // peripheral cells
  const tCellMax = tCellBase + groupingPenalty; // central cells
  const tCell = (tCellMin + tCellMax) / 2; // average
  const thermalGradient = tCellMax - tCellMin;

  // ── 4. Derating factor from temperature ──
  const deratingFactor = interpolateDerating(chem.deratingCurve, tCell);

  // ── 5. Cycle life estimation (Arrhenius model) ──
  const R = 8.314; // J/(mol·K)
  const Tref = chem.tRef + 273.15; // K
  const Toperating = tCell + 273.15; // K

  // Arrhenius: n_cycles = n_ref × exp(Ea/R × (1/T_ref - 1/T_operating))
  const arrheniusFactor = (chem.ea * 1000 / R) * (1 / Tref - 1 / Toperating);
  let estimatedCycles = chem.nRef * Math.exp(arrheniusFactor);

  // Apply C-rate effect: k₁ = k₁_base × (C_avg / C_ref)^α where α ≈ 0.4
  const alpha = 0.4;
  const crateFactor = Math.pow(config.crateAvg / chem.crateRef, alpha);
  estimatedCycles = estimatedCycles / crateFactor;

  // Apply DoD effect: k₁ = k₁_base × (DoD)^β where β ≈ 0.6
  const beta = 0.6;
  const dodFactor = Math.pow(config.dodAvg / chem.dodRef, beta);
  estimatedCycles = estimatedCycles / dodFactor;

  // Ensure reasonable bounds
  estimatedCycles = Math.max(50, Math.min(10000, Math.round(estimatedCycles)));

  // Annual degradation (assuming 1 cycle/day = 365 cycles/year)
  // estimatedCycles is to 80% SoH (20% fade), not 100% fade
  const cyclesPerYear = 365;
  const annualDegradation = estimatedCycles > 0
    ? (20 / estimatedCycles) * cyclesPerYear
    : 100;

  // ── 6. Cooling power consumption ──
  const coolingPowerW = heatTotal * cooling.powerPenalty;

  // ── 7. Safety level ──
  let level: SafetyLevel = 'green';
  if (tCellMax >= chem.tMax) level = 'red';
  else if (tCellMax >= chem.tRecommended) level = 'yellow';

  // ── 8. Status text ──
  let statusText: string;
  if (level === 'red') {
    statusText = `${t('thermal.danger')} — ${tCellMax.toFixed(1)}°C ${t('thermal.exceeds')} ${chem.tMax}°C ${t('thermal.limit')}`;
  } else if (level === 'yellow') {
    statusText = `${t('thermal.warm')} — ${tCellMax.toFixed(1)}°C (${t('thermal.derating')} ${((1 - deratingFactor) * 100).toFixed(0)}%)`;
  } else {
    statusText = `${t('thermal.ok')} — ${tCell.toFixed(1)}°C (${estimatedCycles.toLocaleString()} ${t('thermal.cyclesEst')})`;
  }

  return {
    tCell,
    tCellMax,
    tCellMin,
    thermalGradient,
    deratingFactor,
    estimatedCycles,
    annualDegradation,
    coolingPowerW,
    heatGenerationW: heatTotal,
    level,
    statusText,
  };
}

/* ── Interpolate derating curve ── */

function interpolateDerating(
  curve: { temp: number; capacityPct: number }[],
  temp: number,
): number {
  if (temp <= curve[0].temp) return curve[0].capacityPct / 100;
  if (temp >= curve[curve.length - 1].temp) return curve[curve.length - 1].capacityPct / 100;

  for (let i = 0; i < curve.length - 1; i++) {
    if (temp >= curve[i].temp && temp <= curve[i + 1].temp) {
      const t = (temp - curve[i].temp) / (curve[i + 1].temp - curve[i].temp);
      return (curve[i].capacityPct + t * (curve[i + 1].capacityPct - curve[i].capacityPct)) / 100;
    }
  }
  return 1.0;
}

/* ── Get chemistry options for UI ── */

export function getChemistryOptions(): { id: Chemistry; label: string }[] {
  return (Object.keys(CHEMISTRY_PARAMS) as Chemistry[]).map(id => ({
    id,
    label: CHEMISTRY_PARAMS[id].label,
  }));
}

/* ── Render helpers ── */

export function renderThermalCard(result: ThermalResult, config: ThermalConfig): string {
  const chem = CHEMISTRY_PARAMS[config.chemistry] || CHEMISTRY_PARAMS.nmc;

  const levelColor = result.level === 'green' ? '#22c55e' : result.level === 'yellow' ? '#eab308' : '#ef4444';

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="flex justify-between items-center mb-1">
        <span class="text-[0.68rem] font-extrabold text-slate-400 uppercase">${t('thermal.thermalAnalysis')}</span>
        <span class="text-[0.55rem] font-bold px-1.5 py-0.5 rounded" style="background: ${levelColor}20; color: ${levelColor};">
          ${result.level === 'green' ? t('thermal.ok') : result.level === 'yellow' ? t('thermal.warm') : t('thermal.hot')}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">${t('thermal.cellTemperature')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.tCell.toFixed(1)}°C</span>
        <span class="text-slate-500">${t('thermal.hottestCell')}</span>
        <span class="font-mono font-semibold" style="color: ${levelColor}">${result.tCellMax.toFixed(1)}°C</span>
        <span class="text-slate-500">${t('thermal.thermalGradient')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.thermalGradient.toFixed(1)}°C</span>
        <span class="text-slate-500">${t('thermal.derating')}</span>
        <span class="font-mono font-semibold ${result.deratingFactor < 0.95 ? 'text-amber-600' : 'text-slate-700'}">${(result.deratingFactor * 100).toFixed(0)}%</span>
        <span class="text-slate-500">${t('thermal.heatGeneration')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.heatGenerationW >= 100 ? Math.round(result.heatGenerationW) : result.heatGenerationW.toFixed(1)}W</span>
        <span class="text-slate-500">${t('thermal.coolingPower')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.coolingPowerW.toFixed(1)}W</span>
      </div>
    </div>

    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1">${t('thermal.cycleLifeEstimate')}</div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">${t('thermal.estimatedCyclesLabel')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.estimatedCycles.toLocaleString()}</span>
        <span class="text-slate-500">${t('thermal.annualDegradation')}</span>
        <span class="font-mono font-semibold ${result.annualDegradation > 15 ? 'text-amber-600' : 'text-slate-700'}">${result.annualDegradation.toFixed(1)}%/year</span>
        <span class="text-slate-500">${t('thermal.chemistry')}</span>
        <span class="font-mono font-semibold text-slate-700">${chem.label.split('(')[0].trim()}</span>
        <span class="text-slate-500">${t('thermal.avgCrateDod')}</span>
        <span class="font-mono font-semibold text-slate-700">${config.crateAvg.toFixed(1)}C / ${(config.dodAvg * 100).toFixed(0)}%</span>
      </div>
      ${result.estimatedCycles < 500 ? `
      <div class="mt-1 text-[0.58rem] font-bold text-red-600">
        ⚠ ${t('thermal.lowCycleLifeWarning')}
      </div>` : ''}
    </div>
  `;
}
