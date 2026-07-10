/**
 * F6 — Cell Balancing Analysis Engine
 * Active vs passive balancing comparison
 */

import { t } from '../i18n';

export interface BalancingConfig {
  seriesGroups: number;
  parallelCount: number;
  cellNominalVoltage: number;
  cellCapacityAh: number;
  balancingCurrentMa: number;
  mosfetRdsOhm: number;
  socSpread: number; // 0-1
  channelCostEur: number;
}

export interface BalancingResult {
  recommendation: string;
  recommendationColor: string;
  passive: BalancingModeResult;
  active: BalancingModeResult;
  bestMode: 'passive' | 'active';
  totalChannels: number;
}

export interface BalancingModeResult {
  mode: string;
  balancingTimeHours: number;
  energyLossWh: number;
  heatPerChannelMw: number;
  bmsCostEur: number;
  efficiency: number;
  maxSoCSpreadPct: number;
}

function analyzePassive(cfg: BalancingConfig, totalCells: number): BalancingModeResult {
  const iBal = cfg.balancingCurrentMa / 1000; // A
  const qUnbal = cfg.cellCapacityAh * cfg.socSpread; // Ah to equalize
  const balancingTimeHours = qUnbal / iBal;
  const energyLossWh = balancingTimeHours * iBal * iBal * cfg.mosfetRdsOhm * totalCells;
  const heatPerChannelMw = iBal * iBal * cfg.mosfetRdsOhm * 1000;
  const bmsCostEur = totalCells * cfg.channelCostEur;

  return {
    mode: t('balancing.passive'),
    balancingTimeHours: Math.round(balancingTimeHours * 10) / 10,
    energyLossWh: Math.round(energyLossWh * 100) / 100,
    heatPerChannelMw: Math.round(heatPerChannelMw * 10) / 10,
    bmsCostEur: Math.round(bmsCostEur * 100) / 100,
    efficiency: 0,
    maxSoCSpreadPct: cfg.socSpread * 100,
  };
}

function analyzeActive(cfg: BalancingConfig, totalCells: number): BalancingModeResult {
  const iBal = cfg.balancingCurrentMa / 1000;
  const qUnbal = cfg.cellCapacityAh * cfg.socSpread;
  const balancingTimeHours = qUnbal / (iBal * 0.85); // ~85% transfer efficiency
  const energyLossWh = balancingTimeHours * iBal * iBal * cfg.mosfetRdsOhm * totalCells * 0.15;
  const heatPerChannelMw = iBal * iBal * cfg.mosfetRdsOhm * 150; // active is ~15% loss
  const bmsCostEur = totalCells * cfg.channelCostEur * 3; // active ~3x cost per channel

  return {
    mode: t('balancing.active'),
    balancingTimeHours: Math.round(balancingTimeHours * 10) / 10,
    energyLossWh: Math.round(energyLossWh * 100) / 100,
    heatPerChannelMw: Math.round(heatPerChannelMw * 10) / 10,
    bmsCostEur: Math.round(bmsCostEur * 100) / 100,
    efficiency: 85,
    maxSoCSpreadPct: cfg.socSpread * 100,
  };
}

export function analyzeBalancing(cfg: BalancingConfig): BalancingResult {
  const totalCells = cfg.seriesGroups * cfg.parallelCount;
  const passive = analyzePassive(cfg, totalCells);
  const active = analyzeActive(cfg, totalCells);

  // Decision logic:
  // - If spreading < 5% and cells < 16s: passive is fine
  // - If cells > 24s or spreading > 10%: active recommended
  // - If energy loss > 10% of throughput: active preferred
  const passiveLossRatio = passive.energyLossWh / (cfg.cellCapacityAh * cfg.cellNominalVoltage * totalCells);
  const highSpread = cfg.socSpread > 0.10;
  const manyCells = cfg.seriesGroups > 24;
  const highLoss = passiveLossRatio > 0.10;

  let recommendation: string;
  let recommendationColor: string;
  let bestMode: 'passive' | 'active';

  if (highSpread || manyCells || highLoss) {
    recommendation = t('balancing.activeRecommended');
    recommendationColor = '#3b82f6';
    bestMode = 'active';
  } else if (cfg.socSpread > 0.05 || cfg.seriesGroups > 16) {
    recommendation = t('balancing.activePreferred');
    recommendationColor = '#f59e0b';
    bestMode = 'active';
  } else {
    recommendation = t('balancing.passiveSufficient');
    recommendationColor = '#22c55e';
    bestMode = 'passive';
  }

  return {
    recommendation,
    recommendationColor,
    passive,
    active,
    bestMode,
    totalChannels: totalCells,
  };
}

export function renderBalancingCard(result: BalancingResult, cfg: BalancingConfig): string {
  const best = result.bestMode === 'active' ? result.active : result.passive;

  return `
    <div class="rounded-md p-2.5 mb-2" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);">
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="text-[0.65rem] font-bold" style="color: var(--text-primary);">
            ${result.totalChannels} ${t('balancing.channels')} (${cfg.seriesGroups}S × ${cfg.parallelCount}P)
          </div>
          <div class="text-[0.6rem] mt-0.5" style="color: ${result.recommendationColor}; font-weight: 700;">
            ${result.recommendation}
          </div>
        </div>
        <div class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded" style="background: ${result.recommendationColor}20; color: ${result.recommendationColor};">
          ${result.bestMode.toUpperCase()}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 mb-2">
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">${t('balancing.passive')}</span>
          <div class="text-[0.6rem]" style="color: var(--text-primary);">
            ${result.passive.balancingTimeHours}h | ${result.passive.energyLossWh}Wh ${t('balancing.loss')} | €${result.passive.bmsCostEur.toFixed(0)}
          </div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">${t('balancing.active')}</span>
          <div class="text-[0.6rem]" style="color: var(--text-primary);">
            ${result.active.balancingTimeHours}h | ${result.active.energyLossWh}Wh ${t('balancing.loss')} | €${result.active.bmsCostEur.toFixed(0)}
          </div>
        </div>
      </div>

      <div class="text-[0.56rem]" style="color: var(--text-muted);">
        ${t('balancing.heatPerChannel')} ${best.heatPerChannelMw}mW | ${t('balancing.maxSpread')} ${best.maxSoCSpreadPct}% | ${t('balancing.transferEff')} ${best.efficiency}%
      </div>
    </div>
  `;
}
