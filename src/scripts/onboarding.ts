/**
 * F12 — Onboarding Tour Module
 * 5-step guided tour for first-time users.
 * Persists completion state in localStorage.
 */

import { t } from '../i18n';

const STORAGE_KEY = 'bca-onboarding-done';
const $ = (id: string) => document.getElementById(id);

interface TourStep {
  icon: string;
  title: string;
  description: string;
  target: string;
}

function getSteps(): TourStep[] {
  return [
    {
      icon: '🔋',
      title: t('onboarding.cellSpecs'),
      description: t('onboarding.cellSpecsDesc'),
      target: 'cell-specs',
    },
    {
      icon: '⚗️',
      title: t('onboarding.chemistry'),
      description: t('onboarding.chemistryDesc'),
      target: 'chemistry-section',
    },
    {
      icon: '🔧',
      title: t('onboarding.packConfig'),
      description: t('onboarding.packConfigDesc'),
      target: 'pack-config',
    },
    {
      icon: '📊',
      title: t('onboarding.simulation'),
      description: t('onboarding.simulationDesc'),
      target: 'simulation',
    },
    {
      icon: '💾',
      title: t('onboarding.exportShare'),
      description: t('onboarding.exportShareDesc'),
      target: null,
    },
  ];
}

let currentStep = 0;
let overlay: HTMLElement | null = null;

function renderDots() {
  const dotsEl = $('onboarding-dots');
  if (!dotsEl) return;
  dotsEl.innerHTML = getSteps().map((_, i) =>
    `<span class="onboarding-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}"></span>`
  ).join('');
}

function updateStep() {
  const steps = getSteps();
  const step = steps[currentStep];
  if (!step) return;

  const titleEl = $('onboarding-title');
  const descEl = $('onboarding-desc');
  const iconEl = $('onboarding-icon');
  const prevBtn = $('onboarding-prev');
  const nextBtn = $('onboarding-next');

  if (iconEl) iconEl.textContent = step.icon;
  if (titleEl) titleEl.textContent = step.title;
  if (descEl) descEl.textContent = step.description;

  if (prevBtn) (prevBtn as HTMLButtonElement).disabled = currentStep === 0;
  if (nextBtn) {
    (nextBtn as HTMLButtonElement).textContent = currentStep === steps.length - 1 ? t('onboarding.getStarted') : t('onboarding.next');
  }

  renderDots();

  // Scroll target section into view
  if (step.target) {
    const targetEl = $(step.target) || document.querySelector(`[data-section="${step.target}"]`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function close() {
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
  }
  localStorage.setItem(STORAGE_KEY, 'true');
}

function nextStep() {
  if (currentStep < getSteps().length - 1) {
    currentStep++;
    updateStep();
  } else {
    close();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    updateStep();
  }
}

function startTour() {
  currentStep = 0;
  overlay = $('onboarding-overlay');
  if (!overlay) return;

  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
  updateStep();
}

export function initOnboarding(): void {
  overlay = $('onboarding-overlay');
  if (!overlay) return;

  // Wire up buttons
  $('onboarding-close')?.addEventListener('click', close);
  $('onboarding-skip')?.addEventListener('click', close);
  $('onboarding-next')?.addEventListener('click', nextStep);
  $('onboarding-prev')?.addEventListener('click', prevStep);

  // Close on backdrop click
  overlay.querySelector('.onboarding-backdrop')?.addEventListener('click', close);

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay?.classList.contains('hidden')) {
      close();
    }
  });

  // Start tour after disclaimer is accepted (or immediately if already accepted)
  const hasCompleted = localStorage.getItem(STORAGE_KEY);
  const disclaimerDone = localStorage.getItem('bpa_disclaimer_agreed_v4');

  if (!hasCompleted) {
    if (disclaimerDone) {
      // Disclaimer already accepted — start immediately
      startTour();
    } else {
      // Wait for disclaimer accept button click
      const agreeBtn = $('btn-agree');
      if (agreeBtn) {
        agreeBtn.addEventListener('click', () => {
          // Small delay so disclaimer overlay closes first
          setTimeout(() => startTour(), 300);
        }, { once: true });
      }
    }
  }
}

export function restartTour(): void {
  localStorage.removeItem(STORAGE_KEY);
  startTour();
}
