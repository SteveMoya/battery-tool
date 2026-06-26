import { initThree, updatePack, animate } from './pack-builder';
import {
  initDisclaimer, setupModals, setupFileMenu, setupReset,
  setupPresetEvents, setupCellDbSearch,
  setupMetallicSliders, attachAllInputs, setupSnapshots,
  renderSnapList, setupExportOverlay, populatePresets, selectInitialPresets,
  importStateFromFile, updateDeleteButtons,
} from './ui';

export function initApp() {
  const container = document.getElementById('render-area') as HTMLElement | null;
  if (!container) {
    console.warn('Battery Pack Architect: render-area no encontrado, abortando init.');
    return;
  }

  initThree(container);

  initDisclaimer();
  setupModals();
  setupFileMenu();
  setupReset();
  populatePresets();
  selectInitialPresets();
  setupPresetEvents();
  setupCellDbSearch();
  setupMetallicSliders();
  attachAllInputs();
  setupSnapshots();
  setupExportOverlay();
  renderSnapList();
  updateDeleteButtons();

  document.getElementById('import-file-input')?.addEventListener('change', importStateFromFile);

  updatePack();
  requestAnimationFrame(animate);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
