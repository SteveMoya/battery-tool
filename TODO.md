# BCA Tool — Roadmap de Features

Roadmap de implementación organizado por prioridad. Refleja el estado actual del proyecto al 26-06-2026 y las 16 features solicitadas, mapeadas contra el código existente.

## Estado actual del proyecto

Stack: **Astro 7.7** + **React 19** + **Three.js 0.184** + **Tailwind 4** + **Cloudflare adapter**, desplegado en Cloudflare Workers.

Implementación existente relevante:
- `src/scripts/cell-database.ts` — DB con 100+ celdas (Samsung, LG, Molicel, Sony, CATL Na-Ion, Toshiba LTO, Headway LFP, etc.)
- `src/scripts/presets.ts` — 14 size presets y 7 chemistry presets (incluye LTO, LFP, Na-Ion, LiPo HV, NiMH)
- `src/scripts/pack-builder.ts` — Motor 3D con InstancedMesh, hex/square grid, multi-layer, exploded view, OCC
- `src/scripts/simulation.ts` — Voltage Sag, Joule Heat, SoC, runtime, OCV curve por química, LVC cutoff
- `src/scripts/stl-export.ts` — Export STL con checkboxes (cells/spacers/busbars)
- `src/scripts/electrical-engine.ts` — Motor bidireccional S↔V, P↔Ah (NUEVO - F3/F4)
- `src/scripts/ui.ts` — UI handlers, `applyChemPreset()`, `showChemWarning()` (F2)
- `src/components/sidebar/` — CellSpecs, Chemistry, PackConfig, Simulation, VisualSettings, About
- `src/components/modals/` — Disclaimer, License, Feedback, Commercial, Export, Compare

### Bugs corregidos (26-06-2026)
1. **Hamburger menu no abría dropdown**: `<script>` eliminado de `index.astro` dejó CERO entry points para `app.ts`. Fix: restaurar `<script>` en `index.astro` + eliminar auto-execute de `app.ts` (había double-call).
2. **Bidirectional engine invertido**: `sInp.addEventListener` llamaba `vToS` en vez de `sToV`, así que cambiar series sobreescribía el valor. Fix: swap correcto de las 4 funciones en listeners.

---

## Features por implementar

### 🔴 Alta prioridad

- [x] **F1 — Custom Cell Input completo** ✅
  - ✅ `Cell` interface actualizada con `pw`, `pd`, `pulseAmp`, `chargeAmp`, `formFactor`
  - ✅ Toggle UI "Cilíndrica / Prismática" con inputs separados (`c-prism-w`, `c-prism-d`, `c-len-p`)
  - ✅ `pack-builder.ts` — BoxGeometry para prismática, CylinderGeometry para cilíndrica
  - ✅ Grid spacing usa `pw × pd` pitch para prismática vs `d × d` para cilíndrica
  - ✅ Presets guardan `formFactor` y dimensiones correctas por tipo
  - ✅ Simulación usa `pw` para strip resistance en prismáticas
  - ✅ Reverse lookup maneja presets prismáticos

- [x] **F2 — Chemistry Master Switch** ✅
  - ✅ `applyChemPreset()` en `ui.ts:272` — autocompleta min/nom/max por química (NMC 2.5/3.6/4.2V, LFP 2.5/3.2/3.65V, LTO 1.5/2.4/2.8V, Na-Ion 1.5/3.0/4.0V)
  - ✅ `showChemWarning()` en `ui.ts:302` — banner `#chem-warning` en ChemistrySection.astro:28-31
  - ✅ `sys-cutoff` se clampa si queda fuera del rango de la química seleccionada
  - Pendiente: BMS target validation (F11)

- [x] **F3/F4 — Motor Bidireccional** ✅
  - ✅ Nuevo módulo `electrical-engine.ts` — S↔V y P↔Ah sync en tiempo real
  - ✅ Anti-loop via `activeField` tracking + `setTimeout(150ms)` reset
  - ✅ Inputs `target-v` y `target-ah` en PackConfigSection.astro (sección "Target Mode (bidirectional)")
  - ✅ "Pack Current" y "Cell Current (I/P)" en StatsPanel.astro:32-46
  - ✅ `getI()`, `getCellI()`, `renderCurrentStats()` en simulation.ts:14-22
  - Corregido: funciones estaban invertidas en listeners (sInp → vToS en vez de sToV)

- [x] **F5 — Modo Generativo por Objetivo** ✅
  - ✅ Inputs `gen-target-v` y `gen-target-ah` en Generative Mode subsection de PackConfigSection.astro
  - ✅ Algoritmo: `S = ceil(targetV / cellNomV)`, `P = ceil(targetAh / cellAh)`, fallback +1S si cellMin < LVC
  - ✅ Botón "Generate Configuration" que escribe en `s-count` y `p-count` y dispara `updatePack()`
  - ✅ Sincroniza campos bidireccionales `target-v` y `target-ah`
  - ✅ Feedback text mostrando resultado: "Generated Xs × Yp = Z cells (V, Ah)"

- [x] **F6 — Voltage Sag semafórico** ✅
  - ✅ `checkVoltageSag()` en `safety-indicators.ts:116` — compara `vNet` vs `cutoff × S`
  - ✅ Semáforo: 🟢 OK / 🟡 LVC Cercano (dentro 10%) / 🔴 HIT LVC
  - ✅ Indicador "Time-to-cutoff" con estimación vía binary search sobre OCV curve
  - ✅ UI en `SafetyChecks` panel debajo deSimulationSection.astro

- [ ] **F7 — Algoritmos Heurísticos 2D**
  - Modo actual: hex-mode (checkbox) + ladder — falta Fill Ratio explícito
  - Calcular: `fillRatio = (n × π × d²/4) / (width × depth)`
  - Comparar densidades teóricas: `π/4 ≈ 0.785` (square) vs `π√3/6 ≈ 0.907` (hex)
  - Auto-rotación 90° si fill ratio es mejor en la otra orientación
  - Mostrar "celdas fuera de límite" cuando el contenedor es insuficiente

- [x] **F10a — Tabla de Ampacity** ✅
  - ✅ Tabla empírica 6 entradas en `safety-indicators.ts:18-25`: `[(0.10×5), (0.10×7), (0.15×7), (0.15×8), (0.20×7), (0.30×7)]`
  - ✅ Cada entrada: `optimalA` / `maxA` / `poorA`
  - ✅ Semáforo: 🟢 < optimal / 🟡 optimal..max / 🔴 > max
  - ✅ `checkAmpacity()` compara contra `I_total / P` (corriente por segmento serie)

- [x] **F10b — Regla de Micah Toll** ✅
  - ✅ Heurística: 0.15mm × 8mm = 5A continuos seguros en `safety-indicators.ts:74-76`
  - ✅ `checkMicahToll()` deratea proporcionalmente por área del strip
  - ✅ Alerta roja si ratio > 1.0, amarilla si > 0.8

- [x] **F11 — Selección BMS**
  - DB local de BMS: `[{name, sCount, chem[], maxA, balanceType, profiles[]}]`
  - Match por: S count (exacto o rango programable 8S-24S), química, corriente (con margen 20-30%)
  - Output: "BMS Recomendado: Daly 13S 60A (LFP, Smart)"

- [ ] **F11b — Custom BMS (BMS Personalizado)**
  - Opción "Custom BMS" en el selector de BMS para crear hardware no listado en la DB
  - Inputs requeridos:
    - `bms-name` (texto libre, ej. "DIY JK-Pareo 14S")
    - `bms-s-min` / `bms-s-max` (rango programable, ej. 8-24S)
    - `bms-max-a` (corriente nominal de los MOSFETs, ej. 60A)
    - `bms-chem[]` (multi-select: NMC/LFP/LTO/Na-Ion/NiMH) — si vacío = "cualquier química"
    - `bms-balance-type` (radio: pasivo / activo-capacitivo / activo-inductivo / sin balanceo)
    - `bms-v-cutoff-charge` / `bms-v-cutoff-discharge` (Voltajes de corte por celda, ej. 4.2V / 2.8V)
    - `bms-w` / `bms-d` / `bms-h` (bounding box físico en mm — alimenta F13)
    - `bms-protocol` (Bluetooth/UART/CAN/SMBus — solo metadata informativa)
    - `bms-is-smart` (checkbox — si true, permite match por rango, no exacto)
  - Persistencia: `localStorage.setItem('batt_custom_bms', JSON.stringify([...]))`
  - Validación: aplicar los 3 vectores de F12 también al custom BMS (especialmente V2 electroquímica)
  - Advertencia: "BMS Custom — verifique datasheet; BCA Tool no asume responsabilidad por hardware no certificado"
  - Botón "Guardar como preset reutilizable" en la misma fila de la DB estándar
  - Exportar/importar JSON de la DB custom (compartir setups entre usuarios)

- [x] **F12 — Vectores de Validación BMS**
  - Vector 1: Concordancia S (bloquear BMS 13S con pack 14S, permitir Smart BMS programable)
  - Vector 2: Exclusión electroquímica (BMS LFP 3.65V ↛ NMC 4.2V)
  - Vector 3: MOSFET 20-30% sobre I_max + recomendación balance activo (capacitivo/inductivo 2-5A) para pack > 20Ah

- [ ] **F11b — Agregar BMS custom**
  - Botón "+ Agregar BMS" en el selector de F11 abre un modal con formulario
  - Campos: `name`, `sCount` (rango programable ej. 8S-24S o fijo), `chem[]` (multi-select), `maxA` (corriente continua), `balanceType` (pasivo/activo/sin balance), `profiles[]` (Smart programable, Bluetooth, UART, etc.), `bms-w / bms-d / bms-h` (mm) para F13
  - Persistir en `localStorage` bajo namespace `bca:bms:custom` como array JSON
  - Validar en tiempo real contra vectores de F12 al crear (mostrar 🟢/🟡/🔴 por campo)
  - Listar BMS custom con badge "Custom" en el dropdown de F11, separados de los comerciales
  - Acciones: editar, duplicar, eliminar (con confirmación)
  - Exportar/importar JSON de la DB custom (compartir setups entre usuarios)

- [ ] **F15a — Proyección 2D SVG**
  - Renderizar vista cenital del packGroup como SVG (no Three.js)
  - Color por grupo paralelo (envolventes diferenciadas)
  - Flechas vectoriales indicando dirección de corriente en serie
  - Click sobre celda resalta y muestra info

- [ ] **F15b — Export PDF 1:1 con jsPDF**
  - Instalar: `pnpm add jspdf`
  - Generar PDF vectorial embebiendo SVG vía `doc.addSvgAsImage` o vectorización nativa con `svg2pdf.js`
  - Fragmentación automática en A4/Carta con marcas de registro en cada tile
  - Cuadrícula de páginas con overlap para unión física

- [ ] **DOC — Guía de dependencias y orden**
  - Listar paquetes a instalar y orden de implementación
  - Decidir si F15b usa `jspdf` puro o `svg2pdf.js` (ver tradeoff)

### 🟡 Prioridad media

- [ ] **F8a — Tolerancia de Pitch 21.2 vs 21.7mm**
  - Dropdown "Origen de celda" (Tier 1 / Genérica China)
  - Si 21700 + origen China → `c-spacing` mínimo = 0.5mm; Tier 1 → 0.2mm
  - Alerta: "0.5mm × 200 celdas = 100mm desviación acumulada" si spacing es subdimensionado

- [ ] **F8b — Barley Paper**
  - Checkbox "Incluir papel de cebada" + input `barley-thickness` (default 0.2mm)
  - Sumar al `h` (altura física) y notificar que reduce holgura axial

- [ ] **F9 — Materiales Interconector UI**
  - Ya existe `sim-strip-mat`; falta:
    - Tooltip con resistividad (Ni 7.0, Cu 1.7, Steel 14.0 ×10⁻⁸ Ωm)
    - Alerta visual si Steel + corriente > 30A → "Riesgo térmico elevado"
    - Color automático del busbar por material (ya implementado parcialmente en `pack-builder.ts:368-373`)

- [ ] **F10c — Recomendaciones automáticas de tira**
  - Trigger cuando ampacity excedida
  - Sugerencia 1: "Subir a 0.30mm × 7mm (15A continuos)"
  - Sugerencia 2: "Aplicar laminación doble: 2× 0.15mm × 8mm (10A compartidos)"

- [ ] **F10d — BOM metraje lineal**
  - Calcular `nickelMetersTotal = nickelInPack + ladderOverhead + wasteFactor (15%)`
  - Exportar a CSV/JSON en BOM modal

- [ ] **F13 — Geometría BMS Bounding Box**
  - Inputs `bms-w / bms-d / bms-h` (mm)
  - Renderizar prisma translúcido en 3D junto al pack
  - Detección de interferencia: si la caja intersecta con carcasa → marcar en rojo y sugerir offset (x,y,z)
  - Dropdown de BMS comerciales (ANT, Daly, Xuanjing) con dimensiones pre-cargadas

- [ ] **F15c — Spot Welding Template**
  - Sobre la proyección SVG: añadir marcas circulares (Ø3mm) en cada punto de soldadura previsto
  - Polaridad (+/-) marcada con color
  - Cruz central para alineación en taller

- [ ] **F16 — Monitor Diagnóstico Semafórico**
  - Panel lateral derecho (nuevo componente `DiagnosticMonitor.astro`)
  - Estado global: Verde / Amarillo / Rojo según peor métrica
  - Métricas: Voltage Sag % vs LVC, Joule Heat % vs límite térmico, Ampacity % por segmento

### 🟢 Baja prioridad

- [ ] **F14 — Documentar arquitectura gráfica**
  - Confirmar que `Three.js` cubre el 3D y que `SVG` nativo cubrirá el 2D (no necesitamos segunda librería 3D)
  - Documentar decisión: `Three.js` para render interactivo + `SVG` inline para proyección 2D → una sola fuente geométrica

- [ ] **F15d — Export .STEP**
  - Investigar `three-step`, `occt-import-js`, o `STEP-NC` exporter
  - Solo exportar espaciadores (celdas y busbars ya van en STL)
  - Output: archivo `.step` listo para Fusion 360 / SolidWorks

- [ ] **ARQUITECTURA — nanostores**
  - Evaluar si necesitamos `nanostores` para compartir estado entre islas React
  - Actualmente todo el estado vive en `packState` (singleton) en `pack-builder.ts`; no parece haber islas múltiples compitiendo
  - Decisión: probablemente no necesario en este proyecto, pero documentar el patrón por si se agrega un panel React pesado

---

## Dependencias sugeridas

| Feature | Paquete | Notas |
|---|---|---|
| F15b PDF | `jspdf` (+ opcional `svg2pdf.js`) | Vectorial si se usa `svg2pdf.js`, raster si se usa `addSvgAsImage` |
| F15d STEP | `three-step` o `occt-import-js` | Investigar antes de elegir; `occt-import-js` es más maduro |
| F13 BMS box | (ninguna nueva) | Usar `THREE.BoxGeometry` translúcido existente |
| ARQUITECTURA | `nanostores` + `@nanostores/react` | Solo si F11/F16 introducen islas React |

## Orden de implementación sugerido

1. **F2 + F3/F4** (consolidar motor eléctrico — base para todo lo demás) ✅ COMPLETADO
2. **F5** (modo generativo — desbloquea uso real) ✅ COMPLETADO
3. **F6 + F10a + F10b** (semáforos de seguridad — son el "cerebro de validación" del proyecto) ✅ COMPLETADO
4. **F1** (completar entrada de celda, incluyendo prismáticas) ← SIGUIENTE
5. ~~**F11 + F12** (BMS recommendation con vectores)~~
6. **F15a + F15b + F15c** (export 2D/PDF — output tangible para el taller)
7. **F8a/F8b** (tolerancias reales — son detalle fino de calidad)
8. **F9 + F10c + F10d** (materiales y BOM)
9. **F13 + F16** (visualización de BMS y monitor diagnóstico)
10. **F15d** (STEP — nice-to-have para integración CAD)
