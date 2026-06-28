/**
 * F12 — Keyboard Shortcuts Module
 */

const $ = (id: string) => document.getElementById(id);

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

const shortcuts: Shortcut[] = [
  {
    key: 's',
    ctrl: true,
    description: 'Save configuration',
    action: () => {
      const event = new CustomEvent('app:save-config');
      window.dispatchEvent(event);
    },
  },
  {
    key: 'o',
    ctrl: true,
    description: 'Load configuration',
    action: () => {
      const event = new CustomEvent('app:load-config');
      window.dispatchEvent(event);
    },
  },
  {
    key: 'e',
    ctrl: true,
    description: 'Export datasheet',
    action: () => {
      const btn = $('datasheet-btn');
      btn?.click();
    },
  },
  {
    key: '1',
    ctrl: true,
    description: 'Jump to Cell Specs',
    action: () => scrollToSection('cell-specs'),
  },
  {
    key: '2',
    ctrl: true,
    description: 'Jump to Chemistry',
    action: () => scrollToSection('chemistry-section'),
  },
  {
    key: '3',
    ctrl: true,
    description: 'Jump to Pack Config',
    action: () => scrollToSection('pack-config'),
  },
  {
    key: '4',
    ctrl: true,
    description: 'Jump to Simulation',
    action: () => scrollToSection('simulation'),
  },
  {
    key: '5',
    ctrl: true,
    description: 'Jump to BMS',
    action: () => scrollToSection('bms-section'),
  },
  {
    key: 'r',
    ctrl: true,
    shift: true,
    description: 'Run simulation',
    action: () => {
      const btn = $('run-sim-btn');
      btn?.click();
    },
  },
];

function scrollToSection(sectionId: string) {
  const el = $(sectionId) || document.querySelector(`[data-section="${sectionId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function matchesShortcut(e: KeyboardEvent, shortcut: Shortcut): boolean {
  const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
  const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = shortcut.alt ? e.altKey : !e.altKey;

  return e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch && altMatch;
}

export function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    for (const shortcut of shortcuts) {
      if (matchesShortcut(e, shortcut)) {
        e.preventDefault();
        shortcut.action();
        break;
      }
    }
  });
}

export function getShortcutList(): { key: string; description: string }[] {
  return shortcuts.map(s => {
    const parts: string[] = [];
    if (s.ctrl) parts.push('Ctrl');
    if (s.shift) parts.push('Shift');
    if (s.alt) parts.push('Alt');
    parts.push(s.key.toUpperCase());
    return { key: parts.join('+'), description: s.description };
  });
}
