import type { SafetyLevel } from './safety-indicators';

/* ─────────────────────────────────────────────
   F16 — Diagnostic Monitor
   Aggregates all safety metrics into a single
   global health status for the right-side panel.
   ───────────────────────────────────────────── */

/* ── Joule Heat (Opción B — thermal estimation) ── */

export interface JouleHeatResult {
  level: SafetyLevel;
  heatTotal: number;
  heatPerCell: number;
  tCell: number;
  tAmb: number;
  tMax: number;
  pct: number;
}

const DEFAULT_T_AMB = 25;
const DEFAULT_T_MAX = 72;
const DEFAULT_R_TH = 7;

export function checkJouleHeat(
  heatTotal: number,
  S: number,
  P: number,
  tAmb = DEFAULT_T_AMB,
  tMax = DEFAULT_T_MAX,
  rTh = DEFAULT_R_TH,
): JouleHeatResult {
  const nCells = S * P;
  const heatPerCell = nCells > 0 ? heatTotal / nCells : 0;
  const tCell = tAmb + heatPerCell * rTh;
  const range = tMax - tAmb;
  const pct = range > 0 ? Math.max(0, Math.min(100, ((tCell - tAmb) / range) * 100)) : 0;

  let level: SafetyLevel = 'green';
  if (pct >= 90) level = 'red';
  else if (pct >= 70) level = 'yellow';

  return { level, heatTotal, heatPerCell, tCell, tAmb, tMax, pct };
}

/* ── Render Joule Heat indicator ── */

const JOULE_COLOR: Record<SafetyLevel, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  neutral: '#94a3b8',
};

const JOULE_EMOJI: Record<SafetyLevel, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  neutral: '⚪',
};

export function renderJouleHeatIndicator(r: JouleHeatResult) {
  const el = document.getElementById('safety-joule-heat');
  if (!el) return;

  const emojiSpan = el.querySelector('.safety-emoji');
  const textSpan = el.querySelector('.safety-text');
  if (emojiSpan) emojiSpan.textContent = JOULE_EMOJI[r.level];
  if (textSpan) {
    if (r.level === 'neutral') {
      textSpan.textContent = 'N/A';
    } else {
      const heatStr = r.heatTotal >= 100 ? `${Math.round(r.heatTotal)}W`
        : r.heatTotal >= 10 ? `${r.heatTotal.toFixed(1)}W`
        : `${r.heatTotal.toFixed(2)}W`;
      textSpan.textContent = `${heatStr} → ${r.tCell.toFixed(1)}°C (cell)`;
    }
  }
  (el as HTMLElement).style.color = JOULE_COLOR[r.level];
  (el as HTMLElement).style.borderColor = JOULE_COLOR[r.level];

  const bar = el.querySelector('.diag-bar-fill') as HTMLElement | null;
  if (bar) {
    bar.style.width = `${Math.min(100, r.pct)}%`;
    bar.style.background = JOULE_COLOR[r.level];
  }
  const pctLabel = el.querySelector('.diag-pct') as HTMLElement | null;
  if (pctLabel) pctLabel.textContent = `${Math.round(r.pct)}%`;
}

/* ── Global diagnostic aggregation ── */

export interface DiagnosticReport {
  global: SafetyLevel;
  joule: JouleHeatResult;
  metrics: { id: string; level: SafetyLevel; label: string; pct: number }[];
}

const LEVEL_RANK: Record<SafetyLevel, number> = {
  green: 0,
  yellow: 1,
  red: 2,
  neutral: -1,
};

function worstLevel(levels: SafetyLevel[]): SafetyLevel {
  let worst: SafetyLevel = 'green';
  for (const l of levels) {
    if (LEVEL_RANK[l] > LEVEL_RANK[worst]) worst = l;
  }
  return worst;
}

export function computeDiagnostic(joule: JouleHeatResult): DiagnosticReport {
  const sagEl = document.getElementById('safety-voltage-sag');
  const ampEl = document.getElementById('safety-ampacity');
  const micahEl = document.getElementById('safety-micah');
  const stripEl = document.getElementById('safety-strip-thermal');
  const packEl = document.getElementById('safety-packing');

  function readLevel(el: HTMLElement | null): SafetyLevel {
    if (!el) return 'neutral';
    return (el.dataset.level as SafetyLevel) || 'neutral';
  }

  function readPct(el: HTMLElement | null): number {
    if (!el) return 0;
    const bar = el.querySelector('.diag-bar-fill') as HTMLElement | null;
    if (bar) return parseFloat(bar.style.width) || 0;
    return 0;
  }

  const sagLevel = readLevel(sagEl);
  const ampLevel = readLevel(ampEl);
  const micahLevel = readLevel(micahEl);
  const stripLevel = readLevel(stripEl);
  const packLevel = readLevel(packEl);

  const allLevels = [sagLevel, joule.level, ampLevel, micahLevel, stripLevel, packLevel];

  return {
    global: worstLevel(allLevels),
    joule,
    metrics: [
      { id: 'diag-voltage-sag', level: sagLevel, label: 'Voltage Sag', pct: readPct(sagEl) },
      { id: 'diag-joule-heat', level: joule.level, label: 'Joule Heat', pct: joule.pct },
      { id: 'diag-ampacity', level: ampLevel, label: 'Ampacity', pct: readPct(ampEl) },
      { id: 'diag-micah', level: micahLevel, label: 'Strip Safety', pct: readPct(micahEl) },
      { id: 'diag-strip-thermal', level: stripLevel, label: 'Strip Thermal', pct: readPct(stripEl) },
      { id: 'diag-packing', level: packLevel, label: 'Packing Eff.', pct: readPct(packEl) },
    ],
  };
}

/* ── Render global status + progress bar ── */

const GLOBAL_EMOJI: Record<SafetyLevel, string> = {
  green: '🟢',
  yellow: '🟡',
  red: '🔴',
  neutral: '⚪',
};

const GLOBAL_COLOR: Record<SafetyLevel, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  neutral: '#94a3b8',
};

export function renderDiagnosticGlobal(report: DiagnosticReport) {
  const statusEl = document.getElementById('diag-global-status');
  const barEl = document.getElementById('diag-global-bar');
  const labelEl = document.getElementById('diag-global-label');

  if (statusEl) statusEl.textContent = GLOBAL_EMOJI[report.global];
  if (barEl) {
    const avgPct = report.metrics.reduce((s, m) => s + (m.level === 'neutral' ? 100 : m.pct), 0)
      / report.metrics.filter(m => m.level !== 'neutral').length || 100;
    barEl.style.width = `${Math.min(100, avgPct)}%`;
    barEl.style.background = GLOBAL_COLOR[report.global];
  }
  if (labelEl) {
    const labels: Record<SafetyLevel, string> = {
      green: 'ALL OK',
      yellow: 'CAUTION',
      red: 'WARNING',
      neutral: 'NO DATA',
    };
    labelEl.textContent = labels[report.global];
    labelEl.style.color = GLOBAL_COLOR[report.global];
  }
}
