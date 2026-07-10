/* ─────────────────────────────────────────────
   F1 — Standards Compliance Engine
   Validates battery pack configurations against
   industry standards: IEC 62619, UN 38.3,
   UL 2580, ISO 12405, SAE J2464.
   ───────────────────────────────────────────── */

import { t } from '../i18n';

export type ComplianceStatus = 'pass' | 'warn' | 'fail' | 'info';
export type StandardId = 'IEC_62619' | 'UN_38.3' | 'UL_2580' | 'ISO_12405' | 'SAE_J2464';

export interface ComplianceRequirement {
  id: string;
  standard: StandardId;
  clause: string;
  description: string;
  category: 'safety' | 'transport' | 'performance' | 'fire';
  mandatory: boolean;
}

export interface ComplianceCheckResult {
  requirement: ComplianceRequirement;
  status: ComplianceStatus;
  actual: string;
  detail: string;
}

export interface PackConfig {
  s: number;
  p: number;
  cellNomV: number;
  cellMinV: number;
  cellMaxV: number;
  cellAh: number;
  cellMaxA: number;
  chemistry: string;
  packVoltage: number;
  packCapacityAh: number;
  packIMax: number;
  hasBms: boolean;
  bmsMaxA: number;
  bmsHasOverchargeProtection: boolean;
  bmsHasOverdischargeProtection: boolean;
  bmsHasShortCircuitProtection: boolean;
  bmsHasOvercurrentProtection: boolean;
  hasFuse: boolean;
  fuseRatingA: number;
  hasContactor: boolean;
  hasDisconnect: boolean;
  hasPrecharge: boolean;
  application: string;
}

export interface ComplianceReport {
  packName: string;
  timestamp: string;
  checks: ComplianceCheckResult[];
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
    info: number;
    overallStatus: ComplianceStatus;
  };
}

/* ── Requirements Database ── */

const REQUIREMENTS: ComplianceRequirement[] = [
  // ── UN 38.3 — Transport of Dangerous Goods ──
  {
    id: 'un38.3-voltage-limit',
    standard: 'UN_38.3',
    clause: '38.3.2',
    description: t('standards.un383VoltageLimit'),
    category: 'transport',
    mandatory: true,
  },
  {
    id: 'un38.3-hazmat-label',
    standard: 'UN_38.3',
    clause: '38.3.4',
    description: t('standards.un383HazmatLabel'),
    category: 'transport',
    mandatory: true,
  },
  {
    id: 'un38.3-power-limit',
    standard: 'UN_38.3',
    clause: '38.3.5',
    description: t('standards.un383PowerLimit'),
    category: 'transport',
    mandatory: false,
  },

  // ── IEC 62619 — Secondary Lithium Cells (Industrial) ──
  {
    id: 'iec62619-overcharge',
    standard: 'IEC_62619',
    clause: '8.3.2',
    description: t('standards.iec62619Overcharge'),
    category: 'safety',
    mandatory: true,
  },
  {
    id: 'iec62619-overdischarge',
    standard: 'IEC_62619',
    clause: '8.3.3',
    description: t('standards.iec62619Overdischarge'),
    category: 'safety',
    mandatory: true,
  },
  {
    id: 'iec62619-short-circuit',
    standard: 'IEC_62619',
    clause: '8.3.4',
    description: t('standards.iec62619ShortCircuit'),
    category: 'safety',
    mandatory: true,
  },
  {
    id: 'iec62619-overcurrent',
    standard: 'IEC_62619',
    clause: '8.3.5',
    description: t('standards.iec62619Overcurrent'),
    category: 'safety',
    mandatory: true,
  },
  {
    id: 'iec62619-temperature',
    standard: 'IEC_62619',
    clause: '8.4.1',
    description: t('standards.iec62619Temperature'),
    category: 'safety',
    mandatory: false,
  },
  {
    id: 'iec62619-fuse',
    standard: 'IEC_62619',
    clause: '8.5.1',
    description: t('standards.iec62619Fuse'),
    category: 'safety',
    mandatory: true,
  },

  // ── UL 2580 — Batteries for EVs ──
  {
    id: 'ul2580-contactor',
    standard: 'UL_2580',
    clause: '4.4',
    description: t('standards.ul2580Contactor'),
    category: 'safety',
    mandatory: true,
  },
  {
    id: 'ul2580-hrc-fuse',
    standard: 'UL_2580',
    clause: '4.5',
    description: t('standards.ul2580HrcFuse'),
    category: 'safety',
    mandatory: false,
  },
  {
    id: 'ul2580-bms-current',
    standard: 'UL_2580',
    clause: '5.2',
    description: t('standards.ul2580BmsCurrent'),
    category: 'performance',
    mandatory: false,
  },
  {
    id: 'ul2580-marking',
    standard: 'UL_2580',
    clause: '7.1',
    description: t('standards.ul2580Marking'),
    category: 'safety',
    mandatory: true,
  },

  // ── ISO 12405 — EV Battery Pack Testing ──
  {
    id: 'iso12405-bms-sizing',
    standard: 'ISO_12405',
    clause: '5.3',
    description: t('standards.iso12405BmsSizing'),
    category: 'performance',
    mandatory: true,
  },
  {
    id: 'iso12405-voltage-range',
    standard: 'ISO_12405',
    clause: '6.1',
    description: t('standards.iso12405VoltageRange'),
    category: 'performance',
    mandatory: true,
  },
  {
    id: 'iso12405-chemistry-voltage',
    standard: 'ISO_12405',
    clause: '6.2',
    description: t('standards.iso12405ChemistryVoltage'),
    category: 'performance',
    mandatory: true,
  },

  // ── SAE J2464 — EV Battery Abuse Testing ──
  {
    id: 'saej2464-overvoltage',
    standard: 'SAE_J2464',
    clause: '4.1',
    description: t('standards.saej2464Overvoltage'),
    category: 'fire',
    mandatory: true,
  },
  {
    id: 'saej2464-overdischarge',
    standard: 'SAE_J2464',
    clause: '4.2',
    description: t('standards.saej2464Overdischarge'),
    category: 'fire',
    mandatory: true,
  },
  {
    id: 'saej2464-overcurrent',
    standard: 'SAE_J2464',
    clause: '4.3',
    description: t('standards.saej2464Overcurrent'),
    category: 'fire',
    mandatory: true,
  },
  {
    id: 'saej2464-short-circuit',
    standard: 'SAE_J2464',
    clause: '4.4',
    description: t('standards.saej2464ShortCircuit'),
    category: 'fire',
    mandatory: true,
  },
  {
    id: 'saej2464-temperature',
    standard: 'SAE_J2464',
    clause: '5.1',
    description: t('standards.saej2464Temperature'),
    category: 'fire',
    mandatory: false,
  },
];

/* ── Chemistry-specific voltage ranges ── */

const CHEM_VOLTAGE_RANGES: Record<string, { minV: number; maxV: number; nomV: number }> = {
  'lfp':     { minV: 2.5, maxV: 3.65, nomV: 3.2 },
  'li-ion':  { minV: 2.5, maxV: 4.2,  nomV: 3.6 },
  'nmc':     { minV: 2.5, maxV: 4.2,  nomV: 3.6 },
  'lto':     { minV: 1.5, maxV: 2.8,  nomV: 2.4 },
  'na-ion':  { minV: 1.5, maxV: 3.9,  nomV: 3.0 },
  'lipo':    { minV: 2.5, maxV: 4.2,  nomV: 3.7 },
};

/* ── Standard display info ── */

export const STANDARD_INFO: Record<StandardId, { name: string; fullName: string; color: string }> = {
  'IEC_62619':  { name: 'IEC 62619',  fullName: 'Secondary lithium cells for industrial applications', color: '#3b82f6' },
  'UN_38.3':    { name: 'UN 38.3',    fullName: 'Transport of dangerous goods — lithium battery testing', color: '#ef4444' },
  'UL_2580':    { name: 'UL 2580',    fullName: 'Batteries for use in electric vehicles', color: '#f59e0b' },
  'ISO_12405':  { name: 'ISO 12405',  fullName: 'EV battery pack performance testing', color: '#8b5cf6' },
  'SAE_J2464':  { name: 'SAE J2464',  fullName: 'EV battery abuse testing', color: '#ec4899' },
};

/* ── Compliance Check Logic ── */

export function checkCompliance(config: PackConfig): ComplianceReport {
  const checks: ComplianceCheckResult[] = [];
  const packV = config.packVoltage;
  const packAh = config.packCapacityAh;
  const packWh = packV * packAh;

  // ── UN 38.3 checks ──

  checks.push(checkVoltageLimit(packV));
  checks.push(checkHazmatLabel(packV));
  checks.push(checkPowerLimit(packWh));

  // ── IEC 62619 checks ──

  checks.push(checkOverchargeProtection(config));
  checks.push(checkOverdischargeProtection(config));
  checks.push(checkShortCircuitProtection(config));
  checks.push(checkOvercurrentProtection(config));
  checks.push(checkTemperatureMonitoring(config, packWh));
  checks.push(checkFuseRequired(config));

  // ── UL 2580 checks ──

  checks.push(checkContactorRequired(config));
  checks.push(checkHrcFuse(config));
  checks.push(checkBmsCurrentSizing(config));
  checks.push(checkPackMarking());

  // ── ISO 12405 checks ──

  checks.push(checkIsoBmsSizing(config));
  checks.push(checkIsoVoltageRange(config));
  checks.push(checkIsoChemistryVoltage(config));

  // ── SAE J2464 checks ──

  checks.push(checkSaeOvervoltage(config));
  checks.push(checkSaeOverdischarge(config));
  checks.push(checkSaeOvercurrent(config));
  checks.push(checkSaeShortCircuit(config));
  checks.push(checkSaeTemperatureMonitoring(config));

  // ── Summary ──

  const pass = checks.filter(c => c.status === 'pass').length;
  const warn = checks.filter(c => c.status === 'warn').length;
  const fail = checks.filter(c => c.status === 'fail').length;
  const info = checks.filter(c => c.status === 'info').length;

  let overallStatus: ComplianceStatus = 'pass';
  if (fail > 0) overallStatus = 'fail';
  else if (warn > 0) overallStatus = 'warn';

  return {
    packName: `BCA-${config.s}S${config.p}P`,
    timestamp: new Date().toISOString(),
    checks,
    summary: {
      total: checks.length,
      pass,
      warn,
      fail,
      info,
      overallStatus,
    },
  };
}

/* ── Individual check functions ── */

function req(id: string): ComplianceRequirement {
  return REQUIREMENTS.find(r => r.id === id)!;
}

function checkVoltageLimit(packV: number): ComplianceCheckResult {
  const status: ComplianceStatus = packV <= 100 ? 'pass' : packV <= 150 ? 'warn' : 'fail';
  return {
    requirement: req('un38.3-voltage-limit'),
    status,
    actual: `${packV.toFixed(1)}V`,
    detail: status === 'pass'
      ? t('standards.voltageLimitPass')
      : t('standards.voltageLimitFail', { voltage: packV.toFixed(1) }),
  };
}

function checkHazmatLabel(packV: number): ComplianceCheckResult {
  const status: ComplianceStatus = 'info';
  return {
    requirement: req('un38.3-hazmat-label'),
    status,
    actual: packV > 100 ? 'Class 9 required' : 'Class 9 recommended',
    detail: t('standards.hazmatLabelInfo'),
  };
}

function checkPowerLimit(packWh: number): ComplianceCheckResult {
  let status: ComplianceStatus;
  let detail: string;

  if (packWh <= 100) {
    status = 'pass';
    detail = t('standards.powerLimitPass', { wh: packWh.toFixed(0) });
  } else if (packWh <= 300) {
    status = 'warn';
    detail = t('standards.powerLimitWarn', { wh: packWh.toFixed(0) });
  } else {
    status = 'fail';
    detail = t('standards.powerLimitFail', { wh: packWh.toFixed(0) });
  }

  return {
    requirement: req('un38.3-power-limit'),
    status,
    actual: `${packWh.toFixed(0)}Wh`,
    detail,
  };
}

function checkOverchargeProtection(c: PackConfig): ComplianceCheckResult {
  const status: ComplianceStatus = c.hasBms && c.bmsHasOverchargeProtection ? 'pass' : 'fail';
  return {
    requirement: req('iec62619-overcharge'),
    status,
    actual: c.hasBms ? (c.bmsHasOverchargeProtection ? t('common.yes') : t('common.no')) : 'No BMS',
    detail: status === 'pass'
      ? t('standards.overchargePass')
      : t('standards.overchargeFail'),
  };
}

function checkOverdischargeProtection(c: PackConfig): ComplianceCheckResult {
  const status: ComplianceStatus = c.hasBms && c.bmsHasOverdischargeProtection ? 'pass' : 'fail';
  return {
    requirement: req('iec62619-overdischarge'),
    status,
    actual: c.hasBms ? (c.bmsHasOverdischargeProtection ? t('common.yes') : t('common.no')) : 'No BMS',
    detail: status === 'pass'
      ? t('standards.overdischargePass')
      : t('standards.overdischargeFail'),
  };
}

function checkShortCircuitProtection(c: PackConfig): ComplianceCheckResult {
  const status: ComplianceStatus = c.hasBms && c.bmsHasShortCircuitProtection ? 'pass' : 'fail';
  return {
    requirement: req('iec62619-short-circuit'),
    status,
    actual: c.hasBms ? (c.bmsHasShortCircuitProtection ? t('common.yes') : t('common.no')) : 'No BMS',
    detail: status === 'pass'
      ? t('standards.shortCircuitPass')
      : t('standards.shortCircuitFail'),
  };
}

function checkOvercurrentProtection(c: PackConfig): ComplianceCheckResult {
  const status: ComplianceStatus = c.hasBms && c.bmsHasOvercurrentProtection ? 'pass' : 'fail';
  return {
    requirement: req('iec62619-overcurrent'),
    status,
    actual: c.hasBms ? (c.bmsHasOvercurrentProtection ? t('common.yes') : t('common.no')) : 'No BMS',
    detail: status === 'pass'
      ? t('standards.overcurrentPass')
      : t('standards.overcurrentFail'),
  };
}

function checkTemperatureMonitoring(c: PackConfig, packWh: number): ComplianceCheckResult {
  if (packWh <= 50) {
    return {
      requirement: req('iec62619-temperature'),
      status: 'info',
      actual: `${packWh.toFixed(0)}Wh — exempt`,
      detail: t('standards.temperatureInfo'),
    };
  }
  // Any BMS implies temperature monitoring capability
  const status: ComplianceStatus = c.hasBms ? 'pass' : 'warn';
  return {
    requirement: req('iec62619-temperature'),
    status,
    actual: c.hasBms ? 'Via BMS' : 'Not monitored',
    detail: status === 'pass'
      ? t('standards.temperaturePass')
      : t('standards.temperatureWarn'),
  };
}

function checkFuseRequired(c: PackConfig): ComplianceCheckResult {
  const status: ComplianceStatus = c.hasFuse ? 'pass' : 'fail';
  return {
    requirement: req('iec62619-fuse'),
    status,
    actual: c.hasFuse ? `${c.fuseRatingA}A fuse` : 'No fuse',
    detail: status === 'pass'
      ? t('standards.fusePass', { rating: c.fuseRatingA })
      : t('standards.fuseFail'),
  };
}

function checkContactorRequired(c: PackConfig): ComplianceCheckResult {
  const needsContactor = c.packVoltage > 48 || c.packCapacityAh > 20;
  if (!needsContactor) {
    return {
      requirement: req('ul2580-contactor'),
      status: 'info',
      actual: `${c.packVoltage.toFixed(0)}V / ${c.packCapacityAh.toFixed(0)}Ah — not required`,
      detail: t('standards.contactorInfo'),
    };
  }
  const status: ComplianceStatus = c.hasContactor ? 'pass' : 'warn';
  return {
    requirement: req('ul2580-contactor'),
    status,
    actual: c.hasContactor ? 'Yes' : 'Not specified',
    detail: status === 'pass'
      ? t('standards.contactorPass')
      : t('standards.contactorWarn'),
  };
}

function checkHrcFuse(c: PackConfig): ComplianceCheckResult {
  const needsHrc = c.packVoltage > 48 || c.packCapacityAh > 20;
  if (!needsHrc) {
    return {
      requirement: req('ul2580-hrc-fuse'),
      status: 'info',
      actual: `${c.packVoltage.toFixed(0)}V / ${c.packCapacityAh.toFixed(0)}Ah — not required`,
      detail: t('standards.hrcFuseInfo'),
    };
  }
  const status: ComplianceStatus = c.hasFuse ? 'pass' : 'warn';
  return {
    requirement: req('ul2580-hrc-fuse'),
    status,
    actual: c.hasFuse ? 'Fuse present' : 'No fuse',
    detail: status === 'pass'
      ? t('standards.hrcFusePass')
      : t('standards.hrcFuseWarn'),
  };
}

function checkBmsCurrentSizing(c: PackConfig): ComplianceCheckResult {
  if (!c.hasBms || c.bmsMaxA <= 0) {
    return {
      requirement: req('ul2580-bms-current'),
      status: 'warn',
      actual: 'No BMS or BMS current not specified',
      detail: t('standards.bmsCurrentInfo'),
    };
  }
  const ratio = c.bmsMaxA / c.packIMax;
  const status: ComplianceStatus = ratio >= 1.25 ? 'pass' : ratio >= 1.0 ? 'warn' : 'fail';
  return {
    requirement: req('ul2580-bms-current'),
    status,
    actual: `BMS: ${c.bmsMaxA}A / Pack: ${c.packIMax.toFixed(0)}A (${ratio.toFixed(2)}×)`,
    detail: status === 'pass'
      ? t('standards.bmsCurrentPass', { ratio: ratio.toFixed(2) })
      : t('standards.bmsCurrentWarn', { ratio: ratio.toFixed(2) }),
  };
}

function checkPackMarking(): ComplianceCheckResult {
  // This is a procedural check — pack will always have markings from datasheet
  return {
    requirement: req('ul2580-marking'),
    status: 'pass',
    actual: 'Datasheet generated',
    detail: t('standards.packMarkingPass'),
  };
}

function checkIsoBmsSizing(c: PackConfig): ComplianceCheckResult {
  if (!c.hasBms || c.bmsMaxA <= 0) {
    return {
      requirement: req('iso12405-bms-sizing'),
      status: 'fail',
      actual: 'No BMS specified',
      detail: t('standards.isoBmsSizingFail'),
    };
  }
  const ratio = c.bmsMaxA / c.packIMax;
  const status: ComplianceStatus = ratio >= 1.25 ? 'pass' : ratio >= 1.0 ? 'warn' : 'fail';
  return {
    requirement: req('iso12405-bms-sizing'),
    status,
    actual: `Ratio: ${ratio.toFixed(2)}×`,
    detail: status === 'pass'
      ? t('standards.isoBmsSizingPass', { ratio: ratio.toFixed(2) })
      : t('standards.isoBmsSizingWarn', { current: c.bmsMaxA, needed: (c.packIMax * 1.25).toFixed(0) }),
  };
}

function checkIsoVoltageRange(c: PackConfig): ComplianceCheckResult {
  // Verify S count is within typical BMS range (1S–24S is common)
  const maxSeries = 24;
  const status: ComplianceStatus = c.s <= maxSeries ? 'pass' : 'warn';
  return {
    requirement: req('iso12405-voltage-range'),
    status,
    actual: `${c.s}S (${c.packVoltage.toFixed(0)}V)`,
    detail: status === 'pass'
      ? t('standards.isoVoltageRangePass', { sCount: c.s })
      : t('standards.isoVoltageRangeWarn', { sCount: c.s }),
  };
}

function checkIsoChemistryVoltage(c: PackConfig): ComplianceCheckResult {
  const chemKey = c.chemistry.toLowerCase().replace(/[₄₅₁₂]/g, '');
  const chemRange = CHEM_VOLTAGE_RANGES[chemKey] ?? CHEM_VOLTAGE_RANGES['li-ion'];

  const nomMatch = Math.abs(c.cellNomV - chemRange.nomV) < 0.3;
  const minOk = c.cellMinV >= chemRange.minV - 0.1;
  const maxOk = c.cellMaxV <= chemRange.maxV + 0.1;

  const allOk = nomMatch && minOk && maxOk;
  let status: ComplianceStatus;
  if (allOk) {
    status = 'pass';
  } else if (nomMatch) {
    status = 'warn';
  } else {
    status = 'fail';
  }

  return {
    requirement: req('iso12405-chemistry-voltage'),
    status,
    actual: `${c.cellNomV}V (nom) / ${c.cellMinV}–${c.cellMaxV}V range`,
    detail: status === 'pass'
      ? t('standards.isoChemistryVoltagePass', { chemistry: c.chemistry, minV: chemRange.minV, maxV: chemRange.maxV })
      : status === 'warn'
        ? t('standards.isoChemistryVoltageWarn', { chemistry: c.chemistry, minV: chemRange.minV, maxV: chemRange.maxV })
        : t('standards.isoChemistryVoltageFail', { nomV: c.cellNomV, chemistry: c.chemistry, expected: chemRange.nomV }),
  };
}

function checkSaeOvervoltage(c: PackConfig): ComplianceCheckResult {
  const hasProtection = c.hasBms && c.bmsHasOverchargeProtection;
  const status: ComplianceStatus = hasProtection ? 'pass' : 'fail';
  return {
    requirement: req('saej2464-overvoltage'),
    status,
    actual: hasProtection ? 'Protected' : 'Not protected',
    detail: status === 'pass'
      ? t('standards.saeOvervoltagePass')
      : t('standards.saeOvervoltageFail'),
  };
}

function checkSaeOverdischarge(c: PackConfig): ComplianceCheckResult {
  const hasProtection = c.hasBms && c.bmsHasOverdischargeProtection;
  const status: ComplianceStatus = hasProtection ? 'pass' : 'fail';
  return {
    requirement: req('saej2464-overdischarge'),
    status,
    actual: hasProtection ? 'Protected' : 'Not protected',
    detail: status === 'pass'
      ? t('standards.saeOverdischargePass')
      : t('standards.saeOverdischargeFail'),
  };
}

function checkSaeOvercurrent(c: PackConfig): ComplianceCheckResult {
  const hasProtection = c.hasBms && c.bmsHasOvercurrentProtection;
  const status: ComplianceStatus = hasProtection ? 'pass' : 'fail';
  return {
    requirement: req('saej2464-overcurrent'),
    status,
    actual: hasProtection ? 'Protected' : 'Not protected',
    detail: status === 'pass'
      ? t('standards.saeOvercurrentPass')
      : t('standards.saeOvercurrentFail'),
  };
}

function checkSaeShortCircuit(c: PackConfig): ComplianceCheckResult {
  const hasProtection = c.hasBms && c.bmsHasShortCircuitProtection;
  const status: ComplianceStatus = hasProtection ? 'pass' : 'fail';
  return {
    requirement: req('saej2464-short-circuit'),
    status,
    actual: hasProtection ? 'Protected' : 'Not protected',
    detail: status === 'pass'
      ? t('standards.saeShortCircuitPass')
      : t('standards.saeShortCircuitFail'),
  };
}

function checkSaeTemperatureMonitoring(c: PackConfig): ComplianceCheckResult {
  const status: ComplianceStatus = c.hasBms ? 'pass' : 'warn';
  return {
    requirement: req('saej2464-temperature'),
    status,
    actual: c.hasBms ? 'Via BMS' : 'Not monitored',
    detail: status === 'pass'
      ? t('standards.saeTemperaturePass')
      : t('standards.saeTemperatureWarn'),
  };
}

/* ── Render helpers ── */

export function getStatusEmoji(status: ComplianceStatus): string {
  switch (status) {
    case 'pass': return '✅';
    case 'warn': return '⚠️';
    case 'fail': return '❌';
    case 'info': return 'ℹ️';
  }
}

export function getStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case 'pass': return '#22c55e';
    case 'warn': return '#eab308';
    case 'fail': return '#ef4444';
    case 'info': return '#3b82f6';
  }
}

export function renderComplianceCard(report: ComplianceReport): string {
  const grouped: Record<string, ComplianceCheckResult[]> = {};
  for (const check of report.checks) {
    const key = check.requirement.standard;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(check);
  }

  const overallColor = getStatusColor(report.summary.overallStatus);
  const overallEmoji = getStatusEmoji(report.summary.overallStatus);

  let sections = '';

  for (const [stdId, checks] of Object.entries(grouped)) {
    if (checks.length === 0) continue;
    const info = STANDARD_INFO[stdId as StandardId];
    if (!info) continue;
    const stdFails = checks.filter(c => c.status === 'fail').length;
    const stdWarns = checks.filter(c => c.status === 'warn').length;

    const headerStatus = stdFails > 0 ? '❌' : stdWarns > 0 ? '⚠️' : '✅';

    const rows = checks.map(c => `
      <div class="flex items-start gap-1 py-0.5 border-b border-slate-100 last:border-0">
        <span class="text-[0.6rem] shrink-0 mt-px">${getStatusEmoji(c.status)}</span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1">
            <span class="text-[0.58rem] font-semibold text-slate-700">${c.requirement.clause}</span>
            <span class="text-[0.55rem] font-medium text-slate-500 truncate">${c.requirement.description}</span>
          </div>
          <div class="text-[0.52rem] text-slate-400 leading-tight">${c.detail}</div>
        </div>
        <span class="text-[0.55rem] font-mono font-bold shrink-0" style="color: ${getStatusColor(c.status)}">${c.actual}</span>
      </div>
    `).join('');

    sections += `
      <div class="mb-2">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-1.5">
            <span class="text-[0.6rem] font-extrabold uppercase" style="color: ${info.color}">${info.name}</span>
            <span class="text-[0.5rem] text-slate-400">§${checks.length}</span>
          </div>
          <span class="text-[0.55rem]">${headerStatus}</span>
        </div>
        <div class="bg-white rounded border border-slate-200 px-1.5 py-0.5">
          ${rows}
        </div>
      </div>
    `;
  }

  return `
    <div class="bg-slate-50 border border-slate-200 rounded-md p-2 mt-2">
      <div class="flex items-center justify-between mb-1.5">
        <div class="flex items-center gap-1.5">
          <span class="text-[0.68rem] font-extrabold text-slate-400 uppercase border-b border-slate-200 pb-1">${t('standards.complianceStatus')}</span>
        </div>
        <span class="text-[0.6rem] font-bold px-1.5 py-0.5 rounded" style="background: ${overallColor}20; color: ${overallColor}">
          ${overallEmoji} ${report.summary.pass}/${report.summary.total}
        </span>
      </div>
      ${sections}
    </div>
  `;
}
