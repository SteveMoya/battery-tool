import { inputs, $ } from './dom';
import { t } from '../i18n';
import {
  checkVoltageSag, checkAmpacity, checkMicahToll, checkStripThermal,
  renderVoltageSagIndicator, renderAmpacityIndicator, renderMicahTollIndicator, renderStripThermalIndicator,
} from './safety-indicators';
import {
  checkJouleHeat, renderJouleHeatIndicator,
  computeDiagnostic, renderDiagnosticGlobal,
} from './diagnostic';

let simMaxVal = 100;
let lastSimAmps = 0;
let lastSimWatts = 0;
let lastSimP = 1;

export const getSimMax = () => simMaxVal;
export const setSimMax = (v: number) => { simMaxVal = v; };
export const getLastAmps = () => lastSimAmps;
export const setLastAmps = (v: number) => { lastSimAmps = v; };
export const getLastWatts = () => lastSimWatts;
export const setLastWatts = (v: number) => { lastSimWatts = v; };
export const getI = () => lastSimAmps;
export const getCellI = () => lastSimP > 0 ? lastSimAmps / lastSimP : 0;

export function renderCurrentStats() {
  const outPackI = $('out-pack-current');
  const outCellI = $('out-cell-current');
  if (outPackI) outPackI.textContent = `${lastSimAmps.toFixed(1)} A`;
  if (outCellI) outCellI.textContent = `${getCellI().toFixed(2)} A`;
}

export function getOpenCircuitVoltage(soc: number, min: number, max: number, nom: number): number {
  const range = max - min;
  let chem: 'li-ion' | 'lfp' | 'lto' | 'na-ion' = 'li-ion';
  if (nom >= 3.15 && nom <= 3.45) chem = 'lfp';
  else if (nom >= 2.0 && nom <= 2.8) chem = 'lto';
  else if (nom >= 2.9 && nom <= 3.1) chem = 'na-ion';

  if (chem === 'lfp') {
    if (soc >= 0.9) {
      const p = (soc - 0.9) / 0.1;
      const platTop = min + range * 0.85;
      return platTop + (max - platTop) * p;
    } else if (soc >= 0.15) {
      const p = (soc - 0.15) / 0.75;
      const platBot = min + range * 0.70;
      const platTop = min + range * 0.85;
      return platBot + (platTop - platBot) * p;
    } else {
      const p = soc / 0.15;
      const platBot = min + range * 0.70;
      return min + (platBot - min) * p;
    }
  } else if (chem === 'lto') {
    return min + range * Math.pow(soc, 0.9);
  } else {
    return min + range * soc;
  }
}

export function rescaleLoadSlider() {
  const slider = $('sim-load-slider') as HTMLInputElement | null;
  const inputType = $('sim-load-type') as HTMLInputElement | null;
  const mode = ($('sim-mode-val') as HTMLInputElement | null)?.value;
  const numInput = $('sim-load-input') as HTMLInputElement | null;
  if (!slider) return;
  slider.max = '1000';

  const S = parseInt(inputs['s-count']?.value ?? '1') || 1;
  const P = parseInt(inputs['p-count']?.value ?? '1') || 1;
  const cellAmp = parseFloat(inputs['c-amp']?.value ?? '20') || 20;
  const cellMax = parseFloat(inputs['c-max-v']?.value ?? '4.2') || 4.2;
  const cellMah = parseFloat(inputs['c-mah']?.value ?? '2500') || 2500;

  const cellNom = parseFloat(inputs['c-volts']?.value ?? '3.6') || 3.6;
  let maxChargeC = 1.0; // default NMC
  if (cellNom >= 3.15 && cellNom <= 3.45) maxChargeC = 2.0;      // LFP
  else if (cellNom >= 2.0 && cellNom <= 2.8) maxChargeC = 3.0;   // LTO
  else if (cellNom >= 2.9 && cellNom <= 3.1) maxChargeC = 0.5;   // Na-Ion

  const dischargeMaxA = (P * cellAmp) * 1.5;
  const packAh = (P * cellMah) / 1000;
  const chargeMaxA = packAh * maxChargeC;
  const maxA = mode === 'discharge' ? dischargeMaxA : chargeMaxA;

  const unit = $('sim-input-unit');
  if (inputType?.value === 'cc') {
    simMaxVal = maxA;
    if (unit) unit.textContent = 'A';
  } else {
    const packVMax = S * cellMax;
    simMaxVal = maxA * packVMax;
    if (unit) unit.textContent = 'W';
  }
  if (numInput) numInput.max = simMaxVal.toFixed(1);
}

export function updateSimulation(e?: Event) {
  const slider = $('sim-load-slider') as HTMLInputElement | null;
  const numInput = $('sim-load-input') as HTMLInputElement | null;
  const cellVoltInput = $('sim-cell-volt-input') as HTMLInputElement | null;
  if (!slider || !numInput) return;

  let val = 0;
  if (e && e.target === numInput) {
    val = parseFloat(numInput.value);
    if (isNaN(val)) val = 0;
    if (val > simMaxVal) val = simMaxVal;
    slider.value = String(1000 * Math.sqrt(val / simMaxVal));
  } else {
    const sliderPos = parseFloat(slider.value);
    const ratio = sliderPos / 1000;
    val = simMaxVal * (ratio * ratio);
    let decimals = 1;
    if (val < 10) decimals = 2;
    else if (val >= 100) decimals = 0;
    if (document.activeElement !== numInput) numInput.value = val.toFixed(decimals);
  }

  let smartStep = 1.0;
  if (val < 1) smartStep = 0.05;
  else if (val < 10) smartStep = 0.5;
  else if (val < 50) smartStep = 1.0;
  else smartStep = 5.0;
  numInput.step = String(smartStep);

  const mode = ($('sim-mode-val') as HTMLInputElement | null)?.value ?? 'discharge';
  const type = ($('sim-load-type') as HTMLInputElement | null)?.value ?? 'cc';
  const soc = parseFloat(($('sim-soc') as HTMLInputElement | null)?.value ?? '100') / 100 || 1;

  const S = parseInt(inputs['s-count']?.value ?? '1') || 1;
  const P = parseInt(inputs['p-count']?.value ?? '1') || 1;
  lastSimP = P;
  const cellMin = parseFloat(inputs['c-min-v']?.value ?? '2.5') || 2.5;
  const cellMax = parseFloat(inputs['c-max-v']?.value ?? '4.2') || 4.2;
  const cellNom = parseFloat(inputs['c-volts']?.value ?? '3.6') || 3.6;
  const cellAh = parseFloat(inputs['c-mah']?.value ?? '2500') / 1000 || 2.5;
  const cellAmp = parseFloat(inputs['c-amp']?.value ?? '20') || 20;

  const cutoffEl = $('sys-cutoff') as HTMLInputElement | null;
  let cutoff = parseFloat(cutoffEl?.value ?? '3') || 3;
  if (cutoff < cellMin) { cutoff = cellMin; if (cutoffEl) cutoffEl.value = cellMin.toFixed(2); }
  if (e && e.target === cutoffEl && e.type === 'change') { if (cutoffEl) cutoffEl.value = cutoff.toFixed(2); }

  const rowLVC = $('row-lvc-inputs');
  const rowUsable = $('row-usable-cap');
  if (mode === 'charge') {
    rowLVC?.classList.add('disabled');
    rowUsable?.classList.add('disabled');
    const lblRuntime = $('lbl-runtime'); if (lblRuntime) lblRuntime.textContent = t('sidebar.simulation.chgTime');
  } else {
    rowLVC?.classList.remove('disabled');
    rowUsable?.classList.remove('disabled');
    const lblRuntime = $('lbl-runtime'); if (lblRuntime) lblRuntime.textContent = t('sidebar.simulation.runtime');
  }

  const irCell = parseFloat(inputs['sim-cell-ir']?.value ?? '25') / 1000 || 0.025;
  const rho = parseFloat(inputs['sim-strip-mat']?.value ?? '7') * 1e-8 || 7e-8;
  const wStrip = parseFloat(inputs['sim-strip-w']?.value ?? '7') / 1000 || 0.007;
  const tStrip = parseFloat(inputs['sim-strip-t']?.value ?? '0.15') / 1000 || 0.00015;
  const dRaw = parseFloat(inputs['c-diam']?.value ?? '18') / 1000 || 0.018;
  const pwRaw = parseFloat(inputs['c-prism-w']?.value ?? '0') / 1000 || 0;
  const isPrismatic = inputs['cell-type']?.value === 'prismatic';
  const d = isPrismatic && pwRaw > 0 ? pwRaw : dRaw;
  const sp = parseFloat(inputs['c-spacing']?.value ?? '1') / 1000 || 0.001;

  const rCellsTotal = (S * irCell) / P;
  const rStripsTotal = ((S * ((rho * (d + sp)) / (wStrip * tStrip))) / P) * 1.2;
  const R_total = rCellsTotal + rStripsTotal;

  const cellVoc = getOpenCircuitVoltage(soc, cellMin, cellMax, cellNom);
  const packVoc = cellVoc * S;
  if (document.activeElement !== cellVoltInput && cellVoltInput) {
    cellVoltInput.value = cellVoc.toFixed(2);
  }

  const socLbl = $('val-soc');
  if (socLbl) {
    socLbl.textContent = `${Math.round(soc * 100)}% (${packVoc.toFixed(1)}V)`;
    (socLbl as HTMLElement).style.color = `hsl(${soc * 120}, 80%, 35%)`;
  }

  let I = 0;
  let isCollapse = false;
  if (type === 'cp') {
    const P_target = val;
    if (P_target > 0) {
      if (mode === 'discharge') {
        const a = R_total, b = -packVoc, c = P_target;
        const disc = b * b - 4 * a * c;
        if (disc < 0) { isCollapse = true; I = packVoc / (2 * R_total); }
        else { I = (-b - Math.sqrt(disc)) / (2 * a); }
      } else {
        I = P_target / packVoc;
      }
    }
  } else {
    I = val;
  }

  const vDrop = I * R_total;
  let vNet = mode === 'discharge' ? packVoc - vDrop : packVoc + vDrop;
  if (vNet < 0) vNet = 0;
  const heatCells = (I * I) * rCellsTotal;
  const heatStrips = (I * I) * rStripsTotal;
  const heatTotal = heatCells + heatStrips;

  let pUseful = 0, pTotal = 0;
  if (mode === 'discharge') { pUseful = vNet * I; pTotal = packVoc * I; }
  else { pTotal = vNet * I; pUseful = packVoc * I; }
  const eff = (pTotal > 0) ? (pUseful / pTotal) * 100 : 100;

  lastSimAmps = I;
  lastSimWatts = mode === 'discharge' ? pUseful : pTotal;

  const fmtPwr = (v: number) => (v >= 1000) ? `${(v / 1000).toFixed(2)} kW` : `${Math.round(v)} W`;
  const fmtHeat = (v: number) => {
    if (v >= 100) return `${Math.round(v)} W`;
    if (v >= 10) return `${v.toFixed(1)} W`;
    return `${v.toFixed(2)} W`;
  };

  const lblSag = $('lbl-sim-sag');
  if (mode === 'discharge') {
    if (lblSag?.firstChild) lblSag.firstChild.nodeValue = `${t('sidebar.simulation.sag')} `;
    const outSag = $('out-sim-sag'); if (outSag) outSag.textContent = `-${vDrop.toFixed(2)} V`;
    const lblNet = $('lbl-sim-net'); if (lblNet) lblNet.textContent = t('sidebar.simulation.netOutput');
  } else {
    if (lblSag?.firstChild) lblSag.firstChild.nodeValue = t('sidebar.simulation.rise');
    const outSag = $('out-sim-sag'); if (outSag) outSag.textContent = `+${vDrop.toFixed(2)} V`;
    const lblNet = $('lbl-sim-net'); if (lblNet) lblNet.textContent = t('sidebar.simulation.reqVoltage');
  }
  const outNet = $('out-sim-netv'); if (outNet) outNet.textContent = `${vNet.toFixed(2)} V`;
  const outAmps = $('out-sim-amps'); if (outAmps) outAmps.textContent = `${I.toFixed(1)} A`;

  const packAh = P * cellAh;
  const cRate = packAh > 0 ? I / packAh : 0;
  const lblC = $('lbl-sim-c'); if (lblC) lblC.textContent = `${cRate.toFixed(2)}C`;
  const ratedMaxAmps = P * cellAmp;
  const loadPerc = ratedMaxAmps > 0 ? (I / ratedMaxAmps) * 100 : 0;
  const percEl = $('lbl-load-perc');
  if (percEl) {
    percEl.textContent = `${Math.round(loadPerc)}% ${t('sidebar.simulation.percentOfMax')}`;
    (percEl as HTMLElement).style.color = loadPerc > 100 ? '#ef4444' : loadPerc > 80 ? '#f59e0b' : '#94a3b8';
  }

  const outPT = $('out-sim-power-total'); if (outPT) outPT.textContent = fmtPwr(pTotal);
  const outPU = $('out-sim-power-useful'); if (outPU) outPU.textContent = fmtPwr(pUseful);
  const outHC = $('out-sim-heat-cell'); if (outHC) outHC.textContent = fmtHeat(heatCells);
  const outHS = $('out-sim-heat-strip'); if (outHS) outHS.textContent = fmtHeat(heatStrips);
  const outHT = $('out-sim-heat-total'); if (outHT) outHT.textContent = fmtHeat(heatTotal);
  const outEff = $('out-sim-eff'); if (outEff) outEff.textContent = `${eff.toFixed(1)}%`;

  let cutoffSoC = 0;
  const cutoffCompare = cutoff * S;
  if (mode === 'discharge') {
    const vCellSag = (I * R_total) / S;
    const vCellCutoff = cutoff;
    const vCellOpenNeeded = vCellCutoff + vCellSag;
    let low = 0, high = 1;
    for (let k = 0; k < 8; k++) {
      const mid = (low + high) / 2;
      if (getOpenCircuitVoltage(mid, cellMin, cellMax, cellNom) < vCellOpenNeeded) low = mid; else high = mid;
    }
    cutoffSoC = (low + high) / 2;
  }

  const usablePerc = Math.max(0, 100 - (cutoffSoC * 100));
  const outUsable = $('out-sim-usable'); if (outUsable) outUsable.textContent = `${Math.round(usablePerc)}%`;

  const elRuntime = $('out-sim-runtime');
  if (elRuntime) {
    if (I > 0.01) {
      if (mode === 'discharge') {
        const hrs = (packAh * Math.max(0, soc - cutoffSoC)) / I;
        const h = Math.floor(hrs); const m = Math.round((hrs - h) * 60);
        elRuntime.textContent = h > 99 ? '>99h' : `${h}h ${m}m`;
      } else {
        const hrs = (packAh * (1.0 - soc)) / I;
        const h = Math.floor(hrs); const m = Math.round((hrs - h) * 60);
        elRuntime.textContent = h > 99 ? '>99h' : `~${h}h ${m}m`;
      }
    } else { elRuntime.textContent = '--'; }
  }

  const statusText = $('status-text');
  let warn = false;
  if (mode === 'discharge') {
    if (isCollapse) { warn = true; if (statusText) statusText.textContent = t('simulation.collapse'); }
    else if (vNet < cutoffCompare) { warn = true; if (statusText) statusText.textContent = t('simulation.hitLvc'); }
  } else {
    if (vNet > (cellMax * S)) { warn = true; if (statusText) statusText.textContent = t('simulation.overV'); }
  }
  if (statusText) (statusText as HTMLElement).style.display = warn ? 'block' : 'none';
  if (outNet) (outNet as HTMLElement).style.color = warn ? '#d32f2f' : '#008cc9';

  // F6 + F10a + F10b — Safety indicators
  const sagResult = checkVoltageSag(vNet, I, soc, R_total, S, P, cellMin, cellMax, cellNom, cellAh, cutoff, mode);
  renderVoltageSagIndicator(sagResult);

  const ampResult = checkAmpacity(I, P);
  renderAmpacityIndicator(ampResult);

  const micahResult = checkMicahToll(I, P);
  renderMicahTollIndicator(micahResult);

  const stripResult = checkStripThermal(I, P);
  renderStripThermalIndicator(stripResult);

  // F16 — Joule Heat thermal estimation + diagnostic global
  const tAmb = parseFloat(inputs['sim-tamb']?.value ?? '25') || 25;
  const rTh = parseFloat(inputs['sim-rth']?.value ?? '7') || 7;
  const jouleResult = checkJouleHeat(heatTotal, S, P, tAmb, undefined, rTh);
  renderJouleHeatIndicator(jouleResult);

  // F1 — Render compliance indicator if report available
  const complianceReport = (window as any).__complianceReport;
  if (complianceReport?.summary) {
    const complianceEl = document.getElementById('diag-compliance');
    if (complianceEl) {
      const s = complianceReport.summary.overallStatus;
      const level = s === 'pass' ? 'green' : s === 'warn' ? 'yellow' : s === 'fail' ? 'red' : 'neutral';
      complianceEl.dataset.level = level;
      const emoji = s === 'pass' ? '✅' : s === 'warn' ? '⚠️' : s === 'fail' ? '❌' : '⚪';
      const emojiSpan = complianceEl.querySelector('.safety-emoji');
      const textSpan = complianceEl.querySelector('.safety-text');
      const pctEl = complianceEl.querySelector('.diag-pct');
      if (emojiSpan) emojiSpan.textContent = emoji;
      if (textSpan) textSpan.textContent = `${complianceReport.summary.pass}/${complianceReport.summary.total} checks passed`;
      if (pctEl) pctEl.textContent = s === 'pass' ? '100%' : s === 'warn' ? '50%' : '0%';
      const color = level === 'green' ? '#22c55e' : level === 'yellow' ? '#eab308' : level === 'red' ? '#ef4444' : '#94a3b8';
      (complianceEl as HTMLElement).style.color = color;
      (complianceEl as HTMLElement).style.borderColor = color;
    }
  }

  const diagReport = computeDiagnostic(jouleResult);
  renderDiagnosticGlobal(diagReport);

  renderCurrentStats();

  // Notify BMS selector to update (F11+F12)
  window.dispatchEvent(new CustomEvent('bca:sim-update'));
}
