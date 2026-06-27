import { initThree, updatePack, animate } from './pack-builder';
import {
  initDisclaimer, setupModals, setupFileMenu, setupReset,
  setupPresetEvents, setupCellDbSearch,
  setupMetallicSliders, attachAllInputs, setupSnapshots,
  renderSnapList, setupExportOverlay, setupStepExportOverlay, setupSvgExportOverlay, setupBomOverlay,
  setupBmsBox, setupDiagnosticPanel, setupPowerConnectors, setupF18Controls,
  populatePresets, selectInitialPresets,
  importStateFromFile, updateDeleteButtons,
} from './ui';
import { setupElectricalEngine } from './electrical-engine';

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
  setupElectricalEngine();
  setupSnapshots();
  setupExportOverlay();
  setupStepExportOverlay();
  setupSvgExportOverlay();
  setupBomOverlay();
  setupBmsBox();
  setupDiagnosticPanel();
  setupPowerConnectors();
  setupF18Controls();
  renderSnapList();
  updateDeleteButtons();

  document.getElementById('import-file-input')?.addEventListener('change', importStateFromFile);

  updatePack();
  requestAnimationFrame(animate);
}