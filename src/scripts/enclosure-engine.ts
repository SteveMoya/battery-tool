/* ─────────────────────────────────────────────
   F4 — Pack Enclosure Design Engine
   Enclosure sizing, IP rating, material selection.
   ───────────────────────────────────────────── */

import type { SafetyLevel } from './safety-indicators';

/* ── Types ── */

export type EnclosureMaterial = 'aluminum' | 'steel' | 'plastic' | 'fiberglass';
export type IpRating = 'ip20' | 'ip54' | 'ip65' | 'ip67' | 'ip68';
export type MountingType = 'brackets' | 'rails' | 'custom';
export type VentType = 'none' | 'filtered' | 'sealed' | 'conformal';

interface MaterialProperties {
  label: string;
  density: number;        // kg/m³
  thermalConductivity: number; // W/(m·K)
  costPerKg: number;      // EUR/kg
  emiShielding: boolean;
  maxIpRating: IpRating;
  description: string;
}

const MATERIAL_DB: Record<EnclosureMaterial, MaterialProperties> = {
  aluminum: {
    label: 'Aluminum (6061-T6)',
    density: 2700,
    thermalConductivity: 167,
    costPerKg: 4.5,
    emiShielding: true,
    maxIpRating: 'ip67',
    description: 'Lightweight, good heat dissipation, EMI shielding',
  },
  steel: {
    label: 'Steel (Powder Coated)',
    density: 7850,
    thermalConductivity: 50,
    costPerKg: 2.0,
    emiShielding: true,
    maxIpRating: 'ip65',
    description: 'Durable, cost-effective, good for stationary',
  },
  plastic: {
    label: 'Plastic (ABS/PC)',
    density: 1100,
    thermalConductivity: 0.2,
    costPerKg: 3.0,
    emiShielding: false,
    maxIpRating: 'ip54',
    description: 'Electrical insulation, lightweight, consumer electronics',
  },
  fiberglass: {
    label: 'FR4/Fiberglass',
    density: 1800,
    thermalConductivity: 0.3,
    costPerKg: 8.0,
    emiShielding: false,
    maxIpRating: 'ip65',
    description: 'Excellent electrical insulation, high-voltage applications',
  },
};

interface IpRatingProperties {
  label: string;
  ingressProtection: string;
  requirements: string[];
  typicalUse: string[];
}

const IP_DB: Record<IpRating, IpRatingProperties> = {
  ip20: {
    label: 'IP20',
    ingressProtection: 'Protected against solid objects >12mm',
    requirements: ['No specific sealing required', 'Ventilation openings allowed'],
    typicalUse: ['Indoor stationary (powerwall, server room)'],
  },
  ip54: {
    label: 'IP54',
    ingressProtection: 'Dust protected, splash-proof',
    requirements: ['Sealed enclosure with gaskets', 'Connector panel with IP-rated connectors', 'Drain holes optional'],
    typicalUse: ['E-bike, general EV, outdoor sheltered'],
  },
  ip65: {
    label: 'IP65',
    ingressProtection: 'Dust-tight, water jet resistant',
    requirements: ['Full gasket sealing', 'IP-rated cable glands', 'No unsealed openings', 'Tested with 6.3mm nozzle'],
    typicalUse: ['Marine, outdoor, industrial'],
  },
  ip67: {
    label: 'IP67',
    ingressProtection: 'Dust-tight, temporary immersion',
    requirements: ['Full gasket sealing', 'IP68-rated connectors', 'Pressure equalization valve', 'Tested at 1m depth for 30min'],
    typicalUse: ['Underwater, extreme environments, military'],
  },
  ip68: {
    label: 'IP68',
    ingressProtection: 'Dust-tight, permanent submersion',
    requirements: ['Full potting or hermetic sealing', 'Submarine-rated connectors', 'Pressure tested', 'Continuous submersion rated'],
    typicalUse: ['Permanent underwater, subsea applications'],
  },
};

/* ── Interfaces ── */

export interface EnclosureConfig {
  material: EnclosureMaterial;
  ipRating: IpRating;
  wallThicknessMm: number;
  mountingType: MountingType;
  ventType: VentType;
  // Pack dimensions (mm)
  packWidthMm: number;
  packDepthMm: number;
  packHeightMm: number;
  // Pack info
  packWeightKg: number;
  packVoltage: number;
  packCurrentA: number;
  // Clearance
  clearanceMm: number;    // gap between pack and enclosure wall
}

export interface EnclosureResult {
  // Final dimensions (mm)
  widthMm: number;
  depthMm: number;
  heightMm: number;
  // Volume and weight
  internalVolumeM3: number;
  enclosureWeightKg: number;
  totalWeightKg;
  // Material
  material: MaterialProperties;
  materialLabel: string;
  // IP rating
  ipRating: IpRatingProperties;
  ipLabel: string;
  // Cost
  estimatedCostEur: number;
  // Thermal
  thermalResistance: number; // °C/W (enclosure thermal resistance)
  // Safety
  level: SafetyLevel;
  statusText: string;
  warnings: string[];
  recommendations: string[];
}

/* ── Main enclosure analysis function ── */

export function analyzeEnclosure(config: EnclosureConfig): EnclosureResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const mat = MATERIAL_DB[config.material];
  const ip = IP_DB[config.ipRating];

  // ── 1. Check IP rating compatibility ──
  const ipOrder: IpRating[] = ['ip20', 'ip54', 'ip65', 'ip67', 'ip68'];
  const requestedIpIdx = ipOrder.indexOf(config.ipRating);
  const maxMatIpIdx = ipOrder.indexOf(mat.maxIpRating);

  if (requestedIpIdx > maxMatIpIdx) {
    warnings.push(`${mat.label} max IP rating is ${mat.maxIpLabel} — cannot achieve ${ip.label}`);
  }

  // ── 2. Check wall thickness ──
  let wallThicknessMm = config.wallThicknessMm;
  if (config.material === 'aluminum' && wallThicknessMm < 1.5) {
    recommendations.push('Minimum 1.5mm wall thickness for aluminum enclosures for structural integrity');
    wallThicknessMm = 1.5;
  }
  if (config.material === 'steel' && wallThicknessMm < 1.0) {
    recommendations.push('Minimum 1.0mm wall thickness for steel enclosures');
    wallThicknessMm = 1.0;
  }
  if (config.material === 'plastic' && wallThicknessMm < 2.0) {
    recommendations.push('Minimum 2.0mm wall thickness for plastic enclosures');
    wallThicknessMm = 2.0;
  }

  // ── 3. Calculate final dimensions ──
  const clearance = config.clearanceMm;
  const widthMm = config.packWidthMm + 2 * (clearance + wallThicknessMm);
  const depthMm = config.packDepthMm + 2 * (clearance + wallThicknessMm);
  const heightMm = config.packHeightMm + 2 * (clearance + wallThicknessMm);

  // ── 4. Calculate volume and weight ──
  const internalVolumeM3 = (widthMm * depthMm * heightMm) / 1e9; // mm³ to m³

  // Enclosure material volume (shell)
  const outerVolumeM3 = (widthMm * depthMm * heightMm) / 1e9;
  const innerVolumeM3 = ((widthMm - 2 * wallThicknessMm) * (depthMm - 2 * wallThicknessMm) * (heightMm - 2 * wallThicknessMm)) / 1e9;
  const materialVolumeM3 = outerVolumeM3 - innerVolumeM3;

  const enclosureWeightKg = materialVolumeM3 * mat.density;
  const totalWeightKg = config.packWeightKg + enclosureWeightKg;

  // ── 5. Estimate cost ──
  const materialCost = enclosureWeightKg * mat.costPerKg;
  const gasketCost = config.ipRating !== 'ip20' ? 15 : 0; // rough gasket cost
  const connectorCost = config.ipRating !== 'ip20' ? 20 : 0; // IP-rated connectors
  const estimatedCostEur = materialCost + gasketCost + connectorCost + 30; // +30 for fabrication

  // ── 6. Thermal resistance ──
  // R = thickness / (k × A)
  const surfaceAreaM2 = 2 * ((widthMm * depthMm) + (widthMm * heightMm) + (depthMm * heightMm)) / 1e6;
  const thermalResistance = mat.thermalConductivity > 0
    ? (wallThicknessMm / 1000) / (mat.thermalConductivity * surfaceAreaM2)
    : 1000;

  // ── 7. Recommendations ──
  if (config.packVoltage > 60 && config.material === 'plastic') {
    recommendations.push('For high voltage (>60V), consider aluminum or steel for EMI shielding and structural integrity');
  }

  if (config.packCurrentA > 100 && config.material === 'plastic') {
    recommendations.push('For high current (>100A), consider metal enclosure for heat dissipation');
  }

  if (config.ventType === 'none' && config.ipRating !== 'ip20') {
    recommendations.push('Consider adding filtered vents for pressure equalization');
  }

  if (config.mountingType === 'custom') {
    recommendations.push('Custom mounting requires CAD files — verify bolt patterns and clearances');
  }

  // ── 8. Safety level ──
  let level: SafetyLevel = 'green';
  if (warnings.length > 0) level = 'yellow';
  if (requestedIpIdx > maxMatIpIdx) level = 'red';

  // ── 9. Status text ──
  let statusText: string;
  if (level === 'red') {
    statusText = `INCOMPATIBLE — ${mat.label} cannot achieve ${ip.label}`;
  } else if (level === 'yellow') {
    statusText = `CAUTION — ${ip.label} with ${mat.label}, verify requirements`;
  } else {
    statusText = `OK — ${widthMm.toFixed(0)}×${depthMm.toFixed(0)}×${heightMm.toFixed(0)}mm, ${enclosureWeightKg.toFixed(1)}kg`;
  }

  return {
    widthMm,
    depthMm,
    heightMm,
    internalVolumeM3,
    enclosureWeightKg,
    totalWeightKg,
    material: mat,
    materialLabel: mat.label,
    ipRating: ip,
    ipLabel: ip.label,
    estimatedCostEur,
    thermalResistance,
    level,
    statusText,
    warnings,
    recommendations,
  };
}

/* ── Render helpers ── */

export function renderEnclosureCard(result: EnclosureResult, config: EnclosureConfig): string {
  const levelColor = result.level === 'green' ? '#22c55e' : result.level === 'yellow' ? '#eab308' : '#ef4444';

  const warningsHtml = result.warnings.length > 0 ? `
    <div class="bg-red-50 border border-red-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-red-600 uppercase mb-1">Warnings</div>
      ${result.warnings.map(w => `
        <div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
          <span class="text-red-500 font-bold shrink-0">→</span>
          <span class="text-red-700">${w}</span>
        </div>`).join('')}
    </div>` : '';

  const recsHtml = result.recommendations.length > 0 ? `
    <div class="bg-blue-50 border border-blue-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-blue-600 uppercase mb-1">Recommendations</div>
      ${result.recommendations.map(r => `
        <div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
          <span class="text-blue-500 font-bold shrink-0">→</span>
          <span class="text-blue-700">${r}</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="flex justify-between items-center mb-1">
        <span class="text-[0.68rem] font-extrabold text-slate-400 uppercase">Enclosure Design</span>
        <span class="text-[0.55rem] font-bold px-1.5 py-0.5 rounded" style="background: ${levelColor}20; color: ${levelColor};">
          ${result.level === 'green' ? 'OK' : result.level === 'yellow' ? 'CAUTION' : 'INCOMPATIBLE'}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">Dimensions (W×D×H)</span>
        <span class="font-mono font-semibold text-slate-700">${result.widthMm.toFixed(0)}×${result.depthMm.toFixed(0)}×${result.heightMm.toFixed(0)}mm</span>
        <span class="text-slate-500">Material</span>
        <span class="font-mono font-semibold text-slate-700">${result.materialLabel}</span>
        <span class="text-slate-500">IP Rating</span>
        <span class="font-mono font-semibold text-slate-700">${result.ipLabel}</span>
        <span class="text-slate-500">Wall Thickness</span>
        <span class="font-mono font-semibold text-slate-700">${config.wallThicknessMm}mm</span>
        <span class="text-slate-500">Enclosure Weight</span>
        <span class="font-mono font-semibold text-slate-700">${result.enclosureWeightKg.toFixed(1)}kg</span>
        <span class="text-slate-500">Total Weight</span>
        <span class="font-mono font-semibold text-slate-700">${result.totalWeightKg.toFixed(1)}kg</span>
        <span class="text-slate-500">Estimated Cost</span>
        <span class="font-mono font-semibold text-slate-700">€${result.estimatedCostEur.toFixed(0)}</span>
        <span class="text-slate-500">Thermal Resistance</span>
        <span class="font-mono font-semibold text-slate-700">${result.thermalResistance.toFixed(2)}°C/W</span>
      </div>
      ${result.material.emiShielding ? '<div class="mt-1 text-[0.6rem] font-bold text-green-600">✓ EMI shielding</div>' : ''}
    </div>

    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1">IP Rating Details</div>
      <div class="text-[0.62rem] text-slate-600 mb-1">${result.ipRating.ingressProtection}</div>
      <div class="text-[0.58rem] text-slate-500">
        ${result.ipRating.requirements.join(' · ')}
      </div>
      <div class="text-[0.58rem] text-slate-400 mt-1">
        Typical: ${result.ipRating.typicalUse.join(', ')}
      </div>
    </div>

    ${warningsHtml}
    ${recsHtml}
  `;
}
