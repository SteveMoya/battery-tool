export const inputs = new Proxy(
  {},
  { get: (_t, name) => document.getElementById(name as string) }
) as unknown as Record<string, HTMLInputElement | null>;

export const INPUT_IDS = [
  'c-diam','c-len','c-volts','c-mah','c-amp','c-pulse-amp','c-charge-amp','c-min-v','c-max-v','c-weight','c-cost',
  'c-prism-w','c-prism-d','c-len-p',
  's-count','p-count','target-v','target-ah','c-spacing','hex-mode','pack-layers','layer-spacing',
  'exploded-view','pack-name','calc-ladder',
  'gen-target-v','gen-target-ah',
  'sim-cell-ir','sim-strip-mat','sim-strip-w','sim-strip-t','sim-load-slider',
  'col-cell','col-bg','met-cell','col-cap','col-spacer','col-bus','col-inter','met-inter','met-cap','met-bus','met-spacer',
  'bms-selector',
  // F11b: Custom BMS modal inputs
  'bms-name-input', 'bms-protocol-input', 'bms-s-min', 'bms-s-max', 'bms-smart',
  'bms-max-a-input', 'bms-v-cutoff-charge', 'bms-v-cutoff-discharge',
  'bms-dim-w', 'bms-dim-d', 'bms-dim-h',
];

export function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
