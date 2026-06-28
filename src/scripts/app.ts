import { initThree, updatePack, animate } from './pack-builder';
import {
  initDisclaimer, setupModals, setupFileMenu, setupReset,
  setupPresetEvents, setupCellDbSearch,
  setupMetallicSliders, attachAllInputs, setupSnapshots,
  renderSnapList,   setupExportOverlay, setupStepExportOverlay, setupSvgExportOverlay, setupBomOverlay, setupDatasheetOverlay,
  setupBmsBox, setupDiagnosticPanel, setupPowerConnectors, setupF18Controls,
  populatePresets, selectInitialPresets,
  importStateFromFile, updateDeleteButtons,
} from './ui';
import { setupElectricalEngine } from './electrical-engine';
import { toggleTheme } from './theme';

function setupThemeToggle() {
  const btn = document.getElementById('btn-theme-toggle');
  if (!btn) return;
  
  const updateIcons = () => {
    const isDark = document.documentElement.classList.contains('dark');
    const lightIcon = document.getElementById('theme-icon-light');
    const darkIcon = document.getElementById('theme-icon-dark');
    if (lightIcon) lightIcon.classList.toggle('hidden', isDark);
    if (darkIcon) darkIcon.classList.toggle('hidden', !isDark);
  };
  
  updateIcons();
  
  btn.addEventListener('click', () => {
    toggleTheme();
    updateIcons();
  });
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateIcons);
}

export function initApp() {
  const container = document.getElementById('render-area') as HTMLElement | null;
  if (!container) {
    console.warn('Battery Tool: render-area no encontrado, abortando init.');
    return;
  }

  initThree(container);

  setupThemeToggle();
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
  setupDatasheetOverlay();
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