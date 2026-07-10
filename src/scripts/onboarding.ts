/**
 * F12 — Onboarding Tour Module
 * 5-step guided tour for first-time users.
 * Persists completion state in localStorage.
 */

const STORAGE_KEY = 'bca-onboarding-done';
const $ = (id: string) => document.getElementById(id);

interface TourStep {
  icon: string;
  title: string;
  description: string;
  target: string;
}

const STEPS: TourStep[] = [
  {
    icon: '🔋',
    title: 'Cell Specs',
    description: 'Start by selecting your cell type, dimensions, and capacity. Use the Cell Database to search real models from Samsung, LG, Molicel, and more.',
    target: 'cell-specs',
  },
  {
    icon: '⚗️',
    title: 'Chemistry',
    description: 'Choose your battery chemistry. NMC for high energy density, LFP for long cycle life, LTO for fast charging. Voltages auto-adjust.',
    target: 'chemistry-section',
  },
  {
    icon: '🔧',
    title: 'Pack Configuration',
    description: 'Set series (S) and parallel (P) counts to reach your target voltage and capacity. Enable generative mode to auto-calculate from targets.',
    target: 'pack-config',
  },
  {
    icon: '📊',
    title: 'Simulation',
    description: 'Run load simulations to see voltage sag, heat generation, and efficiency in real-time. Adjust SoC and load to test edge cases.',
    target: 'simulation',
  },
  {
    icon: '💾',
    title: 'Export & Share',
    description: 'Export your design as 3D models (STL/STEP), technical datasheets, BOM, or SVG projections. Save configurations for later.',
    target: null,
  },
];

let currentStep = 0;
let overlay: HTMLElement | null = null;

function renderDots() {
  const dotsEl = $('onboarding-dots');
  if (!dotsEl) return;
  dotsEl.innerHTML = STEPS.map((_, i) =>
    `<span class="onboarding-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}"></span>`
  ).join('');
}

function updateStep() {
  const step = STEPS[currentStep];
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
    (nextBtn as HTMLButtonElement).textContent = currentStep === STEPS.length - 1 ? 'Get Started' : 'Next →';
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
  if (currentStep < STEPS.length - 1) {
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
