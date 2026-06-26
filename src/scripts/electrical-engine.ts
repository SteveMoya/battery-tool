import { inputs } from './dom';

type ActiveField = 's-count' | 'target-v' | 'p-count' | 'target-ah' | null;

let activeField: ActiveField = null;
let resetTimer: number | null = null;

const $inp = (id: string): HTMLInputElement | null => inputs[id] ?? null;

const setActive = (field: ActiveField) => {
  activeField = field;
  if (resetTimer) window.clearTimeout(resetTimer);
  resetTimer = window.setTimeout(() => {
    activeField = null;
    resetTimer = null;
  }, 150);
};

const getCellNom = (): number => parseFloat($inp('c-volts')?.value ?? '3.6') || 3.6;
const getCellAh = (): number => (parseFloat($inp('c-mah')?.value ?? '2500') / 1000) || 2.5;

function sToV(sInp: HTMLInputElement, vInp: HTMLInputElement) {
  const S = parseInt(sInp.value) || 1;
  const v = S * getCellNom();
  if (Math.abs(parseFloat(vInp.value) - v) > 0.05) vInp.value = v.toFixed(1);
}

function vToS(sInp: HTMLInputElement, vInp: HTMLInputElement) {
  const target = parseFloat(vInp.value) || 0;
  const S = Math.max(1, Math.ceil(target / getCellNom()));
  if (parseInt(sInp.value) !== S) sInp.value = String(S);
}

function pToAh(pInp: HTMLInputElement, ahInp: HTMLInputElement) {
  const P = parseInt(pInp.value) || 1;
  const ah = P * getCellAh();
  if (Math.abs(parseFloat(ahInp.value) - ah) > 0.005) ahInp.value = ah.toFixed(2);
}

function ahToP(pInp: HTMLInputElement, ahInp: HTMLInputElement) {
  const target = parseFloat(ahInp.value) || 0;
  const P = Math.max(1, Math.ceil(target / getCellAh()));
  if (parseInt(pInp.value) !== P) pInp.value = String(P);
}

export function setupElectricalEngine() {
  const sInp = $inp('s-count');
  const vInp = $inp('target-v');
  const pInp = $inp('p-count');
  const ahInp = $inp('target-ah');
  const cNom = $inp('c-volts');
  const cAh = $inp('c-mah');
  if (!sInp || !vInp || !pInp || !ahInp) return;

  sInp.addEventListener('input', () => { setActive('s-count'); vToS(sInp, vInp); });
  vInp.addEventListener('input', () => { setActive('target-v'); sToV(sInp, vInp); });
  pInp.addEventListener('input', () => { setActive('p-count'); ahToP(pInp, ahInp); });
  ahInp.addEventListener('input', () => { setActive('target-ah'); pToAh(pInp, ahInp); });

  cNom?.addEventListener('change', () => {
    if (activeField === 'target-v') vToS(sInp, vInp);
    else sToV(sInp, vInp);
  });
  cAh?.addEventListener('change', () => {
    if (activeField === 'target-ah') ahToP(pInp, ahInp);
    else pToAh(pInp, ahInp);
  });

  sToV(sInp, vInp);
  pToAh(pInp, ahInp);
}
