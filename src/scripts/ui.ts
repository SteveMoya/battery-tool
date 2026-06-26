import { CELL_DB, type Cell } from './cell-database';
import { DEFAULT_SIZE_PRESETS, DEFAULT_CHEM_PRESETS, type SizePreset, type ChemPreset } from './presets';
import { exportSTL } from './stl-export';
import { INPUT_IDS, $ } from './dom';
import {
  packState,
  getUserSizePresets, getUserChemPresets,
  setUserSizePresets, setUserChemPresets,
  setUserTouchedBusMode, setLastUserBusMode,
  setUserTouchedBusColor,
  updatePack, getStats,
} from './pack-builder';
import {
  rescaleLoadSlider, updateSimulation,
  getOpenCircuitVoltage, getLastAmps, getLastWatts, getSimMax,
} from './simulation';

export const snapshots: { id: number; inputs: Record<string, any>; data: any }[] = [];

const fileMenuDropdown = () => document.querySelector<HTMLElement>('.dropdown');

const debounce = (fn: (...a: any[]) => void, delay: number) => {
  let t: number | null = null;
  return (...args: any[]) => { if (t) clearTimeout(t); t = window.setTimeout(() => fn(...args), delay); };
};
const debouncedUpdate = debounce(() => updatePack(), 50);

// Typed shortcuts (cleaner casts than `as unknown as ...` everywhere)
const $sel = (id: string): HTMLSelectElement | null => document.getElementById(id) as HTMLSelectElement | null;
const $inp = (id: string): HTMLInputElement | null => document.getElementById(id) as HTMLInputElement | null;
const $btn = (id: string): HTMLButtonElement | null => document.getElementById(id) as HTMLButtonElement | null;

// === MODALES ===
export function setupModals() {
  const setupModal = (triggerId: string, overlayId: string) => {
    const trigger = document.getElementById(triggerId);
    const overlay = document.getElementById(overlayId);
    if (trigger && overlay) {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        (overlay as HTMLElement).style.display = 'flex';
        fileMenuDropdown()?.classList.remove('show');
      });
    }
  };
  setupModal('menu-feedback', 'feedback-overlay');
  setupModal('menu-commercial', 'commercial-overlay');
  setupModal('menu-disclaimer', 'disclaimer-overlay');

  ['feedback-overlay', 'commercial-overlay', 'license-overlay', 'export-overlay', 'modal-overlay'].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('click', (e) => { if (e.target === el) (el as HTMLElement).style.display = 'none'; });
  });

  document.getElementById('menu-license')?.addEventListener('click', (e) => {
    e.preventDefault();
    const overlay = $('license-overlay'); const content = $('license-content');
    if (!overlay || !content) return;
    overlay.style.display = 'flex';
    fileMenuDropdown()?.classList.remove('show');
    if (content.dataset.loaded === 'false') {
      fetch('https://raw.githubusercontent.com/LMF5000/battery-pack-architect/main/LICENSE')
        .then((r) => r.ok ? r.text() : Promise.reject())
        .then((text) => { content.textContent = text; content.dataset.loaded = 'true'; })
        .catch(() => { content.textContent = 'Could not load license file directly.'; });
    }
  });

  document.getElementById('btn-close-compare')?.addEventListener('click', () => { ($('modal-overlay') as HTMLElement).style.display = 'none'; });
  document.getElementById('btn-close-license')?.addEventListener('click', () => { ($('license-overlay') as HTMLElement).style.display = 'none'; });
  document.getElementById('btn-close-feedback')?.addEventListener('click', () => { ($('feedback-overlay') as HTMLElement).style.display = 'none'; });
  document.getElementById('btn-close-commercial')?.addEventListener('click', () => { ($('commercial-overlay') as HTMLElement).style.display = 'none'; });
  document.getElementById('btn-close-export')?.addEventListener('click', () => { ($('export-overlay') as HTMLElement).style.display = 'none'; });
}

export function initDisclaimer() {
  const agreed = localStorage.getItem('bpa_disclaimer_agreed_v4');
  const overlay = $('disclaimer-overlay'); const btn = $('btn-agree');
  if (!overlay || !btn) return;
  if (!agreed) overlay.style.display = 'flex';
  btn.addEventListener('click', () => {
    localStorage.setItem('bpa_disclaimer_agreed_v4', 'true');
    overlay.style.display = 'none';
  });
}

export function setupFileMenu() {
  document.getElementById('btn-file-menu')?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileMenuDropdown()?.classList.toggle('show');
  });
  document.addEventListener('click', (e) => {
    const dd = fileMenuDropdown();
    if (dd && !dd.contains(e.target as Node)) dd.classList.remove('show');
  });
  document.getElementById('menu-import')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('import-file-input')?.click();
    fileMenuDropdown()?.classList.remove('show');
  });
  document.getElementById('menu-export')?.addEventListener('click', (e) => {
    e.preventDefault(); exportState(); fileMenuDropdown()?.classList.remove('show');
  });
  document.getElementById('menu-export-stl')?.addEventListener('click', (e) => {
    e.preventDefault();
    ($('export-overlay') as HTMLElement).style.display = 'flex';
    fileMenuDropdown()?.classList.remove('show');
  });
}

export function setupReset() {
  document.getElementById('btn-reset')?.addEventListener('click', () => location.reload());
}

// === PRESETS ===
export function populatePresets() {
  const selSize = $sel('preset-selector');
  if (!selSize) return;
  const currentSizeVal = selSize.value;
  selSize.innerHTML = '<option value="custom">Custom Cell</option>';
  const sizeGroups: Record<string, any[]> = {};
  [...DEFAULT_SIZE_PRESETS, ...getUserSizePresets()].forEach((p) => {
    const g = (p as any).group || 'My Saved Presets';
    if (!sizeGroups[g]) sizeGroups[g] = []; sizeGroups[g].push(p);
  });
  for (const gName in sizeGroups) {
    const grp = document.createElement('optgroup'); grp.label = gName;
    sizeGroups[gName].forEach((p) => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify((p as SizePreset).data);
      opt.text = (p as SizePreset).name;
      if ((p as any).group === undefined) (opt as any).dataset.user = 'true';
      grp.appendChild(opt);
    });
    selSize.appendChild(grp);
  }
  if (currentSizeVal !== 'custom' && currentSizeVal !== '') selSize.value = currentSizeVal;

  const selChem = $sel('chem-selector');
  if (!selChem) return;
  const currentChemVal = selChem.value;
  selChem.innerHTML = '<option value="custom">Custom Voltage</option>';
  const chemGroups: Record<string, ChemPreset[]> = {};
  [...DEFAULT_CHEM_PRESETS, ...(getUserChemPresets() as ChemPreset[])].forEach((p) => {
    const g = p.group || 'My Saved Presets';
    if (!chemGroups[g]) chemGroups[g] = []; chemGroups[g].push(p);
  });
  for (const gName in chemGroups) {
    const grp = document.createElement('optgroup'); grp.label = gName;
    chemGroups[gName].forEach((p) => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify(p.data);
      opt.text = `${p.name} ${p.data.nom}V (${p.data.min}V - ${p.data.max}V)`;
      if (p.id) (opt as any).dataset.id = p.id;
      if ((p as any).group === undefined) (opt as any).dataset.user = 'true';
      grp.appendChild(opt);
    });
    selChem.appendChild(grp);
  }
  if (currentChemVal !== 'custom' && currentChemVal !== '') selChem.value = currentChemVal;
  updateDeleteButtons();
}

export function updateDeleteButtons() {
  const selSize = $sel('preset-selector');
  const optSize = selSize?.selectedOptions[0] as any;
  const delSize = $btn('btn-del-preset-size');
  if (delSize) delSize.disabled = !(optSize && optSize.dataset.user === 'true');
  const selChem = $sel('chem-selector');
  const optChem = selChem?.selectedOptions[0] as any;
  const delChem = $btn('btn-del-preset-chem');
  if (delChem) delChem.disabled = !(optChem && optChem.dataset.user === 'true');
}

export function setupPresetEvents() {
  const selSize = $sel('preset-selector');
  selSize?.addEventListener('change', (e) => {
    updateDeleteButtons();
    const v = (e.target as HTMLSelectElement).value;
    if (v === 'custom') return;
    const d = JSON.parse(v);
    const cDiam = $inp('c-diam'); if (cDiam) cDiam.value = d.d;
    const cLen = $inp('c-len'); if (cLen) cLen.value = d.l;
    const cWeight = $inp('c-weight'); if (cWeight) cWeight.value = d.w;
    const cCost = $inp('c-cost'); if (cCost) cCost.value = d.cost;
    if (d.cap) { const cMah = $inp('c-mah'); if (cMah) cMah.value = d.cap; }
    if (d.amp) { const cAmp = $inp('c-amp'); if (cAmp) cAmp.value = d.amp; }
    const ir = $inp('sim-cell-ir'); if (ir) ir.value = d.ir || 25;
    if (d.type) {
      const chemSel = $sel('chem-selector');
      if (chemSel) {
        for (let i = 0; i < chemSel.options.length; i++) {
          if ((chemSel.options[i] as any).dataset.id === d.type) {
            chemSel.selectedIndex = i; chemSel.dispatchEvent(new Event('change')); break;
          }
        }
      }
    }
    updatePack();
  });

  document.getElementById('btn-save-preset-size')?.addEventListener('click', () => {
    const name = prompt('Name for Cell preset:');
    if (!name) return;
    const newData = {
      d: parseFloat($inp('c-diam')?.value ?? '0'),
      l: parseFloat($inp('c-len')?.value ?? '0'),
      w: parseFloat($inp('c-weight')?.value ?? '0'),
      cost: $inp('c-cost')?.value ?? '',
      cap: parseFloat($inp('c-mah')?.value ?? '0'),
      amp: parseFloat($inp('c-amp')?.value ?? '0'),
      type: 'li-ion' as const,
      ir: parseFloat($inp('sim-cell-ir')?.value ?? '25'),
    };
    const updated: SizePreset[] = [...(getUserSizePresets() as SizePreset[]), { name, group: 'My Saved Presets', data: newData } as SizePreset];
    setUserSizePresets(updated);
    populatePresets();
    const sel = $sel('preset-selector'); if (sel) sel.selectedIndex = sel.options.length - 1;
    updateDeleteButtons();
  });

  document.getElementById('btn-del-preset-size')?.addEventListener('click', () => {
    if (!confirm('Delete this custom preset?')) return;
    const sel = $sel('preset-selector');
    if (!sel) return;
    const name = sel.options[sel.selectedIndex].text;
    setUserSizePresets((getUserSizePresets() as SizePreset[]).filter((p) => p.name !== name));
    sel.value = 'custom';
    populatePresets();
  });

  const selChem = $sel('chem-selector');
  selChem?.addEventListener('change', (e) => {
    updateDeleteButtons();
    const v = (e.target as HTMLSelectElement).value;
    if (v === 'custom') return;
    const d = JSON.parse(v);
    applyChemPreset(d);
    updatePack();
  });

  document.getElementById('btn-save-preset-chem')?.addEventListener('click', () => {
    const name = prompt('Name for Chemistry preset:');
    if (!name) return;
    const newData = {
      nom: parseFloat($inp('c-volts')?.value ?? '0'),
      min: parseFloat($inp('c-min-v')?.value ?? '0'),
      max: parseFloat($inp('c-max-v')?.value ?? '0'),
    };
    setUserChemPresets([...(getUserChemPresets() as ChemPreset[]), { name, group: 'My Saved Presets', data: newData } as any]);
    populatePresets();
    const sel = $sel('chem-selector'); if (sel) sel.selectedIndex = sel.options.length - 1;
    updateDeleteButtons();
  });

  document.getElementById('btn-del-preset-chem')?.addEventListener('click', () => {
    if (!confirm('Delete this custom preset?')) return;
    const sel = $sel('chem-selector');
    if (!sel) return;
    const txt = sel.options[sel.selectedIndex].text;
    const name = txt.split(' (')[0];
    setUserChemPresets((getUserChemPresets() as ChemPreset[]).filter((p) => p.name !== name && !txt.startsWith(p.name)));
    sel.value = 'custom';
    populatePresets();
  });
}

// === F2: CHEMISTRY MASTER SWITCH ===
export interface ChemData { nom: number; min: number; max: number; }
export interface ChemApplyResult { warnings: string[]; clampedCutoff: boolean; }

export function applyChemPreset(data: ChemData, opts: { silent?: boolean } = {}): ChemApplyResult {
  const warnings: string[] = [];
  const cVolts = $inp('c-volts'); if (cVolts) cVolts.value = String(data.nom);
  const cMinV = $inp('c-min-v'); if (cMinV) cMinV.value = String(data.min);
  const cMaxV = $inp('c-max-v'); if (cMaxV) cMaxV.value = String(data.max);

  let clampedCutoff = false;
  const cutoffEl = $('sys-cutoff') as HTMLInputElement | null;
  if (cutoffEl) {
    const cutoff = parseFloat(cutoffEl.value);
    if (!isNaN(cutoff) && cutoff < data.min) {
      cutoffEl.value = data.min.toFixed(2);
      clampedCutoff = true;
      warnings.push(`LVC ajustado a ${data.min.toFixed(2)}V (mínimo seguro de la química).`);
    } else if (!isNaN(cutoff) && cutoff > data.max) {
      cutoffEl.value = data.max.toFixed(2);
      warnings.push(`LVC estaba por encima del voltaje máximo (${data.max.toFixed(2)}V); se ajustó.`);
    }
  }

  const cellNom = parseFloat($inp('c-volts')?.value ?? String(data.nom));
  if (!isNaN(cellNom) && Math.abs(cellNom - data.nom) > 0.5) {
    warnings.push(`La celda actual (${cellNom}V nominal) no coincide con esta química; verificá.`);
  }

  if (!opts.silent && warnings.length) showChemWarning(warnings.join(' '));
  return { warnings, clampedCutoff };
}

let chemWarnTimer: number | null = null;
export function showChemWarning(msg: string) {
  const el = $('chem-warning');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  if (chemWarnTimer) window.clearTimeout(chemWarnTimer);
  chemWarnTimer = window.setTimeout(() => el.classList.add('hidden'), 6000);
}
export function clearChemWarning() {
  const el = $('chem-warning');
  if (el) el.classList.add('hidden');
  if (chemWarnTimer) { window.clearTimeout(chemWarnTimer); chemWarnTimer = null; }
}

// === CELL DB SEARCH ===
export function setupCellDbSearch() {
  const searchInput = $inp('db-search-input');
  const searchResults = $('db-results');
  if (!searchInput || !searchResults) return;
  searchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.toLowerCase();
    if (query.length < 2) { (searchResults as HTMLElement).style.display = 'none'; return; }
    const matches: Cell[] = CELL_DB.filter((c) => c.name.toLowerCase().includes(query) || (String(c.cap) + 'mah').includes(query));
    searchResults.innerHTML = '';
    if (matches.length > 0) {
      matches.slice(0, 10).forEach((cell: Cell) => {
        const div = document.createElement('div');
        div.className = 'db-item';
        div.innerHTML = `<div class="db-name">${cell.name}</div><div class="db-meta">${cell.cap}mAh | ${cell.amp}A</div>`;
        div.addEventListener('click', () => {
          applyCellData(cell);
          (searchResults as HTMLElement).style.display = 'none';
          searchInput.value = cell.name;
        });
        searchResults.appendChild(div);
      });
      (searchResults as HTMLElement).style.display = 'block';
    } else { (searchResults as HTMLElement).style.display = 'none'; }
  });
  document.addEventListener('click', (e) => {
    if (!$('db-search-wrap')?.contains(e.target as Node)) (searchResults as HTMLElement).style.display = 'none';
  });
}

export function applyCellData(data: Cell) {
  const cDiam = $inp('c-diam'); if (cDiam) cDiam.value = String(data.d);
  const cLen = $inp('c-len'); if (cLen) cLen.value = String(data.l);
  const cWeight = $inp('c-weight'); if (cWeight) cWeight.value = String(data.w);
  const cCost = $inp('c-cost');
  if (data.cost && cCost) cCost.value = data.cost;
  else {
    const match = DEFAULT_SIZE_PRESETS.find((p) =>
      Math.abs(p.data.d - data.d) < 1.0 && Math.abs(p.data.l - data.l) < 3.0
    );
    if (match && cCost) cCost.value = match.data.cost;
  }
  const cMah = $inp('c-mah'); if (cMah) cMah.value = String(data.cap);
  const cAmp = $inp('c-amp'); if (cAmp) cAmp.value = String(data.amp);
  const ir = $inp('sim-cell-ir'); if (ir) ir.value = String(data.ir || 25);

  const sel = $sel('preset-selector');
  if (!sel) return;
  let dbOption = Array.from(sel.options).find((opt) => opt.value === 'db_selected');
  if (!dbOption) {
    dbOption = document.createElement('option');
    dbOption.value = 'db_selected';
    sel.add(dbOption, 1);
  }
  dbOption.text = `[DB] ${data.name}`;
  sel.value = 'db_selected';

  const chemSel = $sel('chem-selector');
  if (!chemSel) return;
  const targetChem = DEFAULT_CHEM_PRESETS.find((p) => p.id === data.type);
  if (targetChem) {
    chemSel.value = JSON.stringify(targetChem.data);
  } else {
    const fallback = data.v < 1.6 ? DEFAULT_CHEM_PRESETS.find((p) => p.id === 'nimh')
      : data.v < 2.8 ? DEFAULT_CHEM_PRESETS.find((p) => p.id === 'lto')
      : data.v < 3.4 ? DEFAULT_CHEM_PRESETS.find((p) => p.id === 'lfp')
      : DEFAULT_CHEM_PRESETS.find((p) => p.id === 'li-ion');
    if (fallback) chemSel.value = JSON.stringify(fallback.data);
  }
  chemSel.dispatchEvent(new Event('change'));
  updatePack();
}

// === REVERSE LOOKUP (Poka-yoke) ===
const identityFields = ['c-diam', 'c-len', 'c-mah', 'c-amp', 'c-volts', 'c-weight', 'c-cost'];

function attemptReverseLookup() {
  const current = {
    d: parseFloat($inp('c-diam')?.value ?? '0'),
    l: parseFloat($inp('c-len')?.value ?? '0'),
    cap: parseFloat($inp('c-mah')?.value ?? '0'),
    amp: parseFloat($inp('c-amp')?.value ?? '0'),
    v: parseFloat($inp('c-volts')?.value ?? '0'),
    w: parseFloat($inp('c-weight')?.value ?? '0'),
    cost: $inp('c-cost')?.value ?? '',
    ir: parseFloat($inp('sim-cell-ir')?.value ?? '25') || 25,
  };
  const sel = $sel('preset-selector');
  const dbInput = $inp('db-search-input');
  if (!sel) return;

  for (let i = 0; i < sel.options.length; i++) {
    const opt = sel.options[i] as any;
    if (opt.dataset.user === 'true' && opt.value.trim().startsWith('{')) {
      try {
        const p = JSON.parse(opt.value);
        if (Math.abs(p.d - current.d) < 0.05 &&
          Math.abs(p.l - current.l) < 0.5 &&
          Math.abs(p.cap - current.cap) < 1 &&
          Math.abs(p.amp - current.amp) < 0.1 &&
          Math.abs(p.w - current.w) < 0.1 &&
          p.cost === current.cost) {
          if (sel.selectedIndex !== i) sel.selectedIndex = i;
          if (dbInput) { dbInput.value = ''; dbInput.placeholder = 'Search DB...'; }
          return;
        }
      } catch { /* skip */ }
    }
  }

  const matches: Cell[] = CELL_DB.filter((c) =>
    Math.abs(c.d - current.d) < 0.05 &&
    Math.abs(c.l - current.l) < 0.5 &&
    Math.abs(c.cap - current.cap) < 1 &&
    Math.abs(c.amp - current.amp) < 0.1 &&
    Math.abs(c.v - current.v) < 0.1 &&
    (c.w ? Math.abs(c.w - current.w) < 0.5 : true)
  );
  const setDBOption = (text: string) => {
    let dbOption = Array.from(sel.options).find((opt) => opt.value === 'db_selected');
    if (!dbOption) {
      dbOption = document.createElement('option');
      dbOption.value = 'db_selected';
      sel.add(dbOption, 1);
    }
    dbOption.text = text;
    sel.value = 'db_selected';
  };

  if (matches.length === 1) {
    setDBOption(`[DB] ${matches[0].name}`);
    if (dbInput) { dbInput.value = ''; dbInput.placeholder = 'Search DB...'; }
  } else if (matches.length > 1) {
    setDBOption('[DB] Multiple Matches Found');
    if (dbInput) { dbInput.value = ''; dbInput.placeholder = `Matches: ${matches.map((m) => m.name).join(', ')}`; }
  } else {
    if (sel.value !== 'custom') sel.value = 'custom';
    const dbOption = Array.from(sel.options).find((opt) => opt.value === 'db_selected');
    if (dbOption) dbOption.remove();
    if (dbInput && dbInput.value.trim() === '') dbInput.placeholder = 'Custom specs (modified)';
  }
}

// === VISUAL SETTINGS METALLIC SLIDERS ===
export function setupMetallicSliders() {
  (['met-cell', 'met-cap', 'met-bus', 'met-spacer', 'met-inter'] as const).forEach((id) => {
    const el = $inp(id);
    const valEl = $('val-' + id);
    if (el && valEl) {
      el.addEventListener('input', () => {
        valEl.textContent = Math.round(parseFloat(el.value) * 100) + '%';
        updatePack();
      });
    }
  });
  document.getElementById('bus-mode')?.addEventListener('change', (e) => {
    setUserTouchedBusMode(true);
    setLastUserBusMode((e.target as HTMLSelectElement).value);
    updatePack();
    const toast = $('perf-toast');
    const v = (e.target as HTMLSelectElement).value;
    if (v !== 'geo' && v !== 'none' && toast) (toast as HTMLElement).style.display = 'none';
  });
  document.getElementById('sim-strip-mat')?.addEventListener('change', () => {
    setUserTouchedBusColor(false);
    updatePack();
  });
  document.getElementById('col-bus')?.addEventListener('input', () => {
    setUserTouchedBusColor(true);
    updatePack();
  });
}

// === INPUT WIRING ===
export function attachAllInputs() {
  INPUT_IDS.forEach((id) => {
    const el = $inp(id);
    if (!el) return;
    el.addEventListener('input', (e) => {
      if (id === 'sim-load-slider' || id === 'sim-cell-ir') updateSimulation(e);
      else if (el.type === 'range' || el.type === 'number' || el.type === 'text') debouncedUpdate();
      else updatePack();
    });
    if (id !== 'sim-load-slider') el.addEventListener('change', () => updatePack());
  });

  ['sim-soc', 'sys-cutoff'].forEach((id) => {
    const el = $(id); el?.addEventListener('input', () => updateSimulation());
  });

  identityFields.forEach((id) => {
    const el = $(id); if (el) el.addEventListener('input', () => { attemptReverseLookup(); updateDeleteButtons(); });
  });
  document.getElementById('sim-cell-ir')?.addEventListener('input', attemptReverseLookup);
  ['c-weight', 'c-cost'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => updateDeleteButtons());
  });

  // Cell V input → SoC reverse
  const simCellVoltInput = $inp('sim-cell-volt-input');
  simCellVoltInput?.addEventListener('input', () => {
    const cellMin = parseFloat($inp('c-min-v')?.value ?? '2.5');
    const cellMax = parseFloat($inp('c-max-v')?.value ?? '4.2');
    const cellNom = parseFloat($inp('c-volts')?.value ?? '3.6');
    let val = parseFloat(simCellVoltInput.value); if (isNaN(val)) return;
    if (val < cellMin) val = cellMin; if (val > cellMax) val = cellMax;
    let low = 0, high = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (getOpenCircuitVoltage(mid, cellMin, cellMax, cellNom) < val) low = mid; else high = mid;
    }
    const newSoC = (low + high) / 2;
    const soc = $inp('sim-soc'); if (soc) soc.value = String(Math.round(newSoC * 100));
    updateSimulation();
  });

  // Load type toggle
  const toggleLoad = $('toggle-load-type');
  const inputLoad = $inp('sim-load-type');
  toggleLoad?.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains('it-opt')) return;
    toggleLoad.querySelectorAll('.it-opt').forEach((el) => el.classList.remove('active'));
    t.classList.add('active');
    const newType = (t as any).dataset.val as string;
    if (inputLoad) inputLoad.value = newType;
    rescaleLoadSlider();
    let targetVal = newType === 'cc' ? getLastAmps() : getLastWatts();
    const max = getSimMax();
    if (targetVal > max) targetVal = max;
    const ratio = max > 0 ? targetVal / max : 0;
    const newPos = 1000 * Math.sqrt(ratio);
    const slider = $inp('sim-load-slider'); if (slider) slider.value = String(newPos);
    const numInput = $inp('sim-load-input');
    const decimals = targetVal < 10 ? 2 : 1;
    if (numInput) numInput.value = targetVal.toFixed(decimals);
    updateSimulation();
  });

  // Mode toggle
  const toggleMode = $('toggle-sim-mode');
  const inputMode = $inp('sim-mode-val');
  toggleMode?.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains('it-opt')) return;
    const val = (t as any).dataset.val as string;
    toggleMode.querySelectorAll('.it-opt').forEach((el) => el.classList.remove('active'));
    t.classList.add('active');
    if (inputMode) inputMode.value = val;
    rescaleLoadSlider();
    updateSimulation();
  });

  // LVC sync
  const lvcCell = $inp('sys-cutoff');
  const lvcPack = $inp('sys-cutoff-pack');
  lvcCell?.addEventListener('input', () => {
    const S = parseInt($inp('s-count')?.value ?? '1') || 1;
    if (lvcPack) lvcPack.value = (parseFloat(lvcCell.value) * S).toFixed(1);
    updateSimulation();
  });
  lvcPack?.addEventListener('input', () => {
    const S = parseInt($inp('s-count')?.value ?? '1') || 1;
    if (lvcCell) lvcCell.value = (parseFloat(lvcPack.value) / S).toFixed(2);
    updateSimulation();
  });

  // Sim load fine-tune
  const fineTune = $inp('sim-load-input');
  if (fineTune) {
    fineTune.addEventListener('input', (e) => updateSimulation(e));
    fineTune.addEventListener('change', () => {
      const max = parseFloat(fineTune.max);
      let val = parseFloat(fineTune.value);
      if (val > max) { fineTune.value = max.toFixed(1); val = max; }
      if (val < 0) fineTune.value = '0';
      updateSimulation({ target: fineTune } as any);
    });
  }
}

// === SNAPSHOTS & COMPARE ===
const snapListEl = () => $('snap-list');
export function setupSnapshots() {
  document.getElementById('btn-snap')?.addEventListener('click', () => {
    const state: Record<string, any> = {};
    INPUT_IDS.forEach((id) => {
      const el = $inp(id); if (el) state[id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    const snap = { id: Date.now(), inputs: state, data: { ...getStats() } };
    snapshots.push(snap); renderSnapList();
  });
  document.getElementById('btn-compare')?.addEventListener('click', () => {
    if (snapshots.length === 0) { alert('Add configurations to compare first.'); return; }
    const modal = $('modal-overlay'); const head = $('comp-head-row'); const body = $('comp-body');
    if (!modal || !head || !body) return;
    (modal as HTMLElement).style.display = 'flex';
    head.innerHTML = '<th>Parameter</th>';
    snapshots.forEach((s) => {
      const th = document.createElement('th');
      let sub = `${s.data.s}S ${s.data.p}P`; if (s.data.l > 1) sub += ` ${s.data.l}L`;
      th.innerHTML = `<div>${s.data.name}</div><div class="comp-header-sub">${sub}</div>`;
      head.appendChild(th);
    });
    const rows: any[] = [
      { label: 'Physical Specs', isHeader: true },
      { label: 'Weight', key: 'kg', unit: ' kg', good: 'min' },
      { label: 'Volume', key: 'vol', unit: ' L', good: 'min' },
      { label: 'Dimensions', complex: (d: any) => `L:${d.w.toFixed(0)} W:${d.d.toFixed(0)} H:${d.h.toFixed(0)}` },
      { label: 'Cell Count', key: 'cells', unit: '', good: 'neutral' },
      { label: 'Layers', key: 'l', unit: '', good: 'neutral' },
      { label: 'Strip Length', key: 'nickel', unit: ' m', good: 'min' },
      { label: 'Electrical Specs', isHeader: true },
      { label: 'Capacity', key: 'ah', unit: ' Ah', good: 'max' },
      { label: 'Nominal V', key: 'v', unit: ' V', good: 'neutral' },
      { label: 'V Range', complex: (d: any) => `${d.vmin.toFixed(1)} - ${d.vmax.toFixed(1)} V` },
      { label: 'Max Current', key: 'amp', unit: ' A', good: 'max' },
      { label: 'Max Power', key: 'kw', unit: ' kW', good: 'max' },
      { label: 'Total Energy', key: 'wh', unit: ' Wh', good: 'max' },
      { label: 'Value & Density', isHeader: true },
      { label: 'Cell Cost', key: 'cost', unit: ' €', good: 'min' },
      { label: 'Energy Density', complex: (d: any) => `${(d.wh / d.kg).toFixed(0)} Wh/kg`, good: 'max', val: (d: any) => d.wh / d.kg },
      { label: 'Volumetric Efficiency', complex: (d: any) => `${(d.wh / d.vol).toFixed(0)} Wh/L`, good: 'max', val: (d: any) => d.wh / d.vol },
      { label: 'Cost Efficiency', complex: (d: any) => `${(d.wh / d.cost).toFixed(1)} Wh/€`, good: 'max', val: (d: any) => d.wh / d.cost },
    ];
    body.innerHTML = '';
    rows.forEach((r) => {
      const tr = document.createElement('tr');
      if (r.isHeader) { tr.innerHTML = `<td colspan="${snapshots.length + 1}" class="row-group">${r.label}</td>`; body.appendChild(tr); return; }
      tr.innerHTML = `<td>${r.label}</td>`;
      const vals: number[] = [];
      if (r.key) for (const s of snapshots) vals.push(s.data[r.key]);
      if (r.val) for (const s of snapshots) vals.push(r.val(s.data));
      let best: number | null = null;
      if (r.good === 'max') best = Math.max(...vals);
      if (r.good === 'min') best = Math.min(...vals);
      snapshots.forEach((s) => {
        const td = document.createElement('td');
        let displayTxt = '';
        let numericVal: number | null = 0;
        if (r.complex) { displayTxt = r.complex(s.data); numericVal = r.val ? r.val(s.data) : null; }
        else {
          const v: number = s.data[r.key];
          numericVal = v;
          let txt = (v % 1 !== 0) ? v.toFixed(1) : String(v);
          if (r.unit === ' €') txt = '€' + v.toFixed(2); else txt += r.unit;
          displayTxt = txt;
        }
        if (r.good && r.good !== 'neutral' && snapshots.length > 1 && best !== null && numericVal !== null) {
          const checkVal = r.val ? numericVal : s.data[r.key];
          if (Math.abs((checkVal as number) - best) < 0.001) td.innerHTML = `<span class="best-val">${displayTxt}</span>`;
          else td.textContent = displayTxt;
        } else { td.textContent = displayTxt; }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  });
}

export function renderSnapList() {
  const list = snapListEl(); if (!list) return;
  list.innerHTML = '';
  const count = $('snap-count'); if (count) count.textContent = String(snapshots.length);
  snapshots.forEach((snap, idx) => {
    const el = document.createElement('div');
    el.className = 'snap-item';
    let desc = `${snap.data.s}S${snap.data.p}P`;
    if (snap.data.l > 1) desc += `${snap.data.l}L`;
    desc += ` | ${Math.round(snap.data.wh)}Wh | €${Math.round(snap.data.cost)}`;
    el.innerHTML = `<div class="snap-info"><div class="snap-name">${snap.data.name}</div><div class="snap-detail">${desc}</div></div><div class="snap-tools"><button class="tool-btn tool-load" title="Load">📂</button><button class="tool-btn tool-del" title="Delete">✕</button></div>`;
    el.querySelector('.tool-load')?.addEventListener('click', () => loadSnapshot(snap));
    el.querySelector('.tool-del')?.addEventListener('click', () => { snapshots.splice(idx, 1); renderSnapList(); });
    list.appendChild(el);
  });
}

function loadSnapshot(snap: { inputs: Record<string, any> }) {
  INPUT_IDS.forEach((id) => {
    const el = $inp(id);
    if (el && snap.inputs[id] !== undefined) {
      if (el.type === 'checkbox') el.checked = snap.inputs[id];
      else el.value = snap.inputs[id];
    }
  });
  updatePack();
}

// === EXPORT / IMPORT STATE ===
export function exportState() {
  const inputsState: Record<string, any> = {};
  const sel = $sel('preset-selector');
  if (sel) {
    if (sel.value === 'db_selected') {
      inputsState['saved_db_name'] = sel.options[sel.selectedIndex].text.replace('[DB] ', '');
    } else {
      const opt = sel.options[sel.selectedIndex] as any;
      if (opt && opt.dataset.user === 'true') inputsState['saved_custom_preset_name'] = opt.text;
    }
  }
  INPUT_IDS.forEach((id) => {
    const el = $inp(id);
    if (el) inputsState[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  const state = {
    version: 'bpa-v1',
    inputs: inputsState,
    userSizePresets: getUserSizePresets(),
    userChemPresets: getUserChemPresets(),
    snapshots: snapshots.map((s) => ({ inputs: s.inputs, data: s.data })),
  };
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement('a');
  const packName = ($inp('pack-name')?.value || 'pack').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `bpa_config_${packName}.json`);
  document.body.appendChild(a); a.click(); a.remove();
}

export function importStateFromFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const state = JSON.parse(String(event.target?.result));
      if (state.version !== 'bpa-v1') { alert('This file appears to be an incompatible or invalid configuration file.'); return; }
      if (state.userSizePresets) { setUserSizePresets(state.userSizePresets); populatePresets(); }
      if (state.userChemPresets) { setUserChemPresets(state.userChemPresets); populatePresets(); }
      let restored = false;
      if (state.inputs?.saved_db_name) {
        const m = CELL_DB.find((c) => c.name === state.inputs.saved_db_name);
        if (m) { applyCellData(m); restored = true; }
      }
      if (!restored && state.inputs?.saved_custom_preset_name) {
        const sel = $sel('preset-selector');
        if (sel) {
          for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].text === state.inputs.saved_custom_preset_name) { sel.selectedIndex = i; restored = true; break; }
          }
        }
      }
      if (state.inputs) {
        INPUT_IDS.forEach((id) => {
          const el = $inp(id);
          if (el && state.inputs[id] !== undefined) {
            if (el.type === 'checkbox') el.checked = state.inputs[id]; else el.value = state.inputs[id];
            if (el.type === 'range') { const v = $('val-' + id); if (v) v.textContent = Math.round(parseFloat(el.value) * 100) + '%'; }
          }
        });
        if (!restored) {
          const selSize = $sel('preset-selector'); if (selSize) selSize.value = 'custom';
          const i_d = parseFloat(state.inputs['c-diam']);
          const i_l = parseFloat(state.inputs['c-len']);
          const i_w = parseFloat(state.inputs['c-weight']);
          const i_cost = state.inputs['c-cost'];
          const i_cap = parseFloat(state.inputs['c-mah']);
          const i_amp = parseFloat(state.inputs['c-amp']);
          const i_ir = parseFloat(state.inputs['sim-cell-ir']);
          if (selSize) {
            for (let i = 0; i < selSize.options.length; i++) {
              if (selSize.options[i].value === 'custom') continue;
              try {
                const p = JSON.parse(selSize.options[i].value);
                if (Math.abs(p.d - i_d) < 0.05 && Math.abs(p.l - i_l) < 0.5 && Math.abs(p.w - i_w) < 0.1 &&
                  Math.abs(p.cap - i_cap) < 1 && Math.abs(p.amp - i_amp) < 0.1 &&
                  Math.abs((p.ir || 25) - i_ir) < 1 && p.cost === i_cost) {
                  selSize.selectedIndex = i; break;
                }
              } catch { /* skip */ }
            }
          }
        }
      }
      if (state.snapshots) {
        snapshots.length = 0;
        state.snapshots.forEach((s: any) => snapshots.push({ id: Date.now(), inputs: s.inputs, data: s.data }));
        renderSnapList();
      }
      updateDeleteButtons();
      updatePack();
    } catch (err) { console.error(err); alert('Error parsing file.'); }
    finally { (e.target as HTMLInputElement).value = ''; }
  };
  reader.readAsText(file);
}

// === STL EXPORT OVERLAY ===
export function setupExportOverlay() {
  document.getElementById('btn-do-export')?.addEventListener('click', () => {
    const incCells = $inp('ex-cells')?.checked ?? false;
    const incSpacers = $inp('ex-spacers')?.checked ?? false;
    const incBus = $inp('ex-bus')?.checked ?? false;
    exportSTL(packState.packGroup, incCells, incSpacers, incBus);
    const overlay = $('export-overlay'); if (overlay) (overlay as HTMLElement).style.display = 'none';
  });
}

// === INITIAL PRESET SELECTION ===
export function selectInitialPresets() {
  const selSize = $sel('preset-selector');
  if (!selSize) return;
  const def = JSON.stringify(DEFAULT_SIZE_PRESETS[0].data);
  for (let i = 0; i < selSize.options.length; i++) {
    if (selSize.options[i].value === def) { selSize.selectedIndex = i; break; }
  }
  const defType = DEFAULT_SIZE_PRESETS[0].data.type;
  const selChem = $sel('chem-selector');
  if (!selChem) return;
  for (let i = 0; i < selChem.options.length; i++) {
    if ((selChem.options[i] as any).dataset.id === defType) { selChem.selectedIndex = i; break; }
  }
}
