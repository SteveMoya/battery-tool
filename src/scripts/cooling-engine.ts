/* ─────────────────────────────────────────────
   F3 — Cooling System Design Engine
   Cooling calculations, sizing, and TIM recommendations.
   ───────────────────────────────────────────── */

import type { SafetyLevel } from './safety-indicators';

/* ── Types ── */

export type CoolingMethod = 'passive' | 'air' | 'liquid';
export type CoolantType = 'water_glycol_50' | 'water_glycol_70' | 'silicone_oil' | 'dielectric_fluid';

interface CoolantProperties {
  label: string;
  density: number;       // kg/m³
  specificHeat: number;  // J/(kg·K)
  thermalConductivity: number; // W/(m·K)
  maxTemp: number;       // °C
}

const COOLANT_DB: Record<CoolantType, CoolantProperties> = {
  water_glycol_50: { label: 'Water/Glycol 50/50', density: 1060, specificHeat: 3350, thermalConductivity: 0.4, maxTemp: 100 },
  water_glycol_70: { label: 'Water/Glycol 70/30', density: 1100, specificHeat: 2980, thermalConductivity: 0.35, maxTemp: 105 },
  silicone_oil: { label: 'Silicone Oil', density: 960, specificHeat: 1500, thermalConductivity: 0.15, maxTemp: 200 },
  dielectric_fluid: { label: 'Dielectric Fluid', density: 850, specificHeat: 1800, thermalConductivity: 0.12, maxTemp: 150 },
};

/* ── Interfaces ── */

export interface CoolingConfig {
  method: CoolingMethod;
  // Air cooling
  fanCount: number;
  cfmPerFan: number;
  // Liquid cooling
  coolantType: CoolantType;
  coolantFlowLPM: number;
  radiatorSize: 'small' | 'medium' | 'large';
  // Pack info
  heatGenerationW: number;
  packVoltage: number;
  packCurrentA: number;
  ambientTemp: number;
  // Surface area estimate
  packSurfaceAreaM2: number;
}

export interface TimEntry {
  name: string;
  type: 'paste' | 'pad' | 'gap_filler';
  thermalConductivity: number; // W/(m·K)
  thickness: number;          // mm
  maxTemp: number;            // °C
  compressiveStrength: number; // kPa
  costPerM2: number;          // EUR/m²
}

export const TIM_DATABASE: TimEntry[] = [
  { name: 'Arctic MX-6', type: 'paste', thermalConductivity: 8.5, thickness: 0.1, maxTemp: 150, compressiveStrength: 0, costPerM2: 50 },
  { name: 'Thermal Grizzly Kryonaut', type: 'paste', thermalConductivity: 12.5, thickness: 0.1, maxTemp: 120, compressiveStrength: 0, costPerM2: 80 },
  { name: 'Fujipoly AR-MX4', type: 'pad', thermalConductivity: 6.0, thickness: 1.0, maxTemp: 150, compressiveStrength: 50, costPerM2: 120 },
  { name: 'Bergquist GAP-PAD 3000', type: 'gap_filler', thermalConductivity: 3.0, thickness: 2.0, maxTemp: 200, compressiveStrength: 30, costPerM2: 90 },
  { name: 'Dow Corning TC-5026', type: 'gap_filler', thermalConductivity: 5.0, thickness: 1.5, maxTemp: 200, compressiveStrength: 45, costPerM2: 150 },
  { name: 'Shin-Etsu X-23-8117', type: 'pad', thermalConductivity: 11.0, thickness: 0.5, maxTemp: 150, compressiveStrength: 60, costPerM2: 200 },
];

export interface CoolingResult {
  method: CoolingMethod;
  tCellMax: number;        // Maximum cell temperature (°C)
  tCellAvg: number;        // Average cell temperature (°C)
  thermalGradient: number;  // ΔT across pack (°C)
  coolingCapacityW: number; // How much heat the system can remove (W)
  powerConsumptionW: number; // Power used by cooling system (W)
  fanCFM: number;          // Total CFM (air cooling)
  coolantFlowLPM: number;  // Flow rate (liquid cooling)
  recommendedTim: TimEntry;
  level: SafetyLevel;
  statusText: string;
  warnings: string[];
}

/* ── Main cooling analysis function ── */

export function analyzeCooling(config: CoolingConfig): CoolingResult {
  const warnings: string[] = [];
  const Q = config.heatGenerationW;

  // ── 1. Calculate cooling capacity ──
  let coolingCapacityW = 0;
  let powerConsumptionW = 0;
  let fanCFM = 0;
  let coolantFlowLPM = 0;

  if (config.method === 'passive') {
    // Natural convection: h ≈ 5-10 W/m²K
    const h = 8;
    coolingCapacityW = h * config.packSurfaceAreaM2 * 30; // ΔT = 30°C typical
    powerConsumptionW = 0;
  } else if (config.method === 'air') {
    // Forced convection: h ≈ 25-100 W/m²K
    fanCFM = config.fanCount * config.cfmPerFan;
    // h ≈ 25 + 0.5 × CFM/m² (rough correlation)
    const h = 25 + 0.5 * (fanCFM / Math.max(0.01, config.packSurfaceAreaM2));
    coolingCapacityW = h * config.packSurfaceAreaM2 * 30;
    // Fan power: ~1W per CFM (rough)
    powerConsumptionW = fanCFM * 1.0;
  } else if (config.method === 'liquid') {
    const coolant = COOLANT_DB[config.coolantType] || COOLANT_DB.water_glycol_50;
    coolantFlowLPM = config.coolantFlowLPM;
    // Q = ρ × Cp × V_dot × ΔT
    const flowM3s = coolantFlowLPM / 60000; // LPM to m³/s
    const deltaT = 10; // coolant ΔT (target)
    coolingCapacityW = coolant.density * coolant.specificHeat * flowM3s * deltaT;
    // Pump power: ~50W per LPM (rough)
    powerConsumptionW = coolantFlowLPM * 50;
  }

  // ── 2. Estimate cell temperatures ──
  let tCellMax: number;
  let tCellAvg: number;
  let thermalGradient: number;

  if (Q <= 0) {
    tCellMax = config.ambientTemp;
    tCellAvg = config.ambientTemp;
    thermalGradient = 0;
  } else if (config.method === 'passive') {
    // Passive: no forced cooling, rely on convection
    const deltaT = Q / (8 * config.packSurfaceAreaM2); // h ≈ 8
    tCellMax = config.ambientTemp + deltaT * 1.3; // hottest cell
    tCellAvg = config.ambientTemp + deltaT;
    thermalGradient = deltaT * 0.3;
  } else if (config.method === 'air') {
    // Air cooling: better heat removal, gradient depends on airflow distribution
    const deltaT = Q / (50 * config.packSurfaceAreaM2); // h ≈ 50
    tCellMax = config.ambientTemp + deltaT * 1.15;
    tCellAvg = config.ambientTemp + deltaT;
    thermalGradient = deltaT * 0.15;
  } else {
    // Liquid cooling: most uniform
    const deltaT = Q / (200 * config.packSurfaceAreaM2); // h ≈ 200
    tCellMax = config.ambientTemp + deltaT * 1.08;
    tCellAvg = config.ambientTemp + deltaT;
    thermalGradient = deltaT * 0.08;
  }

  // ── 3. Check if cooling is adequate ──
  const coolingAdequate = coolingCapacityW >= Q;

  if (!coolingAdequate) {
    const deficit = Q - coolingCapacityW;
    warnings.push(`Cooling capacity (${coolingCapacityW.toFixed(0)}W) insufficient for heat generation (${Q.toFixed(0)}W) — ${deficit.toFixed(0)}W deficit`);
  }

  if (tCellMax > 55) {
    warnings.push(`Cell temperature ${tCellMax.toFixed(1)}°C exceeds 55°C — consider upgrading cooling system`);
  }

  if (config.method === 'air' && fanCFM < 50) {
    warnings.push(`Low airflow (${fanCFM.toFixed(0)} CFM) — consider adding more fans`);
  }

  if (config.method === 'liquid' && coolantFlowLPM < 2) {
    warnings.push(`Low coolant flow (${coolantFlowLPM.toFixed(1)} LPM) — may cause hot spots`);
  }

  // ── 4. TIM recommendation ──
  const recommendedTim = recommendTim(Q, tCellMax);

  // ── 5. Safety level ──
  let level: SafetyLevel = 'green';
  if (tCellMax > 55 || !coolingAdequate) level = 'red';
  else if (tCellMax > 45 || warnings.length > 0) level = 'yellow';

  // ── 6. Status text ──
  let statusText: string;
  if (level === 'red') {
    statusText = `INSUFFICIENT — ${tCellMax.toFixed(1)}°C, ${coolingCapacityW.toFixed(0)}W capacity vs ${Q.toFixed(0)}W load`;
  } else if (level === 'yellow') {
    statusText = `MARGINAL — ${tCellMax.toFixed(1)}°C, ${(coolingCapacityW / Math.max(1, Q) * 100).toFixed(0)}% capacity`;
  } else {
    statusText = `OK — ${tCellMax.toFixed(1)}°C, ${coolingCapacityW.toFixed(0)}W capacity`;
  }

  return {
    method: config.method,
    tCellMax,
    tCellAvg,
    thermalGradient,
    coolingCapacityW,
    powerConsumptionW,
    fanCFM,
    coolantFlowLPM,
    recommendedTim,
    level,
    statusText,
    warnings,
  };
}

/* ── TIM recommendation ── */

function recommendTim(heatW: number, tMax: number): TimEntry {
  // For high heat: use higher conductivity TIM
  if (heatW > 500 || tMax > 50) {
    return TIM_DATABASE.find(t => t.name === 'Shin-Etsu X-23-8117') ?? TIM_DATABASE[TIM_DATABASE.length - 1];
  }
  if (heatW > 200) {
    return TIM_DATABASE.find(t => t.name === 'Thermal Grizzly Kryonaut') ?? TIM_DATABASE[1];
  }
  // Default: good mid-range
  return TIM_DATABASE.find(t => t.name === 'Fujipoly AR-MX4') ?? TIM_DATABASE[2];
}

/* ── Render helpers ── */

export function renderCoolingCard(result: CoolingResult, config: CoolingConfig): string {
  const methodLabel = config.method === 'passive' ? 'Passive (Natural Convection)'
    : config.method === 'air' ? 'Air Cooled (Forced)'
    : 'Liquid Cooled';

  const levelColor = result.level === 'green' ? '#22c55e' : result.level === 'yellow' ? '#eab308' : '#ef4444';

  const warningsHtml = result.warnings.length > 0 ? `
    <div class="bg-amber-50 border border-amber-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-amber-600 uppercase mb-1">Warnings</div>
      ${result.warnings.map(w => `
        <div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
          <span class="text-amber-500 font-bold shrink-0">→</span>
          <span class="text-amber-700">${w}</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="flex justify-between items-center mb-1">
        <span class="text-[0.68rem] font-extrabold text-slate-400 uppercase">Cooling System</span>
        <span class="text-[0.55rem] font-bold px-1.5 py-0.5 rounded" style="background: ${levelColor}20; color: ${levelColor};">
          ${result.level === 'green' ? 'OK' : result.level === 'yellow' ? 'MARGINAL' : 'INSUFFICIENT'}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Method</span>
        <span class="font-mono font-semibold text-slate-700">${methodLabel}</span>
        <span class="text-slate-500">Cell Temperature</span>
        <span class="font-mono font-semibold" style="color: ${levelColor}">${result.tCellMax.toFixed(1)}°C</span>
        <span class="text-slate-500">Cooling Capacity</span>
        <span class="font-mono font-semibold text-slate-700">${result.coolingCapacityW.toFixed(0)}W</span>
        <span class="text-slate-500">Heat Load</span>
        <span class="font-mono font-semibold text-slate-700">${config.heatGenerationW.toFixed(0)}W</span>
        <span class="text-slate-500">Power Consumption</span>
        <span class="font-mono font-semibold text-slate-700">${result.powerConsumptionW.toFixed(1)}W</span>
        <span class="text-slate-500">Thermal Gradient</span>
        <span class="font-mono font-semibold text-slate-700">${result.thermalGradient.toFixed(1)}°C</span>
        ${config.method === 'air' ? `
        <span class="text-slate-500">Total Airflow</span>
        <span class="font-mono font-semibold text-slate-700">${result.fanCFM.toFixed(0)} CFM</span>
        ` : ''}
        ${config.method === 'liquid' ? `
        <span class="text-slate-500">Coolant Flow</span>
        <span class="font-mono font-semibold text-slate-700">${result.coolantFlowLPM.toFixed(1)} LPM</span>
        ` : ''}
      </div>
    </div>

    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1">Recommended TIM</div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Material</span>
        <span class="font-mono font-semibold text-slate-700">${result.recommendedTim.name}</span>
        <span class="text-slate-500">Type</span>
        <span class="font-mono font-semibold text-slate-700">${result.recommendedTim.type}</span>
        <span class="text-slate-500">Conductivity</span>
        <span class="font-mono font-semibold text-slate-700">${result.recommendedTim.thermalConductivity} W/(m·K)</span>
        <span class="text-slate-500">Thickness</span>
        <span class="font-mono font-semibold text-slate-700">${result.recommendedTim.thickness}mm</span>
      </div>
    </div>

    ${warningsHtml}
  `;
}
