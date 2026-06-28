/* ─────────────────────────────────────────────
   F5 — Breaker & Disconnect Engine
   Recommends protection components based on pack config.
   ───────────────────────────────────────────── */

import type { BmsEntry } from './bms-database';
import {
  findContactor,
  findBreaker,
  findDisconnect,
  findPrechargeResistor,
  type ContactorEntry,
  type BreakerEntry,
  type DisconnectEntry,
  type PrechargeResistorEntry,
} from './component-database';

/* ── Interfaces ── */

export interface ProtectionConfig {
  packVoltage: number;
  packCurrentA: number;      // I_max of the pack (continuous)
  packCurrentPulse: number;  // pulse / inrush current
  packCapacityAh: number;
  sCount: number;
  bms: BmsEntry | null;
  application: 'ebike' | 'powerwall' | 'ev' | 'drone' | 'general' | 'marine';
}

export interface ProtectionRecommendation {
  component: string;
  partNumber: string;
  ratingA: number;
  voltageMax: number;
  reason: string;
  category: 'contactor' | 'breaker' | 'disconnect' | 'precharge' | 'fuse' | 'warning';
  priority: 'required' | 'recommended' | 'optional';
  safetyNotes: string[];
  specs: Record<string, string | number>;
}

export interface ProtectionReport {
  recommendations: ProtectionRecommendation[];
  summary: {
    needsContactor: boolean;
    needsBreaker: boolean;
    needsDisconnect: boolean;
    needsPrecharge: boolean;
    needsFuse: boolean;
    overallStatus: 'safe' | 'caution' | 'danger';
  };
  warnings: string[];
}

/* ── Main recommendation function ── */

export function recommendProtection(config: ProtectionConfig): ProtectionReport {
  const recs: ProtectionRecommendation[] = [];
  const warnings: string[] = [];

  const {
    packVoltage,
    packCurrentA,
    packCurrentPulse,
    sCount,
    bms,
    application,
  } = config;

  let needsContactor = false;
  let needsBreaker = false;
  let needsDisconnect = false;
  let needsPrecharge = false;
  let needsFuse = false;

  // ── 1. Contactor: required for packs >60V or >200A ──
  if (packVoltage > 60 || packCurrentA > 200) {
    needsContactor = true;
    const coilV = packVoltage > 12 ? packVoltage : 12;
    const minA = Math.ceil(packCurrentA * 1.5);
    const contactor = findContactor(minA, packVoltage);

    if (contactor) {
      recs.push({
        component: 'Main Contactor',
        partNumber: contactor.name,
        ratingA: contactor.continuousA,
        voltageMax: contactor.voltageMax,
        reason: `Pack ${packVoltage.toFixed(0)}V/${packCurrentA.toFixed(0)}A exceeds 60V/200A threshold — contactor required for safe remote disconnection`,
        category: 'contactor',
        priority: 'required',
        safetyNotes: [
          `Coil voltage: ${coilV.toFixed(0)}V — power from BMS or auxiliary supply`,
          `Rated ${contactor.continuousA}A continuous / ${contactor.maxBreakingA}A breaking capacity`,
          `Contact resistance: ${contactor.contactResistance}mΩ — ${(contactor.continuousA * contactor.contactResistance / 1000).toFixed(2)}W loss at full current`,
          `Mechanical life: ${contactor.lifecycle.toLocaleString()} cycles`,
        ],
        specs: {
          'Type': contactor.type,
          'Manufacturer': contactor.manufacturer,
          'Continuous A': contactor.continuousA,
          'Breaking A': contactor.maxBreakingA,
          'Max Voltage': `${contactor.voltageMax}V`,
          'Coil Voltage': `${contactor.coilVoltage}V`,
          'Contact Resistance': `${contactor.contactResistance}mΩ`,
          'Weight': `${contactor.weightG}g`,
          'Mounting': contactor.mounting,
        },
      });
    } else {
      warnings.push('No suitable contactor found in database — manually verify contactor selection');
    }
  }

  // ── 2. Circuit Breaker: recommended for all packs, required for >48V ──
  if (packVoltage > 48 || packCurrentA > 100) {
    needsBreaker = true;
    const minA = Math.ceil(packCurrentA * 1.25);
    const poles: 1 | 2 = packVoltage > 230 ? 2 : 1;
    const breaker = findBreaker(minA, packVoltage, poles);

    if (breaker) {
      recs.push({
        component: 'Circuit Breaker',
        partNumber: breaker.name,
        ratingA: breaker.ratingA,
        voltageMax: breaker.voltageMax,
        reason: `Overcurrent protection — rated ${breaker.ratingA}A (${Math.round((breaker.ratingA / packCurrentA - 1) * 100)}% margin over I_max)`,
        category: 'breaker',
        priority: packVoltage > 60 ? 'required' : 'recommended',
        safetyNotes: [
          `Interrupting capacity: ${breaker.interruptingCapacity}kA`,
          `Trip curve: ${breaker.tripCurve}`,
          `${breaker.poles} pole(s) — ${breaker.poles === 2 ? 'suitable for high-voltage' : 'single-pole only'}`,
          breaker.mounting === 'din' ? 'DIN rail mount — install in distribution board' : 'Busbar/panel mount',
        ],
        specs: {
          'Manufacturer': breaker.manufacturer,
          'Rating': `${breaker.ratingA}A`,
          'Voltage Max': `${breaker.voltageMax}V`,
          'IC Rating': `${breaker.interruptingCapacity}kA`,
          'Trip Curve': breaker.tripCurve,
          'Poles': breaker.poles,
          'Weight': `${breaker.weightG}g`,
          'Mounting': breaker.mounting,
        },
      });
    } else {
      warnings.push('No suitable breaker found in database — manually verify breaker selection');
    }
  }

  // ── 3. Disconnect switch: required for maintenance safety ──
  if (packVoltage > 48 || packCurrentA > 50) {
    needsDisconnect = true;
    const minA = Math.ceil(packCurrentA * 2.0); // 2× for interrupt capacity
    const disconnect = findDisconnect(minA, packVoltage);

    if (disconnect) {
      recs.push({
        component: 'Disconnect Switch',
        partNumber: disconnect.name,
        ratingA: disconnect.ratingA,
        voltageMax: disconnect.voltageMax,
        reason: `Maintenance safety (LOTO) — disconnect rated ${disconnect.ratingA}A, interrupt capacity ${disconnect.interruptingCapacity}kA`,
        category: 'disconnect',
        priority: 'recommended',
        safetyNotes: [
          disconnect.lotoCapable ? 'Lock-Out/Tag-Out capable — padlock hole for maintenance safety' : 'NOT LOTO-capable — verify maintenance procedures',
          disconnect.motorRated ? 'Motor-rated — can break under load' : 'NOT motor-rated — turn off load before disconnecting',
          `Mounting: ${disconnect.mounting}`,
        ],
        specs: {
          'Manufacturer': disconnect.manufacturer,
          'Rating': `${disconnect.ratingA}A`,
          'Voltage Max': `${disconnect.voltageMax}V`,
          'IC Rating': `${disconnect.interruptingCapacity}kA`,
          'Motor Rated': disconnect.motorRated ? 'Yes' : 'No',
          'LOTO Capable': disconnect.lotoCapable ? 'Yes' : 'No',
          'Weight': `${disconnect.weightG}g`,
          'Mounting': disconnect.mounting,
        },
      });
    } else {
      warnings.push('No suitable disconnect found in database — manually verify disconnect selection');
    }
  }

  // ── 4. Precharge resistor: required for packs >48V with contactors ──
  if (packVoltage > 48 && needsContactor) {
    needsPrecharge = true;
    // Estimate capacitance of typical inverter load: ~1000µF for industrial, ~100µF for simple
    const capacitanceF = application === 'ev' ? 2000e-6 : application === 'powerwall' ? 1500e-6 : 1000e-6;
    // Precharge time target: 500ms to reach 95% of V_pack
    const targetTimeMs = 500;
    const targetTimeSec = targetTimeMs / 1000;
    // RC circuit: t = -RC * ln(1 - V_target/V) = -RC * ln(0.05)
    const resistanceOhm = targetTimeSec / (capacitanceF * Math.abs(Math.log(0.05)));
    // Max power during precharge: P = V²/R (worst case at start)
    const maxPowerW = (packVoltage * packVoltage) / resistanceOhm;
    // Steady-state power: I_leak² × R (negligible)

    const resistor = findPrechargeResistor(resistanceOhm, maxPowerW);

    if (resistor) {
      const prechargeTimeMs = -resistor.resistanceOhm * capacitanceF * Math.log(0.05) * 1000;
      recs.push({
        component: 'Precharge Resistor',
        partNumber: resistor.name,
        ratingA: Math.round(resistor.wattage / resistor.resistanceOhm * 10) / 10,
        voltageMax: packVoltage,
        reason: `Pack ${packVoltage.toFixed(0)}V with contactor — precharge required to limit inrush current and protect contactor contacts`,
        category: 'precharge',
        priority: 'required',
        safetyNotes: [
          `Without precharge, inrush current can reach ${(packVoltage / 0.01 / 1000).toFixed(0)}kA for ${capacitanceF * 1e6}µF load`,
          `Precharge time: ${prechargeTimeMs.toFixed(0)}ms to 95% of pack voltage`,
          `Power rating: ${resistor.wattage}W — handle peak ${maxPowerW.toFixed(1)}W during precharge`,
          `Mount resistor on heatsink or chassis for cooling`,
        ],
        specs: {
          'Manufacturer': resistor.manufacturer,
          'Resistance': `${resistor.resistanceOhm}Ω`,
          'Wattage': `${resistor.wattage}W`,
          'Tolerance': `±${resistor.tolerancePct}%`,
          'Temp Coefficient': `${resistor.tempCoeff_ppm}ppm/°C`,
          'Package': resistor.package,
          'Precharge Time': `${prechargeTimeMs.toFixed(0)}ms`,
          'Peak Power': `${maxPowerW.toFixed(1)}W`,
          'Weight': `${resistor.weightG}g`,
        },
      });
    } else {
      warnings.push(`No suitable precharge resistor found for ${resistanceOhm.toFixed(1)}Ω — manually select resistor`);
    }
  }

  // ── 5. Fuse check: always present via F17 power connector engine, but validate sizing ──
  if (packCurrentA > 0) {
    needsFuse = true;
    const fuseMinA = Math.ceil(packCurrentA * 1.25);
    recs.push({
      component: 'Main Fuse',
      partNumber: 'Refer to F17 Power Connector section',
      ratingA: fuseMinA,
      voltageMax: packVoltage,
      reason: `Fuse should be ≥125% of continuous current (${fuseMinA}A minimum)`,
      category: 'fuse',
      priority: 'required',
      safetyNotes: [
        'Fuse is your last line of defense — if all other protection fails, the fuse blows',
        'Use Class-T for high-current applications (>150A) for fast clearing',
        'Use ANL/MIDI for lower-current applications',
        'Never bypass or upsize a fuse beyond 150% of continuous current',
      ],
      specs: {
        'Minimum Rating': `${fuseMinA}A`,
        'Voltage Rating': `${packVoltage}V`,
        'Type': fuseMinA > 150 ? 'Class-T' : fuseMinA > 60 ? 'ANL' : fuseMinA > 30 ? 'MIDI' : 'MAXI/Blade',
      },
    });
  }

  // ── 6. Safety warnings ──

  if (packVoltage > 60) {
    warnings.push(`HIGH VOLTAGE: ${packVoltage.toFixed(0)}V exceeds 60V — use insulated components, follow IEC 60364/NEC requirements`);
  }

  if (packCurrentA > 200) {
    warnings.push(`HIGH CURRENT: ${packCurrentA.toFixed(0)}A — ensure all connections are properly torqued and use appropriate cable glands`);
  }

  if (packVoltage > 100) {
    warnings.push('HVIL (High Voltage Interlock Loop) recommended for packs >100V per UN ECE R100');
  }

  if (bms && packCurrentA > bms.maxA * 0.8) {
    warnings.push(`BMS MOSFET (${bms.maxA}A) close to I_max (${packCurrentA.toFixed(1)}A) — verify thermal derating and add external contactor`);
  }

  // ── Overall status ──
  let overallStatus: 'safe' | 'caution' | 'danger' = 'safe';
  if (warnings.some(w => w.includes('HIGH VOLTAGE') || w.includes('HIGH CURRENT'))) {
    overallStatus = 'danger';
  } else if (warnings.length > 0 || recs.some(r => r.priority === 'required')) {
    overallStatus = 'caution';
  }

  return {
    recommendations: recs,
    summary: {
      needsContactor,
      needsBreaker,
      needsDisconnect,
      needsPrecharge,
      needsFuse,
      overallStatus,
    },
    warnings,
  };
}

/* ── Render helpers (return HTML strings for sidebar) ── */

const CATEGORY_ICON: Record<string, string> = {
  contactor: '⚡',
  breaker: '🔌',
  disconnect: '🔧',
  precharge: '🛡',
  fuse: '🔗',
  warning: '⚠',
};

const PRIORITY_COLOR: Record<string, string> = {
  required: 'text-red-600 bg-red-50 border-red-200',
  recommended: 'text-amber-600 bg-amber-50 border-amber-200',
  optional: 'text-slate-600 bg-slate-50 border-slate-200',
};

export function renderProtectionCard(report: ProtectionReport): string {
  const recsHtml = report.recommendations.map(rec => {
    const specsHtml = Object.entries(rec.specs).map(([key, val]) =>
      `<span class="text-slate-500">${key}</span>
       <span class="font-mono font-semibold text-slate-700">${val}</span>`
    ).join('');

    const notesHtml = rec.safetyNotes.map(n =>
      `<div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
        <span class="text-amber-500 font-bold shrink-0">→</span>
        <span class="text-slate-600">${n}</span>
      </div>`
    ).join('');

    return `
      <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
        <div class="flex justify-between items-center mb-1">
          <div class="flex items-center gap-1.5">
            <span>${CATEGORY_ICON[rec.category] || '📦'}</span>
            <span class="text-[0.7rem] font-extrabold text-slate-700">${rec.component}</span>
          </div>
          <span class="text-[0.55rem] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[rec.priority]}">${rec.priority.toUpperCase()}</span>
        </div>
        <div class="text-[0.62rem] font-mono font-semibold text-slate-600 mb-1">${rec.partNumber}</div>
        <div class="text-[0.6rem] text-slate-500 mb-1">${rec.reason}</div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.58rem] mb-1.5">
          ${specsHtml}
        </div>
        ${notesHtml ? `
        <div class="pt-1 border-t border-slate-100">
          <div class="text-[0.58rem] font-bold text-slate-400 mb-0.5">Notes</div>
          ${notesHtml}
        </div>` : ''}
      </div>`;
  }).join('');

  const warningsHtml = report.warnings.length > 0 ? `
    <div class="bg-red-50 border border-red-200 rounded-md p-2 mt-2">
      <div class="text-[0.68rem] font-extrabold text-red-600 uppercase mb-1">Safety Warnings</div>
      ${report.warnings.map(w => `
        <div class="flex items-start gap-1 text-[0.58rem] leading-tight mt-0.5">
          <span class="text-red-500 font-bold shrink-0">→</span>
          <span class="text-red-700">${w}</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="mb-2 text-[0.6rem] text-slate-500">
      <span class="font-bold">Status:</span>
      <span class="font-bold ml-1" style="color: ${report.summary.overallStatus === 'safe' ? '#22c55e' : report.summary.overallStatus === 'caution' ? '#eab308' : '#ef4444'}">
        ${report.summary.overallStatus.toUpperCase()}
      </span>
      <span class="ml-2 font-bold">${report.recommendations.length}</span> component(s) recommended
    </div>
    ${recsHtml}
    ${warningsHtml}
  `;
}
