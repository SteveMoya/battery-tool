import type { Cell, CellFormFactor, CellOrigin } from './cell-database';

export type CellType = Cell['type'];

export interface SizePreset {
  name: string;
  group: string;
  data: {
    d: number;
    l: number;
    w: number;
    pw?: number;
    pd?: number;
    cost: string;
    cap: number;
    amp: number;
    pulseAmp?: number;
    chargeAmp?: number;
    type: CellType;
    ir: number;
    formFactor?: CellFormFactor;
    origin?: CellOrigin;
  };
}

export interface ChemPreset {
  name: string;
  group: string;
  id: CellType;
  data: { nom: number; min: number; max: number };
}

export const DEFAULT_SIZE_PRESETS: SizePreset[] = [
  { name: '18650 [⌀18.4 x 65.0mm]', group: 'Market Leaders', data: { d: 18.4, l: 65.0, w: 45, cost: '€4.50', cap: 2500, amp: 20, type: 'li-ion', ir: 25 } },
  { name: '21700 [⌀21.4 x 70.0mm]', group: 'Market Leaders', data: { d: 21.4, l: 70.0, w: 70, cost: '€6.00', cap: 4000, amp: 35, type: 'li-ion', ir: 15 } },
  { name: 'AAA [⌀10.5 x 44.5mm]', group: 'Consumer Standard', data: { d: 10.5, l: 44.5, w: 12, cost: '€1.50', cap: 800, amp: 2, type: 'nimh', ir: 50 } },
  { name: 'AA [⌀14.5 x 50.5mm]', group: 'Consumer Standard', data: { d: 14.5, l: 50.5, w: 28, cost: '€2.00', cap: 2000, amp: 4, type: 'nimh', ir: 40 } },
  { name: 'C [⌀26.2 x 50.0mm]', group: 'Consumer Standard', data: { d: 26.2, l: 50.0, w: 70, cost: '€4.00', cap: 4000, amp: 5, type: 'nimh', ir: 30 } },
  { name: 'D [⌀34.2 x 61.5mm]', group: 'Consumer Standard', data: { d: 34.2, l: 61.5, w: 140, cost: '€5.00', cap: 8000, amp: 8, type: 'nimh', ir: 25 } },
  { name: '10440 [⌀10.4 x 44.0mm]', group: 'Specialist Lithium', data: { d: 10.4, l: 44.0, w: 12, cost: '€3.00', cap: 350, amp: 3, type: 'li-ion', ir: 45 } },
  { name: '14500 [⌀14.4 x 50.0mm]', group: 'Specialist Lithium', data: { d: 14.4, l: 50.0, w: 20, cost: '€3.50', cap: 900, amp: 5, type: 'li-ion', ir: 35 } },
  { name: '18350 [⌀18.4 x 35.0mm]', group: 'Specialist Lithium', data: { d: 18.4, l: 35.0, w: 25, cost: '€4.00', cap: 1100, amp: 10, type: 'li-ion', ir: 25 } },
  { name: '18500 [⌀18.4 x 50.0mm]', group: 'Specialist Lithium', data: { d: 18.4, l: 50.0, w: 32, cost: '€4.20', cap: 1500, amp: 15, type: 'li-ion', ir: 20 } },
  { name: '20700 [⌀20.4 x 70.0mm]', group: 'Specialist Lithium', data: { d: 20.4, l: 70.0, w: 60, cost: '€5.50', cap: 3000, amp: 30, type: 'li-ion', ir: 15 } },
  { name: '26650 [⌀26.4 x 65.0mm]', group: 'Specialist Lithium', data: { d: 26.4, l: 65.0, w: 95, cost: '€8.00', cap: 3500, amp: 15, type: 'lfp', ir: 10 } },
  { name: '32700 [⌀32.4 x 70.0mm]', group: 'Specialist Lithium', data: { d: 32.4, l: 70.0, w: 145, cost: '€12.00', cap: 6000, amp: 20, type: 'lfp', ir: 8 } },
  { name: '4680 [⌀46.0 x 80.0mm]', group: 'Specialist Lithium', data: { d: 46.0, l: 80.0, w: 350, cost: '€20.00', cap: 9000, amp: 50, type: 'li-ion', ir: 8 } },
];

export const DEFAULT_CHEM_PRESETS: ChemPreset[] = [
  { name: 'Li-ion', group: 'Standard', id: 'li-ion', data: { nom: 3.6, min: 2.5, max: 4.2 } },
  { name: 'LiFePO4', group: 'Standard', id: 'lfp', data: { nom: 3.2, min: 2.5, max: 3.65 } },
  { name: 'Sodium-Ion', group: 'Standard', id: 'na-ion', data: { nom: 3.1, min: 1.5, max: 4.0 } },
  { name: 'LTO', group: 'Standard', id: 'lto', data: { nom: 2.4, min: 1.5, max: 2.8 } },
  { name: 'NiMH/NiCd', group: 'Standard', id: 'nimh', data: { nom: 1.2, min: 1.0, max: 1.4 } },
  { name: 'Alkaline', group: 'Standard', id: 'alk', data: { nom: 1.5, min: 0.9, max: 1.6 } },
  { name: 'LiPo (HV)', group: 'Hobby', id: 'lipo', data: { nom: 3.8, min: 3.0, max: 4.35 } },
];
