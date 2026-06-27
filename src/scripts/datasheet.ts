/* ─────────────────────────────────────────────
   F19 — Technical Datasheet PDF Generator
   Generates a professional A4 landscape battery
   pack datasheet using jsPDF.
   ───────────────────────────────────────────── */

import { jsPDF } from 'jspdf';
import { getStats, getBomData } from './pack-builder';
import { getLastAmps, getLastWatts, getCellI } from './simulation';
import { inputs, $ } from './dom';
import { recommendBms, type BmsEntry, type CellType as BmsCellType } from './bms-database';
import { recommendConnector, type ConnectorRecommendation } from './power-connector-engine';
import { getCustomBms } from './bms-database';

/* ── Color palette ── */
const C = {
  headerBg: [30, 64, 175] as const,
  headerText: [255, 255, 255] as const,
  sectionBg: [241, 245, 249] as const,
  sectionBorder: [203, 213, 225] as const,
  text: [30, 41, 59] as const,
  textMuted: [100, 116, 139] as const,
  green: [34, 197, 94] as const,
  yellow: [234, 179, 8] as const,
  red: [239, 68, 68] as const,
  white: [255, 255, 255] as const,
  tableAlt: [248, 250, 252] as const,
};

type RGB = readonly [number, number, number];

/* ── Page constants ── */
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 12;
const SECTION_H = 8;

/* ── Helper: read DOM input value ── */
function inp(id: string, fallback: string): string {
  const el = $(id) as HTMLInputElement | null;
  return el?.value ?? fallback;
}

function inpNum(id: string, fallback: number): number {
  return parseFloat(inp(id, String(fallback))) || fallback;
}

/* ── Helper: fit text to max width, truncate with ellipsis ── */
function fitText(pdf: jsPDF, text: string, maxW: number): string {
  if (pdf.getTextWidth(text) <= maxW) return text;
  let truncated = text;
  while (truncated.length > 1 && pdf.getTextWidth(truncated + '…') > maxW) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length < text.length ? truncated + '…' : truncated;
}

/* ── Helper: draw a section box with header ── */
function drawSection(
  pdf: jsPDF,
  x: number, y: number, w: number, h: number,
  title: string,
): void {
  pdf.setFillColor(...C.sectionBg);
  pdf.roundedRect(x, y, w, h, 1, 1, 'F');
  pdf.setDrawColor(...C.sectionBorder);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(x, y, w, h, 1, 1, 'S');
  pdf.setFillColor(...C.headerBg);
  pdf.roundedRect(x, y, w, SECTION_H, 1, 1, 'F');
  pdf.rect(x, y + SECTION_H - 1, w, 1, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(...C.headerText);
  pdf.text(title.toUpperCase(), x + 3, y + SECTION_H - 2);
}

/* ── Helper: draw key-value pair ── */
function drawKV(
  pdf: jsPDF,
  x: number, y: number, w: number,
  key: string, value: string,
  keyColor: RGB = C.textMuted,
  valueColor: RGB = C.text,
): void {
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...keyColor);
  pdf.text(key, x, y);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...valueColor);
  const valueX = x + w * 0.52;
  const maxValueW = w - w * 0.52 - 3;
  const fitted = fitText(pdf, value, maxValueW);
  pdf.text(fitted, valueX, y);
}

/* ── Helper: draw a colored status dot ── */
function drawStatusDot(pdf: jsPDF, x: number, y: number, level: string): void {
  const color: RGB = level === 'green' ? C.green
    : level === 'yellow' ? C.yellow
    : level === 'red' ? C.red
    : C.textMuted;
  pdf.setFillColor(...color);
  pdf.circle(x, y - 1.2, 1.2, 'F');
}

/* ── Helper: safety level label ── */
function levelLabel(level: string): string {
  if (level === 'green') return 'OK';
  if (level === 'yellow') return 'CAUTION';
  if (level === 'red') return 'WARNING';
  return 'N/A';
}

/* ── Gather all pack data ── */
export interface PackData {
  name: string;
  model: string;
  date: string;
  nomV: number;
  minV: number;
  maxV: number;
  capacity: number;
  energy: number;
  maxDischargeA: number;
  maxChargeA: number;
  cRate: number;
  width: number;
  depth: number;
  height: number;
  weight: number;
  volume: number;
  cellType: string;
  cellDiameter: number;
  cellLength: number;
  chemistry: string;
  formFactor: string;
  s: number;
  p: number;
  layers: number;
  totalCells: number;
  gridType: string;
  bmsName: string;
  bmsBalance: string;
  bmsSRange: string;
  bmsMaxA: number;
  bmsProtocol: string;
  bmsSmart: boolean;
  connectorName: string;
  connectorA: number;
  wireGauge: string;
  fuseRating: string;
  fuseType: string;
  antiSpark: boolean;
  voltageDropPct: number;
  safetyNotes: string[];
  voltageSagLevel: string;
  jouleHeatLevel: string;
  ampacityLevel: string;
  packingLevel: string;
  globalLevel: string;
  voltageSagPct: number;
  jouleHeatPct: number;
  ampacityPct: number;
  packingPct: number;
  simCurrent: number;
  simPower: number;
  runtime: string;
  efficiency: number;
  cutoff: number;
  nickelTotal: number;
  cellCount: number;
  stripWidth: number;
  stripThickness: number;
  stripMaterial: string;
  energyDensityWhPerKg: number | 'N/A';
  energyDensityWhPerL: number | 'N/A';
}

export function gatherPackData(): PackData | null {
  const stats = getStats();
  if (!stats || !stats.s || !stats.p) return null;

  const s = stats.s;
  const p = stats.p;
  const cellNom = inpNum('c-volts', 3.6);
  const cellAh = inpNum('c-mah', 2500) / 1000;
  const cellAmp = inpNum('c-amp', 20);

  const chemId = (() => {
    const v = inp('chem-selector', '');
    if (v && v !== 'custom') {
      try { return JSON.parse(v)?.id ?? 'li-ion'; } catch { return 'li-ion'; }
    }
    return 'li-ion';
  })();
  const packIMax = cellAmp * p;
  const packAh = cellAh * p;
  const bmsRecs = recommendBms(s, chemId as BmsCellType, packIMax, packAh, getCustomBms());
  const bms = bmsRecs.length > 0 ? bmsRecs[0].bms : null;

  const cableLength = inpNum('conn-cable-length', 30);
  const appSelect = $('conn-application') as HTMLSelectElement | null;
  const application = (appSelect?.value ?? 'general') as any;
  let connRec: ConnectorRecommendation | null = null;
  try {
    connRec = recommendConnector(s, p, cellNom, cellAh, packIMax, bms, cableLength, application);
  } catch { /* no connector data */ }

  function readSafetyLevel(elId: string): string {
    const el = document.getElementById(elId);
    if (!el) return 'neutral';
    const dataLevel = el.getAttribute('data-level');
    if (dataLevel && ['green', 'yellow', 'red', 'neutral'].includes(dataLevel)) {
      return dataLevel;
    }
    const color = el.style.borderColor || el.style.color;
    if (color.includes('22c55e') || color.includes('34d399')) return 'green';
    if (color.includes('eab308') || color.includes('fbbf24')) return 'yellow';
    if (color.includes('ef4444') || color.includes('f87171')) return 'red';
    return 'neutral';
  }

  function readSafetyPct(elId: string): number {
    const el = document.getElementById(elId);
    if (!el) return 0;
    const bar = el.querySelector('.diag-bar-fill') as HTMLElement | null;
    if (bar) return parseFloat(bar.style.width) || 0;
    return 0;
  }

  const cellType = inp('cell-type', 'cylindrical');
  const isPrismatic = cellType === 'prismatic';
  const cellDiam = inpNum('c-diam', 18);
  const cellLen = inpNum(isPrismatic ? 'c-len-p' : 'c-len', 65);
  const prismW = inpNum('c-prism-w', 148);
  const prismD = inpNum('c-prism-d', 27);

  const chemName = (() => {
    const v = inp('chem-selector', '');
    if (!v || v === 'custom') return 'Custom';
    try {
      const parsed = JSON.parse(v);
      return parsed.name ?? parsed.id ?? 'Custom';
    } catch { return 'Custom'; }
  })();

  const stripW = inpNum('sim-strip-w', 7);
  const stripT = inpNum('sim-strip-t', 0.15);
  const stripMat = (() => {
    const v = inp('sim-strip-mat', '7');
    const mats: Record<string, string> = { '7': 'Nickel', '1.7': 'Copper', '14': 'Steel' };
    return mats[v] ?? 'Nickel';
  })();

  const bom = getBomData();
  const runtimeEl = $('out-sim-runtime');
  const runtime = runtimeEl?.textContent ?? '--';
  const cutoff = inpNum('sys-cutoff', 3.0);
  const effEl = $('out-sim-eff');
  const efficiency = parseFloat(effEl?.textContent ?? '0') || 0;
  const hexMode = (inputs['hex-mode'] as HTMLInputElement | null)?.checked ?? false;
  const formFactor = isPrismatic ? 'Prismatic' : 'Cylindrical';

  /* Energy density guards */
  const energy = stats.wh;
  const weight = stats.kg;
  const volume = stats.vol;

  if (!energy || !isFinite(energy)) {
    console.warn('[datasheet] Energy is zero/NaN — cannot generate datasheet');
    return null;
  }

  const energyDensityWhPerKg = (weight && isFinite(weight) && weight > 0)
    ? energy / weight
    : 'N/A';
  const energyDensityWhPerL = (volume && isFinite(volume) && volume > 0)
    ? energy / volume
    : 'N/A';

  /* Chemistry-aware maxChargeA default */
  const CHEM_CHARGE_RATE: Record<string, number> = {
    'lfp': 1.0, 'LiFePO4': 1.0,
    'nmc': 0.5, 'NMC': 0.5,
    'lto': 2.0, 'Li₄Ti₅O₁₂': 2.0,
    'na-ion': 0.5, 'Na-Ion': 0.5,
  };
  const defaultCRate = CHEM_CHARGE_RATE[chemId] ?? 0.5;

  return {
    name: stats.name || 'Battery Pack',
    model: `BCA-${s}S${p}P`,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    nomV: stats.v, minV: stats.vmin, maxV: stats.vmax,
    capacity: stats.ah, energy: stats.wh,
    maxDischargeA: packIMax,
    maxChargeA: parseFloat(inp('c-charge-amp', String(cellAmp * defaultCRate))),
    cRate: packAh > 0 ? packIMax / packAh : 0,
    width: stats.w, depth: stats.d, height: stats.h,
    weight: stats.kg, volume: stats.vol,
    cellType: cellDiam > 0 ? `${cellDiam}mm` : `${prismW}×${prismD}mm`,
    cellDiameter: cellDiam, cellLength: cellLen,
    chemistry: chemName, formFactor,
    s, p, layers: stats.l, totalCells: stats.cells,
    gridType: hexMode ? 'Hexagonal' : 'Square',
    bmsName: bms?.name ?? 'None',
    bmsBalance: bms?.balanceType ?? '--',
    bmsSRange: bms ? `${bms.sMin}S-${bms.sMax}S` : '--',
    bmsMaxA: bms?.maxA ?? 0,
    bmsProtocol: bms?.protocol ?? '--',
    bmsSmart: bms?.smart ?? false,
    connectorName: connRec?.connector.name ?? '--',
    connectorA: connRec?.connector.continuousA ?? 0,
    wireGauge: connRec?.wireGauge.label ?? '--',
    fuseRating: connRec ? `${connRec.fuseRating}A` : '--',
    fuseType: connRec?.fuseType ?? '--',
    antiSpark: connRec?.needsAntiSpark ?? false,
    voltageDropPct: connRec?.voltageDropPct ?? 0,
    safetyNotes: connRec?.safetyNotes ?? [],
    voltageSagLevel: readSafetyLevel('safety-voltage-sag'),
    jouleHeatLevel: readSafetyLevel('safety-joule-heat'),
    ampacityLevel: readSafetyLevel('safety-ampacity'),
    packingLevel: readSafetyLevel('safety-packing'),
    globalLevel: readSafetyLevel('diag-global-status') === 'neutral' ? 'green' : readSafetyLevel('diag-global-status'),
    voltageSagPct: readSafetyPct('safety-voltage-sag'),
    jouleHeatPct: readSafetyPct('safety-joule-heat'),
    ampacityPct: readSafetyPct('safety-ampacity'),
    packingPct: readSafetyPct('safety-packing'),
    simCurrent: getLastAmps(),
    simPower: getLastWatts(),
    runtime, efficiency, cutoff,
    nickelTotal: bom.nickelMetersTotal,
    cellCount: bom.cellCount,
    stripWidth: stripW, stripThickness: stripT, stripMaterial: stripMat,
    energyDensityWhPerKg, energyDensityWhPerL,
  };
}

/* ─────────────────────────────────────────────
   Draw datasheet on the CURRENT page of a jsPDF instance.
   Called by both exportDatasheet() and exportPdf().
   ───────────────────────────────────────────── */

export function drawDatasheetPage(pdf: jsPDF, data: PackData): void {
  const pw = PAGE_W;
  const ph = PAGE_H;
  const mx = MARGIN;
  const my = MARGIN;
  const contentW = pw - mx * 2;
  const colGap = 8;
  const colW = (contentW - colGap) / 2;
  const kvGap = 4.5;

  /* HEADER */
  const headerH = 14;
  pdf.setFillColor(...C.headerBg);
  pdf.roundedRect(mx, my, contentW, headerH, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.setTextColor(...C.headerText);
  pdf.text('BATTERY PACK TECHNICAL DATASHEET', mx + 4, my + 6);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${data.name}  |  ${data.model}`, mx + 4, my + 10.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.text(`Date: ${data.date}`, pw - mx - 4, my + 6, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Serial: ${data.model}-${Date.now().toString(36).toUpperCase()}`, pw - mx - 4, my + 10.5, { align: 'right' });

  /* ROW 1 */
  let row1Y = my + headerH + 4;
  const row1H = 46;
  drawSection(pdf, mx, row1Y, colW, row1H, 'Electrical Specifications');
  let ky = row1Y + SECTION_H + 4;
  drawKV(pdf, mx + 3, ky, colW, 'Nominal Voltage', `${data.nomV.toFixed(1)} V`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Voltage Range', `${data.minV.toFixed(1)} – ${data.maxV.toFixed(1)} V`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Capacity', `${data.capacity.toFixed(2)} Ah`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Energy', `${data.energy >= 1000 ? (data.energy / 1000).toFixed(2) + ' kWh' : Math.round(data.energy) + ' Wh'}`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Max Discharge', `${data.maxDischargeA.toFixed(0)} A`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Max Charge', `${data.maxChargeA.toFixed(1)} A`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'C-rate (max)', `${data.cRate.toFixed(2)}C`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Energy Density (Wh/kg)', data.energyDensityWhPerKg === 'N/A' ? 'N/A' : `${data.energyDensityWhPerKg.toFixed(1)}`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Energy Density (Wh/L)', data.energyDensityWhPerL === 'N/A' ? 'N/A' : `${data.energyDensityWhPerL.toFixed(1)}`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Strip', `${data.stripWidth}×${data.stripThickness}mm ${data.stripMaterial}`);

  const col2X = mx + colW + colGap;
  drawSection(pdf, col2X, row1Y, colW, row1H, 'Physical Specifications');
  ky = row1Y + SECTION_H + 4;
  drawKV(pdf, col2X + 3, ky, colW, 'Dimensions (L×W×H)', `${data.width.toFixed(0)}×${data.depth.toFixed(0)}×${data.height.toFixed(0)} mm`); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Weight', `${data.weight.toFixed(2)} kg`); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Volume', `${data.volume >= 1 ? data.volume.toFixed(2) + ' L' : Math.round(data.volume * 1000) + ' mL'}`); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Cell Type', data.formFactor); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Cell Dimensions', data.cellType); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Chemistry', data.chemistry); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Total Cells', `${data.totalCells}`);

  /* ROW 2 */
  let row2Y = row1Y + row1H + 4;
  const row2H = 32;
  drawSection(pdf, mx, row2Y, colW, row2H, 'Configuration');
  ky = row2Y + SECTION_H + 4;
  drawKV(pdf, mx + 3, ky, colW, 'Series × Parallel', `${data.s}S × ${data.p}P`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Layers', `${data.layers}`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Grid Pattern', data.gridType); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Pack Voltage (nom)', `${data.nomV.toFixed(1)} V`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Pack Capacity', `${data.capacity.toFixed(2)} Ah`);

  drawSection(pdf, col2X, row2Y, colW, row2H, 'Battery Management System');
  ky = row2Y + SECTION_H + 4;
  drawKV(pdf, col2X + 3, ky, colW, 'Model', data.bmsName); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Balance Type', data.bmsBalance); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'S Range', data.bmsSRange); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Max Current', data.bmsMaxA > 0 ? `${data.bmsMaxA}A` : '--'); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Protocol', data.bmsProtocol);

  /* ROW 3 */
  let row3Y = row2Y + row2H + 4;
  const row3H = 36;
  drawSection(pdf, mx, row3Y, colW, row3H, 'Power Connectors & Wiring');
  ky = row3Y + SECTION_H + 4;
  drawKV(pdf, mx + 3, ky, colW, 'Main Connector', `${data.connectorName} (${data.connectorA}A)`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Wire Gauge', data.wireGauge); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Fuse', `${data.fuseRating} ${data.fuseType}`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Anti-spark', data.antiSpark ? 'Yes' : 'No'); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Voltage Drop', `${data.voltageDropPct.toFixed(1)}%`);

  drawSection(pdf, col2X, row3Y, colW, row3H, 'Safety Status');
  ky = row3Y + SECTION_H + 4;
  const safetyItems = [
    { label: 'Voltage Sag', level: data.voltageSagLevel },
    { label: 'Joule Heat', level: data.jouleHeatLevel },
    { label: 'Ampacity', level: data.ampacityLevel },
    { label: 'Packing Efficiency', level: data.packingLevel },
  ];
  for (const item of safetyItems) {
    drawStatusDot(pdf, col2X + 5, ky, item.level);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(...C.text);
    pdf.text(item.label, col2X + 8, ky);
    pdf.setFont('helvetica', 'bold');
    const lColor: RGB = item.level === 'green' ? C.green
      : item.level === 'yellow' ? C.yellow
      : item.level === 'red' ? C.red : C.textMuted;
    pdf.setTextColor(...lColor);
    pdf.text(levelLabel(item.level), col2X + colW - 5, ky, { align: 'right' });
    ky += kvGap;
  }

  /* ROW 4 */
  let row4Y = row3Y + row3H + 4;
  const row4H = 28;
  drawSection(pdf, mx, row4Y, colW, row4H, 'Simulation Results');
  ky = row4Y + SECTION_H + 4;
  drawKV(pdf, mx + 3, ky, colW, 'Load Current', `${data.simCurrent.toFixed(1)} A`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Useful Power', `${data.simPower >= 1000 ? (data.simPower / 1000).toFixed(2) + ' kW' : Math.round(data.simPower) + ' W'}`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Runtime', data.runtime); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'Efficiency', `${data.efficiency.toFixed(1)}%`); ky += kvGap;
  drawKV(pdf, mx + 3, ky, colW, 'LVC Cutoff', `${data.cutoff.toFixed(2)} V/cell`);

  drawSection(pdf, col2X, row4Y, colW, row4H, 'Bill of Materials Summary');
  ky = row4Y + SECTION_H + 4;
  drawKV(pdf, col2X + 3, ky, colW, 'Nickel Strip (total)', `${data.nickelTotal.toFixed(2)} m`); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Cell Count', `${data.cellCount} units`); ky += kvGap;
  drawKV(pdf, col2X + 3, ky, colW, 'Packing Efficiency', `${(data.packingPct).toFixed(1)}%`);

  /* FOOTER */
  const footerY = ph - my - 6;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(5.5);
  pdf.setTextColor(...C.textMuted);
  pdf.text(
    'Referenced standards: IEC 62619 (secondary lithium cells), UN 38.3 (transport testing), UL 2580 (EV batteries). For reference only — verify compliance with your local authority.',
    mx, footerY,
  );
  pdf.text(
    `Generated by Battery Tool — ${data.date}`,
    pw - mx, footerY,
    { align: 'right' },
  );
  pdf.setDrawColor(...C.sectionBorder);
  pdf.setLineWidth(0.15);
  pdf.line(mx, footerY - 3, pw - mx, footerY - 3);
}

/* ── Standalone export (menu item) ── */
export function exportDatasheet(): void {
  const data = gatherPackData();
  if (!data) return;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  drawDatasheetPage(pdf, data);
  const safeName = data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  pdf.save(`${safeName}_${data.s}S${data.p}P_datasheet.pdf`);
}
