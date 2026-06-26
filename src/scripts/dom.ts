export const inputs = new Proxy(
  {},
  { get: (_t, name) => document.getElementById(name as string) }
) as unknown as Record<string, HTMLInputElement | null>;

export const INPUT_IDS = [
  'c-diam','c-len','c-volts','c-mah','c-amp','c-min-v','c-max-v','c-weight','c-cost',
  's-count','p-count','c-spacing','hex-mode','pack-layers','layer-spacing',
  'exploded-view','pack-name','calc-ladder',
  'sim-cell-ir','sim-strip-mat','sim-strip-w','sim-strip-t','sim-load-slider',
  'col-cell','col-bg','met-cell','col-cap','col-spacer','col-bus','col-inter','met-inter','met-cap','met-bus','met-spacer',
];

export function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
