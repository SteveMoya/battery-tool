/**
 * F10 — Total Cost of Ownership (TCO) Engine
 * Lifecycle cost analysis: CAPEX + OPEX + replacement + disposal
 */

export interface TcoConfig {
  packCapacityKwh: number;
  packCostEur: number;
  installationCostEur: number;
  cyclesPerYear: number;
  dodAvg: number;
  cyclesToReplacement: number; // from F7 degradation
  electricityCostEurKwh: number;
  maintenanceCostPerYearEur: number;
  replacementCostMultiplier: number; // 1.0 = same cost, 0.7 = 30% cheaper in future
  analysisYears: number;
  discountRate: number; // for NPV
  efficiencyRoundtrip: number; // 0-1
}

export interface TcoResult {
  totalCostEur: number;
  capexEur: number;
  opexEur: number;
  replacementEur: number;
  disposalEur: number;
  costPerKwhCycle: number;
  costPerYear: number;
  npvEur: number;
  lcoePerKwh: number; // levelized cost of energy
  paybackYears: number;
  level: 'excellent' | 'good' | 'fair' | 'poor';
  levelColor: string;
  breakdown: { year: number; cumCost: number; annualCost: number; }[];
}

export function analyzeTco(cfg: TcoConfig): TcoResult {
  const capex = cfg.packCostEur + cfg.installationCostEur;
  const totalCycles = cfg.cyclesPerYear * cfg.analysisYears;
  const replacements = Math.floor(totalCycles / cfg.cyclesToReplacement);
  const replacementCost = cfg.packCostEur * cfg.replacementCostMultiplier * replacements;

  // Annual OPEX
  const annualEnergyThroughput = cfg.packCapacityKwh * cfg.dodAvg * cfg.cyclesPerYear / cfg.efficiencyRoundtrip;
  const annualElectricityCost = annualEnergyThroughput * cfg.electricityCostEurKwh;
  const totalMaintenance = cfg.maintenanceCostPerYearEur * cfg.analysisYears;
  const totalElectricity = annualElectricityCost * cfg.analysisYears;
  const opex = totalMaintenance + totalElectricity;

  // Disposal (rough estimate)
  const disposal = cfg.packCapacityKwh * 15; // €15/kWh recycling

  const totalCost = capex + opex + replacementCost + disposal;
  const costPerKwhCycle = totalCost / (cfg.packCapacityKwh * cfg.dodAvg * totalCycles);
  const costPerYear = totalCost / cfg.analysisYears;

  // NPV
  let npv = capex;
  const yearlyData: { year: number; cumCost: number; annualCost: number; }[] = [];
  let cumCost = capex;

  for (let y = 1; y <= cfg.analysisYears; y++) {
    let annualCost = (opex / cfg.analysisYears);

    // Check if replacement needed this year
    // First replacement happens after cyclesToReplacement cycles
    const cyclesUpToYear = cfg.cyclesPerYear * y;
    if (cyclesUpToYear >= cfg.cyclesToReplacement && cyclesUpToYear % cfg.cyclesToReplacement < cfg.cyclesPerYear) {
      annualCost += cfg.packCostEur * cfg.replacementCostMultiplier;
    }

    if (y === cfg.analysisYears) {
      annualCost += disposal;
    }

    npv += annualCost / Math.pow(1 + cfg.discountRate, y);
    cumCost += annualCost;
    yearlyData.push({ year: y, cumCost: Math.round(cumCost), annualCost: Math.round(annualCost) });
  }

  // LCOE = total discounted cost / total discounted energy
  let totalDiscountedEnergy = 0;
  for (let y = 1; y <= cfg.analysisYears; y++) {
    const energy = annualEnergyThroughput / Math.pow(1 + cfg.discountRate, y);
    totalDiscountedEnergy += energy;
  }
  const lcoe = totalDiscountedEnergy > 0 ? npv / totalDiscountedEnergy : 0;

  // Payback vs grid electricity (assuming €0.15/kWh grid)
  const gridCostPerYear = annualEnergyThroughput * 0.15;
  const payback = gridCostPerYear > 0 ? capex / gridCostPerYear : cfg.analysisYears;

  let level: 'excellent' | 'good' | 'fair' | 'poor';
  let levelColor: string;

  if (costPerKwhCycle < 0.05) {
    level = 'excellent';
    levelColor = '#22c55e';
  } else if (costPerKwhCycle < 0.10) {
    level = 'good';
    levelColor = '#3b82f6';
  } else if (costPerKwhCycle < 0.20) {
    level = 'fair';
    levelColor = '#f59e0b';
  } else {
    level = 'poor';
    levelColor = '#ef4444';
  }

  return {
    totalCostEur: Math.round(totalCost),
    capexEur: capex,
    opexEur: Math.round(opex),
    replacementEur: Math.round(replacementCost),
    disposalEur: disposal,
    costPerKwhCycle: Math.round(costPerKwhCycle * 10000) / 10000,
    costPerYear: Math.round(costPerYear),
    npvEur: Math.round(npv),
    lcoePerKwh: Math.round(lcoe * 10000) / 10000,
    paybackYears: Math.round(payback * 10) / 10,
    level,
    levelColor,
    breakdown: yearlyData,
  };
}

export function renderTcoCard(result: TcoResult, cfg: TcoConfig): string {
  return `
    <div class="rounded-md p-2.5 mb-2" style="background: var(--bg-tertiary); border: 1px solid var(--border-primary);">
      <div class="flex justify-between items-start mb-2">
        <div>
          <div class="text-[0.65rem] font-bold" style="color: var(--text-primary);">
            ${cfg.analysisYears}-Year TCO Analysis
          </div>
          <div class="text-[0.6rem] mt-0.5" style="color: ${result.levelColor}; font-weight: 700;">
            €${result.costPerKwhCycle.toFixed(4)}/kWh/cycle — ${result.level.toUpperCase()}
          </div>
        </div>
        <div class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded" style="background: ${result.levelColor}20; color: ${result.levelColor};">
          €${result.totalCostEur.toLocaleString()}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-3 gap-y-1 mb-2">
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">CAPEX</span>
          <div class="text-[0.6rem]" style="color: var(--text-primary);">€${result.capexEur.toLocaleString()}</div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">OPEX (energy+maint)</span>
          <div class="text-[0.6rem]" style="color: var(--text-primary);">€${result.opexEur.toLocaleString()}</div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">Replacement</span>
          <div class="text-[0.6rem]" style="color: var(--text-primary);">€${result.replacementEur.toLocaleString()}</div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">Disposal</span>
          <div class="text-[0.6rem]" style="color: var(--text-primary);">€${result.disposalEur.toLocaleString()}</div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-2 pt-1.5" style="border-top: 1px solid var(--border-primary);">
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">NPV</span>
          <div class="text-[0.65rem] font-bold" style="color: var(--text-primary);">€${result.npvEur.toLocaleString()}</div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">LCOE</span>
          <div class="text-[0.65rem]" style="color: var(--text-primary);">€${result.lcoePerKwh.toFixed(4)}/kWh</div>
        </div>
        <div>
          <span class="text-[0.58rem] font-bold" style="color: var(--text-muted);">Payback</span>
          <div class="text-[0.65rem]" style="color: var(--text-primary);">${result.paybackYears}yr</div>
        </div>
      </div>

      <div class="text-[0.56rem]" style="color: var(--text-muted);">
        Cost/yr: €${result.costPerYear.toLocaleString()} | Throughput: ${(cfg.packCapacityKwh * cfg.dodAvg * cfg.cyclesPerYear / cfg.efficiencyRoundtrip).toFixed(0)} kWh/yr
      </div>
    </div>
  `;
}
