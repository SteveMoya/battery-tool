/* ─────────────────────────────────────────────
   F5 — Component Database
   Breakers, contactors, disconnect switches, precharge resistors.
   Used by breaker-engine.ts for recommendations.
   ───────────────────────────────────────────── */

export type ComponentType = 'contactor' | 'breaker' | 'disconnect' | 'precharge_resistor';

export interface ContactorEntry {
  name: string;
  manufacturer: string;
  type: 'contactor';
  continuousA: number;
  maxBreakingA: number;
  voltageMax: number;
  coilVoltage: number;
  contactResistance: number; // mΩ
  lifecycle: number;         // mechanical cycles
  weightG: number;
  mounting: 'panel' | 'din' | 'pcb';
}

export interface BreakerEntry {
  name: string;
  manufacturer: string;
  type: 'breaker';
  ratingA: number;
  voltageMax: number;
  interruptingCapacity: number; // kA — how much fault current it can break
  poles: 1 | 2;
  tripCurve: 'B' | 'C' | 'D' | 'manual' | 'hydraulic-magnetic' | 'thermal-magnetic';
  mounting: 'panel' | 'din' | 'busbar';
  weightG: number;
}

export interface DisconnectEntry {
  name: string;
  manufacturer: string;
  type: 'disconnect';
  ratingA: number;
  voltageMax: number;
  interruptingCapacity: number;
  motorRated: boolean;
  lotoCapable: boolean;
  mounting: 'panel' | 'din' | 'padlock';
  weightG: number;
}

export interface PrechargeResistorEntry {
  name: string;
  manufacturer: string;
  type: 'precharge_resistor';
  resistanceOhm: number;
  wattage: number;
  tolerancePct: number;
  tempCoeff_ppm: number;
  package: 'chassis' | 'alumhoused' | 'wirewound';
  weightG: number;
}

export type AnyComponent = ContactorEntry | BreakerEntry | DisconnectEntry | PrechargeResistorEntry;

/* ── Contactor Database ── */

export const CONTACTOR_DB: ContactorEntry[] = [
  // Low-current contactors (up to 80A)
  { name: 'Tyco V23102-A5003-A101', manufacturer: 'TE Connectivity / Tyco', type: 'contactor', continuousA: 30, maxBreakingA: 300, voltageMax: 80, coilVoltage: 12, contactResistance: 15, lifecycle: 300000, weightG: 45, mounting: 'panel' },
  { name: 'Gigavac GX14', manufacturer: 'Gigavac', type: 'contactor', continuousA: 40, maxBreakingA: 500, voltageMax: 90, coilVoltage: 12, contactResistance: 12, lifecycle: 100000, weightG: 85, mounting: 'panel' },
  { name: 'Gigavac GX16', manufacturer: 'Gigavac', type: 'contactor', continuousA: 60, maxBreakingA: 800, voltageMax: 90, coilVoltage: 12, contactResistance: 8, lifecycle: 100000, weightG: 110, mounting: 'panel' },

  // Mid-range contactors (60–200A)
  { name: 'Gigavac GX21', manufacturer: 'Gigavac', type: 'contactor', continuousA: 90, maxBreakingA: 1000, voltageMax: 450, coilVoltage: 12, contactResistance: 5, lifecycle: 100000, weightG: 180, mounting: 'panel' },
  { name: 'Tyco EV200AA', manufacturer: 'TE Connectivity / Tyco', type: 'contactor', continuousA: 200, maxBreakingA: 2000, voltageMax: 450, coilVoltage: 12, contactResistance: 3, lifecycle: 300000, weightG: 350, mounting: 'panel' },
  { name: 'Gigavac GX26', manufacturer: 'Gigavac', type: 'contactor', continuousA: 150, maxBreakingA: 1500, voltageMax: 450, coilVoltage: 12, contactResistance: 4, lifecycle: 100000, weightG: 250, mounting: 'panel' },
  { name: 'Panasonic AEV1824', manufacturer: 'Panasonic', type: 'contactor', continuousA: 200, maxBreakingA: 1500, voltageMax: 900, coilVoltage: 12, contactResistance: 2, lifecycle: 100000, weightG: 400, mounting: 'panel' },

  // High-current contactors (200A+)
  { name: 'Tyco EV200AB', manufacturer: 'TE Connectivity / Tyco', type: 'contactor', continuousA: 300, maxBreakingA: 2500, voltageMax: 450, coilVoltage: 12, contactResistance: 2, lifecycle: 300000, weightG: 500, mounting: 'panel' },
  { name: 'Gigavac HC1', manufacturer: 'Gigavac', type: 'contactor', continuousA: 500, maxBreakingA: 4000, voltageMax: 600, coilVoltage: 12, contactResistance: 1, lifecycle: 100000, weightG: 800, mounting: 'panel' },
  { name: 'Sensata CT400', manufacturer: 'Sensata', type: 'contactor', continuousA: 400, maxBreakingA: 3000, voltageMax: 500, coilVoltage: 12, contactResistance: 1.5, lifecycle: 100000, weightG: 650, mounting: 'panel' },
];

/* ── Circuit Breaker Database ── */

export const BREAKER_DB: BreakerEntry[] = [
  // DIN rail breakers (low-voltage, up to 63A)
  { name: 'Schneider iC60N 1P C16', manufacturer: 'Schneider Electric', type: 'breaker', ratingA: 16, voltageMax: 230, interruptingCapacity: 10, poles: 1, tripCurve: 'C', mounting: 'din', weightG: 120 },
  { name: 'Schneider iC60N 1P C32', manufacturer: 'Schneider Electric', type: 'breaker', ratingA: 32, voltageMax: 230, interruptingCapacity: 10, poles: 1, tripCurve: 'C', mounting: 'din', weightG: 120 },
  { name: 'Schneider iC60N 1P C50', manufacturer: 'Schneider Electric', type: 'breaker', ratingA: 50, voltageMax: 230, interruptingCapacity: 10, poles: 1, tripCurve: 'C', mounting: 'din', weightG: 120 },
  { name: 'Schneider iC60N 2P C32', manufacturer: 'Schneider Electric', type: 'breaker', ratingA: 32, voltageMax: 400, interruptingCapacity: 10, poles: 2, tripCurve: 'C', mounting: 'din', weightG: 240 },
  { name: 'Schneider iC60N 2P C50', manufacturer: 'Schneider Electric', type: 'breaker', ratingA: 50, voltageMax: 400, interruptingCapacity: 10, poles: 2, tripCurve: 'C', mounting: 'din', weightG: 240 },
  { name: 'Schneider iC60N 2P C63', manufacturer: 'Schneider Electric', type: 'breaker', ratingA: 63, voltageMax: 400, interruptingCapacity: 10, poles: 2, tripCurve: 'C', mounting: 'din', weightG: 240 },

  // Industrial breakers (busbar-mounted, 63A–400A)
  { name: 'Square D QO 100A', manufacturer: 'Schneider Electric / Square D', type: 'breaker', ratingA: 100, voltageMax: 240, interruptingCapacity: 10, poles: 2, tripCurve: 'thermal-magnetic', mounting: 'busbar', weightG: 500 },
  { name: 'Square D QO 200A', manufacturer: 'Schneider Electric / Square D', type: 'breaker', ratingA: 200, voltageMax: 240, interruptingCapacity: 10, poles: 2, tripCurve: 'thermal-magnetic', mounting: 'busbar', weightG: 800 },
  { name: 'Siemens G-frame 250A', manufacturer: 'Siemens', type: 'breaker', ratingA: 250, voltageMax: 600, interruptingCapacity: 25, poles: 2, tripCurve: 'thermal-magnetic', mounting: 'busbar', weightG: 1200 },
  { name: 'ABB Tmax T5N 400A', manufacturer: 'ABB', type: 'breaker', ratingA: 400, voltageMax: 690, interruptingCapacity: 36, poles: 2, tripCurve: 'thermal-magnetic', mounting: 'busbar', weightG: 2000 },
];

/* ── Disconnect Switch Database ── */

export const DISCONNECT_DB: DisconnectEntry[] = [
  { name: 'Blue Sea 3000', manufacturer: 'Blue Sea Systems', type: 'disconnect', ratingA: 300, voltageMax: 600, interruptingCapacity: 10, motorRated: true, lotoCapable: true, mounting: 'panel', weightG: 300 },
  { name: 'Blue Sea 9001', manufacturer: 'Blue Sea Systems', type: 'disconnect', ratingA: 60, voltageMax: 32, interruptingCapacity: 5, motorRated: false, lotoCapable: true, mounting: 'panel', weightG: 120 },
  { name: 'Marinco 72000', manufacturer: 'Marinco', type: 'disconnect', ratingA: 200, voltageMax: 300, interruptingCapacity: 8, motorRated: true, lotoCapable: true, mounting: 'panel', weightG: 250 },
  { name: 'Eaton DH30DN', manufacturer: 'Eaton', type: 'disconnect', ratingA: 30, voltageMax: 600, interruptingCapacity: 10, motorRated: true, lotoCapable: true, mounting: 'din', weightG: 200 },
  { name: 'Eaton DH100DN', manufacturer: 'Eaton', type: 'disconnect', ratingA: 100, voltageMax: 600, interruptingCapacity: 10, motorRated: true, lotoCapable: true, mounting: 'panel', weightG: 500 },
];

/* ── Precharge Resistor Database ── */

export const PRECHARGE_RESISTOR_DB: PrechargeResistorEntry[] = [
  // Low power (10–50W)
  { name: 'Vishay 1050-series 25Ω 25W', manufacturer: 'Vishay', type: 'precharge_resistor', resistanceOhm: 25, wattage: 25, tolerancePct: 5, tempCoeff_ppm: 250, package: 'alumhoused', weightG: 25 },
  { name: 'Vishay 1050-series 47Ω 25W', manufacturer: 'Vishay', type: 'precharge_resistor', resistanceOhm: 47, wattage: 25, tolerancePct: 5, tempCoeff_ppm: 250, package: 'alumhoused', weightG: 25 },
  { name: 'Vishay 1050-series 100Ω 25W', manufacturer: 'Vishay', type: 'precharge_resistor', resistanceOhm: 100, wattage: 25, tolerancePct: 5, tempCoeff_ppm: 250, package: 'alumhoused', weightG: 25 },

  // Medium power (50–200W)
  { name: 'Vishay 1050-series 50Ω 50W', manufacturer: 'Vishay', type: 'precharge_resistor', resistanceOhm: 50, wattage: 50, tolerancePct: 5, tempCoeff_ppm: 250, package: 'alumhoused', weightG: 50 },
  { name: 'Caddock MP930 100Ω 100W', manufacturer: 'Caddock', type: 'precharge_resistor', resistanceOhm: 100, wattage: 100, tolerancePct: 1, tempCoeff_ppm: 100, package: 'alumhoused', weightG: 80 },
  { name: 'Vishay 1050-series 200Ω 100W', manufacturer: 'Vishay', type: 'precharge_resistor', resistanceOhm: 200, wattage: 100, tolerancePct: 5, tempCoeff_ppm: 250, package: 'alumhoused', weightG: 80 },

  // High power (200W+)
  { name: 'Caddock MP9200 100Ω 200W', manufacturer: 'Caddock', type: 'precharge_resistor', resistanceOhm: 100, wattage: 200, tolerancePct: 1, tempCoeff_ppm: 100, package: 'chassis', weightG: 150 },
  { name: 'Vishay 1050-series 47Ω 200W', manufacturer: 'Vishay', type: 'precharge_resistor', resistanceOhm: 47, wattage: 200, tolerancePct: 5, tempCoeff_ppm: 250, package: 'alumhoused', weightG: 120 },
];

/* ── Lookup helpers ── */

export function findContactor(minA: number, minVoltage: number): ContactorEntry | null {
  const candidates = CONTACTOR_DB
    .filter(c => c.continuousA >= minA && c.voltageMax >= minVoltage)
    .sort((a, b) => a.continuousA - b.continuousA);
  return candidates[0] ?? null;
}

export function findBreaker(minA: number, minVoltage: number, poles: 1 | 2): BreakerEntry | null {
  const candidates = BREAKER_DB
    .filter(b => b.ratingA >= minA && b.voltageMax >= minVoltage && b.poles >= poles)
    .sort((a, b) => a.ratingA - b.ratingA);
  return candidates[0] ?? null;
}

export function findDisconnect(minA: number, minVoltage: number): DisconnectEntry | null {
  const candidates = DISCONNECT_DB
    .filter(d => d.ratingA >= minA && d.voltageMax >= minVoltage)
    .sort((a, b) => a.ratingA - b.ratingA);
  return candidates[0] ?? null;
}

export function findPrechargeResistor(resistanceOhm: number, minWattage: number): PrechargeResistorEntry | null {
  const candidates = PRECHARGE_RESISTOR_DB
    .filter(r => r.resistanceOhm >= resistanceOhm * 0.8 && r.wattage >= minWattage)
    .sort((a, b) => a.wattage - b.wattage);
  return candidates[0] ?? null;
}
