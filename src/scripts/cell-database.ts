export type CellFormFactor = 'cylindrical' | 'prismatic';
export type CellOrigin = 'tier1' | 'generic-china';

export interface Cell {
  name: string;
  d: number;         // diameter mm (cylindrical) — 0 for prismatic
  l: number;         // length/height mm (both form factors)
  w: number;         // weight g
  pw?: number;       // prismatic width mm (base X)
  pd?: number;       // prismatic depth mm (base Z)
  cap: number;       // capacity mAh
  amp: number;       // continuous discharge A
  pulseAmp?: number; // pulse discharge A (optional)
  chargeAmp?: number;// charge current A (optional)
  v: number;         // nominal voltage
  type: 'li-ion' | 'lfp' | 'na-ion' | 'nimh' | 'lto' | 'lipo' | 'alk';
  ir: number;        // internal resistance mΩ
  rTh?: number;      // thermal resistance K/W (cell-to-ambient)
  cost?: string;
  formFactor?: CellFormFactor; // defaults to 'cylindrical'
  origin?: CellOrigin;        // F8a: tier1 = manufacturer spec, generic-china = generic
}

export const CELL_DB: Cell[] = [
  { name: 'A123 ANR26650M1B', d: 26.25, l: 65.0, w: 76, cap: 2500, amp: 50, v: 3.3, type: 'lfp', ir: 6, rTh: 6 },
  { name: 'A123 APR18650M1A', d: 18.3, l: 65.0, w: 40, cap: 1100, amp: 30, v: 3.3, type: 'lfp', ir: 6, rTh: 10 },
  { name: 'BAK N18650CL', d: 18.4, l: 65.0, w: 46, cap: 2900, amp: 8, v: 3.6, type: 'li-ion', ir: 35, rTh: 10 },
  { name: 'BAK N18650CP', d: 18.4, l: 65.0, w: 46, cap: 3350, amp: 6, v: 3.6, type: 'li-ion', ir: 40, rTh: 10 },
  { name: 'BAK N21700CD', d: 21.2, l: 70.5, w: 68, cap: 4800, amp: 10, v: 3.6, type: 'li-ion', ir: 28, rTh: 7 },
  { name: 'BAK N21700CG', d: 21.2, l: 70.5, w: 68, cap: 5000, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 7 },
  { name: 'CATL 32140 Na-Ion', d: 32.0, l: 140.0, w: 270, cap: 10000, amp: 20, v: 3.0, type: 'na-ion', ir: 8, rTh: 4 },
  { name: 'DMEGC INR18650-26E', d: 18.4, l: 65.0, w: 46, cap: 2600, amp: 5, v: 3.6, type: 'li-ion', ir: 35, rTh: 10 },
  { name: 'Efest 10440 (AAA)', d: 10.4, l: 44.0, w: 10, cap: 350, amp: 3, v: 3.7, type: 'li-ion', ir: 45, rTh: 16 },
  { name: 'Epoch 14500', d: 14.3, l: 49.5, w: 20, cap: 1100, amp: 10, v: 3.6, type: 'li-ion', ir: 20, rTh: 13 },
  { name: 'EVE 25P (18650)', d: 18.35, l: 65.0, w: 47, cap: 2500, amp: 30, v: 3.6, type: 'li-ion', ir: 14, rTh: 10 },
  { name: 'EVE 26V (18650)', d: 18.4, l: 65.0, w: 46, cap: 2550, amp: 7, v: 3.6, type: 'li-ion', ir: 30, rTh: 10 },
  { name: 'EVE 33V (18650)', d: 18.35, l: 65.0, w: 46, cap: 3300, amp: 10, v: 3.6, type: 'li-ion', ir: 26, rTh: 10 },
  { name: 'EVE 40P (21700)', d: 21.25, l: 70.5, w: 68, cap: 4000, amp: 50, v: 3.6, type: 'li-ion', ir: 9, rTh: 7 },
  { name: 'EVE 50E (21700)', d: 21.25, l: 70.5, w: 69, cap: 5000, amp: 15, v: 3.6, type: 'li-ion', ir: 20, rTh: 7 },
  { name: 'EVE INR18650-33V', d: 18.35, l: 65.0, w: 46, cap: 3300, amp: 10, v: 3.6, type: 'li-ion', ir: 26, rTh: 10 },
  { name: 'Farasis 21700', d: 21.2, l: 70.5, w: 68, cap: 4000, amp: 35, v: 3.6, type: 'li-ion', ir: 12, rTh: 7 },
  { name: 'Generic 32650 LFP', d: 32.2, l: 65.5, w: 140, cap: 5000, amp: 20, v: 3.2, type: 'lfp', ir: 10, rTh: 5 },
  { name: 'Hakadi 18650 Na-Ion', d: 18.5, l: 65.2, w: 40, cap: 1500, amp: 5, v: 3.1, type: 'na-ion', ir: 25, rTh: 10 },
  { name: 'Headway 38120', d: 38.0, l: 122.0, w: 330, cap: 10000, amp: 100, v: 3.2, type: 'lfp', ir: 4, rTh: 3 },
  { name: 'Headway 40152', d: 40.0, l: 152.0, w: 480, cap: 15000, amp: 150, v: 3.2, type: 'lfp', ir: 3, rTh: 3 },
  { name: 'Hohm Grown 26650', d: 26.6, l: 65.4, w: 98, cap: 4244, amp: 30, v: 3.7, type: 'li-ion', ir: 12, rTh: 6 },
  { name: 'iJoy 26650', d: 26.5, l: 65.3, w: 95, cap: 4200, amp: 40, v: 3.7, type: 'li-ion', ir: 10, rTh: 6 },
  { name: 'K2 Energy LFP18650', d: 18.3, l: 65.0, w: 40, cap: 1500, amp: 12, v: 3.2, type: 'lfp', ir: 20, rTh: 10 },
  { name: 'K2 Energy LFP26650', d: 26.5, l: 65.5, w: 86, cap: 3800, amp: 12, v: 3.2, type: 'lfp', ir: 15, rTh: 6 },
  { name: 'KeepPower 18350', d: 18.4, l: 35.0, w: 25, cap: 1200, amp: 10, v: 3.7, type: 'li-ion', ir: 28, rTh: 11 },
  { name: 'LG F1L (18650)', d: 18.4, l: 65.0, w: 46, cap: 3350, amp: 5, v: 3.6, type: 'li-ion', ir: 35, rTh: 10 },
  { name: 'LG H40 (21700)', d: 21.25, l: 70.6, w: 68, cap: 4000, amp: 35, v: 3.6, type: 'li-ion', ir: 12, rTh: 7 },
  { name: 'LG HE2 (18650)', d: 18.4, l: 65.0, w: 47, cap: 2500, amp: 20, v: 3.6, type: 'li-ion', ir: 22, rTh: 10 },
  { name: 'LG HE4 (18650)', d: 18.4, l: 65.0, w: 47, cap: 2500, amp: 20, v: 3.6, type: 'li-ion', ir: 22, rTh: 10 },
  { name: 'LG HG2 (18650)', d: 18.5, l: 65.2, w: 45, cap: 3000, amp: 20, v: 3.6, type: 'li-ion', ir: 20, rTh: 10 },
  { name: 'LG M29 (18650)', d: 18.4, l: 65.0, w: 46, cap: 2850, amp: 6, v: 3.6, type: 'li-ion', ir: 30, rTh: 10 },
  { name: 'LG M36 (18650)', d: 18.5, l: 65.2, w: 49, cap: 3600, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 10 },
  { name: 'LG M50 (21700)', d: 21.25, l: 70.6, w: 68, cap: 5000, amp: 7, v: 3.6, type: 'li-ion', ir: 30, rTh: 7 },
  { name: 'LG M50LT (21700)', d: 21.25, l: 70.6, w: 69, cap: 5000, amp: 14, v: 3.6, type: 'li-ion', ir: 25, rTh: 7 },
  { name: 'LG M58T (21700)', d: 21.25, l: 70.6, w: 70, cap: 5800, amp: 12, v: 3.6, type: 'li-ion', ir: 28, rTh: 7 },
  { name: 'LG MH1 (18650)', d: 18.4, l: 65.0, w: 49, cap: 3200, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 10 },
  { name: 'LG MJ1 (18650)', d: 18.6, l: 65.2, w: 49, cap: 3500, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 10 },
  { name: 'Lishen LR1865LA', d: 18.3, l: 65.0, w: 45, cap: 2000, amp: 20, v: 3.6, type: 'li-ion', ir: 20, rTh: 10 },
  { name: 'Lishen LR21700SA', d: 21.2, l: 70.5, w: 69, cap: 4000, amp: 12, v: 3.6, type: 'li-ion', ir: 25, rTh: 7 },
  { name: 'Lishen LR2170LA', d: 21.2, l: 70.5, w: 69, cap: 4000, amp: 30, v: 3.6, type: 'li-ion', ir: 12, rTh: 7 },
  { name: 'Lishen LR2170SD', d: 21.2, l: 70.5, w: 69, cap: 5000, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 7 },
  { name: 'Molicel M35A (18650)', d: 18.6, l: 65.2, w: 48, cap: 3500, amp: 10, v: 3.6, type: 'li-ion', ir: 25, rTh: 10 },
  { name: 'Molicel M50A (21700)', d: 21.55, l: 70.15, w: 67, cap: 5000, amp: 15, v: 3.6, type: 'li-ion', ir: 25, rTh: 7 },
  { name: 'Molicel P26A (18650)', d: 18.6, l: 65.0, w: 46, cap: 2600, amp: 35, v: 3.6, type: 'li-ion', ir: 12, rTh: 10 },
  { name: 'Molicel P26B (18650)', d: 18.6, l: 65.0, w: 46, cap: 2600, amp: 35, v: 3.6, type: 'li-ion', ir: 11, rTh: 10 },
  { name: 'Molicel P28A (18650)', d: 18.6, l: 65.0, w: 46, cap: 2800, amp: 35, v: 3.6, type: 'li-ion', ir: 12, rTh: 10 },
  { name: 'Molicel P28B (18650)', d: 18.6, l: 65.0, w: 46, cap: 2800, amp: 40, v: 3.6, type: 'li-ion', ir: 10, rTh: 10 },
  { name: 'Molicel P30B (18650)', d: 18.6, l: 65.0, w: 46, cap: 3000, amp: 36, v: 3.6, type: 'li-ion', ir: 10, rTh: 10 },
  { name: 'Molicel P42A (21700)', d: 21.55, l: 70.15, w: 67, cap: 4200, amp: 45, v: 3.6, type: 'li-ion', ir: 10, rTh: 7 },
  { name: 'Molicel P45B (21700)', d: 21.55, l: 70.15, w: 68, cap: 4500, amp: 45, v: 3.6, type: 'li-ion', ir: 9, rTh: 7 },
  { name: 'Molicel P50B (21700)', d: 21.55, l: 70.15, w: 68, cap: 5000, amp: 50, v: 3.6, type: 'li-ion', ir: 8, rTh: 7 },
  { name: 'P42A (21700) Re-wrap', d: 21.5, l: 70.2, w: 66, cap: 4200, amp: 45, v: 3.6, type: 'li-ion', ir: 11, rTh: 7 },
  { name: 'Panasonic Eneloop AA', d: 14.35, l: 50.4, w: 27, cap: 1900, amp: 5, v: 1.2, type: 'nimh', ir: 25, rTh: 12 },
  { name: 'Panasonic Eneloop Pro', d: 14.5, l: 50.5, w: 30, cap: 2500, amp: 5, v: 1.2, type: 'nimh', ir: 30, rTh: 12 },
  { name: 'Panasonic NCR18650A', d: 18.5, l: 65.3, w: 47, cap: 3100, amp: 6, v: 3.6, type: 'li-ion', ir: 40, rTh: 10 },
  { name: 'Panasonic NCR18650B', d: 18.5, l: 65.3, w: 47.5, cap: 3400, amp: 6, v: 3.6, type: 'li-ion', ir: 38, rTh: 10 },
  { name: 'Panasonic NCR18650BD', d: 18.5, l: 65.3, w: 48, cap: 3200, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 10 },
  { name: 'Panasonic NCR18650PF', d: 18.5, l: 65.3, w: 48, cap: 2900, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 10 },
  { name: 'Panasonic NCR20700A', d: 20.35, l: 70.3, w: 60, cap: 3100, amp: 30, v: 3.6, type: 'li-ion', ir: 12, rTh: 8 },
  { name: 'QB 26800', d: 26.25, l: 80.0, w: 120, cap: 6800, amp: 30, v: 3.6, type: 'li-ion', ir: 10, rTh: 5 },
  { name: 'Samsung 20S (18650)', d: 18.4, l: 65.0, w: 45, cap: 2000, amp: 30, v: 3.6, type: 'li-ion', ir: 11, rTh: 10 },
  { name: 'Samsung 25R (18650)', d: 18.4, l: 65.0, w: 45, cap: 2500, amp: 20, v: 3.6, type: 'li-ion', ir: 13, rTh: 10 },
  { name: 'Samsung 25S (18650)', d: 18.4, l: 65.0, w: 45, cap: 2500, amp: 25, v: 3.6, type: 'li-ion', ir: 12, rTh: 10 },
  { name: 'Samsung 26J (18650)', d: 18.4, l: 65.0, w: 45, cap: 2600, amp: 5.2, v: 3.6, type: 'li-ion', ir: 35, rTh: 10 },
  { name: 'Samsung 29E (18650)', d: 18.4, l: 65.0, w: 45, cap: 2850, amp: 2.75, v: 3.6, type: 'li-ion', ir: 45, rTh: 10 },
  { name: 'Samsung 30Q (18650)', d: 18.4, l: 65.0, w: 46, cap: 3000, amp: 15, v: 3.6, type: 'li-ion', ir: 15, rTh: 10 },
  { name: 'Samsung 30T (21700)', d: 21.25, l: 70.3, w: 67, cap: 3000, amp: 35, v: 3.6, type: 'li-ion', ir: 10, rTh: 7 },
  { name: 'Samsung 33J (18650)', d: 18.4, l: 65.0, w: 46, cap: 3270, amp: 6, v: 3.6, type: 'li-ion', ir: 32, rTh: 10 },
  { name: 'Samsung 35E (18650)', d: 18.55, l: 65.25, w: 50, cap: 3500, amp: 8, v: 3.6, type: 'li-ion', ir: 35, rTh: 10 },
  { name: 'Samsung 40T (21700)', d: 21.25, l: 70.3, w: 67, cap: 4000, amp: 35, v: 3.6, type: 'li-ion', ir: 12, rTh: 7 },
  { name: 'Samsung 40T3 (21700)', d: 21.15, l: 70.3, w: 68, cap: 4000, amp: 40, v: 3.6, type: 'li-ion', ir: 10, rTh: 7 },
  { name: 'Samsung 48G (21700)', d: 21.25, l: 70.3, w: 69, cap: 4800, amp: 10, v: 3.6, type: 'li-ion', ir: 30, rTh: 7 },
  { name: 'Samsung 50E (21700)', d: 21.25, l: 70.8, w: 69, cap: 5000, amp: 10, v: 3.6, type: 'li-ion', ir: 25, rTh: 7 },
  { name: 'Samsung 50G (21700)', d: 21.25, l: 70.3, w: 69, cap: 5000, amp: 10, v: 3.6, type: 'li-ion', ir: 28, rTh: 7 },
  { name: 'Samsung 50S (21700)', d: 21.25, l: 70.6, w: 72, cap: 5000, amp: 25, v: 3.6, type: 'li-ion', ir: 14, rTh: 7 },
  { name: 'Samsung 53S (21700)', d: 21.25, l: 70.8, w: 70, cap: 5300, amp: 10, v: 3.6, type: 'li-ion', ir: 14, rTh: 7 },
  { name: 'Sanyo NCR18650GA', d: 18.5, l: 65.3, w: 48, cap: 3500, amp: 10, v: 3.6, type: 'li-ion', ir: 38, rTh: 10 },
  { name: 'Sanyo NCR20700B', d: 20.35, l: 70.3, w: 62, cap: 4250, amp: 15, v: 3.6, type: 'li-ion', ir: 25, rTh: 8 },
  { name: 'Sanyo NCR2070C', d: 20.35, l: 70.3, w: 62, cap: 3500, amp: 30, v: 3.6, type: 'li-ion', ir: 12, rTh: 8 },
  { name: 'Sanyo UR18650NSX', d: 18.5, l: 65.1, w: 47, cap: 2500, amp: 20, v: 3.6, type: 'li-ion', ir: 20, rTh: 10 },
  { name: 'Sanyo UR18650ZY', d: 18.4, l: 65.0, w: 46, cap: 2600, amp: 5, v: 3.6, type: 'li-ion', ir: 40, rTh: 10 },
  { name: 'Shockli 26650', d: 26.4, l: 65.5, w: 94, cap: 5500, amp: 20, v: 3.6, type: 'li-ion', ir: 18, rTh: 6 },
  { name: 'Sony VTC3 (18650)', d: 18.3, l: 65.0, w: 45, cap: 1600, amp: 30, v: 3.6, type: 'li-ion', ir: 14, rTh: 10 },
  { name: 'Sony VTC4 (18650)', d: 18.35, l: 65.0, w: 45, cap: 2100, amp: 30, v: 3.6, type: 'li-ion', ir: 12, rTh: 10 },
  { name: 'Sony VTC5 (18650)', d: 18.35, l: 65.0, w: 44, cap: 2600, amp: 20, v: 3.6, type: 'li-ion', ir: 13, rTh: 10 },
  { name: 'Sony VTC5A (18650)', d: 18.35, l: 65.2, w: 48, cap: 2600, amp: 25, v: 3.6, type: 'li-ion', ir: 10, rTh: 10 },
  { name: 'Sony VTC5D (18650)', d: 18.35, l: 65.2, w: 48, cap: 2800, amp: 25, v: 3.6, type: 'li-ion', ir: 11, rTh: 10 },
  { name: 'Sony VTC6 (18650)', d: 18.35, l: 65.2, w: 46.6, cap: 3000, amp: 15, v: 3.6, type: 'li-ion', ir: 15, rTh: 10 },
  { name: 'Sony VTC6A (21700)', d: 21.2, l: 70.2, w: 68, cap: 4000, amp: 40, v: 3.6, type: 'li-ion', ir: 10, rTh: 7 },
  { name: 'Tenpower 20SG (18650)', d: 18.4, l: 65.0, w: 45, cap: 2000, amp: 30, v: 3.6, type: 'li-ion', ir: 13, rTh: 10 },
  { name: 'Tenpower INR18650-25SG', d: 18.4, l: 65.0, w: 46, cap: 2500, amp: 30, v: 3.6, type: 'li-ion', ir: 13, rTh: 10 },
  { name: 'Tesla/Generic 4680', d: 46.0, l: 80.0, w: 355, cap: 9000, amp: 50, v: 3.7, type: 'li-ion', ir: 8, rTh: 3 },
  { name: 'Toshiba SCiB 23660', d: 23.0, l: 66.0, w: 65, cap: 2900, amp: 40, v: 2.4, type: 'lto', ir: 2, rTh: 6 },
  { name: 'Vapcell F52 (21700)', d: 21.3, l: 70.6, w: 70, cap: 5200, amp: 15, v: 3.6, type: 'li-ion', ir: 20, rTh: 7 },
  { name: 'Vapcell F60 (21700)', d: 21.6, l: 70.8, w: 72, cap: 6000, amp: 12.5, v: 3.6, type: 'li-ion', ir: 25, rTh: 7 },
  { name: 'Vapcell G53 (26650)', d: 26.6, l: 65.4, w: 96, cap: 5300, amp: 20, v: 3.6, type: 'li-ion', ir: 15, rTh: 6 },
  { name: 'Vapcell H10 (14500)', d: 14.4, l: 49.0, w: 19, cap: 1000, amp: 10, v: 3.6, type: 'li-ion', ir: 18, rTh: 13 },
  { name: 'Vapcell K64 (26650)', d: 26.6, l: 65.2, w: 94, cap: 6400, amp: 15, v: 3.6, type: 'li-ion', ir: 22, rTh: 6 },
  { name: 'Vapcell S40 (18650)', d: 18.5, l: 65.2, w: 49, cap: 4000, amp: 10, v: 3.6, type: 'li-ion', ir: 28, rTh: 10 },
  { name: 'Vapcell T8 (16340)', d: 16.4, l: 34.0, w: 18, cap: 850, amp: 3, v: 3.6, type: 'li-ion', ir: 40, rTh: 12 },
  { name: 'Wotech 32700 LFP', d: 32.2, l: 70.5, w: 145, cap: 6000, amp: 30, v: 3.2, type: 'lfp', ir: 8, rTh: 5 },
];
