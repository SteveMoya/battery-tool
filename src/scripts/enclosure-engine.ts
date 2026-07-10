/* ─────────────────────────────────────────────
   F4 — Pack Enclosure Design Engine
   Enclosure sizing, IP rating, material selection.
   ───────────────────────────────────────────── */

import type { SafetyLevel } from './safety-indicators';
import { t } from '../i18n';

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
  maxIpLabel: string;
  description: string;
}

const MATERIAL_DB: Record<EnclosureMaterial, MaterialProperties> = {
  aluminum: {
    label: t('enclosure.aluminum'),
    density: 2700,
    thermalConductivity: 167,
    costPerKg: 4.5,
    emiShielding: true,
    maxIpRating: 'ip67',
    maxIpLabel: 'IP67',
    description: t('enclosure.aluminumDesc'),
  },
  steel: {
    label: t('enclosure.steel'),
    density: 7850,
    thermalConductivity: 50,
    costPerKg: 2.0,
    emiShielding: true,
    maxIpRating: 'ip65',
    maxIpLabel: 'IP65',
    description: t('enclosure.steelDesc'),
  },
  plastic: {
    label: t('enclosure.plastic'),
    density: 1100,
    thermalConductivity: 0.2,
    costPerKg: 3.0,
    emiShielding: false,
    maxIpRating: 'ip54',
    maxIpLabel: 'IP54',
    description: t('enclosure.plasticDesc'),
  },
  fiberglass: {
    label: t('enclosure.fiberglass'),
    density: 1800,
    thermalConductivity: 0.3,
    costPerKg: 8.0,
    emiShielding: false,
    maxIpRating: 'ip65',
    maxIpLabel: 'IP65',
    description: t('enclosure.fiberglassDesc'),
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
    ingressProtection: t('enclosure.ip20Desc'),
    requirements: [t('enclosure.ip20Req1'), t('enclosure.ip20Req2')],
    typicalUse: [t('enclosure.ip20Use')],
  },
  ip54: {
    label: 'IP54',
    ingressProtection: t('enclosure.ip54Desc'),
    requirements: [t('enclosure.ip54Req1'), t('enclosure.ip54Req2'), t('enclosure.ip54Req3')],
    typicalUse: [t('enclosure.ip54Use')],
  },
  ip65: {
    label: 'IP65',
    ingressProtection: t('enclosure.ip65Desc'),
    requirements: [t('enclosure.ip65Req1'), t('enclosure.ip65Req2'), t('enclosure.ip65Req3'), t('enclosure.ip65Req4')],
    typicalUse: [t('enclosure.ip65Use')],
  },
  ip67: {
    label: 'IP67',
    ingressProtection: t('enclosure.ip67Desc'),
    requirements: [t('enclosure.ip67Req1'), t('enclosure.ip67Req2'), t('enclosure.ip67Req3'), t('enclosure.ip67Req4')],
    typicalUse: [t('enclosure.ip67Use')],
  },
  ip68: {
    label: 'IP68',
    ingressProtection: t('enclosure.ip68Desc'),
    requirements: [t('enclosure.ip68Req1'), t('enclosure.ip68Req2'), t('enclosure.ip68Req3'), t('enclosure.ip68Req4')],
    typicalUse: [t('enclosure.ip68Use')],
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
  totalWeightKg: number;
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
    warnings.push(`${mat.label} ${t('enclosure.maxIpIs')} ${mat.maxIpLabel} — ${t('enclosure.cannotAchieve')} ${ip.label}`);
  }

  // ── 2. Check wall thickness ──
  let wallThicknessMm = config.wallThicknessMm;
  if (config.material === 'aluminum' && wallThicknessMm < 1.5) {
    recommendations.push(t('enclosure.aluminumWallRec'));
    wallThicknessMm = 1.5;
  }
  if (config.material === 'steel' && wallThicknessMm < 1.0) {
    recommendations.push(t('enclosure.steelWallRec'));
    wallThicknessMm = 1.0;
  }
  if (config.material === 'plastic' && wallThicknessMm < 2.0) {
    recommendations.push(t('enclosure.plasticWallRec'));
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
    recommendations.push(t('enclosure.highVoltageRec'));
  }

  if (config.packCurrentA > 100 && config.material === 'plastic') {
    recommendations.push(t('enclosure.highCurrentRec'));
  }

  if (config.ventType === 'none' && config.ipRating !== 'ip20') {
    recommendations.push(t('enclosure.ventRec'));
  }

  if (config.mountingType === 'custom') {
    recommendations.push(t('enclosure.customMountRec'));
  }

  // ── 8. Safety level ──
  let level: SafetyLevel = 'green';
  if (warnings.length > 0) level = 'yellow';
  if (requestedIpIdx > maxMatIpIdx) level = 'red';

  // ── 9. Status text ──
  let statusText: string;
  if (level === 'red') {
    statusText = `${t('enclosure.incompatible')} — ${mat.label} ${t('enclosure.cannotAchieve')} ${ip.label}`;
  } else if (level === 'yellow') {
    statusText = `${t('enclosure.caution')} — ${ip.label} ${t('enclosure.with')} ${mat.label}, ${t('enclosure.verifyReqs')}`;
  } else {
    statusText = `${t('enclosure.ok')} — ${widthMm.toFixed(0)}×${depthMm.toFixed(0)}×${heightMm.toFixed(0)}mm, ${enclosureWeightKg.toFixed(1)}kg`;
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
      <div class="text-[0.68rem] font-extrabold text-red-600 uppercase mb-1">${t('enclosure.warnings')}</div>
      ${result.warnings.map(w => `
        <div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
          <span class="text-red-500 font-bold shrink-0">→</span>
          <span class="text-red-700">${w}</span>
        </div>`).join('')}
    </div>` : '';

  const recsHtml = result.recommendations.length > 0 ? `
    <div class="bg-blue-50 border border-blue-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-blue-600 uppercase mb-1">${t('enclosure.recommendations')}</div>
      ${result.recommendations.map(r => `
        <div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
          <span class="text-blue-500 font-bold shrink-0">→</span>
          <span class="text-blue-700">${r}</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="flex justify-between items-center mb-1">
        <span class="text-[0.68rem] font-extrabold text-slate-400 uppercase">${t('enclosure.enclosureDesign')}</span>
        <span class="text-[0.55rem] font-bold px-1.5 py-0.5 rounded" style="background: ${levelColor}20; color: ${levelColor};">
          ${result.level === 'green' ? t('enclosure.ok') : result.level === 'yellow' ? t('enclosure.caution') : t('enclosure.incompatible')}
        </span>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem]">
        <span class="text-slate-500">${t('enclosure.dimensions')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.widthMm.toFixed(0)}×${result.depthMm.toFixed(0)}×${result.heightMm.toFixed(0)}mm</span>
        <span class="text-slate-500">${t('enclosure.material')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.materialLabel}</span>
        <span class="text-slate-500">${t('enclosure.ipRating')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.ipLabel}</span>
        <span class="text-slate-500">${t('enclosure.wallThickness')}</span>
        <span class="font-mono font-semibold text-slate-700">${config.wallThicknessMm}mm</span>
        <span class="text-slate-500">${t('enclosure.enclosureWeight')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.enclosureWeightKg.toFixed(1)}kg</span>
        <span class="text-slate-500">${t('enclosure.totalWeight')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.totalWeightKg.toFixed(1)}kg</span>
        <span class="text-slate-500">${t('enclosure.estimatedCost')}</span>
        <span class="font-mono font-semibold text-slate-700">€${result.estimatedCostEur.toFixed(0)}</span>
        <span class="text-slate-500">${t('enclosure.thermalResistance')}</span>
        <span class="font-mono font-semibold text-slate-700">${result.thermalResistance.toFixed(2)}°C/W</span>
      </div>
      ${result.material.emiShielding ? `<div class="mt-1 text-[0.6rem] font-bold text-green-600">✓ ${t('enclosure.emiShielding')}</div>` : ''}
    </div>

    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-slate-400 uppercase mb-1">${t('enclosure.ipRatingDetails')}</div>
      <div class="text-[0.62rem] text-slate-600 mb-1">${result.ipRating.ingressProtection}</div>
      <div class="text-[0.58rem] text-slate-500">
        ${result.ipRating.requirements.join(' · ')}
      </div>
      <div class="text-[0.58rem] text-slate-400 mt-1">
        ${t('enclosure.typical')}: ${result.ipRating.typicalUse.join(', ')}
      </div>
    </div>

    ${warningsHtml}
    ${recsHtml}
  `;
}
