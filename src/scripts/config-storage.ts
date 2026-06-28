/**
 * F12 — Configuration Save/Load Module
 */

interface PackConfig {
  version: number;
  timestamp: string;
  cells: {
    chemistry: string;
    voltage: number;
    capacityMah: number;
  };
  pack: {
    series: number;
    parallel: number;
  };
  bms: {
    selectedId: string | null;
  };
}

function gatherConfig(): PackConfig {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    cells: {
      chemistry: (document.querySelector('#chem-selector') as HTMLSelectElement)?.value ?? '',
      voltage: parseFloat((document.getElementById('c-volts') as HTMLInputElement)?.value ?? '3.6'),
      capacityMah: parseFloat((document.getElementById('c-mah') as HTMLInputElement)?.value ?? '2500'),
    },
    pack: {
      series: parseInt((document.getElementById('num-s') as HTMLInputElement)?.value ?? '14', 10),
      parallel: parseInt((document.getElementById('num-p') as HTMLInputElement)?.value ?? '1', 10),
    },
    bms: {
      selectedId: (document.getElementById('bms-select') as HTMLSelectElement)?.value ?? null,
    },
  };
}

function applyConfig(config: PackConfig): void {
  if (config.cells.chemistry) {
    const chemSelector = document.getElementById('chem-selector') as HTMLSelectElement;
    if (chemSelector) {
      chemSelector.value = config.cells.chemistry;
      chemSelector.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  if (config.cells.voltage) {
    const vInput = document.getElementById('c-volts') as HTMLInputElement;
    if (vInput) {
      vInput.value = String(config.cells.voltage);
      vInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (config.cells.capacityMah) {
    const mahInput = document.getElementById('c-mah') as HTMLInputElement;
    if (mahInput) {
      mahInput.value = String(config.cells.capacityMah);
      mahInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (config.pack.series) {
    const sInput = document.getElementById('num-s') as HTMLInputElement;
    if (sInput) {
      sInput.value = String(config.pack.series);
      sInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (config.pack.parallel) {
    const pInput = document.getElementById('num-p') as HTMLInputElement;
    if (pInput) {
      pInput.value = String(config.pack.parallel);
      pInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (config.bms.selectedId) {
    const bmsSelect = document.getElementById('bms-select') as HTMLSelectElement;
    if (bmsSelect) {
      bmsSelect.value = config.bms.selectedId;
      bmsSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

export function saveConfig(): void {
  const config = gatherConfig();
  const json = JSON.stringify(config, null, 2);

  // Save to localStorage
  try {
    localStorage.setItem('baterry-config', json);
  } catch {
    // Ignore storage errors
  }

  // Download as file
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `baterry-config-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadConfig(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = JSON.parse(ev.target?.result as string) as PackConfig;
        if (config.version === 1) {
          applyConfig(config);
        }
      } catch {
        console.error('Invalid config file');
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

export function loadFromLocalStorage(): PackConfig | null {
  try {
    const json = localStorage.getItem('baterry-config');
    if (json) {
      return JSON.parse(json) as PackConfig;
    }
  } catch {
    // Ignore
  }
  return null;
}

export function initConfigStorage(): void {
  window.addEventListener('app:save-config', () => saveConfig());
  window.addEventListener('app:load-config', () => loadConfig());
}
