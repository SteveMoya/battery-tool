/**
 * F9 — Parallel String Current Sharing Engine
 * Analyzes current distribution between parallel strings
 */

export interface ParallelConfig {
  seriesGroups: number;
  parallelCount: number;
  cellNominalVoltage: number;
  cellCapacityAh: number;
  cellIR: number; // mΩ internal resistance
  interconnectResistance: number; // mΩ
  totalCurrentA: number;
  tempAmbient: number;
}

export interface StringResult {
  stringIndex: number;
  currentA: number;
  currentPct: number;
  powerLossW: number;
  temperatureRiseC: number;
}

export interface ParallelResult {
  strings: StringResult[];
  maxImbalancePct: number;
  maxCurrentA: number;
  minCurrentA: number;
  totalPowerLossW: number;
  deratingRequired: boolean;
  recommendation: string;
  recommendationColor: string;
  level: 'good' | 'warning' | 'critical';
  levelColor: string;
}

export function analyzeParallel(cfg: ParallelConfig): ParallelResult {
  const n = cfg.parallelCount;
  const stringResistance = cfg.cellIR * cfg.seriesGroups / 1000 + cfg.interconnectResistance / 1000;

  // Strings with slightly different resistances (real-world variation ±5%)
  const resistances = Array.from({ length: n }, (_, i) => {
    const variation = 1 + (i - Math.floor(n / 2)) * 0.02;
    return stringResistance * variation;
  });

  const totalConductance = resistances.reduce((sum, r) => sum + 1 / r, 0);
  const avgCurrent = cfg.totalCurrentA / n;

  const strings: StringResult[] = resistances.map((r, i) => {
    const conductance = 1 / r;
    const current = (conductance / totalConductance) * cfg.totalCurrentA;
    const powerLoss = current * current * r;
    const tempRise = powerLoss * 15; // simplified thermal model

    return {
      stringIndex: i,
      currentA: Math.round(current * 100) / 100,
      currentPct: Math.round((current / cfg.totalCurrentA) * 10000) / 100,
      powerLossW: Math.round(powerLoss * 1000) / 1000,
      temperatureRiseC: Math.round(tempRise * 10) / 10,
    };
  });

  const currents = strings.map(s => s.currentA);
  const maxCurrent = Math.max(...currents);
  const minCurrent = Math.min(...currents);
  const maxImbalance = ((maxCurrent - minCurrent) / avgCurrent) * 100;
  const totalPowerLoss = strings.reduce((sum, s) => sum + s.powerLossW, 0);

  const deratingRequired = maxImbalance > 10 || maxCurrent > cfg.cellCapacityAh * 1.5;

  let recommendation: string;
  let recommendationColor: string;
  let level: 'good' | 'warning' | 'critical';
  let levelColor: string;

  if (maxImbalance > 15) {
    recommendation = 'Critical Imbalance';
    recommendationColor = '#ef4444';
    level = 'critical';
    levelColor = '#ef4444';
  } else if (maxImbalance > 10) {
    recommendation = 'Imbalance Warning';
    recommendationColor = '#f59e0b';
    level = 'warning';
    levelColor = '#f59e0b';
  } else if (maxImbalance > 5) {
    recommendation = 'Monitor Current Sharing';
    recommendationColor = '#3b82f6';
    level = 'warning';
    levelColor = '#3b82f6';
  } else {
    recommendation = 'Well Balanced';
    recommendationColor = '#22c55e';
    level = 'good';
    levelColor = '#22c55e';
  }

  return {
    strings,
    maxImbalancePct: Math.round(maxImbalance * 100) / 100,
    maxCurrentA: maxCurrent,
    minCurrentA: minCurrent,
    totalPowerLossW: Math.round(totalPowerLoss * 1000) / 1000,
    deratingRequired,
    recommendation,
    recommendationColor,
    level,
    levelColor,
  };
}

export function renderParallelCard(result: ParallelResult, cfg: ParallelConfig): string {
  return `
    <div class="rounded-md p-2.5 mb-2" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);">
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="text-[0.65rem] font-bold" style="color: var(--text-primary);">
            ${cfg.parallelCount} Parallel Strings × ${cfg.seriesGroups}S
          </div>
          <div class="text-[0.6rem] mt-0.5" style="color: ${result.recommendationColor}; font-weight: 700;">
            ${result.recommendation}
          </div>
        </div>
        <div class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded" style="background: ${result.levelColor}20; color: ${result.levelColor};">
          ${result.level.toUpperCase()}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-2">
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">Imbalance</span>
          <div class="text-[0.65rem] font-bold" style="color: ${result.levelColor};">${result.maxImbalancePct}%</div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">Max Current</span>
          <div class="text-[0.65rem]" style="color: var(--text-primary);">${result.maxCurrentA}A</div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">Power Loss</span>
          <div class="text-[0.65rem]" style="color: var(--text-primary);">${result.totalPowerLossW}W</div>
        </div>
      </div>

      <div class="space-y-1">
        ${result.strings.map(s => `
          <div class="flex items-center gap-2">
            <span class="text-[0.56rem] font-mono w-8" style="color: var(--text-muted);">S${s.stringIndex + 1}</span>
            <div class="flex-1 h-1.5 rounded-full" style="background: var(--bg-secondary);">
              <div class="h-full rounded-full" style="width: ${s.currentPct}%; background: ${result.levelColor};"></div>
            </div>
            <span class="text-[0.56rem] w-14 text-right" style="color: var(--text-primary);">${s.currentA}A (${s.currentPct}%)</span>
          </div>
        `).join('')}
      </div>

      ${result.deratingRequired ? `
        <div class="mt-2 p-1.5 rounded text-[0.58rem] font-bold" style="background: #ef444420; color: #ef4444;">
          ⚠ Derating required: reduce total current to ${Math.round(cfg.cellCapacityAh * cfg.parallelCount * 0.9)}A max
        </div>
      ` : ''}
    </div>
  `;
}
