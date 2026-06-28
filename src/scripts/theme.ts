type Theme = 'light' | 'dark';

const STORAGE_KEY = 'battery-tool-theme';

function getSystemPreference(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  root.style.colorScheme = theme;
}

export function initTheme(): void {
  const stored = getStoredTheme();
  const theme = stored ?? getSystemPreference();
  applyTheme(theme);
  
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}

export function toggleTheme(): Theme {
  const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  
  return next;
}

export function getCurrentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
