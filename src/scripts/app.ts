import { initThree, updatePack, animate } from './pack-builder';
import { initKeyboardShortcuts } from './keyboard-shortcuts';
import { initConfigStorage } from './config-storage';
import { initOnboarding } from './onboarding';
import {
  initDisclaimer, setupModals, setupFileMenu, setupReset,
  setupPresetEvents, setupCellDbSearch,
  setupMetallicSliders, attachAllInputs, setupSnapshots,
  renderSnapList,   setupExportOverlay, setupStepExportOverlay, setupSvgExportOverlay, setupBomOverlay, setupDatasheetOverlay,
  setupBmsBox, setupDiagnosticPanel, setupPowerConnectors, setupF18Controls, setupStandardsCompliance,
  setupProtectionSection, setupThermalSection, setupCoolingSection, setupEnclosureSection, setupDegradationSection, setupBalancingSection, setupParallelSection, setupTcoSection, setupIoTSection,
  populatePresets, selectInitialPresets,
  importStateFromFile, updateDeleteButtons,
  initInputValidation,
} from './ui';
import { setupElectricalEngine } from './electrical-engine';
import { toggleTheme } from './theme';
import { initI18n, setLocale, getLocale, updateDOMTranslations, onLocaleChange, type Locale } from '../i18n';

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

function setupLangToggle() {
  const btn = document.getElementById('btn-lang-toggle');
  const label = document.getElementById('lang-label');
  if (!btn || !label) return;

  const updateLabel = () => {
    label.textContent = getLocale() === 'en' ? 'EN' : 'ES';
  };

  updateLabel();

  btn.addEventListener('click', () => {
    const next: Locale = getLocale() === 'en' ? 'es' : 'en';
    setLocale(next);
    updateLabel();
    updateDOMTranslations();
    updatePack();
  });

  onLocaleChange(() => {
    updateLabel();
    updateDOMTranslations();
    updatePack();
  });
}

export function initApp() {
  const container = document.getElementById('render-area') as HTMLElement | null;
  if (!container) {
    console.warn('Battery Tool: render-area no encontrado, abortando init.');
    return;
  }

  initI18n();
  initThree(container);

  setupThemeToggle();
  setupLangToggle();
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
  setupStandardsCompliance();
  setupProtectionSection();
  setupThermalSection();
  setupCoolingSection();
  setupEnclosureSection();
  setupDegradationSection();
  setupBalancingSection();
  setupParallelSection();
  setupTcoSection();
  setupIoTSection();
  renderSnapList();
  updateDeleteButtons();

  document.getElementById('import-file-input')?.addEventListener('change', importStateFromFile);

  // F12: Keyboard shortcuts & config storage
  initKeyboardShortcuts();
  initConfigStorage();
  initOnboarding();
  initInputValidation();

  // F12: Mobile sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-collapsed');
    });
  }

  updatePack();
  requestAnimationFrame(animate);
}